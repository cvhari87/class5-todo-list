"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Flag, List, Moon, Sun, Search, X, GripVertical } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Category } from "@/lib/types"
import { getCategories, saveCategories, getFlaggedItems } from "@/lib/store"
import { FlaggedList } from "@/components/flagged-list"
import { CategoryCard } from "@/components/category-card"
import { NoteDetail } from "@/components/note-detail"
import { CategoryManager } from "@/components/category-manager"
import { cn } from "@/lib/utils"
import { haptics } from "@/lib/haptics"

type View = "flagged" | "categories" | "detail"

// Separate component to read search params (must be inside Suspense)
function SearchParamsReader({ onView }: { onView: (view: string | null) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    onView(searchParams.get("view"))
  }, [searchParams, onView])
  return null
}

export default function TodoApp() {
  const [categories, setCategories] = useState<Category[]>([])
  const [currentView, setCurrentView] = useState<View>("flagged")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const { theme, setTheme } = useTheme()

  // Drag-to-reorder state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const draggingIdRef = useRef<string | null>(null)
  const dragOverIdRef = useRef<string | null>(null)
  const categoriesRef = useRef<Category[]>([])

  useEffect(() => { categoriesRef.current = categories }, [categories])

  useEffect(() => {
    setCategories(getCategories())
    setMounted(true)
  }, [])

  const handleViewParam = (view: string | null) => {
    if (view === "notes") setCurrentView("categories")
    else if (view === "flagged") setCurrentView("flagged")
  }

  useEffect(() => {
    if (mounted) {
      saveCategories(categories)
    }
  }, [categories, mounted])

  // Global pointer listeners for drag reorder — active only while dragging
  useEffect(() => {
    if (!draggingId) return

    const onPointerMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const row = el?.closest("[data-cat-id]") as HTMLElement | null
      const targetId = row?.dataset.catId
      if (targetId && targetId !== draggingIdRef.current) {
        dragOverIdRef.current = targetId
        setDragOverId(targetId)
      }
    }

    const onPointerUp = () => {
      const from = draggingIdRef.current
      const to = dragOverIdRef.current
      if (from && to && from !== to) {
        haptics.light()
        setCategories(prev => {
          const sorted = [...prev].sort((a, b) => a.priority - b.priority)
          const fromIdx = sorted.findIndex(c => c.id === from)
          const toIdx = sorted.findIndex(c => c.id === to)
          if (fromIdx === -1 || toIdx === -1) return prev
          const [moved] = sorted.splice(fromIdx, 1)
          sorted.splice(toIdx, 0, moved)
          return sorted.map((cat, i) => ({ ...cat, priority: i + 1 }))
        })
      }
      draggingIdRef.current = null
      dragOverIdRef.current = null
      setDraggingId(null)
      setDragOverId(null)
    }

    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
    return () => {
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerup", onPointerUp)
    }
  }, [draggingId])

  const handleDragStart = (categoryId: string) => {
    haptics.medium()
    draggingIdRef.current = categoryId
    dragOverIdRef.current = null
    setDraggingId(categoryId)
    setDragOverId(null)
  }

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

  const handleDeleteCategory = (categoryId: string) => {
    const deleted = categories.find(c => c.id === categoryId)
    if (!deleted) return
    setCategories(prev => prev.filter(c => c.id !== categoryId))
    setCurrentView("categories")
    toast("Note deleted", {
      action: {
        label: "Undo",
        onClick: () => setCategories(prev => [...prev, deleted]),
      },
    })
  }

  const flaggedItems = getFlaggedItems(categories)
  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId)

  // Search: filter categories whose name or items match
  const filteredCategories = searchQuery.trim()
    ? categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.items.some(item => item.text.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : categories

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <SearchParamsReader onView={handleViewParam} />
      </Suspense>
      <div className="max-w-lg mx-auto min-h-screen flex flex-col">
        {currentView === "detail" && selectedCategory ? (
          <NoteDetail
            category={selectedCategory}
            onBack={() => setCurrentView("categories")}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={() => handleDeleteCategory(selectedCategory.id)}
          />
        ) : (
          <>
            {/* Header */}
            <header className="px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-4 bg-background sticky top-0 z-10">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold tracking-tight">
                  {currentView === "flagged" ? "Flagged" : "Notes"}
                </h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowSearch(s => !s); setSearchQuery("") }}
                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Search input */}
              {showSearch && (
                <div className="mb-4 animate-in fade-in slide-in-from-top-1">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search notes and items..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

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
                  {filteredCategories
                    .sort((a, b) => a.priority - b.priority)
                    .map((category) => (
                      <div
                        key={category.id}
                        data-cat-id={category.id}
                        className={cn(
                          "flex items-center gap-2 transition-all",
                          draggingId === category.id && "opacity-40 scale-[0.98]",
                          dragOverId === category.id && draggingId !== category.id && "border-t-2 border-primary pt-1"
                        )}
                      >
                        {/* Drag handle */}
                        <div
                          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-2 text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
                          onPointerDown={(e) => {
                            e.preventDefault()
                            handleDragStart(category.id)
                          }}
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <CategoryCard
                            category={category}
                            onClick={() => {
                              // Only navigate if not dragging
                              if (!draggingId) handleSelectCategory(category.id)
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  {filteredCategories.length === 0 && searchQuery && (
                    <p className="text-center text-muted-foreground text-sm py-8">No notes match "{searchQuery}"</p>
                  )}
                  {!searchQuery && <CategoryManager onAddCategory={handleAddCategory} />}
                </div>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  )
}
