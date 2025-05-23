"use client"

import { useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { SettingsBilling } from '@/components/settings-billing'

export default function BillingSettingsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (sessionId) {
      // Clear the session_id from the URL to prevent refreshing issues
      window.history.replaceState({}, '', window.location.pathname)
      
      // Show success message
      toast.success('Subscription updated successfully!')
    }
  }, [sessionId])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Billing Settings</h1>
        <SettingsBilling organizationId={params.organizationId as string} />
      </div>
    </div>
  )
} 