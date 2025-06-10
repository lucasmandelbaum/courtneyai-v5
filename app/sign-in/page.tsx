"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmail } from '@/lib/supabase-browser'
import { Button, Input, Card, CardBody, CardHeader } from '@nextui-org/react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function SignIn() {
  // We no longer control the input values inside React state to ensure browser autofill behaves correctly
  // Values will be read from the DOM via FormData when the form is submitted.
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const msg = searchParams.get('message')
    if (msg) {
      setMessage(msg)
    }
  }, [searchParams])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Extract values from the form (uncontrolled inputs) so browser autofill is respected
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    const email = String(formData.get('email') || '')
    const password = String(formData.get('password') || '')

    try {
      const { error: signInError, data } = await signInWithEmail(email, password)
      
      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          setError('Please confirm your email address before signing in.')
          return
        }
        throw signInError
      }

      console.log('Sign in successful, redirecting...')
      
      const redirectTo = searchParams.get('redirectTo') || '/'
      router.replace(redirectTo)
    } catch (error) {
      console.error('Sign in error:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const togglePasswordVisibility = () => setShowPassword(!showPassword)

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-r from-blue-50 to-indigo-100">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-lg">
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
            <p className="text-sm text-gray-600 pt-1 text-center">Welcome back! Please sign in to your account.</p>
          </CardHeader>
          <CardBody className="px-8 py-6">
            {message && (
              <div className="mb-4 bg-blue-100 text-blue-800 p-3 rounded-lg text-sm">
                {message}
              </div>
            )}
            <form onSubmit={handleSignIn} className="space-y-5">
              <Input
                type="email"
                name="email"
                id="email"
                autoComplete="email"
                placeholder="Enter your email"
                classNames={{
                  label: "text-sm font-medium",
                  inputWrapper: "h-12 gap-3 pl-3",
                  input: "text-base md:text-sm"
                }}
                required
              />
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                id="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                endContent={
                  <button 
                    type="button" 
                    onClick={togglePasswordVisibility}
                    className="focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="text-gray-400" size={20} />
                    ) : (
                      <Eye className="text-gray-400" size={20} />
                    )}
                  </button>
                }
                classNames={{
                  label: "text-sm font-medium",
                  inputWrapper: "h-12 gap-3 pl-3",
                  input: "text-base md:text-sm"
                }}
                required
              />
              {error && (
                <div className="bg-red-100 text-red-800 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                color="primary"
                isDisabled={loading}
                className="w-full mt-2"
                size="lg"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <div className="flex items-center justify-between pt-2">
                <Link 
                  href="/sign-up" 
                  className="text-sm text-blue-600 hover:underline"
                >
                  Create account
                </Link>
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </form>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
} 