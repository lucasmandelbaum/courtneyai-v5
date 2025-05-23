import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/hooks/useAuth"
import { LayoutWithConditionalSidebar } from "@/components/layout-with-conditional-sidebar"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Courtney AI",
  description: "AI-powered content creation for TikTok creators",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <LayoutWithConditionalSidebar>
              {children}
            </LayoutWithConditionalSidebar>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
