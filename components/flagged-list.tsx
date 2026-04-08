"use client"

import { useState, useEffect } from "react"
import { Flag, ChevronRight, GripVertical } from "lucide-react"
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

function itemKey(fi: FlaggedItem) {
  return `${fi.category.id}-${fi.item.id}`
}

interface SortableRowProps {
  fi: FlaggedItem
  onToggleComplete: (categoryId: string, itemId: string) => void
  onSelectItem: (categoryId: string, itemId: string) => void
  isDragging?: boolean
  isOverlay?: boolean
}

function SortableRow({ fi, onToggleComplete, onSelectItem, isDragging, isOverlay }: SortableRowProps) {
  const key = itemKey(fi)
  const { item, category } = fi

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-3 bg-card border-b border-border",
        isSortableDragging && !isOverlay && "opacity-30",
        isOverlay && "shadow-2xl rounded-xl border border-border opacity-95 scale-[1.03]"
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 touch-none p-2 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing select-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Checkbox */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          if (!isDragging) {
            haptics.success()
            onToggleComplete(category.id, item.id)
          }
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
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => {
          if (!isDragging) onSelectItem(category.id, item.id)
        }}
      >
        <p className={cn(
          "text-sm font-medium truncate",
          item.completed && "line-through text-muted-foreground"
        )}>
          {item.text}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
          <span className="text-xs text-muted-foreground">{category.name}</span>
        </div>
      </div>

      <Flag className="w-4 h-4 text-accent-foreground flex-shrink-0" />
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
    </div>
  )
}

export function FlaggedList({ flaggedItems, onToggleComplete, onSelectItem }: FlaggedListProps) {
  const [orderedItems, setOrderedItems] = useState<FlaggedItem[]>(flaggedItems)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync when external list changes
  useEffect(() => {
    setOrderedItems(flaggedItems)
  }, [flaggedItems])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // 8px movement required before drag starts — prevents accidental drags
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        // 250ms long-press on touch — feels native on iOS
        delay: 250,
        tolerance: 5,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    haptics.medium()
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (over && active.id !== over.id) {
      haptics.light()
      setOrderedItems(prev => {
        const oldIndex = prev.findIndex(fi => itemKey(fi) === active.id)
        const newIndex = prev.findIndex(fi => itemKey(fi) === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const activeItem = activeId ? orderedItems.find(fi => itemKey(fi) === activeId) : null

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedItems.map(itemKey)}
        strategy={verticalListSortingStrategy}
      >
        <div className="divide-y divide-border">
          {orderedItems.map((fi) => (
            <SortableRow
              key={itemKey(fi)}
              fi={fi}
              onToggleComplete={onToggleComplete}
              onSelectItem={onSelectItem}
              isDragging={!!activeId}
            />
          ))}
        </div>
      </SortableContext>

      {/* Floating drag overlay — the card that "lifts" while dragging */}
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
      }}>
        {activeItem ? (
          <SortableRow
            fi={activeItem}
            onToggleComplete={() => {}}
            onSelectItem={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
