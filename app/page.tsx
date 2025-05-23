"use client"

import Link from "next/link"
import { Search, Plus, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ProductImportModal } from "@/components/product-import-modal"
import { useProducts } from "@/hooks/useProducts"
import { Skeleton } from "@/components/ui/skeleton"
import { UsageTracker } from "@/components/usage-tracker"
import { UsageLimitAlert } from "@/components/usage-limit-alert"

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
  
  // Cast the products to the expected type with counts
  const products = rawProducts as unknown as ProductWithCounts[];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>

          {/* Usage Tracker Skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-2 w-full mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Skeleton className="h-10 w-72" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video" />
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <ProductImportModal>
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Add Product
            </Button>
          </ProductImportModal>
        </div>

        {/* Usage Alert */}
        <UsageLimitAlert />

        {/* Usage Overview */}
        <UsageTracker variant="compact" />

        <div className="flex gap-4 items-center w-full sm:w-72">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search products..." className="w-full pl-8" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product) => (
            <Link href={`/product/${product.id}`} key={product.id} className="block h-full">
              <Card className="overflow-hidden h-full hover:shadow-md transition-shadow">
                <div className="aspect-video bg-muted relative">
                  {product.thumbnail_url ? (
                    <img 
                      src={product.thumbnail_url} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 opacity-20" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {new Date(product.updated_at || product.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
