import { useState } from 'react'
import { Button, Card, CardBody, CardHeader } from '@nextui-org/react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface BillingSettingsProps {
  organizationId: string
}

export default function BillingSettings({ organizationId }: BillingSettingsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleSubscribe = async () => {
    try {
      setLoading(true)

      // Call our create-checkout-session endpoint
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: 'your-price-id', // Replace with your Stripe price ID
          organizationId,
        }),
      })

      const { url, error } = await response.json()
      if (error) throw new Error(error)

      // Redirect to Stripe Checkout
      window.location.href = url
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to start checkout session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-xl font-bold">Subscription</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Current Plan</h3>
            <p className="text-gray-600">Free Plan</p>
          </div>
          <Button
            color="primary"
            onClick={handleSubscribe}
            isLoading={loading}
          >
            Upgrade Plan
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

