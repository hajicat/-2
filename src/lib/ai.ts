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

const SYSTEM_PROMPT = `你是一个专业的考试题目解析器。用户会发送PDF提取的文本内容，请从中提取所有题目并按以下JSON格式返回：

{
  "questions": [
    {
      "type": "single",
      "stem": "题干文本",
      "options": ["A. 选项内容", "B. 选项内容", "C. 选项内容", "D. 选项内容"],
      "answer": "A",
      "explanation": "解析说明"
    }
  ]
}

规则：
1. type 字段：single=单选题, multi=多选题, judge=判断题, fill=填空题
2. 单选题 answer 为选项字母（如 "A"），多选题为多个字母（如 "AC"）
3. 判断题 answer 为 "对" 或 "错"，options 留空数组
4. 填空题 answer 为正确答案文本，options 留空数组
5. 如果PDF中有解析就提取，没有则 explanation 留空字符串
6. 确保 stem 完整，不要截断题干
7. 只返回JSON，不要任何其他文字`

export async function parsePdfWithAI(pdfText: string): Promise<ParseResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置')

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `请解析以下题目内容：\n\n${pdfText}` }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`DeepSeek API 错误: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek 返回内容为空')

  const parsed = JSON.parse(content) as ParseResult
  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI 返回格式错误：缺少 questions 数组')
  }

  return parsed
}
