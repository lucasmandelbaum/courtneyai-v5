"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Building2, ArrowLeft, Users, CheckCircle } from "lucide-react"
import { SettingsBilling } from "@/components/settings-billing"

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  member_count: number
  role?: 'owner' | 'admin' | 'member'
}

export default function OrganizationPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [subscriptionRefreshKey, setSubscriptionRefreshKey] = useState(0)
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    loadOrganization()
  }, [])

  useEffect(() => {
    // Check if user returned from successful Stripe checkout
    const sessionId = searchParams.get('session_id')
    if (sessionId && organization) {
      handleCheckoutSuccess(sessionId)
    }
  }, [organization, searchParams])

  const handleCheckoutSuccess = async (sessionId: string) => {
    try {
      setCheckingPayment(true)
      
      // Show immediate success feedback
      toast.success('Payment successful! Your subscription is now active.', {
        icon: <CheckCircle className="h-4 w-4" />,
        duration: 5000
      })

      // Wait a moment for webhook processing, then refresh subscription data
      setTimeout(() => {
        setSubscriptionRefreshKey(prev => prev + 1)
      }, 2000)

      // Clean up the URL by removing the session_id parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.pathname)
      
    } catch (error) {
      console.error('Error handling checkout success:', error)
      toast.error('Payment was processed but there was an issue updating your account. Please contact support if needed.')
    } finally {
      setCheckingPayment(false)
    }
  }

  const handleSubscriptionUpdate = () => {
    // This will be called when subscription data is refreshed
    // We can use this to trigger any additional UI updates if needed
  }

  const loadOrganization = async () => {
    try {
      setLoading(true)

      // First check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!session) {
        router.push('/sign-in')
        return
      }

      const organizationId = Array.isArray(params.id) ? params.id[0] : params.id
      if (!organizationId) {
        toast.error('Invalid organization ID')
        router.push('/settings')
        return
      }

      // Get organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*, organization_members(count)')
        .eq('id', organizationId)
        .single()

      if (orgError) {
        if (orgError.code === 'PGRST116') {
          toast.error('Organization not found')
          router.push('/settings')
          return
        }
        throw orgError
      }

      // Get user's role in organization
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', session.user.id)
        .single()

      if (membershipError) {
        if (membershipError.code === 'PGRST116') {
          toast.error('You do not have access to this organization')
          router.push('/settings')
          return
        }
        throw membershipError
      }

      setOrganization({
        ...org,
        member_count: org.organization_members[0].count,
        role: membership.role as 'owner' | 'admin' | 'member'
      })
    } catch (error) {
      console.error('Error loading organization:', error)
      toast.error('Failed to load organization')
      router.push('/settings')
    } finally {
      setLoading(false)
    }
  }

  if (loading || checkingPayment) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          {checkingPayment && (
            <p className="text-sm text-gray-600">Processing your payment...</p>
          )}
        </div>
      </div>
    )
  }

  if (!organization) return null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Organization Details</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>{organization.name}</CardTitle>
            </div>
            <CardDescription>Organization information and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Organization ID</p>
              <p className="text-sm text-gray-500">{organization.slug}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Your Role</p>
              <p className="text-sm text-gray-500">{organization.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Member Count</p>
              <p className="text-sm text-gray-500">{organization.member_count}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Created At</p>
              <p className="text-sm text-gray-500">
                {new Date(organization.created_at).toLocaleDateString()}
              </p>
            </div>

            {organization.role === 'owner' && (
              <div className="pt-4">
                <Button
                  onClick={() => router.push(`/organization/${organization.id}/members`)}
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Members
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {organization.role === 'owner' && (
          <SettingsBilling 
            organizationId={organization.id} 
            key={subscriptionRefreshKey}
            onSubscriptionUpdate={handleSubscriptionUpdate}
          />
        )}
      </div>
    </div>
  )
} 