"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Button, Input, Card, CardBody, CardHeader } from "@nextui-org/react"
import { motion } from "framer-motion"
import { Eye, EyeOff, Lock } from "lucide-react"

export default function UpdatePassword() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  // Check if we have a session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // If no session, redirect to sign in
        router.replace('/sign-in')
      }
    }
    checkSession()
  }, [router, supabase.auth])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    try {
      // First try to get the current session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error("No active session")
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) throw updateError

      // After password is updated, redirect to home
      router.replace("/")
    } catch (error) {
      console.error("Error updating password:", error)
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const togglePasswordVisibility = () => setShowPassword(!showPassword)

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-md w-full">
          <CardHeader className="flex flex-col gap-1 px-6 pt-6">
            <h1 className="text-2xl font-bold">Set Your Password</h1>
            <p className="text-sm text-default-500">
              Please set a secure password for your account
            </p>
          </CardHeader>
          <CardBody className="gap-4 px-6 pb-6">
            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
              <Input
                type={showPassword ? "text" : "password"}
                label="New Password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                startContent={<Lock className="text-default-400" size={20} />}
                endContent={
                  <button type="button" onClick={togglePasswordVisibility}>
                    {showPassword ? (
                      <EyeOff className="text-default-400" size={20} />
                    ) : (
                      <Eye className="text-default-400" size={20} />
                    )}
                  </button>
                }
                required
              />
              <Input
                type={showPassword ? "text" : "password"}
                label="Confirm Password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                startContent={<Lock className="text-default-400" size={20} />}
                required
              />
              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}
              <Button
                type="submit"
                color="primary"
                isDisabled={loading}
                className="mt-2"
                fullWidth
              >
                {loading ? "Updating password..." : "Set Password"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
} 