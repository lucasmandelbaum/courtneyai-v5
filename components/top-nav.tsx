"use client"

import Link from "next/link"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"

export function TopNav() {
  const pathname = usePathname()
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 border-b bg-background">
      <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
        <Link href="/" className="font-semibold text-xl">
          Courtney AI
        </Link>
        <div className="ml-auto flex items-center space-x-2">
          <Link href="/settings">
            <Button 
              variant={pathname === "/settings" ? "default" : "ghost"} 
              size="sm"
            >
              <User className="h-4 w-4 mr-2" />
              Account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
} 