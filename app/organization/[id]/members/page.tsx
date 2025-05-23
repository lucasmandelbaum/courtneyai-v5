"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Users, ArrowLeft, UserPlus, Trash2, Ticket, Plus, Copy } from "lucide-react"

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
  expires_at: string
}

export default function OrganizationMembersPage() {
  const params = useParams()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    loadMembers()
    loadInviteCodes()
  }, [])

  const loadMembers = async () => {
    try {
      setLoading(true)

      // Get all members with their email addresses using the view
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members_with_emails')
        .select('*')
        .eq('organization_id', params.id)
        .order('role', { ascending: false }) // owners first

      if (membersError) throw membersError

      setMembers(membersData || [])
    } catch (error) {
      console.error('Error loading members:', error)
      toast.error('Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  const loadInviteCodes = async () => {
    try {
      const { data: codes, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('organization_id', params.id)
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
          organizationId: params.id
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
          <h1 className="text-2xl font-bold">Organization Members</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              <CardTitle>Invite Codes</CardTitle>
            </div>
            <CardDescription>Generate and manage invite codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <Button 
                onClick={generateInviteCode} 
                disabled={isGeneratingCode}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isGeneratingCode ? 'Generating...' : 'Generate New Code'}
              </Button>
            </div>

            {inviteCodes.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No active invite codes
              </div>
            ) : (
              <div className="space-y-4">
                {inviteCodes.map((code) => (
                  <div key={code.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-mono text-lg">{code.code}</p>
                      <p className="text-sm text-gray-500">
                        Expires: {new Date(code.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(code.code)
                        toast.success('Invite code copied to clipboard')
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>Members</CardTitle>
            </div>
            <CardDescription>Current organization members</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No members found
              </div>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{member.user_email || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">Role: {member.role}</p>
                    </div>
                    {member.role !== 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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