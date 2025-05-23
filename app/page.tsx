"use client"

import Link from "next/link"
import { Search, Plus, ImageIcon, TrendingUp, BarChart3, Sparkles } from "lucide-react"
import { Card, CardHeader, CardBody, Input, Button, Chip, Skeleton, Divider } from "@heroui/react"
import { ProductImportModal } from "@/components/product-import-modal"
import { useProducts } from "@/hooks/useProducts"
import { UsageTracker } from "@/components/usage-tracker"
import { UsageLimitAlert } from "@/components/usage-limit-alert"
import { useState } from "react"

// Define the extended Product type based on the hook query with counts
type ProductWithCounts = {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
  description?: string | null;
  user_id?: string | null;
  photos?: { count: number };
  videos?: { count: number };
  scripts?: { count: number };
  reels?: { count: number };
  thumbnail_url?: string;
}

export default function Dashboard() {
  const { products: rawProducts, isLoading } = useProducts()
  const [isUsageAlertDismissed, setIsUsageAlertDismissed] = useState(false)
  
  // Cast the products to the expected type with counts
  const products = rawProducts as unknown as ProductWithCounts[];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="space-y-3">
              <Skeleton className="w-48 h-9" />
              <Skeleton className="w-80 h-5" />
            </div>
            <Skeleton className="w-40 h-12" />
          </div>

          {/* Usage Alert Skeleton */}
          <Skeleton className="w-full h-24" />

          {/* Usage Cards Skeleton */}
          <div className="space-y-6">
            <Skeleton className="w-48 h-7" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10" />
                      <Skeleton className="w-20 h-4" />
                    </div>
                    <Skeleton className="w-16 h-8" />
                    <Skeleton className="w-full h-2" />
                    <Skeleton className="w-12 h-3 mx-auto" />
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          {/* Search Skeleton */}
          <div className="space-y-4">
            <Skeleton className="w-32 h-7" />
            <Skeleton className="w-full sm:w-96 h-12" />
          </div>

          {/* Product Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="w-full min-w-[280px] max-w-[400px] flex flex-col h-full">
                <CardHeader className="p-0">
                  <Skeleton className="w-full aspect-[4/3] rounded-t-lg" />
                </CardHeader>
                <CardBody className="px-4 py-3 flex-grow flex flex-col justify-between">
                  <div>
                    <Skeleton className="w-3/4 h-5 mb-2" />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Skeleton className="w-16 h-6 rounded-full" />
                    <Skeleton className="w-16 h-6 rounded-full" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Usage Alert */}
        {!isUsageAlertDismissed && (
          <UsageLimitAlert onDismiss={() => setIsUsageAlertDismissed(true)} />
        )}

        {/* Products Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Your Products</h2>
            <ProductImportModal>
              <Button 
                color="primary" 
                startContent={<Plus className="w-4 h-4" />}
              >
                Add Product
              </Button>
            </ProductImportModal>
          </div>
          <Divider />
        </div>

        {/* Products Grid */}
        <div>
          {products.length === 0 ? (
            <Card className="max-w-md mx-auto">
              <CardBody className="text-center px-6 py-8">
                <div className="w-16 h-16 mx-auto bg-default-100 rounded-full flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-default-400" />
                </div>
                <h3 className="text-large font-semibold text-default-900 mb-2">Ready to create amazing content?</h3>
                <p className="text-small text-default-500 mb-6">
                  Add your first product and start generating engaging video content.
                </p>
                <ProductImportModal>
                  <Button 
                    color="primary" 
                    startContent={<Plus className="w-4 h-4" />}
                  >
                    Add Your First Product
                  </Button>
                </ProductImportModal>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <Link href={`/product/${product.id}`} key={product.id}>
                  <Card isPressable className="w-full min-w-[280px] max-w-[400px] hover:shadow-lg transition-shadow flex flex-col h-full">
                    <CardHeader className="p-0">
                      {product.thumbnail_url ? (
                        <img 
                          src={product.thumbnail_url} 
                          alt={product.name} 
                          className="w-full aspect-[4/3] object-cover rounded-t-lg"
                        />
                      ) : (
                        <div className="w-full aspect-[4/3] bg-default-100 flex items-center justify-center rounded-t-lg">
                          <ImageIcon className="w-12 h-12 text-default-300" />
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardBody className="px-4 py-3 flex-grow flex flex-col justify-between">
                      <div>
                        <h4 className="text-large font-semibold leading-none text-default-900 mb-2">
                          {product.name}
                        </h4>
                      </div>
                      
                      {(product.scripts?.count || product.reels?.count || product.photos?.count) ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {product.scripts?.count && (
                            <Chip size="sm" color="primary" variant="flat">
                              {product.scripts.count} scripts
                            </Chip>
                          )}
                          {product.reels?.count && (
                            <Chip size="sm" color="secondary" variant="flat">
                              {product.reels.count} reels
                            </Chip>
                          )}
                          {product.photos?.count && (
                            <Chip size="sm" color="success" variant="flat">
                              {product.photos.count} photos
                            </Chip>
                          )}
                        </div>
                      ) : (
                        <Chip size="sm" color="default" variant="flat" className="w-fit mt-2">
                          Ready to start
                        </Chip>
                      )}
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Usage Overview Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Usage Overview</h2>
          <Divider />
          <UsageTracker variant="compact" />
        </div>
      </div>
    </div>
  )
}
