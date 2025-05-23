import { useState } from "react"
import { Plus, Sparkles, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useScripts } from "@/hooks/useScripts"
import { useUsage } from "@/hooks/useUsage"
import { toast } from "sonner"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScriptLimitAlert } from "@/components/usage-limit-alert"

interface ScriptGeneratorProps {
  productId: string
  product: {
    description: string | null
  }
  onScriptCreated?: () => void
}

export function ScriptGenerator({ productId, product, onScriptCreated }: ScriptGeneratorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [content, setContent] = useState("")
  const [caption, setCaption] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const { refetch } = useScripts(productId)
  const { updateUsageFromResponse, isAtLimit, isNearLimit, usage } = useUsage()

  // Check if user is at or near limit
  const scriptsAtLimit = isAtLimit('scripts_per_month')
  const scriptsNearLimit = isNearLimit('scripts_per_month')
  const scriptsUsage = usage.scripts_per_month

  const handleCreate = async () => {
    if (!content.trim()) {
      toast.error("Please enter content")
      return
    }

    // Check limits before attempting creation
    if (scriptsAtLimit) {
      toast.error("Script limit reached. Please upgrade your plan to continue.")
      return
    }

    setIsCreating(true)

    try {
      // Get the auth session directly in the component
      const supabase = createBrowserSupabaseClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`)
      }
      
      if (!session?.access_token) {
        throw new Error("Not authenticated")
      }
      
      // Ensure token is properly formatted
      const token = session.access_token.trim()
      if (!token.startsWith('eyJ')) {
        console.error('Invalid token format:', token.substring(0, 10))
        throw new Error('Invalid authentication token format')
      }
      
      console.log('Initiating script creation with valid token')

      const response = await fetch('/api/edge/create-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId,
          title: `Script ${new Date().toLocaleDateString()}`,
          content: content.trim(),
          caption: caption.trim() || null
        }),
        credentials: 'include'
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Script creation error:', {
          status: response.status,
          error: data.error
        })
        
        // Handle usage limit errors specifically
        if (response.status === 429) {
          toast.error(data.message || "Usage limit exceeded. Please upgrade your plan.")
          return
        }
        
        throw new Error(data.error || 'Failed to create script')
      }

      // Update usage data from response
      if (data.usage) {
        updateUsageFromResponse(data.usage, 'scripts_per_month')
      }

      setContent("")
      setCaption("")
      setIsModalOpen(false)
      toast.success("Script created successfully")
      
      // Show usage warning if near limit
      if (data.usage && data.usage.limit !== -1) {
        const newPercentage = (data.usage.currentUsage / data.usage.limit) * 100
        if (newPercentage >= 80 && newPercentage < 100) {
          toast.warning(`You've used ${data.usage.currentUsage}/${data.usage.limit} scripts this month. Consider upgrading your plan.`)
        }
      }
      
      // Ensure both local and parent refreshes happen
      console.log('Refreshing scripts list')
      await refetch()
      onScriptCreated?.()
      
    } catch (error) {
      console.error('Error in script creation:', error)
      
      // Handle authentication errors specially
      if (error instanceof Error && 
          (error.message.includes('auth') || 
           error.message.includes('token') || 
           error.message.includes('Unauthorized'))) {
        toast.error("Authentication error. Please sign in again.")
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to create script")
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleGenerateWithAI = async () => {
    if (!product.description) {
      toast.error("Product description is required for AI script generation")
      return
    }

    // Check limits before attempting generation
    if (scriptsAtLimit) {
      toast.error("Script limit reached. Please upgrade your plan to continue.")
      return
    }

    setIsGenerating(true)
    
    try {
      // Get the auth session
      const supabase = createBrowserSupabaseClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`)
      }
      
      if (!session?.access_token) {
        throw new Error("Not authenticated")
      }

      // Call the Edge Function
      const response = await fetch('https://yubxyvpitesasqwbihea.supabase.co/functions/v1/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          productId
        })
      })

      if (!response.ok) {
        const error = await response.json()
        
        // Handle usage limit errors specifically
        if (response.status === 429) {
          toast.error(error.message || "Usage limit exceeded. Please upgrade your plan.")
          return
        }
        
        throw new Error(error.error || 'Failed to generate script')
      }

      const data = await response.json()
      
      // Update usage data from response
      if (data.usage) {
        updateUsageFromResponse(data.usage, 'scripts_per_month')
      }
      
      // Refresh the scripts list
      await refetch()
      onScriptCreated?.()
      
      toast.success("Script generated successfully")
      
      // Show usage warning if near limit
      if (data.usage && data.usage.limit !== -1) {
        const newPercentage = (data.usage.currentUsage / data.usage.limit) * 100
        if (newPercentage >= 80 && newPercentage < 100) {
          toast.warning(`You've used ${data.usage.currentUsage}/${data.usage.limit} scripts this month. Consider upgrading your plan.`)
        }
      }
      
    } catch (error) {
      console.error('Error generating script:', error)
      
      if (error instanceof Error && 
          (error.message.includes('auth') || 
           error.message.includes('token') || 
           error.message.includes('Unauthorized'))) {
        toast.error("Authentication error. Please sign in again.")
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to generate script")
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Usage Alert */}
      <ScriptLimitAlert showCompact />
      
      <div className="flex gap-2">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button 
                    variant="secondary"
                    className="gap-2"
                    onClick={handleGenerateWithAI}
                    disabled={isGenerating || !product.description || scriptsAtLimit}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate with AI
                        {scriptsUsage && scriptsUsage.limit !== -1 && (
                          <span className="text-xs opacity-70">
                            ({scriptsUsage.currentUsage}/{scriptsUsage.limit})
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="flex items-center gap-1">
                  {!product.description && <AlertCircle className="h-4 w-4" />}
                  {scriptsAtLimit ? (
                    "Script limit reached - upgrade to continue"
                  ) : !product.description ? (
                    "Description required for AI"
                  ) : scriptsUsage && scriptsUsage.limit !== -1 ? (
                    `${scriptsUsage.currentUsage}/${scriptsUsage.limit} scripts used this month`
                  ) : (
                    "Generate AI script from product description"
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button 
              className="gap-2"
              disabled={scriptsAtLimit}
            >
              <Plus className="h-4 w-4" />
              New Script
              {scriptsUsage && scriptsUsage.limit !== -1 && (
                <span className="text-xs opacity-70">
                  ({scriptsUsage.currentUsage}/{scriptsUsage.limit})
                </span>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>New Script</DialogTitle>
              {scriptsNearLimit && scriptsUsage && (
                <div className="text-sm text-orange-600">
                  You've used {scriptsUsage.currentUsage} of {scriptsUsage.limit} scripts this month
                </div>
              )}
            </DialogHeader>

            <div className="space-y-6 pt-2 pb-6">
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Enter your script content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="caption">Caption (optional)</Label>
                <Textarea
                  id="caption"
                  placeholder="Enter a caption for your TikTok post"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  className="mt-1.5"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button 
                onClick={handleCreate} 
                disabled={!content.trim() || isCreating || scriptsAtLimit}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {isCreating ? "Creating..." : "Create Script"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
} 