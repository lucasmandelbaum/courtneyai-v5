"use client"

import { useState, useEffect, ReactNode, useCallback } from "react"
import { Check, Film, ImageIcon, MessageSquareText, Music, Play, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useReels, ReelStatus } from "@/hooks/useReels"
import { useScripts } from "@/hooks/useScripts"
import { useMedia } from "@/hooks/useMedia"
import { useUsage } from "@/hooks/useUsage"
import { VideoPreview } from "@/components/video-preview"
import { toast } from "sonner"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ReelLimitAlert } from "@/components/usage-limit-alert"

interface ReelCreatorProps {
  productId: string;
  onReelGenerated?: () => void;
}

type Step = 1 | 2;

export function ReelCreator({ productId, onReelGenerated }: ReelCreatorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isCurrentReelGenerating, setIsCurrentReelGenerating] = useState(false)
  const [selectedScript, setSelectedScript] = useState<string | null>(null)
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
    setSelectedScript(null)
    setSelectedPhotos([])
    setSelectedVideos([])
    setCurrentStep(1)
    setIsCurrentReelGenerating(false)
    setCurrentGeneratingReelId(undefined)
  }

  const closeModal = () => {
    if (!isCurrentReelGenerating) {
      setIsModalOpen(false)
      setTimeout(resetForm, 300) // Reset after animation completes
    }
  }

  // Handle select all functionality for photos and videos
  const handleSelectAllPhotos = () => {
    if (selectedPhotos.length === photos.length) {
      // If all are selected, deselect all
      setSelectedPhotos([])
    } else {
      // Otherwise, select all
      setSelectedPhotos(photos.map(photo => photo.id))
    }
  }

  const handleSelectAllVideos = () => {
    if (selectedVideos.length === videos.length) {
      // If all are selected, deselect all
      setSelectedVideos([])
    } else {
      // Otherwise, select all
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

    // Check limits before attempting creation
    if (reelsAtLimit) {
      toast.error("Reel limit reached. Please upgrade your plan to continue.")
      return
    }

    setIsCurrentReelGenerating(true)

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

      // Get the selected script to generate a title
      const selectedScriptData = scripts.find(script => script.id === selectedScript)
      const title = selectedScriptData ? `Reel: ${selectedScriptData.title}` : 'Generated Reel'

      // Call through the Next.js API route with the NEW format
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
        
        // Handle usage limit errors specifically
        if (response.status === 429) {
          toast.error(error.message || "Usage limit exceeded. Please upgrade your plan.")
          return
        }
        
        throw new Error(error.error || 'Failed to create reel')
      }

      const data = await response.json()
      
      // Update usage data from response
      if (data.usage) {
        updateUsageFromResponse(data.usage, 'reels_per_month')
      }

      if (data.reel_id) {
        setCurrentGeneratingReelId(data.reel_id)
        toast.success("Reel creation started")
        
        // Show usage warning if near limit
        if (data.usage && data.usage.limit !== -1) {
          const newPercentage = (data.usage.currentUsage / data.usage.limit) * 100
          if (newPercentage >= 80 && newPercentage < 100) {
            toast.warning(`You've used ${data.usage.currentUsage}/${data.usage.limit} reels this month. Consider upgrading your plan.`)
          }
        }
        
        if (onReelGenerated) {
          onReelGenerated()
        }
        
        setIsModalOpen(false)
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
      {/* Usage Alert */}
      <ReelLimitAlert showCompact />
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <Button 
            className="gap-2"
            disabled={reelsAtLimit}
          >
            <Plus className="h-4 w-4" />
            Create Reel
            {reelsUsage && reelsUsage.limit !== -1 && (
              <span className="text-xs opacity-70">
                ({reelsUsage.currentUsage}/{reelsUsage.limit})
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Reel</DialogTitle>
            {reelsNearLimit && reelsUsage && (
              <div className="text-sm text-orange-600">
                You've used {reelsUsage.currentUsage} of {reelsUsage.limit} reels this month
              </div>
            )}
            <div className="mt-4">
              <div className="flex items-center justify-center">
                {[1, 2].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentStep >= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currentStep > step ? <Check className="h-4 w-4" /> : step}
                    </div>
                    {step < 2 && (
                      <div className={`h-1 w-8 ${currentStep > step ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogHeader>

          <div className="mt-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <Label>Select Script</Label>
                {scripts.length > 0 ? (
                  <RadioGroup value={selectedScript || ""} onValueChange={setSelectedScript}>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {scripts.map((script) => (
                        <div key={script.id} className="flex items-start space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value={script.id} id={script.id} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={script.id} className="font-medium block mb-1">{script.title}</Label>
                            <p className="text-sm text-muted-foreground line-clamp-2">{script.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                ) : (
                  <Card className="bg-muted/40">
                    <CardContent className="py-6 text-center">
                      <p className="text-muted-foreground">No scripts available. Generate a script first.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <Label>Select Media</Label>
                <Tabs defaultValue="photos" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="photos" className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Photos ({photos.length})
                    </TabsTrigger>
                    <TabsTrigger value="videos" className="flex items-center gap-2">
                      <Film className="h-4 w-4" />
                      Videos ({videos.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="photos" className="mt-4">
                    {photos.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllPhotos}
                            className="text-xs"
                          >
                            {selectedPhotos.length === photos.length ? 'Deselect All' : 'Select All'}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {selectedPhotos.length} of {photos.length} selected
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
                          {photos.map((photo) => (
                            <div
                              key={photo.id}
                              onClick={() => {
                                setSelectedPhotos(prev => 
                                  prev.includes(photo.id) ? prev.filter(id => id !== photo.id) : [...prev, photo.id]
                                )
                              }}
                              className={`relative aspect-video rounded-md overflow-hidden cursor-pointer ${
                                selectedPhotos.includes(photo.id) ? "ring-2 ring-primary" : ""
                              }`}
                            >
                              <img
                                src={photo.file_path}
                                alt={photo.file_name}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                              {selectedPhotos.includes(photo.id) && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <Check className="h-6 w-6 text-primary" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Card className="bg-muted/40">
                        <CardContent className="py-6 text-center">
                          <p className="text-muted-foreground">No photos available. Upload photos first.</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                  <TabsContent value="videos" className="mt-4">
                    {videos.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllVideos}
                            className="text-xs"
                          >
                            {selectedVideos.length === videos.length ? 'Deselect All' : 'Select All'}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {selectedVideos.length} of {videos.length} selected
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                          {videos.map((video) => (
                            <div
                              key={video.id}
                              onClick={() => {
                                setSelectedVideos(prev => 
                                  prev.includes(video.id) ? prev.filter(id => id !== video.id) : [...prev, video.id]
                                )
                              }}
                              className={`relative aspect-video rounded-md overflow-hidden cursor-pointer ${
                                selectedVideos.includes(video.id) ? "ring-2 ring-primary" : ""
                              }`}
                            >
                              <VideoPreview 
                                src={video.file_path} 
                                className="w-full h-full"
                                isLoading={isCurrentReelGenerating}
                                status={currentGeneratingReelId ? reelStatuses[currentGeneratingReelId] : undefined}
                              />
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
                      <Card className="bg-muted/40">
                        <CardContent className="py-6 text-center">
                          <p className="text-muted-foreground">No videos available. Upload videos first.</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between mt-6">
            <div>
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={handlePreviousStep} 
                  disabled={isCurrentReelGenerating}
                >
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                onClick={closeModal} 
                disabled={isCurrentReelGenerating}
              >
                Cancel
              </Button>
              {currentStep < 2 ? (
                <Button 
                  onClick={handleNextStep}
                  disabled={!selectedScript}
                >
                  Next
                </Button>
              ) : (
                <Button 
                  onClick={handleCreateReel}
                  disabled={
                    isCurrentReelGenerating || 
                    selectedPhotos.length === 0 && selectedVideos.length === 0 ||
                    reelsAtLimit
                  }
                >
                  {isCurrentReelGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {getCurrentStatus()}
                    </>
                  ) : (
                    'Create Reel'
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
