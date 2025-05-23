"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs"
import { toast } from "sonner"
import { Wand2, AlertCircle, Edit, Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ProductDescriptionEditorProps {
  productId: string
  initialDescription: string | null
  onDescriptionUpdated: () => void
  productUrl: string | null
  onSaveOrCancel: () => void
}

export function ProductDescriptionEditor({ 
  productId, 
  initialDescription, 
  onDescriptionUpdated,
  productUrl,
  onSaveOrCancel
}: ProductDescriptionEditorProps) {
  const [description, setDescription] = useState(initialDescription || "")
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiDescription, setAiDescription] = useState<string | null>(null)

  useEffect(() => {
    setDescription(initialDescription || "");
  }, [initialDescription]);

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const supabase = createBrowserSupabaseClient()
      
      const { error } = await supabase
        .from("products")
        .update({ description: description.trim() || null })
        .eq("id", productId)

      if (error) throw error

      toast.success("Product description updated")
      onDescriptionUpdated()
      onSaveOrCancel()
    } catch (error) {
      console.error("Error updating product description:", error)
      toast.error("Failed to update product description")
    } finally {
      setIsSaving(false)
    }
  }

  const generateDescription = async () => {
    if (!productUrl) {
      toast.error("Product URL is required for AI description")
      return
    }

    try {
      setIsGenerating(true)
      const supabase = createBrowserSupabaseClient()
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("No session found")

      const { data, error } = await supabase.functions.invoke('fetch-product-description', {
        body: { productId }
      })

      if (error) throw error

      if (data?.data?.description) {
        setAiDescription(data.data.description)
        toast.success("AI description generated successfully")
      } else {
        throw new Error("No description received")
      }
    } catch (error) {
      console.error("Error generating description:", error)
      toast.error("Failed to generate description")
    } finally {
      setIsGenerating(false)
    }
  }

  const useAiDescription = () => {
    if (aiDescription) {
      setDescription(aiDescription)
      setAiDescription(null)
      toast.success("AI description applied")
    }
  }
  
  const handleCancel = () => {
    setDescription(initialDescription || "");
    setAiDescription(null);
    onSaveOrCancel();
  }

  return (
    <div className="space-y-4">
      <div className="relative group">
        <div 
          className="relative"
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description for your product..."
            className={`resize-none transition-all min-h-[120px] bg-transparent border focus-visible:ring-1 focus-visible:ring-ring`}
            autoFocus
          />
        </div>
        
        <div className="flex justify-between items-center mt-3">
          <div className="flex items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={generateDescription}
                      disabled={isGenerating || isSaving || !productUrl}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <Wand2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4" />
                          Generate AI Description
                        </>
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!productUrl && (
                  <TooltipContent side="top">
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      URL required for AI
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving || isGenerating}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isGenerating}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {aiDescription && (
        <Card className="p-4 mt-4 bg-muted/50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">AI Generated Description</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={useAiDescription}
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Use This Description
              </Button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiDescription}</p>
          </div>
        </Card>
      )}
    </div>
  )
} 