import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY 未配置' }, { status: 500 })

  let body
  try {
    body = await req.json() as {
      model?: string
      messages?: Array<{ role: string; content: string }>
      temperature?: number
      max_tokens?: number
    }
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
  }

  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages 不能为空' }, { status: 400 })
  }

  const requestBody = JSON.stringify({
    model: body.model || 'deepseek-chat',
    messages: body.messages,
    temperature: body.temperature ?? 0.1,
    max_tokens: body.max_tokens ?? 8192,
  })

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: requestBody,
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: `AI 代理请求失败: ${err.message || '未知错误'}` }, { status: 502 })
  }
}
