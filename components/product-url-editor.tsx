"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink, Edit as EditIcon } from "lucide-react"
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs"
import { toast } from "sonner"

interface ProductUrlEditorProps {
  productId: string
  initialUrl: string | null
  onUrlUpdated: () => void
}

export function ProductUrlEditor({ 
  productId, 
  initialUrl, 
  onUrlUpdated 
}: ProductUrlEditorProps) {
  const [url, setUrl] = useState(initialUrl || "")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const supabase = createBrowserSupabaseClient()
      
      const { error } = await supabase
        .from("products")
        .update({ url: url })
        .eq("id", productId)

      if (error) throw error

      toast.success("Product URL updated")
      onUrlUpdated()
      setIsEditing(false)
    } catch (error) {
      console.error("Error updating product URL:", error)
      toast.error("Failed to update product URL")
    } finally {
      setIsSaving(false)
    }
  }

  if (!isEditing && url) {
    return (
      <div className="flex items-center gap-2">
        <a 
          href={url.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          {url}
          <ExternalLink className="h-3 w-3" />
        </a>
        <Button
          variant="outline"
          size="sm"
          className="transition-opacity gap-1.5"
          onClick={() => setIsEditing(true)}
        >
          <EditIcon className="h-3 w-3" />
          Edit
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Add product URL..."
        className="max-w-md"
        onFocus={() => !isEditing && setIsEditing(true)}
      />
      {isEditing && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUrl(initialUrl || "")
              setIsEditing(false)
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      )}
    </div>
  )
} 