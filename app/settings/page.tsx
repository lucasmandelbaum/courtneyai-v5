"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SettingsForm } from "@/components/settings-form"
import { SettingsLogout } from "@/components/settings-logout"
import { SettingsOrganizations } from "@/components/settings-organizations"
import { SettingsBilling } from "@/components/settings-billing"
import { UsageTracker } from "@/components/usage-tracker"
import { UsageLimitAlert } from "@/components/usage-limit-alert"
import { useAuth } from "@/hooks/useAuth"
import { useUsage } from "@/hooks/useUsage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSearchParams } from "next/navigation"

export default function SettingsPage() {
  const { user } = useAuth()
  const { subscription } = useUsage()
  const searchParams = useSearchParams()
  const defaultTab = searchParams?.get('tab') || 'account'

  if (!user) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <p>Please sign in to access settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account, subscription, and usage.</p>
        </div>

        {/* Global Usage Alert */}
        <UsageLimitAlert className="mb-4" />

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="usage">Usage & Limits</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6 mt-6">
            <SettingsForm />
            <SettingsLogout />
          </TabsContent>

          <TabsContent value="usage" className="space-y-6 mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>Your subscription and usage overview</CardDescription>
                </CardHeader>
                <CardContent>
                  {subscription ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Plan:</span>
                        <span>{subscription.planName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Status:</span>
                        <span className="capitalize">{subscription.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Billing Period:</span>
                        <span>
                          {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {' '}
                          {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                        </span>
                      </div>
                      {subscription.cancelAtPeriodEnd && (
                        <div className="text-sm text-orange-600 mt-2">
                          Your subscription will be cancelled at the end of the current billing period.
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Loading subscription details...</p>
                  )}
                </CardContent>
              </Card>
              
              <UsageTracker variant="full" />
            </div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6 mt-6">
            {subscription && (
              <SettingsBilling organizationId={subscription.organizationId} />
            )}
          </TabsContent>

          <TabsContent value="organization" className="space-y-6 mt-6">
            <SettingsOrganizations />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
