"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { toast } from "sonner"

export function SettingsForm() {
  const { user, isLoading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setDisplayName(user.user_metadata.full_name)
    }
  }, [user])

  const handleProfileUpdate = async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName }
      })

      if (error) throw error
      toast.success("Profile updated successfully")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const currentPassword = formData.get("current-password") as string
    const newPassword = formData.get("new-password") as string
    const confirmPassword = formData.get("confirm-password") as string

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      })

      if (error) throw error
      
      toast.success("Password updated successfully")
      e.currentTarget.reset()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account settings and preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input 
              id="name" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              value={user?.email || ""}
              disabled
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleProfileUpdate}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordChange}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input 
                id="new-password" 
                name="new-password"
                type="password" 
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input 
                id="confirm-password" 
                name="confirm-password"
                type="password"
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Change Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
} 