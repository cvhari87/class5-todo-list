"use client"

import { ChevronRight, Flag } from "lucide-react"
import { Category } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CategoryCardProps {
  category: Category
  onClick: () => void
  isDragging?: boolean
}

export function CategoryCard({ category, onClick, isDragging }: CategoryCardProps) {
  const todoItems = category.items.filter(item => item.type === "todo")
  const completedCount = todoItems.filter(item => item.completed).length
  const totalCount = todoItems.length
  const flaggedCount = todoItems.filter(item => item.flagged && !item.completed && !item.recurring).length
  const recurringCount = todoItems.filter(item => item.recurring).length
  const progress = totalCount > 0 ? completedCount / totalCount : 0

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-4 bg-card rounded-2xl shadow-sm active:scale-[0.98] active:shadow-none transition-all cursor-pointer",
        isDragging && "opacity-50"
      )}
      style={{ minHeight: 72 }}
    >
      {/* Color icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: category.color + "20" }}
      >
        <div className="w-6 h-6 rounded-lg" style={{ backgroundColor: category.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-base truncate">{category.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {totalCount === 0 ? "No items" : `${completedCount}/${totalCount} done`}
          </span>
          {flaggedCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-accent-foreground font-medium">
              <Flag className="w-3 h-3" />
              {flaggedCount}
            </span>
          )}
          {recurringCount > 0 && (
            <span className="text-xs text-green-600 font-medium">
              🔄 {recurringCount} daily
            </span>
          )}
        </div>

        {/* Mini progress bar */}
        {totalCount > 0 && (
          <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden w-full max-w-[120px]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: category.color,
              }}
            />
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xl font-bold text-muted-foreground/60">{totalCount}</span>
        <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
      </div>
    </div>
  )
}
