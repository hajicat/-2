import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'edge'

// 全局排行榜
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  await initDb()
  const db = getDb()

  const bankId = req.nextUrl.searchParams.get('bankId')

  let sql: string
  let args: any[]

  if (bankId) {
    // 某个题库的排行榜（每个用户取最佳成绩）
    sql = `SELECT u.id as user_id, u.nickname,
            ar.correct_count, ar.total_questions, ar.total_time_ms,
            ROUND(ar.correct_count * 100.0 / ar.total_questions, 1) as accuracy,
            ar.created_at, ar.detail_json
          FROM attempt_records ar
          JOIN users u ON ar.user_id = u.id
          WHERE ar.bank_id = ?
            AND ar.id IN (
              SELECT MAX(id) FROM attempt_records WHERE bank_id = ? GROUP BY user_id
            )
          ORDER BY accuracy DESC, ar.total_time_ms ASC
          LIMIT 50`
    args = [parseInt(bankId), parseInt(bankId)]
  } else {
    // 全局排行榜（每个用户取总分最高的那次）
    sql = `SELECT u.id as user_id, u.nickname,
            ar.correct_count, ar.total_questions, ar.total_time_ms,
            ROUND(ar.correct_count * 100.0 / ar.total_questions, 1) as accuracy,
            ar.created_at, ar.detail_json
          FROM attempt_records ar
          JOIN users u ON ar.user_id = u.id
          WHERE ar.id IN (
            SELECT MAX(id) FROM attempt_records GROUP BY user_id
          )
          ORDER BY accuracy DESC, ar.total_time_ms ASC
          LIMIT 50`
    args = []
  }

  const result = await db.execute({ sql, args })

  return NextResponse.json({
    leaderboard: result.rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      nickname: r.nickname,
      correctCount: r.correct_count,
      totalQuestions: r.total_questions,
      totalTimeMs: r.total_time_ms,
      accuracy: r.accuracy,
      createdAt: r.created_at,
    }))
  })
}
