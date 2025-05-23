"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardBody, CardHeader, Button, Chip, Divider, Skeleton } from "@heroui/react"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Building2, Users, Settings, Crown, Shield, User, Plus } from "lucide-react"
import { toast } from "sonner"

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  role?: 'owner' | 'admin' | 'member'
  member_count?: number
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

      // Get user's organization memberships with organization details
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organizations (
            id,
            name,
            slug,
            created_at
          )
        `)
        .order('role', { ascending: false })

      if (membershipError) throw membershipError

      // Transform and deduplicate organizations
      const orgMap = new Map()
      memberships?.forEach(membership => {
        const org = membership.organizations as any
        const orgId = org.id
        if (!orgMap.has(orgId) || membership.role === 'owner') {
          orgMap.set(orgId, {
            ...org,
            role: membership.role
          })
        }
      })

      const orgsWithCounts = await Promise.all(
        Array.from(orgMap.values()).map(async (org) => {
          const { count } = await supabase
            .from('organization_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
          
          return { ...org, member_count: count || 0 }
        })
      )

      setOrganizations(orgsWithCounts)
    } catch (error) {
      console.error('Error loading organizations:', error)
      toast.error('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-3 w-3" />
      case 'admin':
        return <Shield className="h-3 w-3" />
      default:
        return <User className="h-3 w-3" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'warning'
      case 'admin':
        return 'primary'
      default:
        return 'default'
    }
  }

  const handleManageMembers = (orgId: string) => {
    router.push(`/organization/${orgId}/members`)
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-800">Organizations</h2>
          </div>
          <Button
            color="primary"
            onClick={() => router.push('/organization-setup')}
            startContent={<Plus className="h-4 w-4" />}
          >
            Create/Join Organization
          </Button>
        </div>
        <Divider />
        <p className="text-sm text-gray-600">Manage your organization memberships and teams</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <Skeleton className="w-32 h-6 mb-2" />
                      <Skeleton className="w-24 h-4" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="w-20 h-8" />
                    <Skeleton className="w-16 h-8" />
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No organizations found</h3>
            <p className="text-gray-600 mb-6">You are not a member of any organizations.</p>
            <Button 
              color="primary"
              onClick={() => router.push('/organization-setup')}
              startContent={<Plus className="h-4 w-4" />}
            >
              Create or Join Organization
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {organizations.map((org) => (
            <Card key={org.id} className="w-full">
              {/* Organization Header */}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-gray-900">{org.name}</h3>
                        <Chip 
                          size="sm" 
                          color={getRoleColor(org.role || 'member')}
                          startContent={getRoleIcon(org.role || 'member')}
                          variant="flat"
                        >
                          {org.role}
                        </Chip>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {org.member_count} member{org.member_count !== 1 ? 's' : ''}
                        </span>
                        <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {org.role === 'owner' && (
                      <Button
                        variant="flat"
                        onClick={() => handleManageMembers(org.id)}
                        startContent={<Settings className="h-4 w-4" />}
                      >
                        Manage
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
} 