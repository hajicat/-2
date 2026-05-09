import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const apiKey = process.env.DEEPSEEK_API_KEY
  const diagnostics: Record<string, any> = {
    deepseek_key_configured: !!apiKey,
    deepseek_key_prefix: apiKey ? apiKey.substring(0, 8) + '...' : '未设置',
    deepseek_url: 'https://api.deepseek.com/chat/completions',
  }

  // 测试1: DNS解析
  try {
    const dnsStart = Date.now()
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: '回复OK' }],
        max_tokens: 5,
        temperature: 0,
      }),
    })
    diagnostics.dns_test = { success: true, latency_ms: Date.now() - dnsStart }
    diagnostics.http_status = resp.status
    diagnostics.http_status_text = resp.statusText

    if (resp.ok) {
      const data = await resp.json()
      diagnostics.api_test = { success: true, response: data.choices?.[0]?.message?.content }
    } else {
      const errText = await resp.text()
      diagnostics.api_test = { success: false, error: errText }
    }
  } catch (err: any) {
    diagnostics.dns_test = { success: false, error: err.message, name: err.name }
  }

  // 测试2: 网络连通性
  try {
    const testResp = await fetch('https://httpbin.org/get', { method: 'GET' })
    diagnostics.outbound_test = { success: testResp.ok, status: testResp.status }
  } catch (err: any) {
    diagnostics.outbound_test = { success: false, error: err.message }
  }

  return NextResponse.json(diagnostics)
}
