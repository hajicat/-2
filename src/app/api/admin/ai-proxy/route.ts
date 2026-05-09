import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY 未配置' }, { status: 500 })

  const body = await req.json() as {
    model?: string
    messages?: Array<{ role: string; content: string }>
    temperature?: number
    max_tokens?: number
  }

  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages 不能为空' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model || 'deepseek-chat',
        messages: body.messages,
        temperature: body.temperature ?? 0.1,
        max_tokens: body.max_tokens ?? 8192,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errText = await response.text().catch(() => '无法读取错误响应')
      return NextResponse.json({ error: `DeepSeek API 错误 (${response.status}): ${errText}` }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'DeepSeek 返回内容为空' }, { status: 502 })
    }

    return NextResponse.json({ success: true, content })
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'AI 请求超时（120秒），请尝试减少题库内容后重试' }, { status: 504 })
    }
    return NextResponse.json({ error: `AI 代理请求失败: ${err.message || '未知错误'}` }, { status: 502 })
  }
}
