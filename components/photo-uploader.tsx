"use client"

import type React from "react"

import { useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PhotoUploader() {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // In a real implementation, we would handle the dropped files here
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-4 transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center text-center">
        <Upload className="h-10 w-10 text-muted-foreground mb-2" />
        <h3 className="font-medium">Drag & drop photos here</h3>
        <p className="text-sm text-muted-foreground mt-1">or click the button below to browse files</p>
      </div>
      <Button>
        <Upload className="h-4 w-4 mr-2" />
        Upload Photos
      </Button>
    </div>
  )
}
