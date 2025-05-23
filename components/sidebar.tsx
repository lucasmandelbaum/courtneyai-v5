"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, Settings, LogOut, Menu, X, LogIn, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/hooks/useAuth"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UsageTracker } from "@/components/usage-tracker"

const navItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: Home,
  }
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { user, signOut, isLoading } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
  }

  const toggleCollapsed = () => {
    setCollapsed(!collapsed)
  }

  return (
    <>
      {/* Mobile Navigation */}
      <div className="fixed top-4 left-4 z-40 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <Link href="/" className="flex items-center space-x-2 font-semibold text-xl hover:opacity-80 transition-opacity">
                    <div className="relative h-6 w-6 flex-shrink-0">
                      <img
                        src="/favicon.svg"
                        alt="Courtney AI Logo"
                        className="h-6 w-6"
                      />
                    </div>
                    <div className="flex items-center h-6 max-w-20">
                      <img
                        src="/courtney-ai-wordmark.png"
                        alt="Courtney AI"
                        className="h-5 w-auto max-w-full object-contain"
                      />
                    </div>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <nav className="flex-1 p-4">
                <ul className="space-y-2">
                  {navItems.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                          pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              
              {/* Usage Tracker for Mobile */}
              {user && (
                <div className="p-4 border-t">
                  <UsageTracker variant="sidebar" showUpgradeButton={false} />
                </div>
              )}
              
              <div className="p-4 border-t mt-auto">
                <div className="flex flex-col gap-2">
                  <Link href="/settings">
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                  </Link>
                  {user ? (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={handleSignOut}
                      disabled={isLoading}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  ) : (
                    <Link href="/sign-in">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start" 
                        size="sm"
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30 transition-all duration-300",
        collapsed ? "md:w-16" : "md:w-64"
      )}>
        <div className="flex flex-col flex-grow border-r bg-background">
          <div className={cn(
            "flex items-center h-16 px-4 border-b",
            collapsed ? "justify-center" : "justify-between"
          )}>
            {!collapsed && <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="relative h-6 w-6 flex-shrink-0">
                <img
                  src="/favicon.svg"
                  alt="Courtney AI Logo"
                  className="h-6 w-6"
                />
              </div>
              <div className="flex items-center h-6 max-w-20">
                <img
                  src="/courtney-ai-wordmark.png"
                  alt="Courtney AI"
                  className="h-5 w-auto max-w-full object-contain"
                />
              </div>
            </Link>}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleCollapsed}
              className={collapsed ? "mx-auto" : "ml-auto"}
            >
              {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              <TooltipProvider>
                {navItems.map((item) => (
                  <Tooltip key={item.name} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center rounded-md px-3 py-2 text-sm font-medium",
                          pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                          collapsed ? "justify-center" : "gap-3"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right">
                        {item.name}
                      </TooltipContent>
                    )}
                  </Tooltip>
                ))}
              </TooltipProvider>
            </nav>
            
            {/* Usage Tracker for Desktop */}
            {user && !collapsed && (
              <div className="px-2 py-4">
                <UsageTracker variant="sidebar" showUpgradeButton={true} />
              </div>
            )}
          </div>
          <div className={cn(
            "p-4 border-t",
            collapsed ? "flex justify-center" : ""
          )}>
            {collapsed ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/settings">
                      <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Settings
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/settings">
                  <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                </Link>
                {user ? (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start" 
                    size="sm"
                    onClick={handleSignOut}
                    disabled={isLoading}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                ) : (
                  <Link href="/sign-in" className="w-full">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start" 
                      size="sm"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
