"use client"

import { useState, useEffect } from "react"
import { Flag, List, Moon, Sun, Search, X } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
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
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const { theme, setTheme } = useTheme()

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

  const handleMoveCategory = (index: number, direction: "up" | "down") => {
    setCategories(prev => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority)
      const newIndex = direction === "up" ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= sorted.length) return prev
      const [moved] = sorted.splice(index, 1)
      sorted.splice(newIndex, 0, moved)
      return sorted.map((cat, i) => ({ ...cat, priority: i + 1 }))
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
            <header className="px-4 pt-8 pb-4 bg-background sticky top-0 z-10">
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
                    .map((category, index, arr) => (
                      <div key={category.id} className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveCategory(index, "up")}
                            disabled={index === 0}
                            className="p-1 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                          </button>
                          <button
                            onClick={() => handleMoveCategory(index, "down")}
                            disabled={index === arr.length - 1}
                            className="p-1 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                        </div>
                        <div className="flex-1">
                          <CategoryCard
                            category={category}
                            onClick={() => handleSelectCategory(category.id)}
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
