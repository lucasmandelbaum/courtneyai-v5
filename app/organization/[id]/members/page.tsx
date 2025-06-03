"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Card, CardHeader, CardBody } from "@heroui/card"
import { Button } from "@heroui/button"
import { Input } from "@heroui/input"
import { Select, SelectItem } from "@heroui/select"
import { Chip } from "@heroui/chip"
import { Divider } from "@heroui/divider"
import { Spinner } from "@heroui/spinner"
import { toast } from "sonner"
import { Users, ArrowLeft, UserPlus, Trash2, Ticket, Plus, Copy, Crown, Shield, User } from "lucide-react"

interface Member {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
  user_email: string | null
}

interface InviteCode {
  id: string
  code: string
  expires_at: string | null
}

export default function OrganizationMembersPage() {
  const params = useParams()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set())
  const supabase = createBrowserSupabaseClient()

  const organizationId = Array.isArray(params.id) ? params.id[0] : params.id

  useEffect(() => {
    if (organizationId) {
      loadMembers()
      loadInviteCodes()
      getCurrentUserRole()
    }
  }, [organizationId])

  const getCurrentUserRole = async () => {
    if (!organizationId) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('No session found')
        return
      }

      console.log('Current user ID:', session.user.id)
      console.log('Organization ID:', organizationId)

      const { data: membership, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', session.user.id)
        .single()

      console.log('Current user membership:', membership)

      if (error) {
        console.error('Error getting current user role:', error)
        throw error
      }
      
      setCurrentUserRole(membership?.role || null)
      console.log('Current user role set to:', membership?.role || null)
    } catch (error) {
      console.error('Error getting current user role:', error)
    }
  }

  const loadMembers = async () => {
    if (!organizationId) return
    
    try {
      setLoading(true)

      // Get all members with their email addresses using the view
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members_with_emails')
        .select('*')
        .eq('organization_id', organizationId)
        .order('role', { ascending: false }) // owners first

      if (membersError) throw membersError

      // Map and filter out any invalid records
      const validMembers: Member[] = (membersData || [])
        .filter(member => 
          member.id && 
          member.user_id && 
          member.role && 
          member.created_at
        )
        .map(member => ({
          id: member.id!,
          user_id: member.user_id!,
          role: member.role! as 'owner' | 'admin' | 'member',
          created_at: member.created_at!,
          user_email: member.user_email
        }))

      setMembers(validMembers)
    } catch (error) {
      console.error('Error loading members:', error)
      toast.error('Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  const loadInviteCodes = async () => {
    if (!organizationId) return
    
    try {
      const { data: codes, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .is('used_by', null)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      setInviteCodes(codes || [])
    } catch (error) {
      console.error('Error loading invite codes:', error)
      toast.error('Failed to load invite codes')
    }
  }

  const generateInviteCode = async () => {
    if (!organizationId) return
    
    try {
      setIsGeneratingCode(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('You must be logged in')
        return
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-member/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organizationId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      toast.success('New invite code generated')
      loadInviteCodes()
    } catch (error) {
      console.error('Error generating invite code:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate invite code')
    } finally {
      setIsGeneratingCode(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      setUpdatingRoles(prev => new Set(prev).add(memberId))

      console.log('Updating role for member:', memberId, 'to:', newRole)

      // Debug: Check authentication state before update
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session before update:', {
        user_id: session?.user?.id,
        access_token_present: !!session?.access_token,
        expires_at: session?.expires_at
      })

      // Debug: Test the RLS function directly
      if (organizationId) {
        const { data: rlsTest } = await supabase.rpc('is_current_user_owner', {
          org_id: organizationId
        })
        console.log('RLS function test result:', rlsTest)
      }

      const { data, error, count } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .select()

      console.log('Update result:', { data, error, count })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      // Check if any rows were actually updated
      if (!data || data.length === 0) {
        console.error('No rows were updated. This might be due to RLS policies.')
        throw new Error('Update failed: No rows were affected. You may not have permission to update this member.')
      }

      console.log('Successfully updated member:', data[0])
      toast.success(`Role updated to ${newRole}`)
      loadMembers() // Reload to get updated data
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update role')
    } finally {
      setUpdatingRoles(prev => {
        const newSet = new Set(prev)
        newSet.delete(memberId)
        return newSet
      })
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      toast.success('Member removed successfully')
      loadMembers()
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
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

  const getRoleColor = (role: string): "warning" | "primary" | "default" => {
    switch (role) {
      case 'owner':
        return 'warning' // Golden/yellow color
      case 'admin':
        return 'primary' // Blue color
      default:
        return 'default' // Gray color
    }
  }

  const isOwner = currentUserRole === 'owner'

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button
            variant="bordered"
            size="sm"
            isIconOnly
            onPress={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Organization Members</h1>
        </div>

        <Card>
          <CardHeader className="flex gap-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              <div className="flex flex-col">
                <p className="text-md font-semibold">Invite Codes</p>
                <p className="text-small text-default-500">Generate and manage invite codes</p>
              </div>
            </div>
          </CardHeader>
          <Divider/>
          <CardBody>
            <div className="flex gap-2 mb-6">
              <Button 
                color="primary"
                startContent={<Plus className="h-4 w-4" />}
                onPress={generateInviteCode} 
                isLoading={isGeneratingCode}
              >
                {isGeneratingCode ? 'Generating...' : 'Generate New Code'}
              </Button>
            </div>

            {inviteCodes.length === 0 ? (
              <div className="text-center py-8 text-default-500">
                No active invite codes
              </div>
            ) : (
              <div className="space-y-4">
                {inviteCodes.map((code) => (
                  <Card key={code.id} shadow="sm">
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-lg font-semibold">{code.code}</p>
                          <p className="text-sm text-default-500">
                            Expires: {new Date(code.expires_at || '').toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="flat"
                          size="sm"
                          isIconOnly
                          onPress={() => {
                            navigator.clipboard.writeText(code.code)
                            toast.success('Invite code copied to clipboard')
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <div className="flex flex-col">
                <p className="text-md font-semibold">Members</p>
                <p className="text-small text-default-500">Current organization members</p>
              </div>
            </div>
          </CardHeader>
          <Divider/>
          <CardBody>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-default-500">
                No members found
              </div>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <Card key={member.id} shadow="sm">
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{member.user_email || 'Unknown'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Chip 
                                color={getRoleColor(member.role)} 
                                variant="flat"
                                startContent={getRoleIcon(member.role)}
                                size="sm"
                              >
                                {member.role}
                              </Chip>
                              <span className="text-xs text-default-500">
                                Joined {new Date(member.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {isOwner && member.role !== 'owner' && (
                            <Select
                              selectedKeys={[member.role]}
                              onSelectionChange={(keys) => {
                                const newRole = Array.from(keys)[0] as string
                                if (newRole && newRole !== member.role) {
                                  handleRoleChange(member.id, newRole)
                                }
                              }}
                              isDisabled={updatingRoles.has(member.id)}
                              size="sm"
                              className="w-32"
                            >
                              <SelectItem key="admin" startContent={<Shield className="h-3 w-3" />}>
                                Admin
                              </SelectItem>
                              <SelectItem key="member" startContent={<User className="h-3 w-3" />}>
                                Member
                              </SelectItem>
                            </Select>
                          )}
                          
                          {isOwner && member.role !== 'owner' && (
                            <Button
                              variant="flat"
                              color="danger"
                              size="sm"
                              isIconOnly
                              onPress={() => handleRemoveMember(member.id)}
                              isDisabled={updatingRoles.has(member.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
} 