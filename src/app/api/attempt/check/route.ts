import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'edge'

// 逐题验证答案（返回正确答案）
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  await initDb()
  const db = getDb()

  const { questionId, selected } = await req.json()

  if (!questionId) {
    return NextResponse.json({ error: '缺少 questionId' }, { status: 400 })
  }

  const result = await db.execute({
    sql: 'SELECT answer, explanation FROM questions WHERE id = ?',
    args: [questionId]
  })

  if (result.rows.length === 0) {
    return NextResponse.json({ error: '题目不存在' }, { status: 404 })
  }

  const correct = result.rows[0].answer as string
  const explanation = result.rows[0].explanation as string || ''

  return NextResponse.json({
    correct: selected === correct,
    answer: correct,
    explanation,
  })
}
