import { useState, useEffect } from 'react'
import { Button, Card, CardBody, CardHeader, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@nextui-org/react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { toast } from 'sonner'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

interface BillingSettingsProps {
  organizationId: string
}

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

export function SettingsBilling({ organizationId }: BillingSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<any>(null)
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchPlans()
    fetchCurrentSubscription()
  }, [])

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

  const fetchCurrentSubscription = async () => {
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
      console.log('Current subscription data:', data)
      setCurrentSubscription(data)
    } catch (error) {
      console.error('Error fetching subscription:', error)
      toast.error('Failed to load current subscription')
    }
  }

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(true)

      // Call our create-checkout-session endpoint
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          organizationId,
        }),
      })

      const { url, error } = await response.json()
      if (error) throw new Error(error)

      // Redirect to Stripe Checkout
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

      // Refresh subscription data
      await fetchCurrentSubscription()
      
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
    <>
      <Card className="w-full">
        <CardHeader>
          <h2 className="text-xl font-bold">Subscription Plans</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {currentSubscription && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold">Current Subscription</h3>
                {canCancelSubscription() && (
                  <Button
                    color="danger"
                    variant="light"
                    size="sm"
                    onClick={onOpen}
                    startContent={<X className="h-4 w-4" />}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
              <p className="text-gray-600">
                Plan: {currentSubscription.pricing_plan?.name || 'Unknown Plan'}
              </p>
              <p className="text-gray-600">
                Status: {currentSubscription.status}
                {currentSubscription.cancel_at_period_end && (
                  <span className="text-orange-600 font-medium"> (Cancelling at period end)</span>
                )}
              </p>
              {currentSubscription.current_period_end && (
                <p className="text-gray-600">
                  {currentSubscription.cancel_at_period_end 
                    ? 'Access ends:' 
                    : 'Next billing date:'
                  } {new Date(currentSubscription.current_period_end).toLocaleDateString()}
                </p>
              )}
              {currentSubscription.cancel_at_period_end && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Your subscription will be cancelled and you'll lose access to premium features at the end of your current billing period.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

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
                  <CardBody className="space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold">{plan.name}</h3>
                      <p className="text-2xl font-bold mt-2">
                        {formatPrice(plan.price)}<span className="text-sm font-normal text-gray-600">/{plan.interval}</span>
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">{plan.description}</p>
                    <ul className="space-y-2 my-4">
                      {renderFeatures(plan.features)}
                    </ul>
                    <Button
                      color={isPlanActive ? "secondary" : "primary"}
                      className="w-full"
                      onClick={() => handleSubscribe(plan.stripe_price_id)}
                      isLoading={loading}
                      disabled={isPlanActive}
                    >
                      {isPlanActive ? 'Current Plan' : currentSubscription ? 'Switch to this Plan' : 'Subscribe'}
                    </Button>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        </CardBody>
      </Card>

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
    </>
  )
} 