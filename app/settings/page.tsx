"use client"

import { useState } from "react"
import { Tabs, Tab, Divider } from "@heroui/react"
import { SettingsForm } from "@/components/settings-form"
import { SettingsLogout } from "@/components/settings-logout"
import { SettingsOrganizations } from "@/components/settings-organizations"
import { SettingsSubscriptionUsage } from "@/components/settings-subscription-usage"
import { UsageLimitAlert } from "@/components/usage-limit-alert"
import { useAuth } from "@/hooks/useAuth"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export default function SettingsPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const defaultTab = searchParams?.get('tab') || 'account'
  const [selectedTab, setSelectedTab] = useState(defaultTab)

  const handleTabChange = (key: string | number) => {
    const newTab = String(key)
    setSelectedTab(newTab)
    
    // Update URL without page reload
    const params = new URLSearchParams(searchParams?.toString())
    if (newTab === 'account') {
      params.delete('tab') // Remove tab param for default tab
    } else {
      params.set('tab', newTab)
    }
    
    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname
    router.push(newUrl, { scroll: false })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="text-center">
            <p>Please sign in to access settings.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Header Section */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-2">Manage your account, subscription, and organizations.</p>
          </div>
          <Divider />
        </div>

        {/* Global Usage Alert */}
        <UsageLimitAlert />

        {/* Settings Content */}
        <div className="w-full">
          <Tabs 
            selectedKey={selectedTab}
            onSelectionChange={handleTabChange}
            className="w-full"
          >
            <Tab key="account" title="Account">
              <div className="space-y-8 mt-8">
                <SettingsForm />
                <SettingsLogout />
              </div>
            </Tab>

            <Tab key="subscription" title="Subscription & Usage">
              <div className="space-y-8 mt-8">
                <SettingsSubscriptionUsage />
              </div>
            </Tab>

            <Tab key="organizations" title="Organizations">
              <div className="space-y-8 mt-8">
                <SettingsOrganizations />
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
