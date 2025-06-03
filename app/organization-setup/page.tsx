"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient, signOut } from '@/lib/supabase-browser'
import { Button, Input, Card, CardBody, CardHeader, Tabs, Tab } from '@nextui-org/react'
import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { PostgrestError } from '@supabase/supabase-js'

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
      if (error instanceof PostgrestError) {
        setError(error.message)
      } else {
        setError('Failed to check organization membership')
      }
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement)
      const name = String(formData.get('name'))
      const slug = String(formData.get('name'))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      console.log('Creating organization:', { name, slug })

      // Get current user first to ensure we're authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        throw userError
      }
      if (!user) {
        throw new Error('No authenticated user found')
      }

      console.log('User authenticated:', user.id)

      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name, slug })
        .select()
        .single()

      if (orgError) {
        if (orgError.code === '23505') {
          throw new Error('An organization with this name already exists')
        }
        throw orgError
      }

      if (!orgData) {
        throw new Error('Failed to create organization')
      }

      console.log('Organization created:', orgData.id)

      // Add user as owner
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: user.id,
          role: 'owner'
        })

      if (memberError) {
        console.error('Failed to add user as owner:', memberError)
        // Cleanup the created organization if member creation fails
        await supabase
          .from('organizations')
          .delete()
          .eq('id', orgData.id)
        throw memberError
      }

      console.log('User added as owner, verifying membership...')

      // Wait a moment and verify the membership was created successfully
      // This helps avoid race condition with middleware
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { data: verifyMember, error: verifyError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .eq('organization_id', orgData.id)
        .single()

      if (verifyError || !verifyMember) {
        console.error('Failed to verify membership:', verifyError)
        throw new Error('Organization created but membership verification failed')
      }

      console.log('Membership verified, redirecting to dashboard...')

      // Redirect to home
      router.replace('/')
    } catch (error) {
      console.error('Error creating organization:', error)
      if (error instanceof PostgrestError) {
        setError(error.message)
      } else if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('An unexpected error occurred while creating the organization')
      }
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('You must be logged in')
      }

      console.log('User authenticated:', session.user.id)

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

      // Wait a moment and verify the membership was created successfully
      // This helps avoid race condition with middleware
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { data: verifyMember, error: verifyError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', session.user.id)
        .single()

      if (verifyError || !verifyMember) {
        console.error('Failed to verify membership after joining:', verifyError)
        throw new Error('Joined organization but membership verification failed')
      }

      console.log('Membership verified, redirecting to dashboard...', {
        organizationId: verifyMember.organization_id,
        role: verifyMember.role
      })

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