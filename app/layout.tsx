import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { HeroUIProvider } from "@heroui/react"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/hooks/useAuth"
import { LayoutWithConditionalSidebar } from "@/components/layout-with-conditional-sidebar"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Courtney AI",
  description: "AI-powered content creation for TikTok creators",
  generator: 'v0.dev',
  metadataBase: new URL('https://courtneyai.com'),
  keywords: ["AI", "TikTok", "content creation", "social media", "video creation", "artificial intelligence"],
  authors: [{ name: "Courtney AI Team" }],
  creator: "Courtney AI",
  publisher: "Courtney AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/favicon.svg',
        color: '#000000',
      },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://courtneyai.com',
    title: 'Courtney AI - AI-Powered Content Creation for TikTok',
    description: 'Create engaging TikTok content with AI assistance. Transform your ideas into viral videos with Courtney AI.',
    siteName: 'Courtney AI',
    images: [
      {
        url: '/web-app-manifest-512x512.png',
        width: 512,
        height: 512,
        alt: 'Courtney AI Logo',
      },
      {
        url: '/web-app-manifest-192x192.png',
        width: 192,
        height: 192,
        alt: 'Courtney AI Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Courtney AI - AI-Powered Content Creation for TikTok',
    description: 'Create engaging TikTok content with AI assistance. Transform your ideas into viral videos with Courtney AI.',
    creator: '@courtneyai',
    images: ['/web-app-manifest-512x512.png'],
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
  },
  category: 'technology',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <HeroUIProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <AuthProvider>
              <LayoutWithConditionalSidebar>
                {children}
              </LayoutWithConditionalSidebar>
            </AuthProvider>
          </ThemeProvider>
        </HeroUIProvider>
      </body>
    </html>
  )
}
