'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  username: string
  nickname: string
  role: string
  created_at: string
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', nickname: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const res = await fetch('/api/admin/users')
    if (res.status === 403) { router.push('/banks'); return }
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setSuccess(`用户 ${form.nickname} 创建成功`)
    setForm({ username: '', password: '', nickname: '' })
    setShowAdd(false)
    loadUsers()
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`确定删除用户 "${name}" ？`)) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadUsers()
  }

  async function handleResetPwd(id: number) {
    const newPassword = prompt('请输入新密码:')
    if (!newPassword) return
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, newPassword }),
    })
    alert('密码已重置')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/banks" className="text-gray-500 hover:text-indigo-600 transition">← 返回</a>
          <h1 className="text-xl font-bold text-gray-800">👥 用户管理</h1>
          <a href="/admin/banks" className="text-sm text-gray-500 hover:text-indigo-600 transition ml-auto">📚 题库管理</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && <p className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</p>}
        {success && <p className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{success}</p>}

        {/* 添加用户 */}
        <div className="mb-6">
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm"
            >
              + 添加用户
            </button>
          ) : (
            <form onSubmit={handleAdd} className="bg-white rounded-xl border p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">用户名</label>
                  <input
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">密码</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">昵称</label>
                  <input
                    value={form.nickname}
                    onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
                  确认添加
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="text-gray-500 px-4 py-2 text-sm">
                  取消
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 用户列表 */}
        {loading ? (
          <p className="text-center text-gray-400 py-10">加载中...</p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{u.nickname}</span>
                    {u.role === 'admin' && (
                      <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">管理员</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">@{u.username}</p>
                </div>
                <button
                  onClick={() => handleResetPwd(u.id)}
                  className="text-xs text-gray-500 hover:text-indigo-600 transition"
                >
                  重置密码
                </button>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => handleDelete(u.id, u.nickname)}
                    className="text-xs text-gray-500 hover:text-red-500 transition"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
