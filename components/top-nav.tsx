"use client"

import Link from "next/link"
import { User, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"

export function TopNav() {
  const pathname = usePathname()
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto flex h-16 items-center px-4 md:px-6">
        <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center h-8 w-8 flex-shrink-0">
            <img
              src="/favicon.svg"
              alt="Courtney AI Logo"
              className="h-8 w-8"
            />
          </div>
          <div className="flex items-center justify-center max-w-28 h-8">
            <img
              src="/courtney-ai-wordmark.png"
              alt="Courtney AI"
              className="w-auto max-w-full object-contain max-h-4"
            />
          </div>
        </Link>
        <div className="ml-auto flex items-center space-x-2">
          <Link href="/support">
            <Button 
              variant={pathname === "/support" ? "default" : "ghost"} 
              size="icon"
              className="transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button 
              variant={pathname === "/settings" ? "default" : "ghost"} 
              size="icon"
              className="transition-colors"
            >
              <User className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
} 