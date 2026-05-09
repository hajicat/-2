import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'edge'

// 获取题目（开始刷题）
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const bankId = req.nextUrl.searchParams.get('bankId')
  if (!bankId) return NextResponse.json({ error: '缺少 bankId' }, { status: 400 })

  await initDb()
  const db = getDb()

  const questions = await db.execute({
    sql: 'SELECT id, type, stem, options_json, sort_order FROM questions WHERE bank_id = ? ORDER BY sort_order',
    args: [parseInt(bankId)]
  })

  return NextResponse.json({
    questions: questions.rows.map(q => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: JSON.parse(q.options_json as string || '[]'),
      sortOrder: q.sort_order,
    }))
  })
}
