"use client"

import { useState, useEffect, ReactNode, useCallback } from "react"
import { Check, Film, ImageIcon, MessageSquareText, Music, Play, Loader2, Plus, X } from "lucide-react"
import { 
  Button, 
  Card, 
  CardBody, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  RadioGroup,
  Radio,
  useRadio,
  VisuallyHidden,
  cn,
  Tabs,
  Tab,
  Chip,
  useDisclosure
} from "@heroui/react"
import { useReels, ReelStatus } from "@/hooks/useReels"
import { useScripts } from "@/hooks/useScripts"
import { useMedia } from "@/hooks/useMedia"
import { useUsage } from "@/hooks/useUsage"
import { VideoPreview } from "@/components/video-preview"
import { toast } from "sonner"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { ReelLimitAlert } from "@/components/usage-limit-alert"

interface ReelCreatorProps {
  productId: string;
  onReelGenerated?: () => void;
}

type Step = 1 | 2;

// Custom Radio component for scripts
const CustomScriptRadio = (props: any) => {
  const {
    Component,
    children,
    description,
    getBaseProps,
    getWrapperProps,
    getInputProps,
    getLabelProps,
    getLabelWrapperProps,
    getControlProps,
  } = useRadio(props);

  return (
    <Component
      {...getBaseProps()}
      className={cn(
        "group inline-flex items-center hover:opacity-70 active:opacity-50 justify-between flex-row-reverse tap-highlight-transparent",
        "w-full cursor-pointer border-2 border-default rounded-lg gap-4 p-4",
        "data-[selected=true]:border-primary",
      )}
    >
      <VisuallyHidden>
        <input {...getInputProps()} />
      </VisuallyHidden>
      <span {...getWrapperProps()}>
        <span {...getControlProps()} />
      </span>
      <div {...getLabelWrapperProps()}>
        {children && (
          <span {...getLabelProps()} className="text-small text-foreground leading-relaxed line-clamp-3">
            {children}
          </span>
        )}
      </div>
    </Component>
  );
};

export function ReelCreator({ productId, onReelGenerated }: ReelCreatorProps) {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isCurrentReelGenerating, setIsCurrentReelGenerating] = useState(false)
  const [selectedScript, setSelectedScript] = useState<string>("")
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
  const [selectedVideos, setSelectedVideos] = useState<string[]>([])
  const [currentGeneratingReelId, setCurrentGeneratingReelId] = useState<string | undefined>(undefined)

  const { createReel, reelStatuses, refetch } = useReels(productId)
  const { scripts } = useScripts(productId)
  const { photos, videos } = useMedia(productId)
  const { updateUsageFromResponse, isAtLimit, isNearLimit, usage } = useUsage()

  // Check if user is at or near limit
  const reelsAtLimit = isAtLimit('reels_per_month')
  const reelsNearLimit = isNearLimit('reels_per_month')
  const reelsUsage = usage.reels_per_month

  // Monitor current reel status (only for the reel created in this modal instance)
  useEffect(() => {
    if (!currentGeneratingReelId) return;
    
    const status = currentGeneratingReelId in reelStatuses ? reelStatuses[currentGeneratingReelId] : undefined;
    if (status) {
      console.log('Current reel status updated:', { reelId: currentGeneratingReelId, status });
      
      if (status === 'completed' || status === 'failed') {
        setIsCurrentReelGenerating(false);
        setCurrentGeneratingReelId(undefined);
        if (status === 'completed') {
          toast.success("Reel created successfully");
        } else {
          toast.error("Failed to create reel");
        }
      }
    }
  }, [currentGeneratingReelId, reelStatuses]);

  const getCurrentStatus = useCallback((): string => {
    if (!currentGeneratingReelId) return 'Starting...';
    const status = currentGeneratingReelId in reelStatuses ? reelStatuses[currentGeneratingReelId] : undefined;
    if (!status) return 'Starting...';
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }, [currentGeneratingReelId, reelStatuses]);

  const handleNextStep = () => {
    setCurrentStep(prev => (prev + 1) as Step)
  }

  const handlePreviousStep = () => {
    setCurrentStep(prev => (prev - 1) as Step)
  }

  const resetForm = () => {
    setSelectedScript("")
    setSelectedPhotos([])
    setSelectedVideos([])
    setCurrentStep(1)
    setIsCurrentReelGenerating(false)
    setCurrentGeneratingReelId(undefined)
  }

  const closeModal = () => {
    if (!isCurrentReelGenerating) {
      onClose()
      setTimeout(resetForm, 300) // Reset after animation completes
    }
  }

  // Handle modal state changes
  const handleOpenChange = (open: boolean) => {
    if (open) {
      onOpen()
    } else {
      closeModal()
    }
  }

  // Handle select all functionality for photos and videos
  const handleSelectAllPhotos = () => {
    if (selectedPhotos.length === photos.length) {
      setSelectedPhotos([])
    } else {
      setSelectedPhotos(photos.map(photo => photo.id))
    }
  }

  const handleSelectAllVideos = () => {
    if (selectedVideos.length === videos.length) {
      setSelectedVideos([])
    } else {
      setSelectedVideos(videos.map(video => video.id))
    }
  }

  const handleSelectAllMedia = () => {
    const allPhotosSelected = selectedPhotos.length === photos.length
    const allVideosSelected = selectedVideos.length === videos.length
    
    if (allPhotosSelected && allVideosSelected) {
      // Deselect all
      setSelectedPhotos([])
      setSelectedVideos([])
    } else {
      // Select all
      setSelectedPhotos(photos.map(photo => photo.id))
      setSelectedVideos(videos.map(video => video.id))
    }
  }

  const handleCreateReel = async () => {
    if (!selectedScript) {
      toast.error("Please select a script")
      return
    }

    if (selectedPhotos.length === 0 && selectedVideos.length === 0) {
      toast.error("Please select at least one photo or video")
      return
    }

    if (reelsAtLimit) {
      toast.error("Reel limit reached. Please upgrade your plan to continue.")
      return
    }

    setIsCurrentReelGenerating(true)

    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`)
      }
      
      if (!session?.access_token) {
        throw new Error("Not authenticated")
      }

      const selectedScriptData = scripts.find(script => script.id === selectedScript)
      const title = selectedScriptData ? `Reel: ${selectedScriptData.title}` : 'Generated Reel'

      const response = await fetch('/api/edge/generate-reel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          productId,
          scriptId: selectedScript,
          photoIds: selectedPhotos,
          videoIds: selectedVideos,
          title
        }),
        credentials: 'include'
      })

      if (!response.ok) {
        const error = await response.json()
        
        if (response.status === 429) {
          toast.error(error.message || "Usage limit exceeded. Please upgrade your plan.")
          return
        }
        
        throw new Error(error.error || 'Failed to create reel')
      }

      const data = await response.json()
      
      if (data.usage) {
        updateUsageFromResponse(data.usage, 'reels_per_month')
      }

      if (data.reel_id) {
        setCurrentGeneratingReelId(data.reel_id)
        toast.success("Reel creation started")
        
        if (data.usage && data.usage.limit !== -1) {
          const newPercentage = (data.usage.currentUsage / data.usage.limit) * 100
          if (newPercentage >= 80 && newPercentage < 100) {
            toast.warning(`You've used ${data.usage.currentUsage}/${data.usage.limit} reels this month. Consider upgrading your plan.`)
          }
        }
        
        if (onReelGenerated) {
          onReelGenerated()
        }
        
        onClose()
        resetForm()
      } else {
        throw new Error("Failed to get reel ID from creation response")
      }
    } catch (error) {
      console.error(error)
      
      if (error instanceof Error && 
          (error.message.includes('auth') || 
           error.message.includes('token') || 
           error.message.includes('Unauthorized'))) {
        toast.error("Authentication error. Please sign in again.")
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to start reel creation")
      }
      setIsCurrentReelGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <ReelLimitAlert showCompact />
      
      <Button 
        color="primary"
        startContent={<Plus className="h-4 w-4" />}
        isDisabled={reelsAtLimit}
        onPress={onOpen}
      >
        Create Reel
        {reelsUsage && reelsUsage.limit !== -1 && (
          <span className="text-xs opacity-70 ml-1">
            ({reelsUsage.currentUsage}/{reelsUsage.limit})
          </span>
        )}
      </Button>

      <Modal 
        isOpen={isOpen} 
        onOpenChange={handleOpenChange}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Create New Reel</h3>
            {reelsNearLimit && reelsUsage && (
              <p className="text-sm text-warning">
                You've used {reelsUsage.currentUsage} of {reelsUsage.limit} reels this month
              </p>
            )}
          </ModalHeader>

          <ModalBody>
            {currentStep === 1 && (
              <div className="space-y-4">
                <h4 className="text-medium font-medium">Select Script</h4>
                {scripts.length > 0 ? (
                  <RadioGroup
                    value={selectedScript}
                    onValueChange={setSelectedScript}
                    className="max-h-96 overflow-y-auto space-y-3"
                  >
                    {scripts.map((script) => (
                      <CustomScriptRadio
                        key={script.id}
                        value={script.id}
                      >
                        {script.content}
                      </CustomScriptRadio>
                    ))}
                  </RadioGroup>
                ) : (
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-default-500">No scripts available. Generate a script first.</p>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <h4 className="text-medium font-medium">Select Media</h4>
                {(photos.length > 0 || videos.length > 0) ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="bordered"
                        size="sm"
                        onPress={handleSelectAllMedia}
                      >
                        {(selectedPhotos.length === photos.length && selectedVideos.length === videos.length) ? 'Deselect All' : 'Select All'}
                      </Button>
                      <div className="flex items-center gap-4">
                        <Chip variant="flat" size="sm">
                          {selectedPhotos.length} of {photos.length} photos
                        </Chip>
                        <Chip variant="flat" size="sm">
                          {selectedVideos.length} of {videos.length} videos
                        </Chip>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                      {/* Photos */}
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          onClick={() => {
                            setSelectedPhotos(prev => 
                              prev.includes(photo.id) ? prev.filter(id => id !== photo.id) : [...prev, photo.id]
                            )
                          }}
                          className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all ${
                            selectedPhotos.includes(photo.id) 
                              ? "ring-2 ring-primary ring-offset-2" 
                              : "hover:scale-105"
                          }`}
                        >
                          <img
                            src={photo.file_path}
                            alt={photo.file_name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2">
                            <Chip 
                              size="sm" 
                              variant="flat" 
                              color="default"
                            >
                              Photo
                            </Chip>
                          </div>
                          {selectedPhotos.includes(photo.id) && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="h-6 w-6 text-primary" />
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Videos */}
                      {videos.map((video) => (
                        <div
                          key={video.id}
                          onClick={() => {
                            setSelectedVideos(prev => 
                              prev.includes(video.id) ? prev.filter(id => id !== video.id) : [...prev, video.id]
                            )
                          }}
                          className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all ${
                            selectedVideos.includes(video.id) 
                              ? "ring-2 ring-primary ring-offset-2" 
                              : "hover:scale-105"
                          }`}
                        >
                          <VideoPreview 
                            src={video.file_path} 
                            className="w-full h-full"
                            isLoading={isCurrentReelGenerating}
                            status={currentGeneratingReelId ? reelStatuses[currentGeneratingReelId] : undefined}
                          />
                          <div className="absolute top-2 left-2">
                            <Chip 
                              size="sm" 
                              variant="flat" 
                              color="default"
                            >
                              Video
                            </Chip>
                          </div>
                          {selectedVideos.includes(video.id) && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="h-6 w-6 text-primary" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Card>
                    <CardBody className="text-center">
                      <p className="text-default-500">No media available. Upload photos or videos first.</p>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <div className="flex justify-between w-full">
              <div>
                {currentStep > 1 && (
                  <Button 
                    variant="bordered"
                    onPress={handlePreviousStep} 
                    isDisabled={isCurrentReelGenerating}
                  >
                    Previous
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="light"
                  onPress={closeModal} 
                  isDisabled={isCurrentReelGenerating}
                >
                  Cancel
                </Button>
                {currentStep < 2 ? (
                  <Button 
                    color="primary"
                    onPress={handleNextStep}
                    isDisabled={!selectedScript}
                  >
                    Next
                  </Button>
                ) : (
                  <Button 
                    color="primary"
                    onPress={handleCreateReel}
                    isDisabled={
                      isCurrentReelGenerating || 
                      (selectedPhotos.length === 0 && selectedVideos.length === 0) ||
                      reelsAtLimit
                    }
                    isLoading={isCurrentReelGenerating}
                  >
                    {isCurrentReelGenerating ? getCurrentStatus() : 'Create Reel'}
                  </Button>
                )}
              </div>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
