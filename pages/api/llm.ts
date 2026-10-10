// Free LLM access via GitHub Models: https://docs.github.com/en/github-models
// Requires a GitHub personal access token with the `models:read` permission,
// provided as GITHUB_TOKEN in .env.local (see .env.example).
import type { NextApiRequest, NextApiResponse } from 'next'

const ENDPOINT = 'https://models.github.ai/inference/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4.1-mini'
const MAX_PROMPT_CHARS = 8000

type Body = {
  prompt?: unknown
  system?: unknown
  model?: unknown
}

type Data = { text: string } | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN is not set' })
  }

  const body = (req.body || {}) as Body
  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return res.status(400).json({ error: 'prompt must be a non-empty string' })
  }
  if (body.prompt.length > MAX_PROMPT_CHARS) {
    return res.status(400).json({ error: `prompt exceeds ${MAX_PROMPT_CHARS} characters` })
  }

  const messages = [
    ...(typeof body.system === 'string' ? [{ role: 'system', content: body.system }] : []),
    { role: 'user', content: body.prompt },
  ]

  let upstream: Response
  try {
    upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: typeof body.model === 'string' ? body.model : DEFAULT_MODEL,
        messages,
      }),
    })
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach GitHub Models' })
  }

  if (!upstream.ok) {
    const detail = await upstream.text()
    return res.status(upstream.status).json({ error: `GitHub Models request failed: ${detail}` })
  }

  const data = (await upstream.json()) as {
    choices?: { message?: { content?: string | null } }[]
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  return res.status(200).json({ text })
}
