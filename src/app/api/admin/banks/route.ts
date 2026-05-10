import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'edge'

// 获取题库列表
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  await initDb()
  const db = getDb()
  const result = await db.execute(
    'SELECT * FROM question_banks ORDER BY created_at DESC'
  )
  return NextResponse.json({ banks: result.rows })
}

// 创建题库（支持服务端AI解析或前端预解析的题目）
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  await initDb()
  const db = getDb()

  const body = await req.json() as {
    name: string
    description?: string
    pdfText?: string
    questions?: Array<{
      type: string
      stem: string
      options: string[]
      answer: string
      explanation: string
      difficulty?: string
    }>
  }
  const { name, description, pdfText, questions } = body

  if (!name) {
    return NextResponse.json({ error: '题库名称不能为空' }, { status: 400 })
  }

  let finalQuestions = questions

  // 如果没有预解析的题目且有文本内容，走服务端AI解析（兼容旧流程）
  if (!finalQuestions && pdfText) {
    try {
      const { parsePdfWithAI } = await import('@/lib/ai')
      const parsed = await parsePdfWithAI(pdfText)
      finalQuestions = parsed.questions
    } catch (err: any) {
      return NextResponse.json({ error: `AI解析失败: ${err.message}` }, { status: 500 })
    }
  }

  if (!finalQuestions || finalQuestions.length === 0) {
    return NextResponse.json({ error: '没有可用的题目数据' }, { status: 400 })
  }

  // 创建题库
  const bankResult = await db.execute({
    sql: 'INSERT INTO question_banks (name, description, question_count, created_by) VALUES (?, ?, ?, ?)',
    args: [name, description || '', finalQuestions.length, admin.id]
  })
  const bankId = Number(bankResult.lastInsertRowid)

  // 批量插入题目
  for (let i = 0; i < finalQuestions.length; i++) {
    const q = finalQuestions[i]
    await db.execute({
      sql: `INSERT INTO questions (bank_id, type, stem, options_json, answer, explanation, difficulty, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        bankId,
        q.type || 'single',
        q.stem,
        JSON.stringify(q.options || []),
        q.answer,
        q.explanation || '',
        q.difficulty || '',
        i
      ]
    })
  }

  return NextResponse.json({
    success: true,
    bank: { id: bankId, name, questionCount: finalQuestions.length }
  })
}

// 删除题库
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  await initDb()
  const db = getDb()
  const { id } = await req.json()

  await db.execute({ sql: 'DELETE FROM question_banks WHERE id = ?', args: [id] })
  return NextResponse.json({ success: true })
}
