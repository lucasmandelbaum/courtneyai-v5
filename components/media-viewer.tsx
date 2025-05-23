"use client"

import { Wand2, X } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Photo } from "@/hooks/useMedia"
import Image from "next/image"

interface MediaViewerProps {
  media: Photo | null
  onClose: () => void
}

export function MediaViewer({ media, onClose }: MediaViewerProps) {
  if (!media) return null

  return (
    <Dialog open={!!media} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="relative aspect-square">
            <Image
              src={media.file_path}
              alt={media.file_name}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
          </div>

          {media.description && (
            <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm p-4">
              <div className="flex items-start gap-2">
                <Wand2 className="h-4 w-4 mt-1 text-primary shrink-0" />
                <div>
                  <Badge variant="secondary" className="mb-2">AI Analysis</Badge>
                  <p className="text-sm text-muted-foreground">{media.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 