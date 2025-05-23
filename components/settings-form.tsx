"use client"

import { useState, useEffect } from "react"
import { Card, CardBody, CardHeader, Input, Button, Divider } from "@heroui/react"
import { useAuth } from "@/hooks/useAuth"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { toast } from "sonner"
import { User, Lock } from "lucide-react"

export function SettingsForm() {
  const { user, isLoading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
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

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long")
      return
    }

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      })

      if (error) throw error
      
      toast.success("Password updated successfully")
      // Clear password fields
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardBody>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Profile Information</h3>
        </div>
        <Divider />
        
        <Card>
          <CardBody className="space-y-6">
            <Input
              label="Display Name"
              placeholder="Enter your display name"
              value={displayName}
              onValueChange={setDisplayName}
              variant="bordered"
            />
            
            <Input
              label="Email"
              placeholder="Your email address"
              value={user?.email || ""}
              isReadOnly
              variant="bordered"
              description="Email cannot be changed directly. Contact support if needed."
            />
            
            <div className="flex justify-end">
              <Button 
                color="primary"
                onClick={handleProfileUpdate}
                isLoading={isLoading}
                isDisabled={!displayName.trim() || displayName === user?.user_metadata?.full_name}
              >
                Save Changes
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Password Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Change Password</h3>
        </div>
        <Divider />
        
        <Card>
          <CardBody className="space-y-6">
            <Input
              label="New Password"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onValueChange={setNewPassword}
              variant="bordered"
              description="Must be at least 6 characters long"
            />
            
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              variant="bordered"
              color={newPassword && confirmPassword && newPassword !== confirmPassword ? "danger" : "default"}
              errorMessage={newPassword && confirmPassword && newPassword !== confirmPassword ? "Passwords do not match" : ""}
            />
            
            <div className="flex justify-end">
              <Button 
                color="primary"
                onClick={handlePasswordChange}
                isLoading={isLoading}
                isDisabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
              >
                Change Password
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
} 