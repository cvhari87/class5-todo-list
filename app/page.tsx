"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Flag, List, Moon, Sun, Search, X, GripVertical } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
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

// Sortable category row using dnd-kit
function SortableCategoryRow({
  category,
  onClick,
  isOverlay,
}: {
  category: Category
  onClick: () => void
  isOverlay?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2",
        isDragging && !isOverlay && "opacity-30",
        isOverlay && "scale-[1.03] shadow-2xl rounded-xl opacity-95"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 touch-none p-2 text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing select-none transition-colors"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <CategoryCard category={category} onClick={onClick} />
      </div>
    </div>
  )
}

export default function TodoApp() {
  const [categories, setCategories] = useState<Category[]>([])
  const [currentView, setCurrentView] = useState<View>("flagged")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const { theme, setTheme } = useTheme()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  )

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

  const handleCatDragStart = (event: DragStartEvent) => {
    haptics.medium()
    setActiveCatId(event.active.id as string)
  }

  const handleCatDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCatId(null)
    if (over && active.id !== over.id) {
      haptics.light()
      setCategories(prev => {
        const sorted = [...prev].sort((a, b) => a.priority - b.priority)
        const oldIndex = sorted.findIndex(c => c.id === active.id)
        const newIndex = sorted.findIndex(c => c.id === over.id)
        const reordered = arrayMove(sorted, oldIndex, newIndex)
        return reordered.map((cat, i) => ({ ...cat, priority: i + 1 }))
      })
    }
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                    onDragStart={handleCatDragStart}
                    onDragEnd={handleCatDragEnd}
                  >
                    <SortableContext
                      items={filteredCategories
                        .sort((a, b) => a.priority - b.priority)
                        .map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {filteredCategories
                        .sort((a, b) => a.priority - b.priority)
                        .map((category) => (
                          <SortableCategoryRow
                            key={category.id}
                            category={category}
                            onClick={() => {
                              if (!activeCatId) handleSelectCategory(category.id)
                            }}
                          />
                        ))}
                    </SortableContext>

                    <DragOverlay dropAnimation={{
                      duration: 200,
                      easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                    }}>
                      {activeCatId ? (
                        <SortableCategoryRow
                          category={categories.find(c => c.id === activeCatId)!}
                          onClick={() => {}}
                          isOverlay
                        />
                      ) : null}
                    </DragOverlay>
                  </DndContext>

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
