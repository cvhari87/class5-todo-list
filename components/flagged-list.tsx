"use client"

import { useEffect, useRef, useState } from "react"
import { Flag, ChevronRight, GripVertical } from "lucide-react"
import { Category, TodoItem } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { haptics } from "@/lib/haptics"

interface FlaggedItem {
  item: TodoItem
  category: Category
}

interface FlaggedListProps {
  flaggedItems: FlaggedItem[]
  onToggleComplete: (categoryId: string, itemId: string) => void
  onSelectItem: (categoryId: string, itemId: string) => void
}

export function FlaggedList({ flaggedItems, onToggleComplete, onSelectItem }: FlaggedListProps) {
  // Local display order — visual only, resets when flaggedItems changes from outside
  const [orderedItems, setOrderedItems] = useState<FlaggedItem[]>(flaggedItems)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const draggingKeyRef = useRef<string | null>(null)
  const dragOverKeyRef = useRef<string | null>(null)
  const orderedRef = useRef<FlaggedItem[]>(flaggedItems)

  // Sync when external list changes (new flags, completions, etc.)
  useEffect(() => {
    setOrderedItems(flaggedItems)
    orderedRef.current = flaggedItems
  }, [flaggedItems])

  useEffect(() => { orderedRef.current = orderedItems }, [orderedItems])

  // Unique key per flagged item
  const itemKey = (fi: FlaggedItem) => `${fi.category.id}-${fi.item.id}`

  // Global pointer listeners — active only while dragging
  useEffect(() => {
    if (!draggingKey) return

    const onPointerMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const row = el?.closest("[data-flag-key]") as HTMLElement | null
      const targetKey = row?.dataset.flagKey
      if (targetKey && targetKey !== draggingKeyRef.current) {
        dragOverKeyRef.current = targetKey
        setDragOverKey(targetKey)
      }
    }

    const onPointerUp = () => {
      const from = draggingKeyRef.current
      const to = dragOverKeyRef.current
      if (from && to && from !== to) {
        haptics.light()
        setOrderedItems(prev => {
          const items = [...prev]
          const fromIdx = items.findIndex(fi => itemKey(fi) === from)
          const toIdx = items.findIndex(fi => itemKey(fi) === to)
          if (fromIdx === -1 || toIdx === -1) return prev
          const [moved] = items.splice(fromIdx, 1)
          items.splice(toIdx, 0, moved)
          return items
        })
      }
      draggingKeyRef.current = null
      dragOverKeyRef.current = null
      setDraggingKey(null)
      setDragOverKey(null)
    }

    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
    return () => {
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerup", onPointerUp)
    }
  }, [draggingKey])

  const handleDragStart = (key: string) => {
    haptics.medium()
    draggingKeyRef.current = key
    dragOverKeyRef.current = null
    setDraggingKey(key)
    setDragOverKey(null)
  }

  if (orderedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center mb-4">
          <Flag className="w-8 h-8 text-accent-foreground" />
        </div>
        <p className="text-muted-foreground text-center">No flagged items</p>
        <p className="text-sm text-muted-foreground/70 text-center mt-1">
          Flag important items to see them here
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {orderedItems.map((fi) => {
        const key = itemKey(fi)
        const { item, category } = fi
        return (
          <div
            key={key}
            data-flag-key={key}
            className={cn(
              "flex items-center gap-2 px-2 py-3 bg-card transition-all",
              draggingKey === key && "opacity-40 scale-[0.98]",
              dragOverKey === key && draggingKey !== key && "border-t-2 border-primary"
            )}
          >
            {/* Drag handle */}
            <div
              className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
              onPointerDown={(e) => {
                e.preventDefault()
                handleDragStart(key)
              }}
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Checkbox */}
            <div
              onClick={(e) => {
                e.stopPropagation()
                haptics.success()
                onToggleComplete(category.id, item.id)
              }}
            >
              <Checkbox
                checked={item.completed}
                className="h-5 w-5 rounded-full border-2"
                style={{ borderColor: category.color }}
              />
            </div>

            {/* Content */}
            <div
              className="flex-1 min-w-0 cursor-pointer group"
              onClick={() => {
                if (!draggingKey) onSelectItem(category.id, item.id)
              }}
            >
              <p className={cn(
                "text-sm font-medium truncate",
                item.completed && "line-through text-muted-foreground"
              )}>
                {item.text}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-xs text-muted-foreground">{category.name}</span>
              </div>
            </div>

            <Flag className="w-4 h-4 text-accent-foreground flex-shrink-0" />
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        )
      })}
    </div>
  )
}
