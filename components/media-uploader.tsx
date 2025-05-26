"use client"

import { useState, useRef } from "react"
import { Upload, Image, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMedia } from "@/hooks/useMedia"
import { useUsage } from "@/hooks/useUsage"
import { toast } from "sonner"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger
} from "@/components/ui/dialog"
import { MediaLimitAlert } from "@/components/usage-limit-alert"

interface MediaUploaderProps {
  productId: string
  onMediaUploaded: () => void
}

export function MediaUploader({ productId, onMediaUploaded }: MediaUploaderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { uploadMedia } = useMedia(productId)
  const { updateUsageFromResponse, isAtLimit, isNearLimit, usage } = useUsage()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if user is at or near limit
  const mediaAtLimit = isAtLimit('media_uploads_per_month')
  const mediaNearLimit = isNearLimit('media_uploads_per_month')
  const mediaUsage = usage.media_uploads_per_month

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!mediaAtLimit) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (mediaAtLimit) {
      toast.error("Media upload limit reached. Please upgrade your plan to continue.")
      return
    }

    const files = Array.from(e.dataTransfer.files)
    await handleFiles(files)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (mediaAtLimit) {
        toast.error("Media upload limit reached. Please upgrade your plan to continue.")
        return
      }
      
      const files = Array.from(e.target.files)
      await handleFiles(files)
    }
  }

  const handleFiles = async (files: File[]) => {
    // Check if files would exceed limit
    if (mediaUsage && mediaUsage.limit !== -1) {
      const remainingUploads = mediaUsage.limit - mediaUsage.currentUsage
      if (files.length > remainingUploads) {
        toast.error(`You can only upload ${remainingUploads} more files this month. Please upgrade your plan for more uploads.`)
        return
      }
    }

    setIsUploading(true)
    let hasUploads = false
    let uploadCount = 0

    try {
      for (const file of files) {
        try {
          if (file.type.startsWith('image/')) {
            await uploadMedia(file, 'photo')
            toast.success(`Uploaded photo: ${file.name}`)
            hasUploads = true
            uploadCount++
          } else if (file.type.startsWith('video/')) {
            await uploadMedia(file, 'video')
            toast.success(`Uploaded video: ${file.name}`)
            hasUploads = true
            uploadCount++
          } else {
            toast.error(`Unsupported file type: ${file.type}`)
          }
        } catch (error) {
          console.error('Upload error:', error)
          
          // Handle usage limit errors specifically
          if (error instanceof Error && error.message.includes('Usage limit exceeded')) {
            toast.error("Media upload limit reached. Please upgrade your plan to continue.")
            break
          } else {
            toast.error(`Failed to upload ${file.name}`)
          }
        }
      }

      // Update usage data after uploads (simulated since we don't get it back from upload)
      if (uploadCount > 0 && mediaUsage) {
        const updatedUsage = {
          ...mediaUsage,
          currentUsage: mediaUsage.currentUsage + uploadCount
        }
        updateUsageFromResponse(updatedUsage, 'media_uploads_per_month')
        
        // Show usage warning if near limit
        if (updatedUsage.limit !== -1) {
          const newPercentage = (updatedUsage.currentUsage / updatedUsage.limit) * 100
          if (newPercentage >= 80 && newPercentage < 100) {
            toast.warning(`You've used ${updatedUsage.currentUsage}/${updatedUsage.limit} media uploads this month. Consider upgrading your plan.`)
          }
        }
      }

      if (hasUploads) {
        onMediaUploaded()
        setIsModalOpen(false)
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleZoneClick = () => {
    if (mediaAtLimit) {
      toast.error("Media upload limit reached. Please upgrade your plan to continue.")
      return
    }
    fileInputRef.current?.click()
  }

  const handleOpen = (open: boolean) => {
    setIsModalOpen(open)
  }

  return (
    <div className="space-y-4">
      {/* Usage Alert */}
      <MediaLimitAlert />
      
      <Dialog open={isModalOpen} onOpenChange={handleOpen}>
        <DialogTrigger asChild>
          <Button 
            className="gap-2"
            disabled={mediaAtLimit}
          >
            <Upload className="h-4 w-4" />
            Upload Media
            {mediaUsage && mediaUsage.limit !== -1 && (
              <span className="text-xs opacity-70">
                ({mediaUsage.currentUsage}/{mediaUsage.limit})
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Upload Media</DialogTitle>
            {mediaNearLimit && mediaUsage && (
              <div className="text-sm text-orange-600">
                You've used {mediaUsage.currentUsage} of {mediaUsage.limit} media uploads this month
              </div>
            )}
          </DialogHeader>
          
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              ${isDragging && !mediaAtLimit ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:bg-muted/50'}
              ${isUploading || mediaAtLimit ? 'opacity-50 pointer-events-none' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleZoneClick}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-primary/10">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {isUploading ? 'Uploading...' : 
                   mediaAtLimit ? 'Upload limit reached' :
                   'Drag files here or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mediaAtLimit ? 
                    'Upgrade your plan to upload more files' :
                    'Supports images (PNG, JPG) and videos (MP4)'
                  }
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                disabled={isUploading || mediaAtLimit}
              />
            </div>
          </div>

          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Images (PNG, JPG)
            </div>
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Videos (MP4)
            </div>
            {mediaUsage && mediaUsage.limit !== -1 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className={mediaNearLimit ? 'text-orange-600' : ''}>
                  {mediaUsage.currentUsage}/{mediaUsage.limit} uploads used this month
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 