'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Bank {
  id: number
  name: string
  description: string
  question_count: number
  created_at: string
  attempted: boolean
  attemptCount: number
  bestRate: number
}

export default function BanksPage() {
  const router = useRouter()
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    Promise.all([fetchBanks(), fetchUser()])
  }, [])

  async function fetchBanks() {
    const res = await fetch('/api/banks')
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    setBanks(data.banks || [])
    setLoading(false)
  }

  async function fetchUser() {
    const res = await fetch('/api/auth/login', { method: 'GET' })
    // 用一个简单的 GET 检查登录态 — 这里简单处理
    // 实际可加 /api/auth/me 接口
  }

  function handleLogout() {
    document.cookie = 'token=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-indigo-600">📝 刷题平台</h1>
          <div className="flex items-center gap-4">
            <a href="/leaderboard" className="text-gray-600 hover:text-indigo-600 transition text-sm">🏆 排行榜</a>
            <a href="/admin/users" className="text-gray-600 hover:text-indigo-600 transition text-sm">⚙️ 管理</a>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500 transition">退出</button>
          </div>
        </div>
      </nav>

      {/* 题库列表 */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">题库列表</h2>

        {loading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : banks.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">📚</p>
            <p>暂无题库，请联系管理员上传</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {banks.map(bank => (
              <div
                key={bank.id}
                onClick={() => router.push(`/banks/${bank.id}`)}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition cursor-pointer p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg text-gray-800 line-clamp-2">{bank.name}</h3>
                  {bank.attempted && (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                      已刷
                    </span>
                  )}
                </div>

                {bank.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{bank.description}</p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>📋 {bank.question_count} 题</span>
                  {bank.attempted && (
                    <span className="text-indigo-600 font-medium">
                      最佳 {Math.round(bank.bestRate * 100)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
