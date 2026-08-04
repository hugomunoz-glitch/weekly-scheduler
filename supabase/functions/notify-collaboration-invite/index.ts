import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://weekly-scheduler-woad.vercel.app'

serve(async (req) => {
  try {
    const { email, code, collaborationName } = await req.json()

    if (!email || !code) {
      return new Response('missing email or code', { status: 400 })
    }

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">
    <p style="font-size:24px;margin:0 0 4px">🎯 Schedulent</p>
    <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px">You've been invited to collaborate</h1>
    <p style="color:#374151;margin:0 0 16px">You've been invited to join <strong>${collaborationName}</strong> on Schedulent.</p>
    <p style="color:#374151;margin:0 0 8px">Use this invite code when you sign up or join:</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;margin:0 0 20px">
      <span style="font-family:monospace;font-size:28px;font-weight:700;letter-spacing:4px;color:#111827">${code}</span>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
      <a href="${APP_URL}/signup" style="display:inline-block;background:#6366f1;color:white;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">Create an account</a>
      <a href="${APP_URL}" style="display:inline-block;background:#f3f4f6;color:#374151;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">I already have an account</a>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin:0">Enter the invite code above when signing up or in the Collaborations panel. If you didn't expect this invitation, you can safely ignore this email.</p>
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
        from: 'Schedulent <onboarding@resend.dev>',
        to: [email],
        subject: `You've been invited to join ${collaborationName} on Schedulent`,
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
