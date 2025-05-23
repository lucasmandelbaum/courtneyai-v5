"use client"

import { useEffect, useState, useCallback } from "react"
import { ExternalLink, MoreVertical, Copy, Play, Download, Trash, Wand2, Settings, AlertCircle, Edit, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MediaUploader } from "@/components/media-uploader"
import { VideoPreview } from "@/components/video-preview"
import { ScriptGenerator } from "@/components/script-generator"
import { ReelCreator } from "@/components/reel-creator"
import { useProducts } from "@/hooks/useProducts"
import { useMedia } from "@/hooks/useMedia"
import { useScripts } from "@/hooks/useScripts"
import { useReels, ReelStatus } from "@/hooks/useReels"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useRouter, useParams } from "next/navigation"
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs"
import { ErrorBoundary } from "react-error-boundary"
import { Badge } from "@/components/ui/badge"
import { ScriptEditor } from "@/components/script-editor"
import { ProductDescriptionEditor } from "@/components/product-description-editor"
import { ProductUrlEditor } from "@/components/product-url-editor"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
const getPaginationItems = (currentPage: number, totalPages: number, pageNeighbours: number = 1) => {
  const DOTS = "...";
  const paginationItems: (string | number)[] = [];

  // Threshold to show all pages directly (e.g., if 7 or fewer pages for N=1)
  // N=1: 1 (first) + 1 (prev N) + 1 (current) + 1 (next N) + 1 (last) = 5 links without dots.
  // With 2 dots, total 7 items. So if totalPages <= 7, show all.
  const simpleThreshold = (pageNeighbours * 2) + 5;

  if (totalPages <= simpleThreshold && totalPages <= 7) { // Max 7 direct pages for N=1
     for (let i = 1; i <= totalPages; i++) {
       paginationItems.push(i);
     }
     return paginationItems;
  }

  // Add the first page
  paginationItems.push(1);

  // Left dots
  if (currentPage - pageNeighbours > 2) {
    paginationItems.push(DOTS);
  }

  // Pages around current page
  const startPage = Math.max(2, currentPage - pageNeighbours);
  const endPage = Math.min(totalPages - 1, currentPage + pageNeighbours);

  for (let i = startPage; i <= endPage; i++) {
    if (!paginationItems.includes(i)) {
      paginationItems.push(i);
    }
  }

  // Right dots
  if (currentPage + pageNeighbours < totalPages - 1) {
    paginationItems.push(DOTS);
  }

  // Add the last page (if not already included and not page 1)
  if (totalPages > 1 && !paginationItems.includes(totalPages)) {
    paginationItems.push(totalPages);
  }
  
  // Remove consecutive DOTS, just in case
  return paginationItems.filter((item, index, self) => item !== DOTS || (item === DOTS && self[index -1] !== DOTS ));
};

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="p-6 bg-destructive/10 rounded-lg max-w-lg mx-auto my-12">
      <h2 className="text-lg font-semibold mb-2">Something went wrong:</h2>
      <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
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
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("details")

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

  // Handle deletion
  const handleDelete = async (id: string, type: string) => {
    if (!id) return
    try {
      setIsDeleting(true)
      if (type === "product") {
        await deleteProduct(id)
        toast.success("Product deleted successfully")
        router.push("/")
      } else if (type === "photo" || type === "video") {
        await deleteMedia(id, type)
        toast.success(`${type} deleted successfully`)
        await fetchMedia()
      } else if (type === "script") {
        await deleteScript(id)
        toast.success("Script deleted successfully")
        await refetchScripts()
      } else if (type === "reel") {
        const supabase = createBrowserSupabaseClient()
        
        // First delete associated reel_media records
        const { error: mediaError } = await supabase
          .from("reel_media")
          .delete()
          .eq("reel_id", id)

        if (mediaError) {
          console.error("Error deleting reel media:", mediaError)
          throw mediaError
        }

        // Then delete associated audio records
        const { error: audioError } = await supabase
          .from("audio")
          .delete()
          .eq("reel_id", id)

        if (audioError) {
          console.error("Error deleting audio:", audioError)
          throw audioError
        }

        // Finally delete the reel itself
        const { error: reelError } = await supabase
          .from("reels")
          .delete()
          .eq("id", id)

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
      const supabase = createBrowserSupabaseClient()
      
      // Get the reel details first
      const { data: reel, error: reelError } = await supabase
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
      await supabase
        .from("reels")
        .update({ status: "processing" })
        .eq("id", reelId)

      // Call the Edge Function with all required fields
      const response = await fetch('/api/edge/generate-reel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
    } catch (error) {
      console.error("Error retrying reel:", error)
      toast.error("Failed to retry reel generation")
    }
  }

  // Show loading state until client-side hydration is complete
  if (!hydrated || isLoadingProduct || !product) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Skeleton className="h-8 w-48" />
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      {!hydrated ? null : (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {isLoadingProduct || !product ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-[300px]" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">{product.name}</h1>
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="gap-2"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" /> 
                        {isDeleting ? "Deleting..." : "Delete Product"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to delete this product?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete "{product.name}" and all its associated media, scripts, and reels.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDelete(id, "product")}
                          disabled={isDeleting}
                        >
                          {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <Tabs defaultValue="details" className="w-full">
                <TabsList>
                  <TabsTrigger
                    value="details"
                    className=""
                  >
                    Details
                  </TabsTrigger>
                  <TabsTrigger
                    value="media"
                  >
                    Media
                  </TabsTrigger>
                  <TabsTrigger
                    value="scripts"
                  >
                    Scripts
                  </TabsTrigger>
                  <TabsTrigger
                    value="reels"
                  >
                    Reels
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Product Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ProductUrlEditor 
                        productId={id} 
                        initialUrl={product.url} 
                        onUrlUpdated={refetchProduct} 
                      />
                      <Separator className="my-4" />
                      <ProductDescriptionEditor 
                        productId={id}
                        initialDescription={product.description}
                        onDescriptionUpdated={refetchProduct}
                        productUrl={product.url}
                        onSaveOrCancel={refetchProduct}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="media" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Media</CardTitle>
                      <CardDescription>Upload and manage product media</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MediaUploader productId={id} onMediaUploaded={fetchMedia} />
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Media</h2>
                        <div className="flex gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Button
                                    variant="secondary"
                                    className="gap-2"
                                    onClick={() => {
                                      setIsLoading(true)
                                      downloadFromUrl()
                                        .catch(() => {}) // Error is already handled by toast
                                        .finally(() => setIsLoading(false))
                                    }}
                                    disabled={isLoading || !product?.url}
                                  >
                                    {isLoading ? (
                                      <>
                                        <Wand2 className="h-4 w-4 animate-spin" />
                                        Extracting...
                                      </>
                                    ) : (
                                      <>
                                        <Wand2 className="h-4 w-4" />
                                        Extract from URL
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {!product?.url && (
                                <TooltipContent side="top">
                                  <div className="flex items-center gap-1">
                                    <AlertCircle className="h-4 w-4" />
                                    URL required for extraction
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {[...photos, ...videos]
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .slice((mediaPage - 1) * mediaPerPage, mediaPage * mediaPerPage)
                          .map((item) => {
                            const isPhoto = 'duration' in item ? false : true;
                            return (
                              <div 
                                key={item.id} 
                                className={`group relative aspect-square bg-muted rounded-lg overflow-hidden`}
                              >
                                {isPhoto ? (
                                  <img
                                    src={item.file_path}
                                    alt={item.file_name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                ) : (
                                  <VideoPreview 
                                    src={item.file_path}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                )}
                                
                                {/* Type Badge */}
                                <div className="absolute top-2 left-2">
                                  <Badge variant="secondary" className="text-xs opacity-70">
                                    {isPhoto ? 'Photo' : 'Video'}
                                  </Badge>
                                </div>

                                {/* Hover Actions - Repositioned to top-right corner */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8 bg-black/20 hover:bg-black/40 backdrop-blur-sm"
                                    onClick={() => window.open(item.file_path, "_blank")}
                                  >
                                    <Download className="h-4 w-4 text-white" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-8 w-8 bg-red-600/20 hover:bg-red-600/40 backdrop-blur-sm"
                                    onClick={() => handleDelete(item.id, isPhoto ? "photo" : "video")}
                                  >
                                    <Trash className="h-4 w-4 text-white" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        {photos.length === 0 && videos.length === 0 && (
                          <Card className="col-span-full bg-muted/40">
                            <div className="p-6 text-center">
                              <p className="text-muted-foreground">No media uploaded yet</p>
                            </div>
                          </Card>
                        )}
                      </div>
                      {/* Pagination Controls */}
                      {(photos.length + videos.length > mediaPerPage) && (() => {
                        const totalPagesMedia = Math.ceil((photos.length + videos.length) / mediaPerPage);
                        return (
                          <div className="mt-6 flex w-full items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMediaPage(p => Math.max(1, p - 1))}
                              disabled={mediaPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="flex items-center gap-2 px-2">
                              {getPaginationItems(mediaPage, totalPagesMedia, 1).map((item, index) =>
                                typeof item === 'number' ? (
                                  <span
                                    key={`media-page-${item}`}
                                    onClick={() => setMediaPage(item)}
                                    className={`cursor-pointer text-sm px-2 py-1 rounded-md ${mediaPage === item ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                  >
                                    {item}
                                  </span>
                                ) : (
                                  <span key={`media-dots-${index}`} className="px-1 text-muted-foreground">
                                    {item}
                                  </span>
                                )
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMediaPage(p => Math.min(totalPagesMedia, p + 1))}
                              disabled={mediaPage >= totalPagesMedia}
                            >
                              Next
                            </Button>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="scripts" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Scripts</CardTitle>
                      <CardDescription>Generate and manage product scripts</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScriptGenerator 
                        productId={id} 
                        product={product}
                        onScriptCreated={refetchScripts} 
                      />
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
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      navigator.clipboard.writeText(script.content)
                                      toast.success("Script copied to clipboard")
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(script.id, "script")}
                                    disabled={isDeleting}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                <p className="text-sm leading-relaxed">{script.content}</p>
                                {script.caption && (
                                  <div className="text-sm text-muted-foreground border-t pt-2">
                                    <p className="font-medium mb-1">Caption:</p>
                                    <p>{script.caption}</p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {scripts.length === 0 && (
                          <Card className="bg-muted/40">
                            <CardContent className="p-6 text-center">
                              <p className="text-muted-foreground">No scripts generated yet</p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                      {/* Pagination Controls */}
                      {(scripts.length > scriptsPerPage) && (() => {
                        const totalPagesScripts = Math.ceil(scripts.length / scriptsPerPage);
                        return (
                          <div className="mt-6 flex w-full items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setScriptsPage(p => Math.max(1, p - 1))}
                              disabled={scriptsPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="flex items-center gap-2 px-2">
                              {getPaginationItems(scriptsPage, totalPagesScripts, 1).map((item, index) =>
                                typeof item === 'number' ? (
                                  <span
                                    key={`script-page-${item}`}
                                    onClick={() => setScriptsPage(item)}
                                    className={`cursor-pointer text-sm px-2 py-1 rounded-md ${scriptsPage === item ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                  >
                                    {item}
                                  </span>
                                ) : (
                                  <span key={`script-dots-${index}`} className="px-1 text-muted-foreground">
                                    {item}
                                  </span>
                                )
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setScriptsPage(p => Math.min(totalPagesScripts, p + 1))}
                              disabled={scriptsPage >= totalPagesScripts}
                            >
                              Next
                            </Button>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reels" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Reels</CardTitle>
                      <CardDescription>Create and manage product reels</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ReelCreator 
                        productId={id} 
                        onReelGenerated={refreshReels} 
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {reels
                          .slice((reelsPage - 1) * reelsPerPage, reelsPage * reelsPerPage)
                          .map((reel) => (
                          <div key={reel.id} className="group relative aspect-[9/16] bg-muted rounded-md overflow-hidden">
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
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {reel.status === "completed" && reel.storage_path && (
                                <>
                                  <Button 
                                    variant="secondary" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => {
                                      const url = supabase.storage.from('generated-reels').getPublicUrl(reel.storage_path!.replace('generated-reels/', '')).data.publicUrl;
                                      window.open(url, '_blank');
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleDelete(reel.id, "reel")}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {reels.length === 0 && (
                          <Card className="col-span-full bg-muted/40">
                            <div className="p-6 text-center">
                              <p className="text-muted-foreground">No reels created yet</p>
                            </div>
                          </Card>
                        )}
                      </div>
                      {/* Pagination Controls */}
                      {(reels.length > reelsPerPage) && (() => {
                        const totalPagesReels = Math.ceil(reels.length / reelsPerPage);
                        return (
                          <div className="mt-6 flex w-full items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReelsPage(p => Math.max(1, p - 1))}
                              disabled={reelsPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="flex items-center gap-2 px-2">
                              {getPaginationItems(reelsPage, totalPagesReels, 1).map((item, index) =>
                                typeof item === 'number' ? (
                                  <span
                                    key={`reel-page-${item}`}
                                    onClick={() => setReelsPage(item)}
                                    className={`cursor-pointer text-sm px-2 py-1 rounded-md ${reelsPage === item ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                  >
                                    {item}
                                  </span>
                                ) : (
                                  <span key={`reel-dots-${index}`} className="px-1 text-muted-foreground">
                                    {item}
                                  </span>
                                )
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReelsPage(p => Math.min(totalPagesReels, p + 1))}
                              disabled={reelsPage >= totalPagesReels}
                            >
                              Next
                            </Button>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </ErrorBoundary>
      )}
    </div>
  )
}
