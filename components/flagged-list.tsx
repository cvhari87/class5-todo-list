"use client"

import { useState, useEffect, useRef } from "react"
import {
  Flag, GripVertical, RefreshCw, CheckCircle2, ChevronDown,
  Trash2, Archive, AlertCircle, ArrowUpDown, SlidersHorizontal,
} from "lucide-react"
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

type SortMode = "manual" | "category" | "oldest" | "newest"

interface FlaggedListProps {
  flaggedItems: FlaggedItem[]
  recurringItems: FlaggedItem[]
  onToggleComplete: (categoryId: string, itemId: string) => void
  onSelectItem: (categoryId: string, itemId: string) => void
  onDeleteItem: (categoryId: string, itemId: string) => void
  onArchiveItem: (categoryId: string, itemId: string) => void
  onArchiveAllCompleted: () => void
  searchQuery?: string
}

function itemKey(fi: FlaggedItem) {
  return `${fi.category.id}-${fi.item.id}`
}

// ─── Due date helpers ─────────────────────────────────────────────────────────

function getDueDateStatus(dueDate?: string): "overdue" | "today" | null {
  if (!dueDate) return null
  const today = new Date().toISOString().split("T")[0]
  if (dueDate < today) return "overdue"
  if (dueDate === today) return "today"
  return null
}

function DueDateBadge({ dueDate }: { dueDate?: string }) {
  const status = getDueDateStatus(dueDate)
  if (!status) return null
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0",
      status === "overdue"
        ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
        : "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
    )}>
      <AlertCircle className="w-2.5 h-2.5" />
      {status === "overdue" ? "Overdue" : "Due today"}
    </span>
  )
}

// ─── Swipeable completed row ──────────────────────────────────────────────────

interface SwipeableCompletedRowProps {
  fi: FlaggedItem
  onToggleComplete: (categoryId: string, itemId: string) => void
  onSelectItem: (categoryId: string, itemId: string) => void
  onArchiveItem: (categoryId: string, itemId: string) => void
  onDeleteItem: (categoryId: string, itemId: string) => void
}

function SwipeableCompletedRow({ fi, onToggleComplete, onSelectItem, onArchiveItem, onDeleteItem }: SwipeableCompletedRowProps) {
  const { item, category } = fi
  const [translateX, setTranslateX] = useState(0)
  const [swiped, setSwiped] = useState(false)
  const startXRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const THRESHOLD = 72 // px to trigger archive

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    isDraggingRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return
    const dx = e.touches[0].clientX - startXRef.current
    if (dx < -4) isDraggingRef.current = true
    if (dx < 0) {
      setTranslateX(Math.max(dx, -THRESHOLD - 20))
    }
  }

  const handleTouchEnd = () => {
    if (translateX <= -THRESHOLD) {
      setSwiped(true)
      haptics.medium()
      setTimeout(() => {
        onArchiveItem(category.id, item.id)
      }, 200)
    } else {
      setTranslateX(0)
    }
    startXRef.current = null
  }

  return (
    <div className="relative overflow-hidden border-b border-border last:border-0">
      {/* Swipe-reveal archive background */}
      <div className="absolute inset-0 flex items-center justify-end pr-4 bg-primary/10">
        <div className="flex items-center gap-1 text-primary">
          <Archive className="w-4 h-4" />
          <span className="text-xs font-medium">Archive</span>
        </div>
      </div>

      {/* Row content */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-3 bg-card transition-transform",
          swiped && "translate-x-[-100%] opacity-0 duration-200"
        )}
        style={{ transform: swiped ? undefined : `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Category color left border */}
        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />

        <div className="w-3 flex-shrink-0" />

        <div onClick={(e) => {
          e.stopPropagation()
          haptics.light()
          onToggleComplete(category.id, item.id)
        }}>
          <Checkbox checked className="h-5 w-5 rounded-full border-2" style={{ borderColor: category.color }} />
        </div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectItem(category.id, item.id)}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate line-through text-muted-foreground">{item.text}</p>
            <DueDateBadge dueDate={item.dueDate} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="text-xs text-muted-foreground">{category.name}</span>
          </div>
        </div>

        <Flag className="w-3.5 h-3.5 text-amber-400 fill-current flex-shrink-0" />
        <button
          onClick={(e) => {
            e.stopPropagation()
            haptics.medium()
            onArchiveItem(category.id, item.id)
          }}
          className="flex items-center justify-center w-9 h-9 rounded-full active:bg-primary/10 active:text-primary text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0"
          aria-label="Archive"
        >
          <Archive className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            haptics.heavy()
            onDeleteItem(category.id, item.id)
          }}
          className="flex items-center justify-center w-9 h-9 rounded-full active:bg-destructive/10 active:text-destructive text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

interface SortableRowProps {
  fi: FlaggedItem
  onToggleComplete: (categoryId: string, itemId: string) => void
  onSelectItem: (categoryId: string, itemId: string) => void
  onDeleteItem?: (categoryId: string, itemId: string) => void
  isDragging?: boolean
  isOverlay?: boolean
  showRecurringIcon?: boolean
}

function SortableRow({ fi, onToggleComplete, onSelectItem, onDeleteItem, isDragging, isOverlay, showRecurringIcon }: SortableRowProps) {
  const key = itemKey(fi)
  const { item, category } = fi

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-3 bg-card border-b border-border last:border-0",
        isSortableDragging && !isOverlay && "opacity-30",
        isOverlay && "shadow-2xl rounded-xl border border-border opacity-95 scale-[1.03]"
      )}
    >
      {/* Category color left border */}
      {!showRecurringIcon && (
        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
      )}

      <div {...attributes} {...listeners}
        className="flex-shrink-0 touch-none p-2 text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing select-none">
        <GripVertical className="w-4 h-4" />
      </div>

      <div onClick={(e) => {
        e.stopPropagation()
        if (!isDragging) { haptics.success(); onToggleComplete(category.id, item.id) }
      }}>
        <Checkbox checked={item.completed} className="h-5 w-5 rounded-full border-2" style={{ borderColor: category.color }} />
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { if (!isDragging) onSelectItem(category.id, item.id) }}>
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn("text-sm font-medium truncate", item.completed && "line-through text-muted-foreground")}>
            {item.text}
          </p>
          {!item.completed && <DueDateBadge dueDate={item.dueDate} />}
        </div>
      </div>

      {showRecurringIcon
        ? <RefreshCw className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        : <Flag className="w-4 h-4 text-amber-500 fill-current flex-shrink-0" />
      }
      <button
        onClick={(e) => { e.stopPropagation(); haptics.heavy(); onDeleteItem?.(category.id, item.id) }}
        className="flex items-center justify-center w-9 h-9 rounded-full active:bg-destructive/10 active:text-destructive text-muted-foreground/30 transition-colors flex-shrink-0"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Sortable section ─────────────────────────────────────────────────────────

interface SortableSectionProps {
  items: FlaggedItem[]
  onReorder: (items: FlaggedItem[]) => void
  onToggleComplete: (categoryId: string, itemId: string) => void
  onSelectItem: (categoryId: string, itemId: string) => void
  onDeleteItem?: (categoryId: string, itemId: string) => void
  showRecurringIcon?: boolean
}

function SortableSection({ items, onReorder, onToggleComplete, onSelectItem, onDeleteItem, showRecurringIcon }: SortableSectionProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const handleDragStart = (event: DragStartEvent) => { haptics.medium(); setActiveId(event.active.id as string) }
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (over && active.id !== over.id) {
      haptics.light()
      const oldIndex = items.findIndex(fi => itemKey(fi) === active.id)
      const newIndex = items.findIndex(fi => itemKey(fi) === over.id)
      onReorder(arrayMove(items, oldIndex, newIndex))
    }
  }

  const activeItem = activeId ? items.find(fi => itemKey(fi) === activeId) : null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
      onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(itemKey)} strategy={verticalListSortingStrategy}>
        {items.map(fi => (
          <SortableRow key={itemKey(fi)} fi={fi}
            onToggleComplete={onToggleComplete} onSelectItem={onSelectItem}
            onDeleteItem={onDeleteItem}
            isDragging={!!activeId} showRecurringIcon={showRecurringIcon} />
        ))}
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeItem ? (
          <SortableRow fi={activeItem} onToggleComplete={() => {}} onSelectItem={() => {}} isOverlay showRecurringIcon={showRecurringIcon} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FlaggedList({
  flaggedItems, recurringItems,
  onToggleComplete, onSelectItem, onDeleteItem, onArchiveItem, onArchiveAllCompleted,
  searchQuery = "",
}: FlaggedListProps) {
  const [orderedFlagged, setOrderedFlagged] = useState<FlaggedItem[]>(flaggedItems)
  const [orderedRecurring, setOrderedRecurring] = useState<FlaggedItem[]>(recurringItems)
  const [showCompletedToday, setShowCompletedToday] = useState(true)
  const [showCompletedFlagged, setShowCompletedFlagged] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>("manual")
  const [showSortMenu, setShowSortMenu] = useState(false)

  useEffect(() => { setOrderedFlagged(flaggedItems) }, [flaggedItems])
  useEffect(() => { setOrderedRecurring(recurringItems) }, [recurringItems])

  // Apply sort to active flagged items
  const activeFlaggedRaw = orderedFlagged.filter(fi => !fi.item.completed)
  const completedFlagged = orderedFlagged.filter(fi => fi.item.completed)

  const activeFlagged = (() => {
    if (sortMode === "manual") return activeFlaggedRaw
    const sorted = [...activeFlaggedRaw]
    if (sortMode === "category") {
      sorted.sort((a, b) => a.category.name.localeCompare(b.category.name))
    } else if (sortMode === "oldest") {
      sorted.sort((a, b) => a.item.createdAt.localeCompare(b.item.createdAt))
    } else if (sortMode === "newest") {
      sorted.sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt))
    }
    return sorted
  })()

  const incompleteDaily = orderedRecurring.filter(fi => !fi.item.completed)
  const completedToday = orderedRecurring.filter(fi => fi.item.completed)
  const isSearching = searchQuery.trim().length > 0
  const isEmpty = orderedRecurring.length === 0 && orderedFlagged.length === 0

  const categoryGroups = incompleteDaily.reduce<{ category: Category; items: FlaggedItem[] }[]>((groups, fi) => {
    const existing = groups.find(g => g.category.id === fi.category.id)
    if (existing) { existing.items.push(fi) } else { groups.push({ category: fi.category, items: [fi] }) }
    return groups
  }, [])

  const sortLabels: Record<SortMode, string> = {
    manual: "Manual",
    category: "By Category",
    oldest: "Oldest First",
    newest: "Newest First",
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center mb-4">
          <Flag className="w-8 h-8 text-accent-foreground" />
        </div>
        {isSearching ? (
          <>
            <p className="text-muted-foreground text-center">No results for &ldquo;{searchQuery}&rdquo;</p>
            <p className="text-sm text-muted-foreground/70 text-center mt-1">Try a different search term</p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-center">Nothing here yet</p>
            <p className="text-sm text-muted-foreground/70 text-center mt-1">
              Flag items or mark tasks as daily goals to see them here
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* ── Daily Goals section ── */}
      {orderedRecurring.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-4 py-2 bg-background/50">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Daily Goals</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {completedToday.length}/{orderedRecurring.length} done
            </span>
          </div>

          <div className="mx-4 mb-3 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedToday.length / orderedRecurring.length) * 100}%` }}
            />
          </div>

          {categoryGroups.length > 0 && (
            <div>
              {categoryGroups.map(({ category, items }) => (
                <div key={category.id}>
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
                    <span className="text-xs font-medium text-muted-foreground">{category.name}</span>
                  </div>
                  <SortableSection
                    items={items}
                    onReorder={(reordered) => {
                      setOrderedRecurring(prev => {
                        const otherItems = prev.filter(fi => fi.category.id !== category.id)
                        const completedInCat = prev.filter(fi => fi.category.id === category.id && fi.item.completed)
                        return [...otherItems, ...reordered, ...completedInCat]
                      })
                    }}
                    onToggleComplete={onToggleComplete}
                    onSelectItem={onSelectItem}
                    showRecurringIcon
                  />
                </div>
              ))}
            </div>
          )}

          {completedToday.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompletedToday(s => !s)}
                className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-secondary/30 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs font-medium text-green-600">
                  Completed today ({completedToday.length})
                </span>
                <ChevronDown className={cn(
                  "w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform duration-200",
                  !showCompletedToday && "-rotate-90"
                )} />
              </button>

              {showCompletedToday && (
                <div className="opacity-60">
                  {completedToday.map(fi => (
                    <div key={itemKey(fi)}
                      className="flex items-center gap-2 px-4 py-3 border-b border-border last:border-0 bg-card">
                      <div className="w-4" />
                      <div onClick={(e) => {
                        e.stopPropagation()
                        haptics.light()
                        onToggleComplete(fi.category.id, fi.item.id)
                      }}>
                        <Checkbox checked className="h-5 w-5 rounded-full border-2" style={{ borderColor: fi.category.color }} />
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectItem(fi.category.id, fi.item.id)}>
                        <p className="text-sm font-medium truncate line-through text-muted-foreground">{fi.item.text}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: fi.category.color }} />
                          <span className="text-xs text-muted-foreground">{fi.category.name}</span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Divider ── */}
      {orderedRecurring.length > 0 && orderedFlagged.length > 0 && (
        <div className="h-3 bg-secondary/30" />
      )}

      {/* ── Flagged Items section ── */}
      {orderedFlagged.length > 0 && (
        <div>
          {/* Section header with sort control */}
          <div className="flex items-center gap-2 px-4 py-2 bg-background/50">
            <Flag className="w-3.5 h-3.5 text-accent-foreground" />
            <span className="text-xs font-semibold text-accent-foreground uppercase tracking-wide">Flagged</span>
            <div className="ml-auto relative">
              <button
                onClick={() => setShowSortMenu(s => !s)}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors",
                  showSortMenu
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>{sortLabels[sortMode]}</span>
                <ArrowUpDown className="w-3 h-3" />
              </button>

              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                  {(["manual", "category", "oldest", "newest"] as SortMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => { setSortMode(mode); setShowSortMenu(false); haptics.light() }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm transition-colors",
                        sortMode === mode
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-secondary/50 text-foreground"
                      )}
                    >
                      {sortLabels[mode]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active (incomplete) flagged items */}
          {activeFlagged.length > 0 && (
            <SortableSection
              items={activeFlagged}
              onReorder={(reordered) => {
                if (sortMode !== "manual") return // only reorder in manual mode
                setOrderedFlagged(prev => {
                  const completed = prev.filter(fi => fi.item.completed)
                  return [...reordered, ...completed]
                })
              }}
              onToggleComplete={onToggleComplete}
              onSelectItem={onSelectItem}
              onDeleteItem={onDeleteItem}
            />
          )}

          {/* Completed flagged items — collapsible with swipe-to-archive + bulk archive */}
          {completedFlagged.length > 0 && (
            <div>
              <div className="flex items-center w-full px-4 py-2 bg-background/30">
                <button
                  onClick={() => setShowCompletedFlagged(s => !s)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-600">
                    Completed ({completedFlagged.length})
                  </span>
                  <ChevronDown className={cn(
                    "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                    !showCompletedFlagged && "-rotate-90"
                  )} />
                </button>
                {/* Bulk archive button */}
                <button
                  onClick={() => { haptics.medium(); onArchiveAllCompleted() }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary active:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                  aria-label="Archive all completed"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive all</span>
                </button>
              </div>

              {showCompletedFlagged && (
                <div className="opacity-70">
                  <p className="text-[10px] text-muted-foreground/60 px-4 pb-1">← Swipe left to archive</p>
                  {completedFlagged.map(fi => (
                    <SwipeableCompletedRow
                      key={itemKey(fi)}
                      fi={fi}
                      onToggleComplete={onToggleComplete}
                      onSelectItem={onSelectItem}
                      onArchiveItem={onArchiveItem}
                      onDeleteItem={onDeleteItem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Close sort menu on outside click */}
      {showSortMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSortMenu(false)} />
      )}
    </div>
  )
}
