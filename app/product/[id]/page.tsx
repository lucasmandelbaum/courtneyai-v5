"use client"

import { useEffect, useState, useCallback } from "react"
import { ExternalLink, Copy, Play, Download, Trash, Wand2, AlertCircle, Edit, Plus, Trash2, Save, X, Grid, FileText, Clapperboard } from "lucide-react"
import { MediaUploader } from "@/components/media-uploader"
import { VideoPreview } from "@/components/video-preview"
import { ScriptGenerator } from "@/components/script-generator"
import { ReelCreator } from "@/components/reel-creator"
import { useProducts } from "@/hooks/useProducts"
import { useMedia } from "@/hooks/useMedia"
import { useScripts } from "@/hooks/useScripts"
import { useReels, type ReelStatus } from "@/hooks/useReels"
import { toast } from "sonner"
import { useRouter, useParams } from "next/navigation"
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs"
import { ErrorBoundary } from "react-error-boundary"
import { ScriptEditor } from "@/components/script-editor"

// HeroUI imports from main package (migration from NextUI to HeroUI)
import { 
  Button, 
  Card, 
  CardBody, 
  CardHeader, 
  CardFooter,
  Chip, 
  Divider, 
  Image,
  Input,
  Link, 
  Modal, 
  ModalBody, 
  ModalContent, 
  ModalFooter, 
  ModalHeader, 
  Skeleton, 
  Tab, 
  Tabs,
  Textarea,
  Tooltip,
  useDisclosure,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react"

interface ProductPageProps {
  params: {
    id: string
  }
}

interface Product {
  id: string
  name: string
  description: string | null
  url: string | null
  user_id: string | null
  created_at: string
  updated_at: string
}

// Initialize Supabase client
const supabase = createBrowserSupabaseClient()

// Helper function to generate pagination items (numbers and ellipses)
const getPaginationItems = (currentPage: number, totalPages: number, pageNeighbours = 1) => {
  const DOTS = "..."
  const paginationItems: (string | number)[] = []

  // Threshold to show all pages directly (e.g., if 7 or fewer pages for N=1)
  // N=1: 1 (first) + 1 (prev N) + 1 (current) + 1 (next N) + 1 (last) = 5 links without dots.
  // With 2 dots, total 7 items. So if totalPages <= 7, show all.
  const simpleThreshold = pageNeighbours * 2 + 5

  if (totalPages <= simpleThreshold && totalPages <= 7) {
    // Max 7 direct pages for N=1
    for (let i = 1; i <= totalPages; i++) {
      paginationItems.push(i)
    }
    return paginationItems
  }

  // Add the first page
  paginationItems.push(1)

  // Left dots
  if (currentPage - pageNeighbours > 2) {
    paginationItems.push(DOTS)
  }

  // Pages around current page
  const startPage = Math.max(2, currentPage - pageNeighbours)
  const endPage = Math.min(totalPages - 1, currentPage + pageNeighbours)

  for (let i = startPage; i <= endPage; i++) {
    if (!paginationItems.includes(i)) {
      paginationItems.push(i)
    }
  }

  // Right dots
  if (currentPage + pageNeighbours < totalPages - 1) {
    paginationItems.push(DOTS)
  }

  // Add the last page (if not already included and not page 1)
  if (totalPages > 1 && !paginationItems.includes(totalPages)) {
    paginationItems.push(totalPages)
  }

  // Remove consecutive DOTS, just in case
  return paginationItems.filter((item, index, self) => item !== DOTS || (item === DOTS && self[index - 1] !== DOTS))
}

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="p-6 bg-danger-50 rounded-lg max-w-lg mx-auto my-12">
      <h2 className="text-lg font-semibold mb-2 text-danger-700">Something went wrong:</h2>
      <p className="text-sm text-default-500 mb-4">{error.message}</p>
      <Button color="danger" onClick={resetErrorBoundary}>Try again</Button>
    </div>
  )
}

export default function ProductPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : ''
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [isMediaExpanded, setIsMediaExpanded] = useState(false)
  const [isScriptsExpanded, setIsScriptsExpanded] = useState(false)
  const [isReelsExpanded, setIsReelsExpanded] = useState(false)
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false)
  const [mediaPage, setMediaPage] = useState(1)
  const [mediaPerPage] = useState(10)
  const [scriptsPage, setScriptsPage] = useState(1)
  const [scriptsPerPage] = useState(5)
  const [reelsPage, setReelsPage] = useState(1)
  const [reelsPerPage] = useState(6)
  // Header editing states
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [editingDescription, setEditingDescription] = useState("")
  const [editingUrl, setEditingUrl] = useState("")
  const [isSavingDescription, setIsSavingDescription] = useState(false)
  const [isSavingUrl, setIsSavingUrl] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("media")
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();
  const supabaseClient = createBrowserSupabaseClient(); // Initialize client once

  // State for new script creation UI
  const [scriptCreationMode, setScriptCreationMode] = useState<null | 'ai' | 'manual'>(null);
  const { 
    isOpen: isManualScriptModalOpen, 
    onOpen: onManualScriptModalOpen, 
    onClose: onManualScriptModalClose,
    onOpenChange: onManualScriptModalOpenChangeInternal // Renamed to avoid conflict
  } = useDisclosure();

  // State for manual script form
  const [manualScriptTitle, setManualScriptTitle] = useState("");
  const [manualScriptContent, setManualScriptContent] = useState("");
  const [manualScriptCaption, setManualScriptCaption] = useState("");
  const [isSavingManualScript, setIsSavingManualScript] = useState(false);

  // Hydration safety
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Redirect if no ID
  useEffect(() => {
    if (!id) {
      router.push("/")
    }
  }, [id, router])

  // Fetch product details
  const { products, isLoading: isLoadingProduct, deleteProduct, refetch: refetchProduct } = useProducts()
  const product = products.find(p => p.id === id)

  // Fetch media
  const { photos, videos, isLoading: isLoadingMedia, refetch: fetchMedia, deleteMedia, downloadFromUrl } = useMedia(id)

  // Fetch scripts
  const { scripts, isLoading: isLoadingScripts, refetch: refetchScripts, deleteScript } = useScripts(id)

  // Fetch reels
  const { reels, isLoading: isLoadingReels, refetch: refetchReels } = useReels(id)

  // Debug reels update
  useEffect(() => {
    console.log('Reels updated:', reels.length, 'reels found', 
      reels.map(r => ({ id: r.id, status: r.status, title: r.title })))
  }, [reels])

  // Function to refresh reels that can be called from anywhere
  const refreshReels = useCallback(() => {
    console.log('Explicitly refreshing reels list')
    // Force a more aggressive refresh
    setIsLoading(true)
    refetchReels().then(() => {
      console.log('Reels refresh completed')
      // Force a re-render
      setIsLoading(false)
    })
  }, [refetchReels])
  
  // Set up a polling mechanism as a backup
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (reels.some(reel => reel.status === 'pending' || reel.status === 'processing')) {
        console.log('Found pending/processing reels, refreshing automatically')
        refetchReels()
      }
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(refreshInterval)
  }, [reels, refetchReels])

  // Handle manual script save
  const handleSaveManualScript = async () => {
    if (!manualScriptContent.trim()) {
      toast.error("Script content cannot be empty.")
      return
    }
    setIsSavingManualScript(true)
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        toast.error("Authentication error. Please log in again.");
        setIsSavingManualScript(false);
        return;
      }

      const { error } = await supabaseClient.from("scripts").insert([
        {
          product_id: id,
          user_id: session.user.id,
          title: manualScriptTitle.trim() || null,
          content: manualScriptContent.trim(),
          caption: manualScriptCaption.trim() || null,
          // Add any other necessary fields like 'status' or 'type' if your table has them
        },
      ])

      if (error) throw error

      toast.success("Script created successfully!")
      await refetchScripts()
      onManualScriptModalCloseInternal() // Correct: Call the aliased onClose to close the modal
      // Reset form fields
      setManualScriptTitle("")
      setManualScriptContent("")
      setManualScriptCaption("")
      setScriptCreationMode(null) // Reset creation mode
    } catch (error) {
      console.error("Error saving manual script:", error)
      toast.error("Failed to save script. Check console for details.")
    } finally {
      setIsSavingManualScript(false)
    }
  }

  // Wrapper for modal open change to reset form and mode
  const onManualScriptModalOpenChange = (isOpen: boolean) => {
    // This function will be passed to the Modal's onOpenChange prop.
    // It receives the new open state from the Modal.
    if (!isOpen) {
      // Reset form and mode when modal is closed
      setManualScriptTitle("");
      setManualScriptContent("");
      setManualScriptCaption("");
      setScriptCreationMode(null); // Important to allow re-selection
      // Also call the onClose from useDisclosure to update its internal state
      onManualScriptModalClose();
    }
  };
  // Alias original onClose to avoid direct usage in success path of save and for clarity
  const onManualScriptModalCloseInternal = onManualScriptModalClose;

  // Handle deletion
  const handleDelete = async (itemId: string, type: string) => {
    if (!itemId) return
    try {
      setIsDeleting(true)
      if (type === "product") {
        await deleteProduct(itemId)
        toast.success("Product deleted successfully")
        router.push("/")
      } else if (type === "photo" || type === "video") {
        await deleteMedia(itemId, type)
        toast.success(`${type} deleted successfully`)
        await fetchMedia()
      } else if (type === "script") {
        await deleteScript(itemId)
        toast.success("Script deleted successfully")
        await refetchScripts()
      } else if (type === "reel") {
        // const supabaseClient = createBrowserSupabaseClient() // Already initialized
        
        // First delete associated reel_media records
        const { error: mediaError } = await supabaseClient
          .from("reel_media")
          .delete()
          .eq("reel_id", itemId)

        if (mediaError) {
          console.error("Error deleting reel media:", mediaError)
          throw mediaError
        }

        // Then delete associated audio records
        const { error: audioError } = await supabaseClient
          .from("audio")
          .delete()
          .eq("reel_id", itemId)

        if (audioError) {
          console.error("Error deleting audio:", audioError)
          throw audioError
        }

        // Finally delete the reel itself
        const { error: reelError } = await supabaseClient
          .from("reels")
          .delete()
          .eq("id", itemId)

        if (reelError) {
          console.error("Error deleting reel:", reelError)
          throw reelError
        }

        refreshReels()
        toast.success("Reel deleted successfully")
      }
    } catch (error) {
      toast.error(`Failed to delete ${type}`)
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRetry = async (reelId: string) => {
    try {
      // const supabaseClient = createBrowserSupabaseClient() // Already initialized
      
      // Get the reel details first
      const { data: reel, error: reelError } = await supabaseClient
        .from("reels")
        .select(`
          *,
          script:scripts(*),
          reel_media(*)
        `)
        .eq("id", reelId)
        .single()

      if (reelError) throw reelError
      if (!reel) throw new Error("Reel not found")

      // Get media IDs
      const photoIds = reel.reel_media
        .filter((m: { media_type: string; photo_id: string }) => m.media_type === 'photo')
        .map((m: { photo_id: string }) => m.photo_id)
        .filter(Boolean)

      const videoIds = reel.reel_media
        .filter((m: { media_type: string; video_id: string }) => m.media_type === 'video')
        .map((m: { video_id: string }) => m.video_id)
        .filter(Boolean)

      // Update status back to processing
      await supabaseClient
        .from("reels")
        .update({ status: "processing" })
        .eq("id", reelId)

      // Call the Edge Function with all required fields
      const session = (await supabaseClient.auth.getSession()).data.session;
      if (!session) {
        toast.error("Authentication error. Please log in again.");
        return;
      }

      const response = await fetch('/api/edge/generate-reel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          productId: reel.product_id,
          scriptId: reel.script_id,
          templateId: reel.template_id,
          photoIds,
          videoIds,
          title: reel.title
        }),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to retry reel generation')
      }

      toast.success("Retrying reel generation")
      refreshReels()
    } catch (error) {
      console.error("Error retrying reel:", error)
      toast.error("Failed to retry reel generation")
    }
  }

  // Header editing functions
  const handleSaveDescription = async () => {
    try {
      setIsSavingDescription(true)
      
      const { error } = await supabaseClient
        .from("products")
        .update({ description: editingDescription.trim() || null })
        .eq("id", id)

      if (error) throw error

      toast.success("Product description updated")
      await refetchProduct()
      setIsEditingDescription(false)
    } catch (error) {
      console.error("Error updating product description:", error)
      toast.error("Failed to update product description")
    } finally {
      setIsSavingDescription(false)
    }
  }

  const handleSaveUrl = async () => {
    try {
      setIsSavingUrl(true)
      
      const { error } = await supabaseClient
        .from("products")
        .update({ url: editingUrl.trim() || null })
        .eq("id", id)

      if (error) throw error

      toast.success("Product URL updated")
      await refetchProduct()
      setIsEditingUrl(false)
    } catch (error) {
      console.error("Error updating product URL:", error)
      toast.error("Failed to update product URL")
    } finally {
      setIsSavingUrl(false)
    }
  }

  const handleGenerateDescription = async () => {
    if (!product?.url) {
      toast.error("Product URL is required for AI description")
      return
    }

    try {
      setIsGeneratingDescription(true)
      
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (!session) throw new Error("No session found")

      const { data, error } = await supabaseClient.functions.invoke('fetch-product-description', {
        body: { productId: id }
      })

      if (error) throw error

      if (data?.data?.description) {
        setEditingDescription(data.data.description)
        toast.success("AI description generated successfully")
      } else {
        throw new Error("No description received")
      }
    } catch (error) {
      console.error("Error generating description:", error)
      toast.error("Failed to generate description")
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const handleCancelDescriptionEdit = () => {
    setEditingDescription(product?.description || "")
    setIsEditingDescription(false)
  }

  const handleCancelUrlEdit = () => {
    setEditingUrl(product?.url || "")
    setIsEditingUrl(false)
  }

  const handleStartEditingDescription = () => {
    setEditingDescription(product?.description || "")
    setIsEditingDescription(true)
  }

  const handleStartEditingUrl = () => {
    setEditingUrl(product?.url || "")
    setIsEditingUrl(true)
  }

  // Show loading state until client-side hydration is complete
  if (!hydrated || isLoadingProduct || !product) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-[200px] rounded-lg" />
          <Skeleton className="h-[200px] rounded-lg" />
          <Skeleton className="h-[200px] rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      {!hydrated ? null : (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {isLoadingProduct || !product ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-[300px] rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Product Header Card - Enhanced */}
              <Card className="max-w-4xl mx-auto border border-default-200">
                <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 p-4">
                  <div className="pr-8">
                    <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
                    <p className="text-sm text-foreground-500">
                      Created on {new Date(product.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    color="danger"
                    variant="flat"
                    isIconOnly
                    onPress={onDeleteModalOpen}
                    isLoading={isDeleting}
                    aria-label={isDeleting ? "Deleting Product..." : "Delete Product"}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                
                <CardBody className="p-4 pt-0 space-y-3">
                  {/* URL Section */}
                  <div className="group relative">
                    {isEditingUrl ? (
                      <div className="space-y-2">
                        <Input
                          type="url"
                          value={editingUrl}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingUrl(e.target.value)}
                          placeholder="https://your-product-url.com"
                          variant="faded"
                          classNames={{ inputWrapper: "bg-content2" }}
                        />
                        <div className="flex gap-2 justify-end pt-1">
                          <Button
                            size="sm"
                            variant="light"
                            startContent={<X className="h-4 w-4" />}
                            onPress={handleCancelUrlEdit}
                            isDisabled={isSavingUrl}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            color="primary"
                            startContent={<Save className="h-4 w-4" />}
                            onPress={handleSaveUrl}
                            isLoading={isSavingUrl}
                          >
                            {isSavingUrl ? "Saving..." : "Save URL"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pr-8 relative">
                        {!isEditingUrl && (
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            startContent={product.url ? <Edit className="h-4 w-4 text-foreground-500" /> : <Plus className="h-4 w-4 text-foreground-500"/>}
                            onPress={handleStartEditingUrl}
                            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={product.url ? "Edit URL" : "Add URL"}
                          />
                        )}
                        {product.url ? (
                          <Link 
                            href={product.url} 
                            isExternal 
                            showAnchorIcon
                            className="text-sm text-primary hover:underline"
                            anchorIcon={<ExternalLink className="ml-1 h-3 w-3" />}
                          >
                            {product.url.length > 70 ? product.url.substring(0, 67) + "..." : product.url}
                          </Link>
                        ) : (
                          <span className="text-sm text-foreground-400 italic">No product URL. Click the edit icon to add one.</span>
                        )}
                      </div>
                    )}
                  </div>

                  <Divider className="my-4" />

                  {/* Description Section */}
                  <div className="group relative">
                    {isEditingDescription ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingDescription}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingDescription(e.target.value)}
                          placeholder="Add a detailed description for your product..."
                          minRows={3}
                          maxRows={8}
                          variant="faded"
                          classNames={{ inputWrapper: "bg-content2" }}
                        />
                        <div className="flex flex-wrap gap-2 justify-end pt-1">
                          <Button
                            size="sm"
                            startContent={<Wand2 className="h-4 w-4" />}
                            onPress={handleGenerateDescription}
                            isLoading={isGeneratingDescription}
                            isDisabled={!product.url || isSavingDescription}
                            variant="flat"
                            color="secondary"
                          >
                            {isGeneratingDescription ? "Generating..." : "AI Assist"}
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            startContent={<X className="h-4 w-4" />}
                            onPress={handleCancelDescriptionEdit}
                            isDisabled={isSavingDescription || isGeneratingDescription}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            color="primary"
                            startContent={<Save className="h-4 w-4" />}
                            onPress={handleSaveDescription}
                            isLoading={isSavingDescription}
                            isDisabled={isGeneratingDescription}
                          >
                            {isSavingDescription ? "Saving..." : "Save Description"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pr-8 relative">
                        {!isEditingDescription && (
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            startContent={<Edit className="h-4 w-4 text-foreground-500" />}
                            onPress={handleStartEditingDescription}
                            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Edit description"
                          />
                        )}
                        <p className="text-sm text-foreground leading-relaxed">
                          {product.description ? 
                            (product.description.length > 200 ? product.description.substring(0, 197) + '...' : product.description) : 
                            <span className="text-foreground-400 italic">No description yet. Click the edit icon to add one.</span>
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
              
              {/* Main Content Tabs - Simplified layout without unnecessary card wrappers */}
              <div className="max-w-4xl mx-auto">
                <Tabs 
                  aria-label="Product Content"
                  selectedKey={activeTab}
                  onSelectionChange={(key) => setActiveTab(key as string)}
                  classNames={{ panel: "pt-6" }}
                >
                  <Tab 
                    key="media" 
                    title={(
                      <div className="flex items-center">
                        <Grid className="h-5 w-5 mr-2" />
                        <span>{`Media (${photos.length + videos.length})`}</span>
                      </div>
                    )}
                  >
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                        <div>
                          <h2 className="text-xl font-semibold text-default-700">Media Library</h2>
                          <p className="text-sm text-default-500">Upload and manage product media</p>
                        </div>
                        <div className="flex-shrink-0">
                          <MediaUploader productId={id} onMediaUploaded={fetchMedia} />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {[...photos, ...videos]
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .slice((mediaPage - 1) * mediaPerPage, mediaPage * mediaPerPage)
                          .map((item) => {
                            const isPhoto = 'duration' in item ? false : true;
                            return (
                              <Card 
                                key={item.id} 
                                className="group aspect-square shadow-sm hover:shadow-md transition-shadow border border-default-200"
                              >
                                <CardBody className="p-0 overflow-hidden">
                                {isPhoto ? (
                                  <img
                                    src={item.file_path || "/placeholder.svg"}
                                    alt={item.file_name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                ) : (
                                  <VideoPreview 
                                    src={item.file_path}
                                    className="absolute inset-0 w-full h-full object-cover rounded-none bg-transparent"
                                  />
                                )}
                                </CardBody>
                                <div className="absolute top-2 left-2 z-10">
                                  <Chip size="sm" color="default" variant="flat" className="backdrop-blur-sm bg-black/30 text-white">
                                    {isPhoto ? 'Photo' : 'Video'}
                                  </Chip>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 z-10">
                                  <div className="flex justify-end gap-2">
                                    <Tooltip content="Download">
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        className="text-white hover:bg-white/20"
                                        onPress={() => window.open(item.file_path, "_blank")}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    </Tooltip>
                                    <Tooltip content="Delete">
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        color="danger"
                                        variant="light"
                                        className="hover:bg-danger/20"
                                        onPress={() => handleDelete(item.id, isPhoto ? "photo" : "video")}
                                      >
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    </Tooltip>
                                  </div>
                                </div>
                              </Card>
                            )
                          })}
                        {(photos.length === 0 && videos.length === 0) && (
                          <Card className="col-span-full bg-default-50">
                            <CardBody className="p-6 text-center">
                              <p className="text-default-500">No media uploaded yet</p>
                            </CardBody>
                          </Card>
                        )}
                      </div>
                      
                      {/* Pagination Controls */}
                      {(photos.length + videos.length > mediaPerPage) && (() => {
                        const totalPagesMedia = Math.ceil((photos.length + videos.length) / mediaPerPage);
                        const paginationItems = getPaginationItems(mediaPage, totalPagesMedia);
                        return (
                          <div className="flex justify-center items-center gap-2 mt-6">
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setMediaPage(p => Math.max(1, p - 1))}
                              disabled={mediaPage <= 1}
                            >
                              Previous
                            </Button>
                            {paginationItems.map((item, index) => (
                              item === "..." ? (
                                <span key={index} className="px-2">...</span>
                              ) : (
                                <Button
                                  key={index}
                                  size="sm"
                                  variant={mediaPage === item ? "solid" : "flat"}
                                  color={mediaPage === item ? "secondary" : "default"}
                                  onPress={() => setMediaPage(item as number)}
                                >
                                  {item}
                                </Button>
                              )
                            ))}
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setMediaPage(p => Math.min(totalPagesMedia, p + 1))}
                              disabled={mediaPage >= totalPagesMedia}
                            >
                              Next
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  </Tab>
                  <Tab 
                    key="scripts" 
                    title={(
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        <span>{`Scripts (${scripts.length})`}</span>
                      </div>
                    )}
                  >
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                        <div>
                          <h2 className="text-xl font-semibold text-default-700">Scripts</h2>
                          <p className="text-sm text-default-500">Generate and manage product scripts</p>
                        </div>
                        <div className="flex-shrink-0">
                          <Dropdown>
                            <DropdownTrigger>
                              <Button 
                                color="primary"
                                variant="solid"
                                startContent={<Plus className="h-5 w-5" />}
                              >
                                New Script
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu 
                              aria-label="New Script Options"
                              onAction={(key) => {
                                if (key === "ai") {
                                  setScriptCreationMode("ai");
                                  // Scroll to the script generator section
                                  const scriptGeneratorElement = document.getElementById('script-generator-component');
                                  if (scriptGeneratorElement) {
                                    scriptGeneratorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                } else if (key === "manual") {
                                  setScriptCreationMode("manual");
                                  onManualScriptModalOpen();
                                }
                              }}
                            >
                              <DropdownItem key="manual" startContent={<Edit className="h-4 w-4" />}>
                                Manual Entry
                              </DropdownItem>
                              <DropdownItem key="ai" startContent={<Wand2 className="h-4 w-4" />}>
                                Generate with AI
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </div>
                      </div>
                      
                      {scriptCreationMode === 'ai' && (
                        <div id="script-generator-component" className="bg-content2 rounded-lg p-4">
                           <h3 className="text-lg font-semibold text-default-700 mb-3">Generate Script with AI</h3>
                          <ScriptGenerator productId={id} product={product} onScriptCreated={() => { refetchScripts(); setScriptCreationMode(null); }} />
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        {scripts
                          .slice((scriptsPage - 1) * scriptsPerPage, scriptsPage * scriptsPerPage)
                          .map((script) => (
                          <Card 
                            key={script.id} 
                            className="relative bg-white hover:shadow-lg transition-shadow cursor-pointer"
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  {new Date(script.created_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </div>
                                <div className="flex gap-1 items-center">
                                  <ScriptEditor
                                    scriptId={script.id}
                                    productId={id}
                                    initialTitle={script.title}
                                    initialContent={script.content}
                                    initialCaption={script.caption || ""}
                                    onScriptEdited={() => {
                                      console.log('Refreshing scripts list after edit')
                                      refetchScripts()
                                    }}
                                  />
                                  <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8"
                                    onPress={() => {
                                      navigator.clipboard.writeText(script.content)
                                      toast.success("Script copied to clipboard")
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    color="danger"
                                    className="h-8 w-8 text-danger hover:text-danger-600"
                                    onPress={() => handleDelete(script.id, "script")}
                                    disabled={isDeleting}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardBody>
                              <div className="space-y-4">
                                <p className="text-sm leading-relaxed">{script.content}</p>
                                {script.caption && (
                                  <div className="text-sm text-default-500 border-t pt-2">
                                    <p className="font-medium mb-1">Caption:</p>
                                    <p>{script.caption}</p>
                                  </div>
                                )}
                              </div>
                            </CardBody>
                          </Card>
                        ))}
                        {scripts.length === 0 && (
                          <Card className="bg-default-50">
                            <CardBody className="p-6 text-center">
                              <p className="text-default-500">No scripts generated yet</p>
                            </CardBody>
                          </Card>
                        )}
                      </div>
                      
                      {/* Pagination Controls */}
                      {(scripts.length > scriptsPerPage) && (() => {
                        const totalPagesScripts = Math.ceil(scripts.length / scriptsPerPage);
                        const paginationItems = getPaginationItems(scriptsPage, totalPagesScripts);
                        return (
                          <div className="flex justify-center items-center gap-2 mt-6">
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setScriptsPage(p => Math.max(1, p - 1))}
                              disabled={scriptsPage <= 1}
                            >
                              Previous
                            </Button>
                            {paginationItems.map((item, index) => (
                              item === "..." ? (
                                <span key={index} className="px-2">...</span>
                              ) : (
                                <Button
                                  key={index}
                                  size="sm"
                                  variant={scriptsPage === item ? "solid" : "flat"}
                                  color={scriptsPage === item ? "secondary" : "default"}
                                  onPress={() => setScriptsPage(item as number)}
                                >
                                  {item}
                                </Button>
                              )
                            ))}
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setScriptsPage(p => Math.min(totalPagesScripts, p + 1))}
                              disabled={scriptsPage >= totalPagesScripts}
                            >
                              Next
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  </Tab>
                  <Tab 
                    key="reels" 
                    title={(
                      <div className="flex items-center">
                        <Clapperboard className="h-5 w-5 mr-2" />
                        <span>{`Reels (${reels.length})`}</span>
                      </div>
                    )}
                  >
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 w-full">
                        <div>
                          <h2 className="text-xl font-semibold text-default-700">Reels</h2>
                          <p className="text-sm text-default-500">Create and manage video reels</p>
                        </div>
                        <div className="flex-shrink-0">
                          <ReelCreator 
                            productId={id} 
                            onReelGenerated={refreshReels} 
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {reels
                          .slice((reelsPage - 1) * reelsPerPage, reelsPage * reelsPerPage)
                          .map((reel) => (
                          <Card 
                            key={reel.id} 
                            className="group aspect-[9/16] shadow-sm overflow-hidden"
                          >
                            <CardBody className="p-0 relative"> {/* Ensure CardBody is relative for absolute positioning of children */}
                              {reel.status === "completed" && reel.storage_path ? (
                                <VideoPreview
                                  src={supabase.storage.from('generated-reels').getPublicUrl(reel.storage_path.replace('generated-reels/', '')).data.publicUrl}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  status={reel.status as ReelStatus}
                                />
                              ) : (
                                <VideoPreview
                                  isLoading={reel.status === "processing"}
                                  status={reel.status as ReelStatus}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {reel.status === "completed" && reel.storage_path && (
                                  <>
                                    <Tooltip content="Copy Public URL">
                                      <Button 
                                        variant="flat" 
                                        color="default"
                                        size="sm"
                                        isIconOnly
                                        onPress={() => {
                                          const { data: { publicUrl } } = supabase.storage.from('generated-reels').getPublicUrl(reel.storage_path!.replace('generated-reels/', ''));
                                          if (publicUrl) {
                                            navigator.clipboard.writeText(publicUrl);
                                            toast.success("Public URL copied to clipboard!");
                                          } else {
                                            toast.error("Could not get public URL.");
                                          }
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </Tooltip>
                                    <Tooltip content="Retry Generation">
                                      <Button 
                                        variant="flat" 
                                        color="warning" 
                                        size="sm"
                                        isIconOnly
                                        onPress={() => handleRetry(reel.id)}
                                        isLoading={isLoading}
                                      >
                                        <Wand2 className="h-3 w-3" />
                                      </Button>
                                    </Tooltip>
                                  </>
                                )}
                                <Tooltip content="Delete Reel">
                                  <Button 
                                    variant="flat" 
                                    color="danger"
                                    size="sm" 
                                    isIconOnly
                                    onPress={() => handleDelete(reel.id, "reel")}
                                    isLoading={isDeleting}
                                  >
                                    <Trash className="h-3 w-3" />
                                  </Button>
                                </Tooltip>
                              </div>
                            </CardBody>
                          </Card>
                        ))}
                        {reels.length === 0 && (
                          <Card className="bg-default-50">
                            <CardBody className="p-6 text-center">
                              <p className="text-default-500">No reels created yet</p>
                            </CardBody>
                          </Card>
                        )}
                      </div>
                      
                      {/* Pagination Controls */}
                      {(reels.length > reelsPerPage) && (() => {
                        const totalPagesReels = Math.ceil(reels.length / reelsPerPage);
                        const paginationItems = getPaginationItems(reelsPage, totalPagesReels);
                        return (
                          <div className="flex justify-center items-center gap-2 mt-6">
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setReelsPage(p => Math.max(1, p - 1))}
                              disabled={reelsPage <= 1}
                            >
                              Previous
                            </Button>
                            {paginationItems.map((item, index) => (
                              item === "..." ? (
                                <span key={index} className="px-2">...</span>
                              ) : (
                                <Button
                                  key={index}
                                  size="sm"
                                  variant={reelsPage === item ? "solid" : "flat"}
                                  color={reelsPage === item ? "secondary" : "default"}
                                  onPress={() => setReelsPage(item as number)}
                                >
                                  {item}
                                </Button>
                              )
                            ))}
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setReelsPage(p => Math.min(totalPagesReels, p + 1))}
                              disabled={reelsPage >= totalPagesReels}
                            >
                              Next
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  </Tab>
                </Tabs>
              </div>

              {/* Delete Product Modal */}
              <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose}>
                <ModalContent>
                  {(onClose) => (
                    <>
                      <ModalHeader className="flex flex-col gap-1">Confirm Deletion</ModalHeader>
                      <ModalBody>
                        <p>
                          Are you sure you want to delete this product: <strong>{product.name}</strong>?
                        </p>
                        <p className="text-sm text-default-500">
                          This action cannot be undone. All associated media, scripts, and reels will be permanently deleted.
                        </p>
                      </ModalBody>
                      <ModalFooter>
                        <Button color="default" variant="light" onPress={onClose}>
                          Cancel
                        </Button>
                        <Button 
                          color="danger" 
                          onPress={() => {
                            handleDelete(id, "product");
                            onClose();
                          }}
                          isLoading={isDeleting}
                        >
                          {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </Button>
                      </ModalFooter>
                    </>
                  )}
                </ModalContent>
              </Modal>

              {/* Manual Script Creation Modal */}
              <Modal 
                isOpen={isManualScriptModalOpen} 
                onOpenChange={onManualScriptModalOpenChange}
                size="2xl"
                backdrop="blur"
              >
                <ModalContent>
                  {(onClose) => (
                    <>
                      <ModalHeader className="flex flex-col gap-1">Create New Script Manually</ModalHeader>
                      <ModalBody>
                        <Input
                          label="Script Title (Optional)"
                          placeholder="E.g., Catchy Intro Hook"
                          value={manualScriptTitle}
                          onValueChange={setManualScriptTitle}
                          variant="faded"
                        />
                        <Textarea
                          label="Script Content"
                          placeholder="Write your amazing script here..."
                          value={manualScriptContent}
                          onValueChange={setManualScriptContent}
                          minRows={5}
                          maxRows={15}
                          isRequired
                          variant="faded"
                          classNames={{ inputWrapper: "bg-default-50" }}
                        />
                        <Textarea
                          label="Script Caption (Optional)"
                          placeholder="Add a compelling caption for your video..."
                          value={manualScriptCaption}
                          onValueChange={setManualScriptCaption}
                          minRows={2}
                          maxRows={5}
                          variant="faded"
                        />
                      </ModalBody>
                      <ModalFooter>
                        <Button color="danger" variant="light" onPress={onClose}>
                          Cancel
                        </Button>
                        <Button 
                          color="primary" 
                          onPress={handleSaveManualScript}
                          isLoading={isSavingManualScript}
                          startContent={!isSavingManualScript ? <Save className="h-4 w-4" /> : null}
                        >
                          {isSavingManualScript ? "Saving..." : "Save Script"}
                        </Button>
                      </ModalFooter>
                    </>
                  )}
                </ModalContent>
              </Modal>

            </div>
          )}
        </ErrorBoundary>
      )}
    </div>
  )
}
