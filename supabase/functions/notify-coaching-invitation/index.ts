import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://schedulent.app'

serve(async (req) => {
  try {
    const payload = await req.json()

    // Supabase database webhooks send { type, table, record, old_record }
    if (payload.type !== 'INSERT' || payload.table !== 'coach_invitations') {
      return new Response('ignored', { status: 200 })
    }

    const invitation = payload.record
    if (!invitation || invitation.status !== 'pending') {
      return new Response('ignored', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Resolve coach username
    const { data: coach } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', invitation.coach_id)
      .single()

    const coachName = coach?.username ?? 'Someone'

    // Resolve recipient email — either from invitee_id lookup or the stored invitee_email
    let recipientEmail: string | null = invitation.invitee_email ?? null
    let recipientName = 'there'

    if (!recipientEmail && invitation.invitee_id) {
      const { data: invitee } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', invitation.invitee_id)
        .single()

      if (invitee?.username) recipientName = invitee.username

      // Look up their auth email via the service-role admin API
      const { data: { user } } = await supabase.auth.admin.getUserById(invitation.invitee_id)
      recipientEmail = user?.email ?? null
    }

    if (!recipientEmail) {
      console.warn('No email address found for invitation', invitation.id)
      return new Response('no recipient email', { status: 200 })
    }

    const messageSnippet = invitation.message
      ? `<p style="color:#6b7280;font-style:italic;margin:0 0 16px">"${invitation.message}"</p>`
      : ''

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">
    <p style="font-size:24px;margin:0 0 4px">🎯 Schedulent</p>
    <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px">You have a coaching invitation</h1>
    <p style="color:#374151;margin:0 0 16px">Hi ${recipientName}, <strong>${coachName}</strong> has invited you to be coached on Schedulent.</p>
    ${messageSnippet}
    <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:white;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">Open Schedulent to respond</a>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">You can accept or decline inside the Collaborations panel. If you didn't expect this invitation, you can safely ignore this email.</p>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Schedulent <notifications@schedulent.app>',
        to: [recipientEmail],
        subject: `${coachName} wants to coach you on Schedulent`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend error:', res.status, body)
      return new Response('email send failed', { status: 500 })
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Function error:', err)
    return new Response('internal error', { status: 500 })
  }
})
