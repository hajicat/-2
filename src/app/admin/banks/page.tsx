'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [form, setForm] = useState({ name: '', description: '', rawText: '' })
  const [parsing, setParsing] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadBanks() }, [])

  async function loadBanks() {
    const res = await fetch('/api/admin/banks')
    if (res.status === 403) { router.push('/banks'); return }
    const data = await res.json()
    setBanks(data.banks || [])
    setLoading(false)
  }

  async function extractTextFromFile(file: File): Promise<string> {
    const name = file.name.toLowerCase()

    if (name.endsWith('.txt')) {
      return await file.text()
    }

    if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      if (result.messages.length > 0) {
        console.warn('DOCX 解析警告:', result.messages)
      }
      return result.value || ''
    }

    if (name.endsWith('.pdf')) {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item: any) => item.str).join(' ')
        text += pageText + '\n'
      }
      return text.trim()
    }

    throw new Error('不支持的文件格式，请上传 PDF、DOCX 或 TXT 文件')
  }

  async function handleFile(file: File) {
    if (!file) return
    const validTypes = ['.pdf', '.docx', '.txt']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!validTypes.includes(ext)) {
      setError('不支持的文件格式，请上传 PDF、DOCX 或 TXT 文件')
      return
    }
    setError('')
    setExtracting(true)
    setUploadedFileName(file.name)
    try {
      const text = await extractTextFromFile(file)
      if (!text.trim()) {
        setError('未能从文件中提取到文本内容，该文件可能为图片扫描件或空文件')
        setUploadedFileName('')
      } else {
        setForm(f => ({ ...f, rawText: text }))
      }
    } catch (err: any) {
      setError(`文件解析失败: ${err.message || '未知错误'}`)
      setUploadedFileName('')
    }
    setExtracting(false)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (e.target) e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name.trim()) {
      setError('请填写题库名称')
      return
    }
    if (!form.rawText.trim()) {
      setError('请上传文件或粘贴题目文本内容')
      return
    }
    setParsing(true)
    try {
      const res = await fetch('/api/admin/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, description: form.description, pdfText: form.rawText }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setParsing(false); return }
      setSuccess(`题库 "${data.bank.name}" 创建成功，共 ${data.bank.questionCount} 题`)
      setForm({ name: '', description: '', rawText: '' })
      setUploadedFileName('')
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

              {/* 文件上传区域 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">上传题库文件 *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div
                  onClick={() => !extracting && fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                    dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
                  } ${extracting ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {extracting ? (
                    <div className="text-gray-500">
                      <p className="text-lg mb-1">⏳</p>
                      <p className="text-sm">正在解析文件...</p>
                      {uploadedFileName && <p className="text-xs text-gray-400 mt-1">{uploadedFileName}</p>}
                    </div>
                  ) : uploadedFileName && form.rawText ? (
                    <div className="text-green-600">
                      <p className="text-lg mb-1">✅</p>
                      <p className="text-sm font-medium">{uploadedFileName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        已提取 {form.rawText.length.toLocaleString()} 个字符 · 点击重新选择
                      </p>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <p className="text-lg mb-1">📁</p>
                      <p className="text-sm font-medium">点击选择文件 或拖拽文件到此处</p>
                      <p className="text-xs text-gray-400 mt-1">支持 PDF、DOCX、TXT 格式</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 文本预览 / 手动编辑 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {form.rawText ? '已提取的文本（可手动编辑）' : '或直接粘贴文本'}
                </label>
                <textarea
                  value={form.rawText}
                  onChange={e => setForm(f => ({ ...f, rawText: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-gray-800 h-48 resize-y"
                  placeholder="上传文件后自动显示提取的文本，或直接在此粘贴PDF/文档中的题目文本..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  💡 上传 PDF/DOCX 文件后文本会自动提取到此处，你也可以手动编辑后再提交
                </p>
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
                  onClick={() => { setShowUpload(false); setError(''); setUploadedFileName(''); setForm({ name: '', description: '', rawText: '' }) }}
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
