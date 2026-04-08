"use client"

import { Flag, ChevronRight } from "lucide-react"
import { Category, TodoItem } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { haptics } from "@/lib/haptics"

interface FlaggedListProps {
  flaggedItems: { item: TodoItem; category: Category }[]
  onToggleComplete: (categoryId: string, itemId: string) => void
  onSelectItem: (categoryId: string, itemId: string) => void
}

export function FlaggedList({ flaggedItems, onToggleComplete, onSelectItem }: FlaggedListProps) {
  if (flaggedItems.length === 0) {
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
      {flaggedItems.map(({ item, category }) => (
        <div
          key={item.id}
          className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-secondary/50 transition-colors cursor-pointer group"
          onClick={() => onSelectItem(category.id, item.id)}
        >
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
          <div className="flex-1 min-w-0">
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
      ))}
    </div>
  )
}
