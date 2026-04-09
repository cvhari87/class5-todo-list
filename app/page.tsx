"use client"

import { useState, useEffect, Suspense, useRef, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Flag, List, Moon, Sun, Search, X, GripVertical, Settings } from "lucide-react"
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
import { getCategories, saveCategories, getFlaggedItems, getRecurringItems, todayString } from "@/lib/store"
import { FlaggedList } from "@/components/flagged-list"
import { CategoryCard } from "@/components/category-card"
import { NoteDetail } from "@/components/note-detail"
import { CategoryManager } from "@/components/category-manager"
import { LockScreen, isPinEnabled } from "@/components/pin-lock"
import { SettingsSheet } from "@/components/settings-sheet"
import { AuthScreen } from "@/components/auth-screen"
import { scheduleDueNotifications } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { haptics } from "@/lib/haptics"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, signOut, User } from "firebase/auth"
import {
  loadCategoriesFromFirestore,
  saveCategoryToFirestore,
  deleteCategoryFromFirestore,
  saveAllCategoriesToFirestore,
  subscribeToCategories,
} from "@/lib/firestore"

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

// Apple Notes-style search results
function SearchResults({
  query,
  categories,
  onSelectCategory,
}: {
  query: string
  categories: Category[]
  onSelectCategory: (id: string) => void
}) {
  const q = query.toLowerCase().trim()
  if (!q) return null

  // Collect all matching items with their category
  const results: { categoryId: string; categoryName: string; categoryColor: string; itemText: string; itemId: string }[] = []
  const matchedCategories: Category[] = []

  for (const cat of categories) {
    const catNameMatch = cat.name.toLowerCase().includes(q)
    const matchingItems = cat.items.filter(item => item.text.toLowerCase().includes(q))

    if (catNameMatch) matchedCategories.push(cat)
    for (const item of matchingItems) {
      results.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        itemText: item.text,
        itemId: item.id,
      })
    }
  }

  const totalResults = matchedCategories.length + results.length

  if (totalResults === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-muted-foreground text-sm">No results for &ldquo;{query}&rdquo;</p>
      </div>
    )
  }

  // Highlight matching text
  function highlight(text: string) {
    const idx = text.toLowerCase().indexOf(q)
    if (idx === -1) return <span>{text}</span>
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-1 pb-4">
      <p className="text-xs text-muted-foreground px-1 mb-1">{totalResults} result{totalResults !== 1 ? "s" : ""}</p>

      {/* Matching note names */}
      {matchedCategories.map(cat => (
        <button
          key={cat.id}
          onClick={() => { haptics.light(); onSelectCategory(cat.id) }}
          className="flex items-center gap-3 px-3 py-3 rounded-xl bg-card active:bg-secondary transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.color + "20" }}>
            <div className="w-4 h-4 rounded-md" style={{ backgroundColor: cat.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{highlight(cat.name)}</p>
            <p className="text-xs text-muted-foreground">{cat.items.length} item{cat.items.length !== 1 ? "s" : ""}</p>
          </div>
        </button>
      ))}

      {/* Matching items */}
      {results.map(r => (
        <button
          key={r.itemId}
          onClick={() => { haptics.light(); onSelectCategory(r.categoryId) }}
          className="flex items-center gap-3 px-3 py-3 rounded-xl bg-card active:bg-secondary transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: r.categoryColor + "20" }}>
            <div className="w-4 h-4 rounded-md" style={{ backgroundColor: r.categoryColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{highlight(r.itemText)}</p>
            <p className="text-xs text-muted-foreground">{r.categoryName}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

export default function TodoApp() {
  const [categories, setCategories] = useState<Category[]>([])
  const [currentView, setCurrentView] = useState<View>("flagged")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchActive, setSearchActive] = useState(false)
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const { theme, setTheme } = useTheme()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const firestoreUnsub = useRef<(() => void) | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  )

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      setAuthChecked(true)

      if (firebaseUser) {
        // Load from Firestore, migrate localStorage data if needed
        const firestoreCats = await loadCategoriesFromFirestore(firebaseUser.uid)
        if (firestoreCats.length === 0) {
          // First sign-in: migrate existing localStorage data to Firestore
          const localCats = getCategories()
          await saveAllCategoriesToFirestore(firebaseUser.uid, localCats)
          setCategories(localCats)
          saveCategories(localCats)
        } else {
          setCategories(firestoreCats)
          saveCategories(firestoreCats)
        }

        // Subscribe to real-time updates
        if (firestoreUnsub.current) firestoreUnsub.current()
        firestoreUnsub.current = subscribeToCategories(firebaseUser.uid, (cats) => {
          setCategories(cats)
          saveCategories(cats)
        })

        if (isPinEnabled()) setLocked(true)
        scheduleDueNotifications(firestoreCats)
      } else {
        // Not signed in — fall back to localStorage
        if (firestoreUnsub.current) { firestoreUnsub.current(); firestoreUnsub.current = null }
        const cats = getCategories()
        setCategories(cats)
        scheduleDueNotifications(cats)
      }

      setMounted(true)
    })
    return () => { unsub(); if (firestoreUnsub.current) firestoreUnsub.current() }
  }, [])

  // Auto-lock when app goes to background (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPinEnabled()) {
        setLocked(true)
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Re-schedule notifications whenever categories change
  useEffect(() => {
    if (mounted) scheduleDueNotifications(categories)
  }, [categories, mounted])

  const handleViewParam = useCallback((view: string | null) => {
    if (view === "notes") setCurrentView("categories")
    else if (view === "flagged") setCurrentView("flagged")
  }, [])

  // Save to localStorage + Firestore whenever categories change
  useEffect(() => {
    if (!mounted) return
    saveCategories(categories)
    if (user) {
      // Save each category individually (Firestore batches automatically)
      categories.forEach(cat => saveCategoryToFirestore(user.uid, cat))
    }
  }, [categories, mounted, user])

  const openSearch = () => {
    setSearchActive(true)
    setSearchQuery("")
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const closeSearch = () => {
    setSearchActive(false)
    setSearchQuery("")
    haptics.light()
  }

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
            items: cat.items.map(item => {
              if (item.id !== itemId) return item
              const completing = !item.completed
              return {
                ...item,
                completed: completing,
                lastCompletedDate: completing && item.recurring ? todayString() : item.lastCompletedDate,
              }
            }),
          }
        }
        return cat
      })
    )
  }

  const handleSelectItem = (categoryId: string, _itemId: string) => {
    setSelectedCategoryId(categoryId)
    setCurrentView("detail")
    closeSearch()
  }

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setCurrentView("detail")
    closeSearch()
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
    if (user) deleteCategoryFromFirestore(user.uid, categoryId)
    setCurrentView("categories")
    toast("Note deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          setCategories(prev => [...prev, deleted])
          if (user) saveCategoryToFirestore(user.uid, deleted)
        },
      },
    })
  }

  const flaggedItems = useMemo(() => getFlaggedItems(categories), [categories])
  const recurringItems = useMemo(() => getRecurringItems(categories), [categories])
  const selectedCategory = useMemo(
    () => categories.find(cat => cat.id === selectedCategoryId),
    [categories, selectedCategoryId]
  )
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.priority - b.priority),
    [categories]
  )

  // Search: filter flagged + recurring items when in Flagged view
  const filteredFlaggedItems = useMemo(() => {
    if (!searchQuery.trim()) return flaggedItems
    const q = searchQuery.toLowerCase()
    return flaggedItems.filter(
      fi => fi.item.text.toLowerCase().includes(q) || fi.category.name.toLowerCase().includes(q)
    )
  }, [flaggedItems, searchQuery])

  const filteredRecurringItems = useMemo(() => {
    if (!searchQuery.trim()) return recurringItems
    const q = searchQuery.toLowerCase()
    return recurringItems.filter(
      fi => fi.item.text.toLowerCase().includes(q) || fi.category.name.toLowerCase().includes(q)
    )
  }, [recurringItems, searchQuery])

  if (!authChecked || !mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not signed in → show auth screen
  if (!user) {
    return <AuthScreen onSignedIn={() => {}} />
  }

  // Show lock screen if PIN is enabled and app is locked
  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Suspense fallback={null}>
        <SearchParamsReader onView={handleViewParam} />
      </Suspense>

      {/* Settings sheet */}
      <SettingsSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        onSignOut={() => signOut(auth)}
      />

      <div className="max-w-lg mx-auto min-h-[100dvh] flex flex-col">
        {currentView === "detail" && selectedCategory ? (
          <NoteDetail
            category={selectedCategory}
            onBack={() => setCurrentView("categories")}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={() => handleDeleteCategory(selectedCategory.id)}
          />
        ) : (
          <>
            {/* ── Header ── */}
            <header className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 bg-background sticky top-0 z-10">
              {/* Title row */}
              {!searchActive && (
                <div className="flex items-center justify-between mb-3">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {currentView === "flagged" ? "Flagged" : "Notes"}
                  </h1>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={openSearch}
                      className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      aria-label="Search"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => { haptics.light(); setShowSettings(true) }}
                      className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      aria-label="Settings"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Apple Notes-style search bar */}
              {searchActive && (
                <div className="flex items-center gap-2 mb-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex-1 flex items-center gap-2 bg-secondary rounded-xl px-3 h-10">
                    <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="search"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-muted-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={closeSearch}
                    className="text-primary text-sm font-medium px-1 py-2 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </header>

            {/* ── Content ── */}
            <main className="flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] overflow-y-auto">
              {/* Search active on Notes tab → full search results */}
              {searchActive && currentView !== "flagged" ? (
                <SearchResults
                  query={searchQuery}
                  categories={categories}
                  onSelectCategory={handleSelectCategory}
                />
              ) : currentView === "flagged" ? (
                <div className="bg-card rounded-xl shadow-sm overflow-hidden">
                  <FlaggedList
                    flaggedItems={filteredFlaggedItems}
                    recurringItems={filteredRecurringItems}
                    onToggleComplete={handleToggleComplete}
                    onSelectItem={handleSelectItem}
                    searchQuery={searchActive ? searchQuery : ""}
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
                      items={sortedCategories.map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sortedCategories.map((category) => (
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

                  {categories.length === 0 && !searchQuery && (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                        <List className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                      <p className="font-medium text-foreground">No notes yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Tap &ldquo;New Note&rdquo; below to get started</p>
                    </div>
                  )}

                  <CategoryManager onAddCategory={handleAddCategory} />
                </div>
              )}
            </main>

            {/* ── Bottom Tab Bar ── */}
            {!searchActive && (
              <nav
                className="fixed bottom-0 left-0 right-0 z-20 bg-background/80 backdrop-blur-xl border-t border-border"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <div className="max-w-lg mx-auto flex">
                  <button
                    onClick={() => { haptics.light(); setCurrentView("flagged") }}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors",
                      currentView === "flagged" ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <div className="relative">
                      <Flag className="w-6 h-6" />
                      {flaggedItems.length > 0 && (
                        <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                          {flaggedItems.length}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium">Flagged</span>
                  </button>

                  <button
                    onClick={() => { haptics.light(); setCurrentView("categories") }}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors",
                      currentView === "categories" ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <div className="relative">
                      <List className="w-6 h-6" />
                      <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {categories.length}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium">Notes</span>
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  )
}
