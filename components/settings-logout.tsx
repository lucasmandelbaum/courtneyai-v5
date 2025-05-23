"use client"

import { LogOut } from "lucide-react"
import { Button, Card, CardBody, Divider } from "@heroui/react"
import { useAuth } from "@/hooks/useAuth"

export function SettingsLogout() {
  const { signOut, isLoading } = useAuth()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LogOut className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-800">Account Access</h3>
      </div>
      <Divider />
      
      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Sign Out</h4>
            <p className="text-sm text-gray-600">
              Logging out will end your current session and return you to the login page.
              You'll need to sign in again to access your account.
            </p>
          </div>
          
          <div className="flex justify-start">
            <Button 
              color="danger"
              variant="flat"
              onClick={signOut}
              isLoading={isLoading}
              startContent={<LogOut className="h-4 w-4" />}
            >
              Sign Out
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
} 