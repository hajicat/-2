import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { verifyPassword, createToken } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const db = getDb()
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 })
    }

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username]
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    const user = result.rows[0]
    const valid = await verifyPassword(password as string, user.password_hash as string)
    if (!valid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    const token = await createToken({
      id: user.id as number,
      username: user.username as string,
      role: user.role as string,
    })

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role }
    })

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '登录失败' }, { status: 500 })
  }
}
