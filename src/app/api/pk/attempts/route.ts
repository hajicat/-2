import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'edge'

// 获取某个用户的某题库的答题记录（用于影子模式）
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId')
  const bankId = req.nextUrl.searchParams.get('bankId')

  if (!userId || !bankId) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 })
  }

  await initDb()
  const db = getDb()

  // 获取目标用户的最佳记录
  const result = await db.execute({
    sql: `SELECT id, correct_count, total_questions, total_time_ms, detail_json, created_at
          FROM attempt_records
          WHERE user_id = ? AND bank_id = ?
          ORDER BY (correct_count * 1.0 / total_questions) DESC, total_time_ms ASC
          LIMIT 1`,
    args: [parseInt(userId), parseInt(bankId)]
  })

  if (result.rows.length === 0) {
    return NextResponse.json({ error: '该用户无此题库的答题记录' }, { status: 404 })
  }

  const record = result.rows[0]
  const detail = JSON.parse(record.detail_json as string || '[]')

  // 累积时间轴（用于影子模式动画）
  let cumTime = 0
  const timeline = detail.map((d: any, i: number) => {
    cumTime += d.timeMs
    return {
      index: i,
      cumTimeMs: cumTime,
      correct: d.correct,
      questionId: d.questionId,
    }
  })

  return NextResponse.json({
    record: {
      id: record.id,
      nickname: '', // 前端已有
      correctCount: record.correct_count,
      totalQuestions: record.total_questions,
      totalTimeMs: record.total_time_ms,
      createdAt: record.created_at,
    },
    timeline,
  })
}
