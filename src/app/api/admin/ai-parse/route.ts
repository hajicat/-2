import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY 未配置' }, { status: 500 })

  let body
  try {
    body = await req.json() as {
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

  await initDb()
  const db = getDb()

  const jobResult = await db.execute({
    sql: 'INSERT INTO ai_jobs (user_id, status) VALUES (?, ?)',
    args: [admin.id, 'pending']
  })
  const jobId = Number(jobResult.lastInsertRowid)

  const ctx = getRequestContext()
  ctx.waitUntil(processJob(jobId, apiKey, body))

  return NextResponse.json({ jobId })
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('id')
  if (!jobId) return NextResponse.json({ error: '缺少 job id' }, { status: 400 })

  await initDb()
  const db = getDb()

  const result = await db.execute({
    sql: 'SELECT * FROM ai_jobs WHERE id = ? AND user_id = ?',
    args: [parseInt(jobId), admin.id]
  })

  if (result.rows.length === 0) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 })
  }

  const job = result.rows[0]
  return NextResponse.json({
    id: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
  })
}

async function processJob(
  jobId: number,
  apiKey: string,
  body: { messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number }
) {
  try {
    const db = getDb()

    await db.execute({
      sql: "UPDATE ai_jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ?",
      args: [jobId]
    })

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: body.messages,
        temperature: body.temperature ?? 0.1,
        max_tokens: body.max_tokens ?? 8192,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data)
      throw new Error(`DeepSeek API 错误: ${errMsg}`)
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek 返回内容为空')

    await db.execute({
      sql: "UPDATE ai_jobs SET status = 'done', result = ?, updated_at = datetime('now') WHERE id = ?",
      args: [content, jobId]
    })
  } catch (err: any) {
    const db = getDb()
    await db.execute({
      sql: "UPDATE ai_jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?",
      args: [err.message || '未知错误', jobId]
    })
  }
}
