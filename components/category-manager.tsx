"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Category } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { generateId } from "@/lib/store"
import { haptics } from "@/lib/haptics"
import { cn } from "@/lib/utils"

const PRESET_COLORS = [
  "#007AFF", // Blue
  "#34C759", // Green
  "#FF9500", // Orange
  "#FF3B30", // Red
  "#AF52DE", // Purple
  "#5856D6", // Indigo
  "#FF2D55", // Pink
  "#00C7BE", // Teal
]

interface CategoryManagerProps {
  onAddCategory: (category: Category) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CategoryManager({ onAddCategory, open: externalOpen, onOpenChange }: CategoryManagerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = (v: boolean) => {
    setInternalOpen(v)
    onOpenChange?.(v)
  }
  const [name, setName] = useState("")
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])

  const handleSubmit = () => {
    if (!name.trim()) return
    haptics.success()
    const newCategory: Category = {
      id: generateId(),
      name: name.trim(),
      color: selectedColor,
      priority: Date.now(),
      items: [],
    }
    onAddCategory(newCategory)
    setName("")
    setSelectedColor(PRESET_COLORS[0])
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit()
    if (e.key === "Escape") setOpen(false)
  }

  return (
    <>
      {/* Add button */}
      <button
        onClick={() => { haptics.light(); setOpen(true) }}
        className="w-full h-14 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">New Note</span>
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-card rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-[env(safe-area-inset-bottom)]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            <div className="px-5 pb-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 mt-2">
                <h2 className="text-lg font-semibold">New Note</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Name input */}
              <Input
                placeholder="Note name (e.g. Work, Health)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-12 text-base rounded-xl mb-5"
              />

              {/* Color picker */}
              <p className="text-sm font-medium text-muted-foreground mb-3">Choose a color</p>
              <div className="grid grid-cols-8 gap-2 mb-6">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => { haptics.light(); setSelectedColor(color) }}
                    className={cn(
                      "w-full aspect-square rounded-full transition-transform active:scale-90",
                      selectedColor === color && "scale-110"
                    )}
                    style={{
                      backgroundColor: color,
                      outline: selectedColor === color ? `3px solid ${color}` : undefined,
                      outlineOffset: selectedColor === color ? "2px" : undefined,
                    }}
                  />
                ))}
              </div>

              {/* Preview */}
              {name.trim() && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: selectedColor + "20" }}>
                    <div className="w-5 h-5 rounded-lg" style={{ backgroundColor: selectedColor }} />
                  </div>
                  <span className="font-medium">{name.trim()}</span>
                </div>
              )}

              {/* Create button */}
              <button
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="w-full h-14 rounded-2xl font-semibold text-base transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white"
                style={{ backgroundColor: name.trim() ? selectedColor : undefined }}
              >
                Create Note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
