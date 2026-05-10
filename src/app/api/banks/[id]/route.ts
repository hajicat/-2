import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { id } = await params
  const bankId = parseInt(id)
  if (isNaN(bankId)) {
    return NextResponse.json({ error: '无效的题库ID' }, { status: 400 })
  }

  await initDb()
  const db = getDb()

  // 题库信息
  const bank = await db.execute({
    sql: 'SELECT * FROM question_banks WHERE id = ?',
    args: [bankId]
  })
  if (bank.rows.length === 0) {
    return NextResponse.json({ error: '题库不存在' }, { status: 404 })
  }

  // 所有题目
  const questions = await db.execute({
    sql: 'SELECT id, type, stem, options_json, explanation, difficulty, sort_order FROM questions WHERE bank_id = ? ORDER BY sort_order',
    args: [bankId]
  })

  // 用户在此题库的历史记录
  const records = await db.execute({
    sql: `SELECT id, correct_count, total_questions, total_time_ms, created_at
          FROM attempt_records WHERE user_id = ? AND bank_id = ? ORDER BY created_at DESC LIMIT 10`,
    args: [user.id, bankId]
  })

  // 排行榜（此题库最佳成绩）
  const leaderboard = await db.execute({
    sql: `SELECT u.nickname, ar.correct_count, ar.total_questions, ar.total_time_ms, ar.created_at
          FROM attempt_records ar JOIN users u ON ar.user_id = u.id
          WHERE ar.bank_id = ?
          AND ar.id IN (
            SELECT MAX(id) FROM attempt_records GROUP BY user_id
          )
          ORDER BY (ar.correct_count * 1.0 / ar.total_questions) DESC, ar.total_time_ms ASC
          LIMIT 20`,
    args: [bankId]
  })

  return NextResponse.json({
    bank: bank.rows[0],
    questions: questions.rows.map(q => ({
      ...q,
      options: JSON.parse(q.options_json as string || '[]'),
    })),
    records: records.rows,
    leaderboard: leaderboard.rows,
  })
}
