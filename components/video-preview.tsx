"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, Maximize, Minimize, Volume2, VolumeX, RotateCcw, Loader2, Spinner } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { ReelStatus } from "@/hooks/useReels"

interface VideoPreviewProps {
  src?: string
  isLoading?: boolean
  status?: ReelStatus
  progressDetails?: {
    message?: string;
    step?: number;
    total_steps?: number;
  };
  progressPercentage?: number;
  className?: string
}

export function VideoPreview({ src, isLoading, status, progressDetails, progressPercentage, className }: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setProgress((video.currentTime / video.duration) * 100)
    }

    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded:', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
      setDuration(video.duration)
      setProgress(0)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
      video.currentTime = 0
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("ended", handleEnded)

    // Force load metadata if video is already loaded
    if (video.readyState >= 2) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("ended", handleEnded)
    }
  }, [videoRef.current])

  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Reset state
      setIsPlaying(false)
      setProgress(0)
      setDuration(0)
      
      // Load new source
      video.load()
      
      // Check if metadata is already available
      if (video.readyState >= 2) {
        console.log('Video metadata already available:', {
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        });
        setDuration(video.duration)
      }
    }
  }, [src])

  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleProgressChange = (value: number[]) => {
    if (!videoRef.current) return
    const newTime = (value[0] / 100) * duration
    videoRef.current.currentTime = newTime
    setProgress(value[0])
  }

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) return
    const newVolume = value[0] / 100
    videoRef.current.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    if (isMuted) {
      videoRef.current.volume = volume
      setIsMuted(false)
    } else {
      videoRef.current.volume = 0
      setIsMuted(true)
    }
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const restart = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    setProgress(0)
    if (!isPlaying) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const getStatusMessage = (status: ReelStatus, details?: ReelStatus['progress_details']): string => {
    if (!status) return 'Processing...';
    
    if (details?.message) {
      return details.message;
    }

    switch (status) {
      case 'pending': return 'Starting...';
      case 'processing': return 'Processing...';
      case 'generating_audio': return 'Generating audio...';
      case 'processing_media': return 'Processing media...';
      case 'rendering_preparing': return 'Preparing video...';
      case 'rendering_processing': return 'Rendering video...';
      case 'rendering_finalizing': return 'Finalizing video...';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Processing...';
    }
  };

  if (isLoading || (status && [
    'pending',
    'processing',
    'generating_audio',
    'processing_media',
    'rendering_preparing',
    'rendering_processing',
    'rendering_finalizing'
  ].includes(status))) {
    return (
      <div className={cn("relative aspect-[9/16] w-full bg-muted", className)}>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground capitalize">
            {status ? status.replace(/_/g, ' ') : 'Loading...'}
          </p>
          {progressPercentage !== undefined && (
            <p className="mt-2 text-sm text-muted-foreground">{progressPercentage}%</p>
          )}
        </div>
      </div>
    )
  }

  if (!src && status !== 'completed') {
    return (
      <div className={cn(
        "relative flex items-center justify-center bg-black/5 rounded-lg overflow-hidden aspect-video",
        className
      )}>
        <p className="text-sm text-muted-foreground">No preview available</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative group bg-black rounded-lg overflow-hidden",
        isFullscreen ? "fixed inset-0 z-50" : className
      )}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        onClick={togglePlay}
      />
      
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="space-y-4">
          <Slider
            value={[progress]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={handleProgressChange}
            className="w-full"
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                onClick={restart}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              
              <span className="text-xs text-white">
                {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
              </span>
              
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                  onClick={toggleMute}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  className="w-24"
                />
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
          <Loader2 className="h-8 w-8 animate-spin text-white mb-2" />
          <div className="text-sm text-white text-center">
            {getStatusMessage(status, progressDetails)}
            {progressPercentage !== undefined && (
              <div className="mt-1 text-xs">
                {progressPercentage}%
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 