'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface LeaderboardEntry {
  rank: number
  userId: number
  nickname: string
  correctCount: number
  totalQuestions: number
  totalTimeMs: number
  accuracy: number
  createdAt: string
}

export default function LeaderboardPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    const res = await fetch('/api/leaderboard')
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    setEntries(data.leaderboard || [])
    setLoading(false)
  }

  function fmtTime(ms: number) {
    const secs = Math.floor(ms / 1000)
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins}:${s.toString().padStart(2, '0')}`
  }

  function handleChallenge(entry: LeaderboardEntry) {
    // 跳转到题库列表，选择后进入影子模式
    // 这里简化：跳到 banks 页面，带上 shadow 参数提示
    router.push(`/banks?shadow=${entry.userId}&name=${encodeURIComponent(entry.nickname)}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/banks" className="text-gray-500 hover:text-indigo-600 transition">← 返回</a>
          <h1 className="text-xl font-bold text-gray-800">🏆 排行榜</h1>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">🏆</p>
            <p>暂无记录，快去刷题吧！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div
                key={entry.userId}
                className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 ${
                  i < 3 ? 'border-amber-200 bg-amber-50/30' : ''
                }`}
              >
                {/* 排名 */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                  style={{
                    background: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : i === 2 ? '#f59e0b' : '#f3f4f6',
                    color: i < 3 ? '#fff' : '#6b7280',
                  }}
                >
                  {entry.rank}
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{entry.nickname}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.correctCount}/{entry.totalQuestions} 正确 · 用时 {fmtTime(entry.totalTimeMs)}
                  </p>
                </div>

                {/* 正确率 */}
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-indigo-600">{entry.accuracy}%</div>
                  <div className="text-xs text-gray-400">正确率</div>
                </div>

                {/* 挑战按钮 */}
                <button
                  onClick={() => handleChallenge(entry)}
                  className="shrink-0 bg-amber-100 text-amber-700 text-xs px-3 py-2 rounded-lg hover:bg-amber-200 transition font-medium"
                >
                  ⚔️ 挑战
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
