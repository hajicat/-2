const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

interface ParseResult {
  questions: Array<{
    type: 'single' | 'multi' | 'judge' | 'fill'
    stem: string
    options: string[]
    answer: string
    explanation: string
  }>
}

const SYSTEM_PROMPT = `你是一个专业的考试题目解析器。用户会发送题库文本内容，请从中提取所有题目并按以下JSON格式返回。

你必须只返回纯JSON，不要任何额外文字，不要markdown代码块：

{
  "questions": [
    {
      "type": "single",
      "stem": "题干文本，保留完整，不要截断",
      "options": ["A. 选项内容", "B. 选项内容", "C. 选项内容", "D. 选项内容"],
      "answer": "A",
      "explanation": "解析说明，没有则留空字符串"
    }
  ]
}

规则：
1. type: single=单选题, multi=多选题, judge=判断题, fill=填空题
2. 单选 answer 填选项字母如 "A"，多选填如 "AC"
3. 判断 answer 填 "对" 或 "错"，options 为空数组 []
4. 填空 answer 填正确答案文本，options 为空数组 []
5. 如果原文有解析就提取，没有则 explanation 留空字符串 ""
6. stem 必须完整保留题干原文，不要截断
7. 直接输出JSON，不要包在markdown代码块中`

const MAX_RETRIES = 3
const MAX_TEXT_LENGTH = 60000

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim()
  }
  return cleaned
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (err: any) {
      if (attempt === retries - 1) throw err
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function parsePdfWithAI(pdfText: string): Promise<ParseResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置')

  if (pdfText.length > MAX_TEXT_LENGTH) {
    throw new Error(`文本过长（${pdfText.length}字符），请分批上传，单次不超过${MAX_TEXT_LENGTH}字符`)
  }

  const requestBody = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请解析以下题目内容：\n\n${pdfText}` }
    ],
    temperature: 0.1,
    max_tokens: 8192
  })

  let response: Response
  try {
    response = await fetchWithRetry(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    })
  } catch (err: any) {
    throw new Error(`DeepSeek API 网络请求失败: ${err.message || '未知网络错误'}`)
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '无法读取响应')
    throw new Error(`DeepSeek API 返回错误 (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek 返回内容为空')

  let parsed: ParseResult
  try {
    const cleanedContent = cleanJsonResponse(content)
    parsed = JSON.parse(cleanedContent) as ParseResult
  } catch {
    throw new Error(`AI 返回格式错误，无法解析JSON。原始返回: ${content.substring(0, 200)}`)
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI 返回格式错误：缺少 questions 数组')
  }

  if (parsed.questions.length === 0) {
    throw new Error('AI 未能从文本中提取到题目，请检查内容格式')
  }

  return parsed
}
