"use client"

import { useState, useEffect } from "react"
import { Flag, List } from "lucide-react"
import { Category } from "@/lib/types"
import { getCategories, saveCategories, getFlaggedItems } from "@/lib/store"
import { FlaggedList } from "@/components/flagged-list"
import { CategoryCard } from "@/components/category-card"
import { NoteDetail } from "@/components/note-detail"
import { CategoryManager } from "@/components/category-manager"
import { cn } from "@/lib/utils"

type View = "flagged" | "categories" | "detail"

export default function TodoApp() {
  const [categories, setCategories] = useState<Category[]>([])
  const [currentView, setCurrentView] = useState<View>("flagged")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCategories(getCategories())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      saveCategories(categories)
    }
  }, [categories, mounted])

  const handleToggleComplete = (categoryId: string, itemId: string) => {
    setCategories(prev =>
      prev.map(cat => {
        if (cat.id === categoryId) {
          return {
            ...cat,
            items: cat.items.map(item =>
              item.id === itemId ? { ...item, completed: !item.completed } : item
            ),
          }
        }
        return cat
      })
    )
  }

  const handleSelectItem = (categoryId: string, _itemId: string) => {
    setSelectedCategoryId(categoryId)
    setCurrentView("detail")
  }

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setCurrentView("detail")
  }

  const handleUpdateCategory = (updatedCategory: Category) => {
    setCategories(prev =>
      prev.map(cat => (cat.id === updatedCategory.id ? updatedCategory : cat))
    )
  }

  const handleAddCategory = (newCategory: Category) => {
    setCategories(prev => [...prev, newCategory])
  }

  const handleReorderCategories = (dragIndex: number, dropIndex: number) => {
    setCategories(prev => {
      const newCategories = [...prev]
      const [removed] = newCategories.splice(dragIndex, 1)
      newCategories.splice(dropIndex, 0, removed)
      return newCategories.map((cat, index) => ({ ...cat, priority: index + 1 }))
    })
  }

  const flaggedItems = getFlaggedItems(categories)
  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId)

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto min-h-screen flex flex-col">
        {currentView === "detail" && selectedCategory ? (
          <NoteDetail
            category={selectedCategory}
            onBack={() => setCurrentView("categories")}
            onUpdateCategory={handleUpdateCategory}
          />
        ) : (
          <>
            {/* Header */}
            <header className="px-4 pt-8 pb-4 bg-background sticky top-0 z-10">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold tracking-tight">
                  {currentView === "flagged" ? "Flagged" : "Categories"}
                </h1>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-card rounded-xl p-1 shadow-sm self-start">
                <button
                  onClick={() => setCurrentView("flagged")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                    currentView === "flagged"
                      ? "bg-accent/30 text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Flag className="w-4 h-4" />
                  <span className="text-sm font-medium">Flagged</span>
                  {flaggedItems.length > 0 && (
                    <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full font-medium">
                      {flaggedItems.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setCurrentView("categories")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                    currentView === "categories"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="w-4 h-4" />
                  <span className="text-sm font-medium">Notes</span>
                  <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full font-medium">
                    {categories.length}
                  </span>
                </button>
              </div>
            </header>

            {/* Content */}
            <main className="flex-1 px-4 pb-8">
              {currentView === "flagged" ? (
                <div className="bg-card rounded-xl shadow-sm overflow-hidden">
                  <FlaggedList
                    flaggedItems={flaggedItems}
                    onToggleComplete={handleToggleComplete}
                    onSelectItem={handleSelectItem}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {categories
                    .sort((a, b) => a.priority - b.priority)
                    .map((category, index) => (
                      <div
                        key={category.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", index.toString())
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"))
                          handleReorderCategories(dragIndex, index)
                        }}
                      >
                        <CategoryCard
                          category={category}
                          onClick={() => handleSelectCategory(category.id)}
                        />
                      </div>
                    ))}
                  <CategoryManager onAddCategory={handleAddCategory} />
                </div>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  )
}
