'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Button, 
  Card, 
  CardBody, 
  CardHeader,
  Input, 
  Textarea, 
  Select, 
  SelectItem,
  Chip,
  Tabs, 
  Tab,
  Divider
} from '@heroui/react'
import { useSupportTickets, type CreateSupportTicketData } from '@/hooks/useSupportTickets'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'
import { 
  Bug, 
  Lightbulb, 
  HelpCircle, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Loader2,
  MessageSquare
} from 'lucide-react'

const ticketTypeIcons = {
  bug: Bug,
  feature_request: Lightbulb,
  general_support: HelpCircle
}

const priorityColors = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger'
} as const

const statusColors = {
  open: 'primary',
  in_progress: 'secondary',
  resolved: 'success',
  closed: 'default'
} as const

const statusIcons = {
  open: Clock,
  in_progress: Loader2,
  resolved: CheckCircle,
  closed: XCircle
}

export default function SupportPage() {
  const { user } = useAuth()
  const { tickets, loading, submitting, error, submitTicket, clearError } = useSupportTickets()
  const { toast } = useToast()
  
  const [formData, setFormData] = useState<CreateSupportTicketData>({
    title: '',
    description: '',
    type: 'general_support',
    priority: 'medium'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      })
      return
    }

    const result = await submitTicket(formData)
    
    if (result) {
      toast({
        title: 'Ticket Submitted',
        description: 'Your support ticket has been submitted successfully. We\'ll get back to you soon!',
      })
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        type: 'general_support',
        priority: 'medium'
      })
    } else {
      toast({
        title: 'Submission Failed',
        description: error || 'Failed to submit support ticket. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <Card className="max-w-md mx-auto">
            <CardBody className="text-center py-8">
              <AlertTriangle className="mx-auto h-12 w-12 text-warning mb-4" />
              <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
              <p className="text-gray-600">Please sign in to access support.</p>
            </CardBody>
          </Card>
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
            <h1 className="text-3xl font-bold text-gray-900">Support Center</h1>
            <p className="text-gray-600 mt-2">Get help with CourtneyAI, report bugs, or request new features.</p>
          </div>
          <Divider />
        </div>

        {/* Support Content */}
        <div className="w-full">
          <Tabs className="w-full">
            <Tab key="submit" title="Submit Ticket">
              <div className="space-y-8 mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      <h3 className="text-xl font-semibold">Submit Support Ticket</h3>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {error && (
                      <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-danger" />
                          <span className="text-danger">{error}</span>
                          <Button 
                            variant="light" 
                            size="sm" 
                            color="danger"
                            onClick={clearError}
                            className="ml-auto"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                          label="Type"
                          value={formData.type}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, type: e.target.value as any }))
                          }}
                        >
                          <SelectItem key="bug" startContent={<Bug className="h-4 w-4" />}>
                            Bug Report
                          </SelectItem>
                          <SelectItem key="feature_request" startContent={<Lightbulb className="h-4 w-4" />}>
                            Feature Request
                          </SelectItem>
                          <SelectItem key="general_support" startContent={<HelpCircle className="h-4 w-4" />}>
                            General Support
                          </SelectItem>
                        </Select>

                        <Select
                          label="Priority"
                          value={formData.priority}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, priority: e.target.value as any }))
                          }}
                        >
                          <SelectItem key="low">Low</SelectItem>
                          <SelectItem key="medium">Medium</SelectItem>
                          <SelectItem key="high">High</SelectItem>
                          <SelectItem key="critical">Critical</SelectItem>
                        </Select>
                      </div>

                      <Input
                        label="Title"
                        placeholder="Brief description of your issue or request"
                        value={formData.title}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
                        maxLength={200}
                        isRequired
                        description={`${formData.title.length}/200 characters`}
                      />

                      <Textarea
                        label="Description"
                        placeholder="Please provide detailed information about your issue or request. Include steps to reproduce if reporting a bug."
                        value={formData.description}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                        maxRows={6}
                        maxLength={5000}
                        isRequired
                        description={`${formData.description.length}/5000 characters`}
                      />

                      <Button 
                        type="submit" 
                        color="primary"
                        isDisabled={submitting || !formData.title.trim() || !formData.description.trim()}
                        isLoading={submitting}
                        startContent={!submitting && <Send className="h-4 w-4" />}
                        className="w-full"
                      >
                        {submitting ? 'Submitting...' : 'Submit Ticket'}
                      </Button>
                    </form>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            <Tab key="tickets" title={`My Tickets (${tickets?.length || 0})`}>
              <div className="space-y-8 mt-4">
                <Card>
                  <CardHeader>
                    <h3 className="text-xl font-semibold">My Support Tickets</h3>
                  </CardHeader>
                  <CardBody>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Loading tickets...</span>
                      </div>
                    ) : (tickets?.length || 0) === 0 ? (
                      <div className="text-center py-8">
                        <HelpCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium mb-2">No tickets yet</h3>
                        <p className="text-gray-600 mb-4">
                          You haven't submitted any support tickets yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(tickets || []).map((ticket) => {
                          const TypeIcon = ticketTypeIcons[ticket.type]
                          const StatusIcon = statusIcons[ticket.status]
                          
                          return (
                            <motion.div
                              key={ticket.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              <Card className="hover:shadow-md transition-shadow">
                                <CardBody className="p-6">
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-3 flex-1">
                                      <TypeIcon className="h-5 w-5 mt-0.5 text-gray-600" />
                                      <div className="flex-1">
                                        <h3 className="font-medium text-lg mb-2">{ticket.title}</h3>
                                        <p className="text-gray-600 text-sm">
                                          {ticket.description.length > 150 
                                            ? `${ticket.description.substring(0, 150)}...`
                                            : ticket.description
                                          }
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 ml-4">
                                      <Chip
                                        color={statusColors[ticket.status]}
                                        variant="flat"
                                        startContent={<StatusIcon className="h-3 w-3" />}
                                      >
                                        {ticket.status.replace('_', ' ')}
                                      </Chip>
                                      <Chip
                                        color={priorityColors[ticket.priority]}
                                        variant="bordered"
                                        size="sm"
                                      >
                                        {ticket.priority}
                                      </Chip>
                                    </div>
                                  </div>
                                  
                                  <Divider className="my-4" />
                                  
                                  <div className="flex items-center justify-between text-sm text-gray-500">
                                    <span>Ticket #{ticket.id.slice(-8)}</span>
                                    <span>Created {formatDate(ticket.created_at)}</span>
                                  </div>
                                  
                                  {ticket.admin_notes && (
                                    <div className="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-200">
                                      <p className="text-sm font-medium text-primary-900 mb-1">Admin Notes:</p>
                                      <p className="text-sm text-primary-800">{ticket.admin_notes}</p>
                                    </div>
                                  )}
                                  
                                  {ticket.response && (
                                    <div className="mt-4 p-4 bg-success-50 rounded-lg border border-success-200">
                                      <p className="text-sm font-medium text-success-900 mb-1 flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Response:
                                      </p>
                                      <p className="text-sm text-success-800 whitespace-pre-wrap">{ticket.response}</p>
                                    </div>
                                  )}
                                </CardBody>
                              </Card>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>
    </div>
  )
} 