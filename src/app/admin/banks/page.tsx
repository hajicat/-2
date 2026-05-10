'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Bank {
  id: number
  name: string
  description: string
  question_count: number
  created_at: string
}

interface Question {
  type: string
  stem: string
  options: string[]
  answer: string
  explanation: string
  difficulty?: string
}

const DEEPSEEK_PROMPT = `你是专业考试题目解析器。请从以下题库文本中提取所有题目，输出严格 JSON 格式，不含任何其他文字：

{
  "questions": [
    {
      "type": "single",
      "stem": "题干原文完整保留",
      "options": ["选项内容A", "选项内容B", "选项内容C", "选项内容D"],
      "answer": "A",
      "explanation": "解析说明，无则空字符串",
      "difficulty": "易"
    }
  ]
}

【题型规则】
- single: 单选题，answer 填字母如 "A"
- multi: 多选题，answer 填字母连写如 "AC"
- judge: 判断题，options 为 []，answer 填 "Y"(对) 或 "N"(错)
- essay: 论述题/简答题，options 为 []，answer 填参考答案

【难度】易/中/难

【要求】stem 逐字还原不截断，options 不加字母前缀，直接输出纯JSON

以下是题库文本：
---`

function cleanJson(text: string): string {
  let t = text.trim()
  const m = t.match(/\x60\x60\x60(?:json)?\s*\n?([\s\S]*?)\x60\x60\x60/)
  if (m) t = m[1].trim()
  return t
}

export default function AdminBanksPage() {
  const router = useRouter()
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [tab, setTab] = useState<'extract' | 'import'>('extract')

  // 文件提取
  const [rawText, setRawText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 导入 AI 结果
  const [bankName, setBankName] = useState('')
  const [bankDesc, setBankDesc] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [creating, setCreating] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadBanks() }, [])

  async function loadBanks() {
    const res = await fetch('/api/admin/banks')
    if (res.status === 403) { router.push('/banks'); return }
    const data = await res.json()
    setBanks(data.banks || [])
    setLoading(false)
  }

  // ── 文件提取 ──
  async function extractTextFromFile(file: File): Promise<string> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.txt')) return await file.text()
    if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      return r.value || ''
    }
    if (name.endsWith('.pdf')) {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
      let t = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const c = await page.getTextContent()
        t += c.items.map((it: any) => it.str).join(' ') + '\n'
      }
      return t.trim()
    }
    throw new Error('不支持的文件格式，请上传 PDF、DOCX 或 TXT')
  }

  async function handleFile(file: File) {
    if (!file) return
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!['.pdf', '.docx', '.txt'].includes(ext)) {
      setError('不支持的文件格式，请上传 PDF、DOCX 或 TXT 文件')
      return
    }
    setError('')
    setExtracting(true)
    setUploadedFileName(file.name)
    try {
      const text = await extractTextFromFile(file)
      if (!text.trim()) {
        setError('未能提取到文本，可能为图片扫描件或空文件')
      } else {
        setRawText(text)
      }
    } catch (err: any) {
      setError(`解析失败: ${err.message}`)
    }
    setExtracting(false)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    if (e.target) e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }

  async function handleCopyText() {
    await navigator.clipboard.writeText(rawText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(DEEPSEEK_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── 导入创建 ──
  async function handleCreateBank() {
    setError('')
    setSuccess('')
    if (!bankName.trim()) { setError('请填写题库名称'); return }
    if (!jsonInput.trim()) { setError('请粘贴AI返回的JSON结果'); return }

    setCreating(true)
    try {
      const cleaned = cleanJson(jsonInput)
      const parsed = JSON.parse(cleaned)
      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        setError('JSON 格式错误：缺少 questions 数组，请确认AI返回的格式正确')
        setCreating(false)
        return
      }

      for (const q of parsed.questions) {
        if (!q.type || !q.stem) { setError('缺少必要字段 type/stem'); setCreating(false); return }
        if (!['single', 'multi', 'judge', 'essay'].includes(q.type)) { setError(`不支持的题型: ${q.type}`); setCreating(false); return }
        if ((q.type === 'single' || q.type === 'multi') && (!q.options || q.options.length === 0)) { setError(`${q.type} 需要 options`); setCreating(false); return }
      }

      const res = await fetch('/api/admin/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bankName, description: bankDesc, questions: parsed.questions }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '创建失败'); setCreating(false); return }

      setSuccess(`题库 "${data.bank.name}" 创建成功，共 ${data.bank.questionCount} 题`)
      setBankName('')
      setBankDesc('')
      setJsonInput('')
      setShowUpload(false)
      loadBanks()
    } catch (err: any) {
      setError(`JSON 解析失败: ${err.message || '请确认格式正确'}`)
    }
    setCreating(false)
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`确定删除题库 "${name}"？`)) return
    await fetch('/api/admin/banks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
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
        {error && <div className="bg-rose-50 text-rose-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg mb-4 text-sm">{success}</div>}

        {!showUpload ? (
          <button onClick={() => { setShowUpload(true); setError(''); setSuccess('') }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm">
            + 上传题库
          </button>
        ) : (
          <div className="bg-white rounded-xl border p-6 space-y-6">
            {/* Tab 切换 */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button onClick={() => { setTab('extract'); setError(''); setSuccess('') }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'extract' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                📄 提取题库文本
              </button>
              <button onClick={() => { setTab('import'); setError(''); setSuccess('') }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'import' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                🤖 导入AI解析结果
              </button>
            </div>

            {/* Tab 1: 提取文本 */}
            {tab === 'extract' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-medium mb-1">📋 操作步骤</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700">
                    <li>上传 PDF/DOCX/TXT 文件，自动提取文本</li>
                    <li>复制提取的文本到 <a href="https://chat.deepseek.com" target="_blank" className="underline font-medium">DeepSeek 网页版</a></li>
                    <li>使用下方的提示词让 AI 解析为 JSON</li>
                    <li>切换到「导入AI解析结果」标签，粘贴 JSON 创建题库</li>
                  </ol>
                </div>

                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileInputChange} className="hidden" />
                <div
                  onClick={() => !extracting && fileInputRef.current?.click()}
                  onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={e => { e.preventDefault(); setDragOver(false) }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'} ${extracting ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {extracting ? (
                    <div className="text-gray-500"><p className="text-lg mb-1">⏳</p><p className="text-sm">正在解析 {uploadedFileName}...</p></div>
                  ) : uploadedFileName ? (
                    <div className="text-emerald-600"><p className="text-lg mb-1">✅</p><p className="text-sm font-medium">{uploadedFileName}</p><p className="text-xs text-gray-400 mt-1">已提取 {rawText.length.toLocaleString()} 字符 · 点击重新选择</p></div>
                  ) : (
                    <div className="text-gray-500"><p className="text-lg mb-1">📁</p><p className="text-sm font-medium">点击选择文件 或 拖拽到此处</p><p className="text-xs text-gray-400 mt-1">支持 PDF、DOCX、TXT</p></div>
                  )}
                </div>

                {rawText && (
                  <>
                    <div className="flex gap-2">
                      <button onClick={handleCopyText} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition">
                        {copied ? '✓ 已复制' : '📋 复制文本'}
                      </button>
                    </div>
                    <textarea value={rawText} onChange={e => setRawText(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-mono text-gray-800 h-40 resize-y" />
                  </>
                )}

                <details className="bg-gray-50 rounded-lg border">
                  <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                    📝 DeepSeek 提示词
                    <button onClick={e => { e.preventDefault(); handleCopyPrompt() }} className="ml-auto text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded hover:bg-indigo-200">
                      {copied ? '已复制' : '复制提示词'}
                    </button>
                  </summary>
                  <pre className="px-4 py-3 text-xs text-gray-600 whitespace-pre-wrap border-t">{DEEPSEEK_PROMPT}</pre>
                </details>
              </div>
            )}

            {/* Tab 2: 导入结果 */}
            {tab === 'import' && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">💡 使用说明</p>
                  <p className="text-amber-700">将 DeepSeek 返回的 JSON 结果完整粘贴到下方，系统会自动解析并创建题库</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">题库名称 *</label>
                    <input value={bankName} onChange={e => setBankName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="如：数据结构期末复习" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">描述（可选）</label>
                    <input value={bankDesc} onChange={e => setBankDesc(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="简要描述" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">粘贴 AI 返回的 JSON 结果 *</label>
                  <textarea
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono text-gray-800 h-64 resize-y"
                    placeholder={`粘贴 DeepSeek 返回的 JSON，例如：\n\n{\n  "questions": [\n    {\n      "type": "single",\n      "stem": "...",\n      "options": ["...", "..."],\n      "answer": "A",\n      "explanation": "",\n      "difficulty": "易"\n    }\n  ]\n}`}
                  />
                </div>

                <button onClick={handleCreateBank} disabled={creating}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
                  {creating ? '创建中...' : '📚 创建题库'}
                </button>
              </div>
            )}

            {/* 取消按钮 */}
            <div className="pt-2 border-t">
              <button onClick={() => { setShowUpload(false); setError(''); setSuccess(''); setRawText(''); setUploadedFileName(''); setBankName(''); setBankDesc(''); setJsonInput('') }}
                className="text-gray-500 px-4 py-2 text-sm hover:text-gray-700">
                关闭
              </button>
            </div>
          </div>
        )}

        {/* 题库列表 */}
        {loading ? <p className="text-center text-gray-400 py-10">加载中...</p> :
          banks.length === 0 ? (
            <div className="text-center py-20 text-gray-400"><p className="text-4xl mb-4">📭</p><p>暂无题库</p></div>
          ) : (
            <div className="space-y-3 mt-6">
              {banks.map(b => (
                <div key={b.id} className="bg-white rounded-lg border p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">{b.name}</p>
                    {b.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{b.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">📋 {b.question_count} 题 · {new Date(b.created_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <button onClick={() => handleDelete(b.id, b.name)} className="text-xs text-gray-500 hover:text-red-500 transition">删除</button>
                </div>
              ))}
            </div>
          )}
      </main>
    </div>
  )
}
