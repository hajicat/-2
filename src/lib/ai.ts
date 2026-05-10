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

const SYSTEM_PROMPT = `你是一个专业的考试题目解析器。请从提供的题库文本中提取所有题目，严格按照以下 JSON 格式输出。

你必须只返回纯 JSON，不要任何额外文字，不要用 markdown 代码块包裹：

{
  "questions": [
    {
      "type": "single",
      "stem": "题干文本，必须完整保留，不能截断或缩写",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],
      "answer": "A",
      "explanation": "解析说明，如果原文没有解析则填空字符串",
      "difficulty": "易"
    }
  ]
}

【题型规则】type 字段取以下值：
- single: 单选题，只有一个正确答案。answer 填正确选项的字母如 "A"。options 是纯文本选项数组，不要加字母前缀（前端会自动加上 A. B. C. D.）。
- multi: 多选题，有多个正确答案。answer 填所有正确选项的字母连在一起如 "AC" 或 "BCD"。options 同上。
- judge: 判断题，只有对/错两种答案。options 为空数组 []。answer 必须填 "Y"（正确/对）或 "N"（错误/错）。
- essay: 论述题/简答题/名词解释。options 为空数组 []。answer 填该题的参考答案或答题要点文本。

【难度标记】difficulty 字段取以下值：
- "易": 基础概念、定义类题目
- "中": 需要理解、辨析的题目
- "难": 需要综合分析、深入理解的高难度题目

【核心规则】
1. 如果原文有解析就提取，没有则 explanation 填空字符串 ""
2. stem 必须完整保留题干原文，逐字还原
3. options 数组不要加 "A. " "B. " 等前缀，只需纯选项文本
4. 只输出 JSON，前面不要有任何解释性文字`

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
