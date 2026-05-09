import { NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'edge'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  await initDb()
  const db = getDb()

  const banks = await db.execute(
    'SELECT id, name, description, question_count, created_at FROM question_banks ORDER BY created_at DESC'
  )

  // 获取每个题库的做题记录数
  const records = await db.execute({
    sql: `SELECT bank_id, COUNT(*) as count, MAX(correct_count * 1.0 / total_questions) as best_rate
          FROM attempt_records WHERE user_id = ? GROUP BY bank_id`,
    args: [user.id]
  })

  const recordMap = new Map<number, { count: number; bestRate: number }>()
  for (const r of records.rows) {
    recordMap.set(r.bank_id as number, {
      count: r.count as number,
      bestRate: r.best_rate as number || 0,
    })
  }

  return NextResponse.json({
    banks: banks.rows.map(b => ({
      ...b,
      attempted: recordMap.has(b.id as number),
      attemptCount: recordMap.get(b.id as number)?.count || 0,
      bestRate: recordMap.get(b.id as number)?.bestRate || 0,
    }))
  })
}
