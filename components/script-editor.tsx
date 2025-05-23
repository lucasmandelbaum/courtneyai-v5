"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useScripts } from "@/hooks/useScripts"
import { toast } from "sonner"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"

interface ScriptEditorProps {
  scriptId: string
  productId: string
  initialTitle: string
  initialContent: string
  initialCaption?: string
  onScriptEdited?: () => void
}

export function ScriptEditor({ 
  scriptId, 
  productId, 
  initialTitle, 
  initialContent,
  initialCaption = "",
  onScriptEdited 
}: ScriptEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [caption, setCaption] = useState(initialCaption)
  const [isEditing, setIsEditing] = useState(false)
  const { editScript } = useScripts(productId)

  const handleEdit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Please enter both a title and content")
      return
    }

    setIsEditing(true)

    try {
      await editScript(scriptId, {
        title: title.trim(),
        content: content.trim(),
        caption: caption.trim() || null
      })

      setIsModalOpen(false)
      toast.success("Script updated successfully")
      onScriptEdited?.()
      
    } catch (error) {
      console.error('Error in script editing:', error)
      toast.error(error instanceof Error ? error.message : "Failed to update script")
    } finally {
      setIsEditing(false)
    }
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Script</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter a title for your script"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Enter your script content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
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
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleEdit} 
            disabled={!title.trim() || !content.trim() || isEditing}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            {isEditing ? "Updating..." : "Update Script"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 