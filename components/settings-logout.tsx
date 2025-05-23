"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"

export function SettingsLogout() {
  const { signOut, isLoading } = useAuth()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Manage your account access.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Logging out will end your current session and return you to the login page.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          variant="destructive"
          onClick={signOut}
          disabled={isLoading}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </CardFooter>
    </Card>
  )
} 