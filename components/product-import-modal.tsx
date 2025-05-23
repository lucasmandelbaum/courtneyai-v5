"use client"

import { useState, ReactNode, cloneElement, isValidElement } from "react"
import { Plus } from "lucide-react"
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, useDisclosure } from "@heroui/react"
import { useProducts } from "@/hooks/useProducts"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface ProductImportModalProps {
  children?: ReactNode;
}

export function ProductImportModal({ children }: ProductImportModalProps) {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure()
  const [isLoading, setIsLoading] = useState(false)
  const { createProduct } = useProducts()
  const router = useRouter()

  const resetForm = () => {
    setIsLoading(false)
  }

  const closeModal = () => {
    if (!isLoading) {
      onClose()
      setTimeout(resetForm, 300) // Reset after animation completes
    }
  }

  // Handle modal state changes (following ReelCreator pattern)
  const handleOpenChange = (open: boolean) => {
    if (open) {
      onOpen()
    } else {
      closeModal()
    }
  }

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

      closeModal() // Use closeModal instead of onOpenChange
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
    <>
      {children ? (
        // Properly clone the children and add onPress prop if it's a valid React element
        isValidElement(children) ? cloneElement(children, { onPress: onOpen } as any) : (
          <div onClick={onOpen} className="cursor-pointer">
            {children}
          </div>
        )
      ) : (
        <Button 
          color="primary"
          onPress={onOpen}
        >
          Add Product
        </Button>
      )}
      
      <Modal 
        isOpen={isOpen} 
        onOpenChange={handleOpenChange}
        placement="center"
        size="lg"
      >
        <ModalContent>
          {(onCloseInternal) => (
            <form onSubmit={handleSubmit}>
              <ModalHeader className="flex flex-col gap-1">
                Import Product
                <p className="text-sm text-gray-600 font-normal">
                  Add a new product to your dashboard. Fill in the required details below.
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Input
                    name="name"
                    label="Product Name"
                    placeholder="Enter product name"
                    isRequired
                    variant="bordered"
                  />
                  <Input
                    name="url"
                    label="Product URL (Optional)"
                    placeholder="https://example.com/product"
                    type="url"
                    variant="bordered"
                  />
                  <Input
                    name="description"
                    label="Description (Optional)"
                    placeholder="Enter product description"
                    variant="bordered"
                  />
                  <Input
                    name="tags"
                    label="Tags (Optional)"
                    placeholder="Enter tags separated by commas"
                    variant="bordered"
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button 
                  color="danger" 
                  variant="light" 
                  onPress={closeModal}
                  isDisabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  color="primary" 
                  type="submit" 
                  isLoading={isLoading}
                >
                  {isLoading ? "Creating..." : "Save & Open Product"}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
