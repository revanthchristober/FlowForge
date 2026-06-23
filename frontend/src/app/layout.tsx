import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { ReactQueryProvider } from '@/lib/query-client'
import './globals.css'

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ForgeFlow — AI Software Delivery',
  description: 'PRD-to-production multi-agent pipeline with LangGraph + LiteLLM + Langfuse',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} h-full`}>
      <body className="min-h-full bg-navy text-cream antialiased" suppressHydrationWarning>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  )
}
