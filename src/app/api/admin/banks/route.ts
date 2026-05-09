import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { parsePdfWithAI } from '@/lib/ai'

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

// 上传PDF → AI解析 → 创建题库
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  await initDb()
  const db = getDb()

  const { name, description, pdfText } = await req.json()

  if (!name || !pdfText) {
    return NextResponse.json({ error: '题库名称和PDF文本内容不能为空' }, { status: 400 })
  }

  // 调用 DeepSeek 解析
  let parsed
  try {
    parsed = await parsePdfWithAI(pdfText)
  } catch (err: any) {
    return NextResponse.json({ error: `AI解析失败: ${err.message}` }, { status: 500 })
  }

  if (!parsed.questions || parsed.questions.length === 0) {
    return NextResponse.json({ error: '未能从PDF中提取到任何题目' }, { status: 400 })
  }

  // 创建题库
  const bankResult = await db.execute({
    sql: 'INSERT INTO question_banks (name, description, question_count, created_by) VALUES (?, ?, ?, ?)',
    args: [name, description || '', parsed.questions.length, admin.id]
  })
  const bankId = Number(bankResult.lastInsertRowid)

  // 批量插入题目
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i]
    await db.execute({
      sql: `INSERT INTO questions (bank_id, type, stem, options_json, answer, explanation, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        bankId,
        q.type || 'single',
        q.stem,
        JSON.stringify(q.options || []),
        q.answer,
        q.explanation || '',
        i
      ]
    })
  }

  return NextResponse.json({
    success: true,
    bank: { id: bankId, name, questionCount: parsed.questions.length }
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
