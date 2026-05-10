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

interface ShadowTick { index: number; cumTimeMs: number; correct: boolean }
interface AnswerDetail { questionId: number; selected: string; correct: boolean; timeMs: number }

const DIFF_STYLES: Record<string, string> = {
  '易': 'bg-emerald-100 text-emerald-700',
  '中': 'bg-amber-100 text-amber-700',
  '难': 'bg-rose-100 text-rose-700',
}

const TYPE_LABEL: Record<string, string> = {
  single: '单选题', multi: '多选题', judge: '判断题', essay: '论述题',
}

type Mode = 'full' | 'single' | 'multi' | 'judge'

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const shadowUserId = searchParams.get('shadow')
  const shadowNickname = searchParams.get('name') || '影子选手'

  const [bank, setBank] = useState<any>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('full')

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

  // 错题追踪
  const [mistakes, setMistakes] = useState<Set<number>>(new Set())
  const [reviewMode, setReviewMode] = useState(false)

  useEffect(() => { loadData() }, [id])

  useEffect(() => {
    if (allQuestions.length === 0) return
    let filtered = [...allQuestions]
    if (mode === 'single') filtered = allQuestions.filter(q => q.type === 'single')
    else if (mode === 'multi') filtered = allQuestions.filter(q => q.type === 'multi')
    else if (mode === 'judge') filtered = allQuestions.filter(q => q.type === 'judge')
    else {
      const order: Record<string, number> = { single: 0, multi: 1, judge: 2, essay: 3 }
      filtered.sort((a, b) => (order[a.type] ?? 0) - (order[b.type] ?? 0) || a.sortOrder - b.sortOrder)
    }
    setQuestions(filtered)
    resetQuiz(filtered)
  }, [allQuestions, mode])

  function resetQuiz(qs: Question[]) {
    setCurrentIdx(0)
    setSelectedLetters([])
    setShowResult(false)
    setIsCorrect(null)
    setCorrectAnswer('')
    setExplanation('')
    setAnswers([])
    setFinished(false)
    setResult(null)
    quizStartTime.current = Date.now()
    questionStartTime.current = Date.now()
    if (qs.length === 0) setFinished(true)
  }

  async function loadData() {
    try {
      const res = await fetch(`/api/banks/${id}`)
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setBank(data.bank)
      setAllQuestions(data.questions || [])
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
    if (q.type === 'single' || q.type === 'judge') setSelectedLetters([letter])
    else if (q.type === 'multi') setSelectedLetters(prev => prev.includes(letter) ? prev.filter(l => l !== letter) : [...prev, letter])
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
      const res = await fetch('/api/attempt/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: q.id, selected }) })
      const data = await res.json()
      const ok = isEssay ? true : data.correct
      setIsCorrect(ok)
      setCorrectAnswer(data.answer)
      setExplanation(data.explanation)
      setShowResult(true)
      if (!ok) setMistakes(prev => new Set(prev).add(q.id))
      setAnswers(prev => [...prev, { questionId: q.id, selected: isEssay ? '已查看答案' : selected, correct: ok, timeMs }])
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
    } else { setFinished(true); submitAll() }
  }

  async function submitAll() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/attempt/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bankId: parseInt(id), answers }) })
      const data = await res.json()
      setResult(data.record)
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  function fmtTime(ms: number) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}` }

  function getShadowProgress() {
    if (!shadowLoaded || shadowTimeline.length === 0) return null
    const e = Date.now() - quizStartTime.current; let d = 0, c = 0
    for (const t of shadowTimeline) { if (t.cumTimeMs <= e) { d = t.index + 1; if (t.correct) c++ } else break }
    return { done: d, correct: c }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>
  if (allQuestions.length === 0) return <div className="min-h-screen flex items-center justify-center text-gray-400"><div className="text-center"><p className="text-4xl mb-4">📭</p><p>题库为空</p><button onClick={() => router.push('/banks')} className="mt-4 text-indigo-600 underline">返回</button></div></div>

  // ─── 结果页 ───
  if (finished && result) {
    const c = result.correctCount ?? answers.filter(a => a.correct).length
    const t = result.totalQuestions ?? answers.length
    const acc = result.accuracy ?? Math.round((c / t) * 100)
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center animate-in">
          <div className="text-6xl mb-4">{acc >= 80 ? '🎉' : acc >= 60 ? '👍' : '💪'}</div>
          <h2 className="text-2xl font-bold text-[#2c3e50] mb-2">答题完成</h2>
          <p className="text-gray-500 mb-6">{bank?.name}</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-indigo-50 rounded-xl p-4"><div className="text-2xl font-bold text-indigo-600">{c}/{t}</div><div className="text-xs text-gray-500 mt-1">正确数</div></div>
            <div className="bg-emerald-50 rounded-xl p-4"><div className="text-2xl font-bold text-emerald-600">{acc}%</div><div className="text-xs text-gray-500 mt-1">正确率</div></div>
            <div className="bg-amber-50 rounded-xl p-4"><div className="text-2xl font-bold text-amber-600">{fmtTime(result.totalTimeMs || 0)}</div><div className="text-xs text-gray-500 mt-1">总用时</div></div>
          </div>
          {mistakes.size > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium text-rose-700 mb-2">📋 错题 ({mistakes.size} 题)</p>
              <button onClick={() => { setFinished(false); setResult(null); setReviewMode(true); const qs = allQuestions.filter(q => mistakes.has(q.id)); setQuestions(qs); resetQuiz(qs) }} className="text-sm text-rose-600 underline font-medium">▶ 死磕错题</button>
            </div>
          )}
          {shadowLoaded && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium text-amber-800 mb-2">🏁 影子对比 - {shadowNickname}</p>
              <p className="text-sm text-amber-700">{acc > (shadowTimeline.length > 0 ? Math.round(shadowTimeline.filter(t => t.correct).length / shadowTimeline.length * 100) : 0) ? '你赢了！🎉' : '影子更快更准，下次加油！💪'}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setMode('full'); setReviewMode(false) }} className="flex-1 bg-[#2c3e50] text-white py-3 rounded-xl font-medium hover:bg-[#34495e] transition-all duration-400" style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>再刷一次</button>
            <button onClick={() => router.push('/banks')} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all duration-400" style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>返回题库</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[currentIdx]
  const shadowProgress = getShadowProgress()
  const selfCorrect = answers.filter(a => a.correct).length
  const selfAccuracy = answers.length > 0 ? Math.round(selfCorrect / answers.length * 100) : 0
  const isMulti = q.type === 'multi'; const isJudge = q.type === 'judge'; const isEssay = q.type === 'essay'
  const diffCls = DIFF_STYLES[q.difficulty] || ''
  const typeLabel = TYPE_LABEL[q.type] || q.type
  const modeBtns: { mode: Mode; label: string; icon: string; style: string }[] = [
    { mode: 'full', label: '全库浏览', icon: '📚', style: 'bg-[#2c3e50]' },
    { mode: 'single', label: '单选特训', icon: '🔥', style: 'bg-[#3498db]' },
    { mode: 'multi', label: '多选特训', icon: '🔥', style: 'bg-[#9b59b6]' },
    { mode: 'judge', label: '判断特训', icon: '🔥', style: 'bg-[#e67e22]' },
  ]

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <style>{`
        @keyframes springIn {
          0% { opacity: 0; transform: scale(0.92) translateY(18px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes springUp {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseCorrect {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
        }
        .animate-in { animation: springIn 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-up { animation: springUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-pulse-correct { animation: pulseCorrect 0.8s cubic-bezier(0.16,1,0.3,1); }
        .spring-btn { transition: all 0.4s cubic-bezier(0.16,1,0.3,1); }
        .spring-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .spring-btn:active { transform: translateY(0) scale(0.97); }
        .option-enter { animation: springUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .card-spring { transition: all 0.45s cubic-bezier(0.16,1,0.3,1); }
      `}</style>

      {/* 顶部进度栏 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 truncate mr-4">{reviewMode ? '🔄 死磕错题' : bank?.name}</span>
            <span className="text-sm font-mono text-gray-600">{fmtTime(elapsed - quizStartTime.current)}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-14 text-gray-500 shrink-0">🧑 你</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full card-spring" style={{ width: `${questions.length > 0 ? ((currentIdx + (showResult ? 1 : 0)) / questions.length) * 100 : 0}%` }} />
              </div>
              <span className="w-20 text-right text-gray-500 shrink-0">{currentIdx + (showResult ? 1 : 0)}/{questions.length}{answers.length > 0 && <span className="text-indigo-600 ml-1">{selfAccuracy}%</span>}</span>
            </div>
            {shadowLoaded && shadowProgress && (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 text-gray-400 shrink-0 truncate">👻 {shadowNickname}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full card-spring" style={{ width: `${(shadowProgress.done / questions.length) * 100}%` }} />
                </div>
                <span className="w-20 text-right text-gray-400 shrink-0">{shadowProgress.done}/{questions.length}{shadowProgress.done > 0 && <span className="text-amber-600 ml-1">{Math.round(shadowProgress.correct / shadowProgress.done * 100)}%</span>}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 模式切换 */}
        {!reviewMode && (
          <div className="bg-white rounded-2xl shadow-sm border p-4 mb-6 animate-up">
            <div className="flex gap-2">
              {modeBtns.map(b => (
                <button
                  key={b.mode}
                  onClick={() => setMode(b.mode)}
                  className={`spring-btn flex-1 py-2.5 rounded-xl text-sm font-bold text-white text-center ${b.style} ${mode === b.mode ? 'ring-3 ring-amber-300 ring-offset-2' : 'opacity-70 hover:opacity-100'}`}
                >
                  {b.icon} {b.label}
                </button>
              ))}
            </div>
            {mode === 'full' && <p className="text-center text-xs text-gray-400 mt-3">按 单选 → 多选 → 判断 → 论述 顺序排列</p>}
          </div>
        )}

        {questions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center text-gray-400 animate-in">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg mb-1">该模式下无题目</p>
            <button onClick={() => setMode('full')} className="text-indigo-600 text-sm underline mt-2">返回全库浏览</button>
          </div>
        ) : (
          <div key={currentIdx} className="bg-white rounded-2xl shadow-sm border p-6 md:p-8 animate-in">
            {/* 题号行 */}
            <div className="flex items-center gap-2 mb-5">
              <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-semibold">第 {currentIdx + 1}/{questions.length} 题</span>
              <span className="text-xs text-gray-400">{typeLabel}</span>
              {q.difficulty && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${diffCls}`}>{q.difficulty}</span>}
              {mistakes.has(q.id) && <span className="text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-medium">错题</span>}
            </div>

            {/* 题干 */}
            <p className="text-lg text-[#2c3e50] leading-relaxed mb-8 font-semibold whitespace-pre-wrap" style={{ animationDelay: '0.05s' }}>{q.stem}</p>

            {/* 判断按钮 */}
            {isJudge && (
              <div className="flex gap-3 mb-8">
                {[{ l: 'Y', label: '✓ 正确', cls: 'hover:border-emerald-400 hover:bg-emerald-50' }, { l: 'N', label: '✗ 错误', cls: 'hover:border-rose-400 hover:bg-rose-50' }].map((opt, i) => {
                  const sel = selectedLetters.includes(opt.l)
                  let cls = `border-2 border-gray-200 ${opt.cls}`
                  if (showResult) {
                    if (opt.l === correctAnswer) cls = 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 animate-pulse-correct'
                    else if (sel && !isCorrect) cls = 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                    else cls = 'border-gray-200 opacity-50'
                  } else if (sel) cls = 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                  return (
                    <button key={opt.l} onClick={() => toggleLetter(opt.l)} disabled={showResult}
                      className={`spring-btn flex-1 text-center px-5 py-5 rounded-2xl font-semibold text-lg ${cls}`}
                      style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                    >{opt.label}</button>
                  )
                })}
              </div>
            )}

            {/* 选项列表 */}
            {!isJudge && !isEssay && (
              <div className="space-y-3 mb-8">
                {q.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i)
                  const sel = selectedLetters.includes(letter)
                  let cls = 'border-2 border-gray-200 spring-btn'
                  if (showResult) {
                    const isCorrectOpt = correctAnswer.includes(letter)
                    if (isCorrectOpt) cls = 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 animate-pulse-correct'
                    else if (sel && !isCorrect) cls = 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                    else cls = 'border-gray-200 opacity-50'
                  } else if (sel) cls = 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                  else cls += ' hover:border-indigo-300 hover:bg-indigo-50/50'
                  return (
                    <button key={i} onClick={() => toggleLetter(letter)} disabled={showResult}
                      className={`option-enter w-full text-left px-5 py-4 rounded-2xl flex items-center gap-3 ${cls}`}
                      style={{ animationDelay: `${0.05 + i * 0.06}s` }}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors duration-300 ${sel && !showResult ? 'bg-indigo-600 text-white' : 'border-2 border-gray-300 text-gray-500'}`}>
                        {letter}
                      </span>
                      <span className="text-gray-700 leading-relaxed">{opt}</span>
                      {showResult && correctAnswer.includes(letter) && <span className="ml-auto text-emerald-600 text-lg font-bold">✓</span>}
                      {showResult && sel && !correctAnswer.includes(letter) && <span className="ml-auto text-rose-500 text-lg font-bold">✗</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* 论述题 */}
            {isEssay && (
              <div className="mb-8 p-6 bg-gray-50 rounded-2xl border text-center animate-up">
                <p className="text-gray-400 text-sm mb-2">📝 论述题</p>
                <p className="text-gray-500 text-xs">点击下方按钮查看参考答案</p>
              </div>
            )}

            {/* 正确答案 / 解析 */}
            {showResult && (isEssay || explanation) && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 animate-up">
                <p className="text-sm font-semibold text-blue-800 mb-2">{isEssay ? '📖 参考答案' : '📖 解析'}</p>
                <p className="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">{isEssay ? correctAnswer : explanation}</p>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              {!showResult ? (
                <button onClick={handleConfirm}
                  disabled={(!isEssay && selectedLetters.length === 0) || checking}
                  className="spring-btn flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-base hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 disabled:hover:translate-y-0"
                >
                  {checking ? '验证中...' : isEssay ? '📖 显示参考答案' : isMulti ? `确认 (${selectedLetters.sort().join('') || '无'})` : '确 认'}
                </button>
              ) : (
                <button onClick={handleNext}
                  className="spring-btn flex-1 bg-[#2c3e50] text-white py-4 rounded-2xl font-semibold text-base hover:bg-[#34495e]"
                >
                  {currentIdx < questions.length - 1 ? '下一题 →' : '查看结果'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
