import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '刷题复习平台',
  description: '班级考试复习平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
