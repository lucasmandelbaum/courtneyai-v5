"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient, signOut } from '@/lib/supabase-browser'
import { Button, Input, Card, CardBody, CardHeader, Tabs, Tab } from '@nextui-org/react'
import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'

export default function OrganizationSetup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('organization-create')
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    // Check if user already has an organization
    checkOrganization()
  }, [])

  const checkOrganization = async () => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .single()

      if (memberError && memberError.code !== 'PGRST116') {
        throw memberError
      }

      if (memberData?.organization_id) {
        // User already has an organization, redirect to home
        router.replace('/')
      }
    } catch (error) {
      console.error('Error checking organization:', error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Failed to check organization membership')
      }
    }
  }

  const waitForOrganizationMembership = async (userId: string): Promise<boolean> => {
    let retries = 0
    const maxRetries = 20 // 10 seconds total with 500ms delays
    
    console.log('Waiting for organization membership to be confirmed...')
    
    while (retries < maxRetries) {
      try {
        const { data: memberData, error: memberError } = await supabase
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', userId)
          .single()

        if (memberError && memberError.code !== 'PGRST116') {
          console.error('Error checking membership:', memberError)
          throw memberError
        }

        if (memberData?.organization_id) {
          console.log('Organization membership confirmed:', {
            organizationId: memberData.organization_id,
            role: memberData.role,
            attemptsUsed: retries + 1
          })
          return true
        }

        console.log(`Membership not found yet, retrying... (${retries + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 500))
        retries++
      } catch (error) {
        console.error('Error during membership check:', error)
        throw error
      }
    }

    console.error('Failed to confirm organization membership after maximum retries')
    return false
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement)
      const name = String(formData.get('name'))

      console.log('Creating organization:', { name })

      // Get current user and session for API call
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('User auth error:', userError)
        throw userError
      }
      if (!user) {
        throw new Error('No authenticated user found. Please sign in again.')
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No session found. Please sign in again.')
      }

      console.log('User authenticated:', user.id)

      // Call Edge function to create organization
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-organization`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create organization')
      }

      console.log('Organization created successfully:', result.data)

      // Wait for organization membership to be confirmed in database
      const membershipConfirmed = await waitForOrganizationMembership(user.id)
      
      if (!membershipConfirmed) {
        throw new Error('Organization was created but membership confirmation timed out. Please refresh the page.')
      }

      console.log('Redirecting to dashboard...')

      // Redirect to home
      router.replace('/')
    } catch (error) {
      console.error('Error creating organization:', error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred while creating the organization')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement)
      const code = String(formData.get('code'))

      console.log('Joining organization with code:', code)

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('User auth error:', userError)
        throw userError
      }
      if (!user) {
        throw new Error('You must be logged in')
      }

      console.log('User authenticated:', user.id)

      // Get user session for the access token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No session found. Please sign in again.')
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-member/use`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      console.log('Successfully joined organization, verifying membership...')

      // Wait for organization membership to be confirmed in database
      const membershipConfirmed = await waitForOrganizationMembership(user.id)
      
      if (!membershipConfirmed) {
        throw new Error('Joined organization but membership confirmation timed out. Please refresh the page.')
      }

      console.log('Membership verified, redirecting to dashboard...')

      // Redirect to home
      router.replace('/')
    } catch (error) {
      console.error('Error joining organization:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      const { error } = await signOut()
      if (error) throw error
      router.replace('/sign-in')
    } catch (error) {
      console.error('Error signing out:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-r from-blue-50 to-indigo-100">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col items-center space-y-2 px-8 pt-8 pb-0">
            <div className="w-full flex justify-end">
              <Button
                isIconOnly
                color="default"
                variant="light"
                onPress={handleSignOut}
                isLoading={signingOut}
                className="absolute top-4 right-4"
                aria-label="Sign out"
              >
                {!signingOut && <LogOut size={20} />}
              </Button>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Organization Setup</h1>
            <p className="text-md text-gray-600">Create or join an organization to continue</p>
          </CardHeader>
          <CardBody className="px-8 py-6">
            <Tabs 
              selectedKey={selectedTab} 
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="mb-6"
              aria-label="Organization setup options"
              disableAnimation={true}
            >
              <Tab 
                key="organization-create" 
                title="Create Organization"
                id="create-org-tab"
              >
                <form onSubmit={handleCreateOrganization} className="space-y-6" id="create-org-form">
                  <Input
                    key="org-name-input"
                    type="text"
                    name="name"
                    label="Organization Name"
                    placeholder="Enter organization name"
                    isRequired
                    classNames={{
                      label: "text-sm font-medium",
                      inputWrapper: "h-12",
                    }}
                  />
                  {error && (
                    <div key="create-error" className="bg-red-100 text-red-800 p-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  <Button
                    key="create-submit"
                    type="submit"
                    color="primary"
                    isLoading={loading}
                    className="w-full"
                    size="lg"
                  >
                    Create Organization
                  </Button>
                </form>
              </Tab>
              <Tab 
                key="organization-join" 
                title="Join Organization"
                id="join-org-tab"
              >
                <form onSubmit={handleJoinOrganization} className="space-y-6" id="join-org-form">
                  <Input
                    key="org-code-input"
                    type="text"
                    name="code"
                    label="Invite Code"
                    placeholder="Enter invite code"
                    isRequired
                    classNames={{
                      label: "text-sm font-medium",
                      inputWrapper: "h-12",
                    }}
                  />
                  {error && (
                    <div key="join-error" className="bg-red-100 text-red-800 p-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  <Button
                    key="join-submit"
                    type="submit"
                    color="primary"
                    isLoading={loading}
                    className="w-full"
                    size="lg"
                  >
                    Join Organization
                  </Button>
                </form>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
} 