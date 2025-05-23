"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Spinner } from "@nextui-org/react"
import { Building2, Users } from "lucide-react"

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  role?: 'owner' | 'admin' | 'member'
}

interface OrganizationMember {
  id: string
  user_id: string
  organization_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}

export default function AccountPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get user's organization memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')

      if (membershipError) throw membershipError

      // Transform the data to include role
      const orgs = memberships?.map(membership => ({
        ...membership.organizations,
        role: membership.role
      })) || []

      setOrganizations(orgs)
    } catch (error) {
      console.error('Error loading organizations:', error)
      setError('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="md:ml-64 p-4 md:p-6">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Account</h1>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>View and update your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="User Name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="user@example.com" />
            </div>
          </CardContent>
          <CardFooter>
            <Button>Save Changes</Button>
          </CardFooter>
        </Card>

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
                <Spinner />
              </div>
            ) : error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : organizations.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>You are not a member of any organizations.</p>
                <Button
                  className="mt-2"
                  onClick={() => window.location.href = '/organization-setup'}
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
                          <Button variant="outline" size="sm">
                            <Users className="h-4 w-4 mr-1" />
                            Manage Members
                          </Button>
                        )}
                        <Button variant="outline" size="sm">View</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
