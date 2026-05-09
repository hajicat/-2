import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { requireAdmin, hashPassword } from '@/lib/auth'

export const runtime = 'edge'

// 获取用户列表
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  await initDb()
  const db = getDb()
  const result = await db.execute(
    'SELECT id, username, nickname, role, created_at FROM users ORDER BY id'
  )
  return NextResponse.json({ users: result.rows })
}

// 添加用户
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  await initDb()
  const db = getDb()
  const { username, password, nickname } = await req.json()

  if (!username || !password || !nickname) {
    return NextResponse.json({ error: '请填写完整信息' }, { status: 400 })
  }

  const exists = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [username]
  })
  if (exists.rows.length > 0) {
    return NextResponse.json({ error: '用户名已存在' }, { status: 400 })
  }

  const hash = await hashPassword(password)
  await db.execute({
    sql: 'INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, ?, ?)',
    args: [username, hash, nickname, 'user']
  })

  return NextResponse.json({ success: true })
}

// 删除用户
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  await initDb()
  const db = getDb()
  const { id } = await req.json()

  if (id === admin.id) {
    return NextResponse.json({ error: '不能删除自己' }, { status: 400 })
  }

  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] })
  return NextResponse.json({ success: true })
}

// 重置密码
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '无权限' }, { status: 403 })

  await initDb()
  const db = getDb()
  const { id, newPassword } = await req.json()

  if (!id || !newPassword) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 })
  }

  const hash = await hashPassword(newPassword)
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [hash, id]
  })

  return NextResponse.json({ success: true })
}
