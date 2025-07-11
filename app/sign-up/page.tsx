"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useAuth } from "@/hooks/useAuth"
import { Button, Input, Card, CardBody, CardHeader, Divider } from '@nextui-org/react'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Icons } from "@/components/ui/icons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { signUpWithEmail } from '@/lib/supabase-browser'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

const formSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isEmailSent, setIsEmailSent] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const { error: signUpError, data } = await signUpWithEmail(email, password)
      if (signUpError) throw signUpError
      
      setIsEmailSent(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
      setIsEmailSent(false)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error: signUpError } = await signUpWithEmail(email, password)
      if (signUpError) throw signUpError
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const togglePasswordVisibility = () => setShowPassword(!showPassword)

  if (isEmailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="max-w-md w-full">
            <CardHeader className="flex flex-col items-center space-y-3 px-8 pt-8 pb-4">
              <div className="flex flex-col items-center space-y-2 mb-3">
                <div className="flex items-center justify-center h-10 w-10 flex-shrink-0">
                  <img
                    src="/favicon.svg"
                    alt="Courtney AI Logo"
                    className="h-10 w-10"
                  />
                </div>
                <div className="flex items-center justify-center max-w-32 h-8">
                  <img
                    src="/courtney-ai-wordmark.png"
                    alt="Courtney AI"
                    className="w-auto max-w-full object-contain max-h-6"
                  />
                </div>
              </div>
              <Mail className="w-10 h-10 mx-auto text-primary mt-1" />
            </CardHeader>
            <CardBody className="gap-3 px-8 py-7 text-center">
              <h1 className="text-xl font-bold mb-1">Check Your Email</h1>
              <p className="text-default-500">
                We've sent a confirmation link to <strong>{email}</strong>
              </p>
              <p className="text-default-500 mt-2">
                Please check your email and click the link to activate your account.
              </p>
              <Divider className="my-4" />
              <div className="text-sm text-default-500">
                Didn't receive the email?{' '}
                <Button
                  variant="light"
                  color="primary"
                  onPress={handleResend}
                  isDisabled={loading}
                >
                  Resend
                </Button>
              </div>
              <div className="mt-4">
                <Link href="/sign-in" className="text-primary text-sm">
                  Back to Sign In
                </Link>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="max-w-md w-full">
          <CardHeader className="flex flex-col items-center space-y-3 px-8 pt-8 pb-4">
            <div className="flex flex-col items-center space-y-2 mb-3">
              <div className="flex items-center justify-center h-10 w-10 flex-shrink-0">
                <img
                  src="/favicon.svg"
                  alt="Courtney AI Logo"
                  className="h-10 w-10"
                />
              </div>
              <div className="flex items-center justify-center max-w-32 h-8">
                <img
                  src="/courtney-ai-wordmark.png"
                  alt="Courtney AI"
                  className="w-auto max-w-full object-contain max-h-6"
                />
              </div>
            </div>
            <p className="text-sm text-default-500 text-center pt-1">Sign up for a new account</p>
          </CardHeader>
          <CardBody className="gap-3.5 px-8 pb-6">
            <form onSubmit={handleSignUp} className="flex flex-col gap-3.5">
              <Input
                type="email"
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                startContent={<Mail className="text-default-400" size={20} />}
                required
              />
              <Input
                type={showPassword ? "text" : "password"}
                label="Password"
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
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
              <div className="text-center text-sm">
                Already have an account?{' '}
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