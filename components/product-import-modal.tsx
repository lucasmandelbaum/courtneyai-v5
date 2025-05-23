"use client"

import { useState, ReactNode } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProducts } from "@/hooks/useProducts"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface ProductImportModalProps {
  children?: ReactNode;
}

export function ProductImportModal({ children }: ProductImportModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { createProduct } = useProducts()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const url = formData.get("url") as string
    const description = formData.get("description") as string
    const tags = formData.get("tags") as string

    try {
      const product = await createProduct({
        name,
        description: description || undefined
      })

      setOpen(false)
      toast.success("Product created successfully")
      router.push(`/product/${product.id}`)
    } catch (error) {
      toast.error("Failed to create product")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Product</DialogTitle>
          <DialogDescription>
            Add a new product to your dashboard. Fill in the required details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Product Name</Label>
              <Input id="name" name="name" placeholder="Enter product name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">Product URL (Optional)</Label>
              <Input id="url" name="url" type="url" placeholder="https://example.com/product" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input id="description" name="description" placeholder="Enter product description" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <Input id="tags" name="tags" placeholder="Enter tags separated by commas" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Save & Open Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
