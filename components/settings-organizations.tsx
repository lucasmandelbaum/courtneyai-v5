"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Building2, Users } from "lucide-react"
import { toast } from "sonner"

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  role?: 'owner' | 'admin' | 'member'
}

export function SettingsOrganizations() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    try {
      setLoading(true)

      // Get user's organization memberships with role priority
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organizations (*)
        `)
        .order('role', { ascending: false }) // 'owner' comes before 'member' alphabetically

      if (membershipError) throw membershipError

      // Transform the data to include role and deduplicate by organization
      const orgMap = new Map()
      memberships?.forEach(membership => {
        const orgId = membership.organizations.id
        // Only keep the first (highest privilege) role we encounter
        if (!orgMap.has(orgId)) {
          orgMap.set(orgId, {
            ...membership.organizations,
            role: membership.role
          })
        }
      })

      setOrganizations(Array.from(orgMap.values()))
    } catch (error) {
      console.error('Error loading organizations:', error)
      toast.error('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  const handleManageMembers = (orgId: string) => {
    router.push(`/organization/${orgId}/members`)
  }

  const handleViewOrganization = (orgId: string) => {
    router.push(`/organization/${orgId}`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <CardTitle>Organizations</CardTitle>
        </div>
        <CardDescription>Manage your organization memberships</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <p>You are not a member of any organizations.</p>
            <Button
              className="mt-2"
              onClick={() => router.push('/organization-setup')}
            >
              Create or Join Organization
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <div key={org.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{org.name}</h3>
                    <p className="text-sm text-gray-500">Role: {org.role}</p>
                  </div>
                  <div className="flex gap-2">
                    {org.role === 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageMembers(org.id)}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Manage Members
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewOrganization(org.id)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 