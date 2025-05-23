"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { resetPassword } from "@/lib/supabase-browser"
import { Button, Input, Card, CardBody, CardHeader } from "@nextui-org/react"
import { motion } from "framer-motion"
import Link from "next/link"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await resetPassword(email)
      if (error) throw error
      setSuccess(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader className="flex flex-col gap-1 px-6 pt-6">
            <h1 className="text-2xl font-bold">Reset Password</h1>
            <p className="text-sm text-default-500">
              Enter your email to reset your password
            </p>
          </CardHeader>
          <CardBody className="gap-4 px-6 pb-6">
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}
              {success && (
                <p className="text-sm text-success">
                  Check your email for the password reset link
                </p>
              )}
              <Button
                type="submit"
                color="primary"
                disabled={loading}
                className="mt-2"
              >
                {loading ? "Sending reset link..." : "Send Reset Link"}
              </Button>
              <div className="text-center text-sm">
                Remember your password?{" "}
                <Link href="/sign-in" className="text-primary">
                  Sign in
                </Link>
              </div>
            </form>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
} 