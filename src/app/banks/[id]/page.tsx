'use client'

export const runtime = 'edge'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { use } from 'react'

interface Question {
  id: number
  type: string
  stem: string
  options: string[]
  explanation: string
  difficulty: string
  sortOrder: number
}

interface ShadowTick {
  index: number
  cumTimeMs: number
  correct: boolean
}

interface AnswerDetail {
  questionId: number
  selected: string
  correct: boolean
  timeMs: number
}

const DIFF_MAP: Record<string, { label: string; color: string }> = {
  '易': { label: '易', color: 'bg-green-100 text-green-700' },
  '中': { label: '中', color: 'bg-yellow-100 text-yellow-700' },
  '难': { label: '难', color: 'bg-red-100 text-red-700' },
}

const TYPE_LABEL: Record<string, string> = {
  single: '单选题',
  multi: '多选题',
  judge: '判断题',
  essay: '论述题',
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const shadowUserId = searchParams.get('shadow')
  const shadowNickname = searchParams.get('name') || '影子选手'

  const [bank, setBank] = useState<any>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedLetters, setSelectedLetters] = useState<string[]>([])
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [answers, setAnswers] = useState<AnswerDetail[]>([])
  const [finished, setFinished] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [checking, setChecking] = useState(false)

  const questionStartTime = useRef(Date.now())
  const quizStartTime = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  const [shadowTimeline, setShadowTimeline] = useState<ShadowTick[]>([])
  const [shadowLoaded, setShadowLoaded] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    try {
      const res = await fetch(`/api/banks/${id}`)
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setBank(data.bank)
      setQuestions(data.questions)
      setLoading(false)
      if (shadowUserId) {
        const pkRes = await fetch(`/api/pk/attempts?userId=${shadowUserId}&bankId=${id}`)
        if (pkRes.ok) {
          const pkData = await pkRes.json()
          setShadowTimeline(pkData.timeline || [])
          setShadowLoaded(true)
        }
      }
    } catch { setLoading(false) }
  }

  useEffect(() => {
    if (finished) return
    const timer = setInterval(() => setElapsed(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [finished])

  function toggleLetter(letter: string) {
    if (showResult) return
    const q = questions[currentIdx]
    if (q.type === 'single' || q.type === 'judge') {
      setSelectedLetters([letter])
    } else if (q.type === 'multi') {
      setSelectedLetters(prev =>
        prev.includes(letter) ? prev.filter(l => l !== letter) : [...prev, letter]
      )
    }
  }

  async function handleConfirm() {
    const q = questions[currentIdx]
    const isEssay = q.type === 'essay'
    if (!isEssay && selectedLetters.length === 0) return
    if (checking) return
    setChecking(true)

    const timeMs = Date.now() - questionStartTime.current
    const selected = isEssay ? '' : selectedLetters.sort().join('')

    try {
      const res = await fetch('/api/attempt/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, selected }),
      })
      const data = await res.json()

      setIsCorrect(isEssay ? true : data.correct)
      setCorrectAnswer(data.answer)
      setExplanation(data.explanation)
      setShowResult(true)

      setAnswers(prev => [...prev, {
        questionId: q.id,
        selected: isEssay ? '已查看答案' : selected,
        correct: isEssay ? true : data.correct,
        timeMs,
      }])
    } catch { alert('验证答案失败，请重试') }
    setChecking(false)
  }

  function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1)
      setSelectedLetters([])
      setShowResult(false)
      setIsCorrect(null)
      setCorrectAnswer('')
      setExplanation('')
      questionStartTime.current = Date.now()
    } else {
      setFinished(true)
      submitAll()
    }
  }

  async function submitAll() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/attempt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId: parseInt(id), answers }),
      })
      const data = await res.json()
      setResult(data.record)
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  function fmtTime(ms: number) {
    const secs = Math.floor(ms / 1000)
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins}:${s.toString().padStart(2, '0')}`
  }

  function getShadowProgress(): { done: number; correct: number } | null {
    if (!shadowLoaded || shadowTimeline.length === 0) return null
    const quizElapsed = Date.now() - quizStartTime.current
    let done = 0, correct = 0
    for (const tick of shadowTimeline) {
      if (tick.cumTimeMs <= quizElapsed) { done = tick.index + 1; if (tick.correct) correct++ }
      else break
    }
    return { done, correct }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-4xl mb-4">📭</p><p>题库为空</p>
          <button onClick={() => router.push('/banks')} className="mt-4 text-indigo-600 underline">返回</button>
        </div>
      </div>
    )
  }

  if (finished && result) {
    const correctCount = result.correctCount ?? answers.filter(a => a.correct).length
    const total = result.totalQuestions ?? answers.length
    const accuracy = result.accuracy ?? Math.round((correctCount / total) * 100)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">{accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '💪'}</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">答题完成！</h2><p className="text-gray-500 mb-6">{bank?.name}</p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-indigo-50 rounded-lg p-4"><div className="text-2xl font-bold text-indigo-600">{correctCount}/{total}</div><div className="text-xs text-gray-500">正确数</div></div>
            <div className="bg-green-50 rounded-lg p-4"><div className="text-2xl font-bold text-green-600">{accuracy}%</div><div className="text-xs text-gray-500">正确率</div></div>
            <div className="bg-amber-50 rounded-lg p-4"><div className="text-2xl font-bold text-amber-600">{fmtTime(result.totalTimeMs || 0)}</div><div className="text-xs text-gray-500">总用时</div></div>
          </div>
          {shadowLoaded && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-medium text-amber-800 mb-2">🏁 影子对比 - {shadowNickname}</p>
              <p className="text-sm text-amber-700">
                {accuracy > (shadowTimeline.length > 0 ? Math.round(shadowTimeline.filter(t => t.correct).length / shadowTimeline.length * 100) : 0) ? '你赢了！🎉' : accuracy < (shadowTimeline.length > 0 ? Math.round(shadowTimeline.filter(t => t.correct).length / shadowTimeline.length * 100) : 0) ? '影子更快更准，下次加油！💪' : '打平了！🤝'}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition">再刷一次</button>
            <button onClick={() => router.push('/banks')} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition">返回题库</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[currentIdx]
  const shadowProgress = getShadowProgress()
  const selfCorrect = answers.filter(a => a.correct).length
  const selfAccuracy = answers.length > 0 ? Math.round(selfCorrect / answers.length * 100) : 0
  const isMulti = q.type === 'multi'
  const isJudge = q.type === 'judge'
  const isEssay = q.type === 'essay'
  const diffTag = DIFF_MAP[q.difficulty] || null
  const typeLabel = TYPE_LABEL[q.type] || q.type

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 truncate mr-4">{bank?.name}</span>
            <span className="text-sm font-mono text-gray-600">{fmtTime(elapsed - quizStartTime.current)}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-14 text-gray-500 shrink-0">🧑 你</span>
              <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${((currentIdx + (showResult ? 1 : 0)) / questions.length) * 100}%` }} />
              </div>
              <span className="w-24 text-right text-gray-500 shrink-0">{currentIdx + (showResult ? 1 : 0)}/{questions.length}{answers.length > 0 && <span className="text-indigo-600 ml-1">{selfAccuracy}%</span>}</span>
            </div>
            {shadowLoaded && shadowProgress && (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 text-gray-400 shrink-0 truncate">👻 {shadowNickname}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${(shadowProgress.done / questions.length) * 100}%` }} />
                </div>
                <span className="w-24 text-right text-gray-400 shrink-0">{shadowProgress.done}/{questions.length}{shadowProgress.done > 0 && <span className="text-amber-600 ml-1">{Math.round(shadowProgress.correct / shadowProgress.done * 100)}%</span>}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full font-medium">第 {currentIdx + 1}/{questions.length} 题</span>
            <span className="text-xs text-gray-400">{typeLabel}</span>
            {diffTag && <span className={`text-xs px-1.5 py-0.5 rounded ${diffTag.color}`}>{diffTag.label}</span>}
          </div>

          <p className="text-lg text-gray-800 leading-relaxed mb-6 whitespace-pre-wrap">{q.stem}</p>

          {isJudge ? (
            <div className="flex gap-3 mb-8">
              {['Y', 'N'].map(letter => {
                const selected = selectedLetters.includes(letter)
                const label = letter === 'Y' ? '✓ 正确' : '✗ 错误'
                let cls = 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                if (showResult) {
                  const isThisCorrect = letter === correctAnswer
                  if (isThisCorrect) cls = 'border-green-400 bg-green-50 ring-2 ring-green-200'
                  else if (selected && !isCorrect) cls = 'border-red-400 bg-red-50 ring-2 ring-red-200'
                  else cls = 'border-gray-200 opacity-60'
                } else if (selected) {
                  cls = 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                }
                return (
                  <button
                    key={letter}
                    onClick={() => toggleLetter(letter)}
                    disabled={showResult}
                    className={`flex-1 text-center px-5 py-4 rounded-xl border-2 transition font-medium text-lg ${cls}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : !isEssay ? (
            <div className="space-y-3 mb-8">
              {q.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i)
                const selected = selectedLetters.includes(letter)
                let cls = 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                if (showResult) {
                  const isCorrectOpt = correctAnswer.includes(letter)
                  if (isCorrectOpt) cls = 'border-green-400 bg-green-50 ring-2 ring-green-200'
                  else if (selected && !isCorrect) cls = 'border-red-400 bg-red-50 ring-2 ring-red-200'
                  else cls = 'border-gray-200 opacity-60'
                } else if (selected) {
                  cls = 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                }
                return (
                  <button
                    key={i}
                    onClick={() => toggleLetter(letter)}
                    disabled={showResult}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition flex items-center gap-3 ${cls}`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected && !showResult ? 'bg-indigo-600 text-white' : 'border-2 border-current'}`}>
                      {letter}
                    </span>
                    <span className="text-gray-700">{opt}</span>
                    {showResult && correctAnswer.includes(letter) && <span className="ml-auto text-green-600 text-sm font-medium">✓</span>}
                    {showResult && selected && !correctAnswer.includes(letter) && <span className="ml-auto text-red-500 text-sm font-medium">✗</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border text-sm text-gray-500 text-center">
              📝 论述题 — 确认后将显示参考答案
            </div>
          )}

          {showResult && isEssay && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-800 mb-1">📖 参考答案</p>
              <p className="text-sm text-blue-700 whitespace-pre-wrap">{correctAnswer}</p>
            </div>
          )}

          {showResult && !isEssay && explanation && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-800 mb-1">📖 解析</p>
              <p className="text-sm text-blue-700">{explanation}</p>
            </div>
          )}

          <div className="flex gap-3">
            {!showResult ? (
              <button
                onClick={handleConfirm}
                disabled={(!isEssay && selectedLetters.length === 0) || checking}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {checking ? '验证中...' : isEssay ? '显示参考答案' : (isMulti ? `确认选择 (${selectedLetters.sort().join('') || '无'})` : '确 认')}
              </button>
            ) : (
              <button onClick={handleNext} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition">
                {currentIdx < questions.length - 1 ? '下一题' : '查看结果'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
