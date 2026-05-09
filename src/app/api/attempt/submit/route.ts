import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'edge'

interface AnswerDetail {
  questionId: number
  selected: string
  correct: boolean
  timeMs: number
}

// 提交答题记录
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  await initDb()
  const db = getDb()

  const { bankId, answers } = await req.json() as {
    bankId: number
    answers: AnswerDetail[]
  }

  if (!bankId || !answers || !Array.isArray(answers)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 })
  }

  const correctCount = answers.filter(a => a.correct).length
  const totalTimeMs = answers.reduce((sum, a) => sum + a.timeMs, 0)

  const result = await db.execute({
    sql: `INSERT INTO attempt_records (user_id, bank_id, total_questions, correct_count, total_time_ms, detail_json)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      user.id,
      bankId,
      answers.length,
      correctCount,
      totalTimeMs,
      JSON.stringify(answers)
    ]
  })

  return NextResponse.json({
    success: true,
    record: {
      id: Number(result.lastInsertRowid),
      totalQuestions: answers.length,
      correctCount,
      totalTimeMs,
      accuracy: Math.round((correctCount / answers.length) * 100),
    }
  })
}
