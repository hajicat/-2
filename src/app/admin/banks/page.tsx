'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Bank {
  id: number
  name: string
  description: string
  question_count: number
  created_at: string
}

export default function AdminBanksPage() {
  const router = useRouter()
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', pdfText: '' })
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadBanks() }, [])

  async function loadBanks() {
    const res = await fetch('/api/admin/banks')
    if (res.status === 403) { router.push('/banks'); return }
    const data = await res.json()
    setBanks(data.banks || [])
    setLoading(false)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name.trim() || !form.pdfText.trim()) {
      setError('题库名称和PDF文本内容不能为空')
      return
    }
    setParsing(true)
    try {
      const res = await fetch('/api/admin/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess(`题库 "${data.bank.name}" 创建成功，共 ${data.bank.questionCount} 题`)
      setForm({ name: '', description: '', pdfText: '' })
      setShowUpload(false)
      loadBanks()
    } catch (err: any) {
      setError(err.message)
    }
    setParsing(false)
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`确定删除题库 "${name}" ？所有题目和答题记录将被删除！`)) return
    await fetch('/api/admin/banks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadBanks()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/banks" className="text-gray-500 hover:text-indigo-600 transition">← 返回</a>
          <h1 className="text-xl font-bold text-gray-800">📚 题库管理</h1>
          <a href="/admin/users" className="text-sm text-gray-500 hover:text-indigo-600 transition ml-auto">👥 用户管理</a>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && <p className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</p>}
        {success && <p className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{success}</p>}

        {/* 上传区域 */}
        <div className="mb-6">
          {!showUpload ? (
            <button
              onClick={() => setShowUpload(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm"
            >
              + 上传题库
            </button>
          ) : (
            <form onSubmit={handleUpload} className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="font-bold text-gray-800">上传新题库</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">题库名称 *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800"
                    placeholder="如：数据结构期末复习"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">描述（可选）</label>
                  <input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800"
                    placeholder="简要描述题库内容"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">PDF 文本内容 *</label>
                <p className="text-xs text-gray-400 mb-2">
                  💡 打开 PDF → 全选复制 (Ctrl+A, Ctrl+C) → 粘贴到下方。也可以用 PDF 转文本工具。
                </p>
                <textarea
                  value={form.pdfText}
                  onChange={e => setForm(f => ({ ...f, pdfText: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-gray-800 h-64 resize-y"
                  placeholder="粘贴从 PDF 中复制的题目文本..."
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={parsing}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {parsing ? '🤖 AI 解析中...' : '🤖 AI 解析并创建'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUpload(false); setError('') }}
                  className="text-gray-500 px-4 py-2 text-sm"
                >
                  取消
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 题库列表 */}
        {loading ? (
          <p className="text-center text-gray-400 py-10">加载中...</p>
        ) : banks.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">📭</p>
            <p>暂无题库，点击上方按钮上传</p>
          </div>
        ) : (
          <div className="space-y-3">
            {banks.map(b => (
              <div key={b.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800">{b.name}</p>
                  {b.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{b.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    📋 {b.question_count} 题 · 创建于 {new Date(b.created_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(b.id, b.name)}
                  className="text-xs text-gray-500 hover:text-red-500 transition"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
