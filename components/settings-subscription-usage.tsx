"use client"

import { useState, useEffect } from 'react'
import { Button, Card, CardBody, CardHeader, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Select, SelectItem, Divider } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { CheckCircle2, AlertTriangle, X, TrendingUp, Users, Zap } from 'lucide-react'
import { useUsage } from '@/hooks/useUsage'
import { UsageTracker } from '@/components/usage-tracker'

interface PricingPlan {
  id: string
  name: string
  description: string
  stripe_price_id: string
  price: number
  interval: string
  features: Record<string, number | boolean>
  active: boolean
}

interface Organization {
  id: string
  name: string
}

export function SettingsSubscriptionUsage() {
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<any>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { subscription, usage, isLoading: usageLoading, isAtLimit, isNearLimit } = useUsage()

  useEffect(() => {
    fetchPlans()
    fetchOrganizations()
  }, [])

  useEffect(() => {
    if (subscription?.organizationId) {
      setSelectedOrgId(subscription.organizationId)
      fetchCurrentSubscription(subscription.organizationId)
    } else if (selectedOrgId) {
      fetchCurrentSubscription(selectedOrgId)
    }
  }, [subscription, selectedOrgId])

  const fetchOrganizations = async () => {
    try {
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select(`
          organizations (
            id,
            name
          )
        `)

      if (error) throw error

      const orgs = memberships?.map(membership => {
        const org = membership.organizations as any
        return { id: org.id, name: org.name } as Organization
      }).filter(org => org.id && org.name) || []
      
      setOrganizations(orgs)
      
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast.error('Failed to load organizations')
    }
  }

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('active', true)
        .order('price')

      if (error) throw error
      setPlans(data)
    } catch (error) {
      console.error('Error fetching plans:', error)
      toast.error('Failed to load pricing plans')
    }
  }

  const fetchCurrentSubscription = async (organizationId: string) => {
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .select(`
          *,
          pricing_plan:plan_id (
            id,
            name,
            price,
            interval,
            features
          )
        `)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (error) throw error
      setCurrentSubscription(data)
    } catch (error) {
      console.error('Error fetching subscription:', error)
      toast.error('Failed to load current subscription')
    }
  }

  const handleSubscribe = async (priceId: string) => {
    if (!selectedOrgId) {
      toast.error('Please select an organization')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          organizationId: selectedOrgId,
        }),
      })

      const { url, error } = await response.json()
      if (error) throw new Error(error)

      window.location.href = url
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to start checkout session')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async (cancelImmediately = false) => {
    try {
      setCancelLoading(true)

      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: currentSubscription.stripe_subscription_id,
          cancelImmediately
        }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel subscription')
      }

      await fetchCurrentSubscription(selectedOrgId)
      
      if (cancelImmediately) {
        toast.success('Subscription cancelled immediately')
      } else {
        toast.success('Subscription will be cancelled at the end of your current billing period')
      }
      
      onOpenChange()
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to cancel subscription')
    } finally {
      setCancelLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price)
  }

  const renderFeatures = (features: Record<string, number | boolean>) => {
    return Object.entries(features).map(([key, value]) => {
      const formattedKey = key.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
      
      let displayValue: string
      if (typeof value === 'number') {
        displayValue = value === -1 ? 'Unlimited' : value.toString()
      } else {
        displayValue = value ? '✓' : '✗'
      }

      return (
        <li key={key} className="flex items-center gap-2 text-sm text-gray-600">
          <span>{formattedKey}:</span>
          <span>{displayValue}</span>
        </li>
      )
    })
  }

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.pricing_plan?.id === planId &&
           currentSubscription?.status === 'active'
  }

  const canCancelSubscription = () => {
    return currentSubscription && 
           currentSubscription.status === 'active' && 
           !currentSubscription.cancel_at_period_end
  }

  return (
    <div className="space-y-8">
      {/* Organization Selector */}
      {organizations.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-800">Organization Context</h2>
          </div>
          <Divider />
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Managing subscription for:</span>
                <Select
                  selectedKeys={selectedOrgId ? [selectedOrgId] : []}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string
                    setSelectedOrgId(selected)
                  }}
                  className="max-w-xs"
                >
                  {organizations.map((org) => (
                    <SelectItem key={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Current Plan & Usage Overview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-800">Current Plan & Usage</h2>
        </div>
        <Divider />
        
        <Card>
          <CardBody className="space-y-6">
            {/* Subscription Status */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">Subscription Details</h3>
              {subscription ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Plan:</span>
                    <span className="text-gray-900">{subscription.planName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Status:</span>
                    <span className="capitalize text-gray-900">{subscription.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Billing Period:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {' '}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </div>
                  {subscription.cancelAtPeriodEnd && (
                    <div className="text-sm text-orange-600 mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      Your subscription will be cancelled at the end of the current billing period.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No active subscription</p>
              )}
            </div>

            {/* Usage Metrics */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Usage Overview</h3>
              <UsageTracker variant="full" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Available Plans */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Available Plans</h2>
        <Divider />
        <p className="text-sm text-gray-600">Compare and switch between subscription plans</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isPlanActive = isCurrentPlan(plan.id)
            return (
              <Card 
                key={plan.id} 
                className={`w-full relative ${isPlanActive ? 'border-2 border-primary' : ''}`}
              >
                {isPlanActive && (
                  <div className="absolute -top-3 -right-3 bg-primary rounded-full p-1">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                )}
                <CardBody className="flex flex-col h-full">
                  <div className="flex-grow space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                      <p className="text-2xl font-bold mt-2 text-gray-900">
                        {formatPrice(plan.price)}<span className="text-sm font-normal text-gray-600">/{plan.interval}</span>
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">{plan.description}</p>
                    <ul className="space-y-2">
                      {renderFeatures(plan.features)}
                    </ul>
                  </div>
                  <div className="mt-6">
                    <Button
                      color={isPlanActive ? "secondary" : "primary"}
                      className="w-full"
                      onClick={() => handleSubscribe(plan.stripe_price_id)}
                      isLoading={loading}
                      disabled={isPlanActive}
                    >
                      {isPlanActive ? 'Current Plan' : currentSubscription ? 'Switch to this Plan' : 'Subscribe'}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Cancel Subscription
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <p>
                    Are you sure you want to cancel your subscription to{' '}
                    <strong>{currentSubscription?.pricing_plan?.name}</strong>?
                  </p>
                  
                  <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <h4 className="font-medium">What happens when you cancel:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Your subscription will remain active until {new Date(currentSubscription?.current_period_end).toLocaleDateString()}</li>
                      <li>• You'll continue to have access to all premium features until then</li>
                      <li>• No further charges will be made</li>
                      <li>• You can reactivate your subscription at any time</li>
                    </ul>
                  </div>

                  <p className="text-sm text-gray-600">
                    This action can be undone by contacting support or resubscribing before your access expires.
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Keep Subscription
                </Button>
                <Button
                  color="danger"
                  isLoading={cancelLoading}
                  onPress={() => handleCancelSubscription(false)}
                >
                  Cancel at Period End
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
} 