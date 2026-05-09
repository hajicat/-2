# 📝 刷题复习平台

班级专属考试复习平台。管理员上传 PDF 题库，DeepSeek AI 自动解析为结构化题目，学生在线刷题，还能和排行榜上的同学进行"影子 PK"对决。

---

## ✨ 功能一览

| 功能 | 说明 |
|------|------|
| 🔐 **封闭注册** | 只有管理员能在后台添加用户，不对外开放注册 |
| 📚 **AI 解析题库** | 粘贴 PDF 文本内容 → DeepSeek 自动识别题目、选项、答案、解析 |
| ✍️ **逐题刷题** | 选择答案 → 即时判对错 → 显示正确答案和解析 |
| 👻 **影子 PK** | 排行榜选人当"影子"，刷题时实时对比进度条和正确率 |
| 🏆 **排行榜** | 按正确率 + 用时排名，支持全局和单题库排行 |
| 🛡️ **管理后台** | 用户增删改查、题库上传删除、密码重置 |

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 15 (App Router) + Tailwind CSS + TypeScript |
| 后端 | Next.js API Routes（Edge Runtime） |
| 数据库 | Turso（libSQL，免费版） |
| AI | DeepSeek API（deepseek-chat） |
| 认证 | JWT + PBKDF2（Edge 兼容） |
| 部署 | Cloudflare Pages（免费版） |

---

## 🚀 部署指南

### 第一步：创建 Turso 数据库

```bash
# 安装 Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# 登录
turso auth login

# 创建数据库
turso db create exam-prep

# 获取连接 URL
turso db show exam-prep --url
# 输出类似: libsql://exam-prep-xxx.turso.io

# 创建 auth token
turso db tokens create exam-prep
# 输出类似: eyJhbGciOiJFZDI1NTE5...
```

### 第二步：获取 DeepSeek API Key

1. 访问 [platform.deepseek.com](https://platform.deepseek.com)
2. 注册/登录 → API Keys → 创建新 Key
3. 复制 `sk-xxx` 格式的 key

### 第三步：配置环境变量

在 Cloudflare Dashboard → 你的项目 → Settings → Environment Variables 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `TURSO_DATABASE_URL` | `libsql://exam-prep-xxx.turso.io` | Turso 连接地址 |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOi...` | Turso 认证 token |
| `JWT_SECRET` | 任意随机字符串 | JWT 签名密钥 |
| `DEEPSEEK_API_KEY` | `sk-xxx` | DeepSeek API Key |

### 第四步：部署到 Cloudflare Pages

#### 方式一：命令行部署

```bash
# 安装 wrangler（如果没有）
npm install -g wrangler

# 登录 Cloudflare
npx wrangler login

# 打包
npm run pages:build

# 部署
npm run deploy
```

#### 方式二：Git 集成（推荐）

1. 把代码推到 GitHub
2. Cloudflare Dashboard → Pages → Create a project → Connect to Git
3. 选择仓库，设置：
   - **Build command**: `npm run pages:build`
   - **Build output directory**: `.vercel/output/static`
4. 添加环境变量（同第三步）
5. 部署完成

---

## 💻 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置 .env.local
cp .env.example .env.local
# 编辑 .env.local，填入 Turso 和 DeepSeek 配置

# 3. 启动开发服务器
npm run dev

# 4. 访问 http://localhost:3000
```

### 默认管理员账号

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123` |

⚠️ **首次登录后请立即修改密码**

---

## 📖 使用流程

### 管理员

1. 用管理员账号登录
2. 进入 **⚙️ 管理 → 👥 用户管理**，添加班级同学的账号
3. 进入 **📚 题库管理**，点击"上传题库"
4. 输入题库名称，将 PDF 中的题目文本粘贴到文本框
5. 点击"AI 解析并创建"，等待 DeepSeek 解析完成
6. 解析成功后，题库自动出现在学生的题库列表中

### 学生

1. 用管理员分配的账号密码登录
2. 在 **题库列表** 中选择要刷的题库
3. 逐题作答，选完点"确认"查看对错和解析
4. 全部答完查看成绩报告
5. 去 **🏆 排行榜** 查看排名，点"⚔️ 挑战"进入影子 PK 模式

### 影子 PK 模式

1. 在排行榜上选择一个同学，点"⚔️ 挑战"
2. 选择同一题库开始刷题
3. 刷题过程中，顶部会显示两条进度条：
   - 🧑 蓝色：你自己的进度
   - 👻 橙色：影子对手的历史进度
4. 实时对比谁做得快、谁正确率高
5. 答完后查看胜负结果

---

## 📁 项目结构

```
exam-prep/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # 首页（重定向到题库）
│   │   ├── login/page.tsx            # 登录页
│   │   ├── banks/
│   │   │   ├── page.tsx              # 题库列表
│   │   │   └── [id]/page.tsx         # 刷题页（含影子 PK）
│   │   ├── leaderboard/page.tsx      # 排行榜
│   │   ├── admin/
│   │   │   ├── users/page.tsx        # 用户管理
│   │   │   └── banks/page.tsx        # 题库管理
│   │   └── api/
│   │       ├── auth/login/           # 登录接口
│   │       ├── admin/users/          # 用户 CRUD
│   │       ├── admin/banks/          # 题库管理 + AI 解析
│   │       ├── banks/                # 题库列表
│   │       ├── banks/[id]/           # 题库详情 + 题目
│   │       ├── attempt/
│   │       │   ├── start/            # 获取题目
│   │       │   ├── check/            # 逐题验证答案
│   │       │   └── submit/           # 提交答题记录
│   │       ├── leaderboard/          # 排行榜
│   │       └── pk/attempts/          # 影子 PK 数据
│   ├── lib/
│   │   ├── db.ts                     # Turso 数据库连接 + 建表
│   │   ├── auth.ts                   # JWT + PBKDF2 认证
│   │   └── ai.ts                     # DeepSeek API 调用
│   └── components/                   # 公共组件（预留）
├── .vercel/output/static/            # CF Pages 打包产物
├── .env.local                        # 环境变量（本地开发）
├── package.json
├── tailwind.config.js
├── next.config.js
└── tsconfig.json
```

---

## 📊 数据库表结构

```sql
-- 用户表
users (id, username, password_hash, nickname, role, created_at)

-- 题库表
question_banks (id, name, description, question_count, created_by, created_at)

-- 题目表
questions (id, bank_id, type, stem, options_json, answer, explanation, sort_order)

-- 答题记录表（影子 PK 的数据来源）
attempt_records (id, user_id, bank_id, total_questions, correct_count,
                 total_time_ms, detail_json, created_at)
```

---

## 🔧 自定义修改

### 修改题目类型

编辑 `src/lib/ai.ts` 中的 `SYSTEM_PROMPT`，调整 AI 解析的题目类型和输出格式。

### 修改排行榜规则

编辑 `src/app/api/leaderboard/route.ts` 中的 SQL 查询，调整排序逻辑。

### 修改影子 PK 对比逻辑

编辑 `src/app/banks/[id]/page.tsx` 中的 `getShadowProgress` 函数。

---

## 📝 注意事项

1. **DeepSeek API 有调用频率限制**，上传大题库时可能需要等待
2. **Turso 免费版**限制：9GB 存储、1000 行读取/秒，班级使用完全够用
3. **CF Pages 免费版**限制：每天 500 次构建、每月 100k 请求
4. **PDF 文本提取**：目前采用手动复制粘贴方式，如需自动提取可集成 pdfjs-dist
5. **首次部署后**，Turso 数据库会自动建表并创建默认管理员

---

## 📄 License

MIT
