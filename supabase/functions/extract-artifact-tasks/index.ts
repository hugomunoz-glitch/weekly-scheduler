import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url, title, notes, content } = await req.json()
    if (!title) return new Response(JSON.stringify({ error: 'missing title' }), { status: 400, headers: corsHeaders })

    // Use pasted content if available, otherwise try fetching the URL
    let pageText = ''
    if (content && content.trim()) {
      pageText = content.trim().slice(0, 12000)
    } else if (url) {
      try {
        const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        const html = await pageRes.text()
        pageText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 12000)
      } catch {
        pageText = `Title: ${title}\nNotes: ${notes || 'none'}`
      }
    } else {
      pageText = `Title: ${title}\nNotes: ${notes || 'none'}`
    }

    const prompt = `You are extracting actionable items from a plan or document that a coach or collaborator shared.

Document title: "${title}"
${notes ? `Notes: "${notes}"` : ''}

Document content:
${pageText}

Extract all actionable tasks and goals from this content. For each item:
- Decide if it's a GOAL (a larger objective, outcome, or milestone) or a TASK (a specific action to take)
- Give it a clear, concise title
- Add a brief description if helpful (1 sentence max)
- Suggest a due date if one is mentioned or implied (ISO format YYYY-MM-DD), otherwise null
- For tasks, suggest a bucket: "morning", "afternoon", or "evening" if time of day is implied, otherwise null

Return ONLY valid JSON in this exact format, no other text:
{
  "items": [
    {
      "type": "goal",
      "title": "string",
      "description": "string or null",
      "dueDate": "YYYY-MM-DD or null"
    },
    {
      "type": "task",
      "title": "string",
      "description": "string or null",
      "dueDate": "YYYY-MM-DD or null",
      "bucket": "morning | afternoon | evening | null"
    }
  ]
}`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      console.error('Claude error:', err)
      return new Response(JSON.stringify({ error: 'extraction failed' }), { status: 500, headers: corsHeaders })
    }

    const claudeData = await claudeRes.json()
    const raw = claudeData.content?.[0]?.text ?? ''

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Try to extract JSON from the response if it has surrounding text
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { items: [] }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers: corsHeaders })
  }
})
