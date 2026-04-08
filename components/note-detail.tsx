"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowLeft, Plus, Flag, Trash2, GripVertical, Heading, AlignLeft, CheckSquare, ArrowUpDown, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Category, TodoItem, ItemType } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { generateId, todayString } from "@/lib/store"
import { haptics } from "@/lib/haptics"

const PRESET_COLORS = [
  "#007AFF", "#34C759", "#FF9500", "#FF3B30",
  "#AF52DE", "#5856D6", "#FF2D55", "#00C7BE",
]

type SortOrder = "default" | "flagged" | "incomplete" | "alpha"

interface NoteDetailProps {
  category: Category
  onBack: () => void
  onUpdateCategory: (category: Category) => void
  onDeleteCategory: () => void
}

export function NoteDetail({ category, onBack, onUpdateCategory, onDeleteCategory }: NoteDetailProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addingType, setAddingType] = useState<ItemType | null>(null)
  const [newItemText, setNewItemText] = useState("")
  const [newItemDueDate, setNewItemDueDate] = useState("")
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitleText, setEditTitleText] = useState(category.name)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>("default")
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Refs to avoid stale closures in pointer event handlers
  const draggingIdRef = useRef<string | null>(null)
  const dragOverIdRef = useRef<string | null>(null)
  const categoryRef = useRef(category)
  const onUpdateCategoryRef = useRef(onUpdateCategory)
  const confirmNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { categoryRef.current = category }, [category])
  useEffect(() => { onUpdateCategoryRef.current = onUpdateCategory }, [onUpdateCategory])

  // Global pointer listeners — active only while dragging
  useEffect(() => {
    if (!draggingId) return

    const onPointerMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const row = el?.closest("[data-drag-id]") as HTMLElement | null
      const targetId = row?.dataset.dragId
      if (targetId && targetId !== draggingIdRef.current) {
        dragOverIdRef.current = targetId
        setDragOverId(targetId)
      }
    }

    const onPointerUp = () => {
      const from = draggingIdRef.current
      const to = dragOverIdRef.current
      if (from && to) {
        const items = [...categoryRef.current.items]
        const fromIdx = items.findIndex(i => i.id === from)
        const toIdx = items.findIndex(i => i.id === to)
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = items.splice(fromIdx, 1)
          items.splice(toIdx, 0, moved)
          onUpdateCategoryRef.current({ ...categoryRef.current, items })
        }
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

  const handleDragStart = (itemId: string) => {
    draggingIdRef.current = itemId
    dragOverIdRef.current = null
    setDraggingId(itemId)
    setDragOverId(null)
  }

  const startAdding = (type: ItemType) => {
    setAddingType(type)
    setNewItemText("")
    setNewItemDueDate("")
    setAddMenuOpen(false)
  }

  const commitNewItem = () => {
    if (!addingType || !newItemText.trim()) { setAddingType(null); return }
    haptics.light()
    const newItem: TodoItem = {
      id: generateId(),
      text: newItemText.trim(),
      type: addingType,
      completed: false,
      flagged: false,
      createdAt: new Date(),
      dueDate: newItemDueDate || undefined,
    }
    onUpdateCategory({ ...category, items: [...category.items, newItem] })
    setNewItemText("")
    setNewItemDueDate("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitNewItem()
    if (e.key === "Escape") { setAddingType(null); setNewItemText("") }
  }

  const handleToggleComplete = (itemId: string) => {
    const item = category.items.find(i => i.id === itemId)
    if (item) item.completed ? haptics.light() : haptics.success()
    const today = todayString()
    onUpdateCategory({
      ...category,
      items: category.items.map(i =>
        i.id === itemId
          ? { ...i, completed: !i.completed, lastCompletedDate: !i.completed ? today : i.lastCompletedDate }
          : i
      ),
    })
  }

  const handleToggleRecurring = (itemId: string) => {
    haptics.medium()
    onUpdateCategory({
      ...category,
      items: category.items.map(item =>
        item.id === itemId
          ? { ...item, recurring: !item.recurring, flagged: item.recurring ? item.flagged : false }
          : item
      ),
    })
  }

  const handleToggleFlag = (itemId: string) => {
    haptics.medium()
    onUpdateCategory({
      ...category,
      items: category.items.map(item =>
        item.id === itemId ? { ...item, flagged: !item.flagged } : item
      ),
    })
  }

  const handleDeleteItem = (itemId: string) => {
    const deleted = category.items.find(i => i.id === itemId)
    if (!deleted) return
    haptics.heavy()
    onUpdateCategory({ ...category, items: category.items.filter(i => i.id !== itemId) })
    toast("Item deleted", {
      action: {
        label: "Undo",
        onClick: () => onUpdateCategory({
          ...category,
          items: [...category.items.filter(i => i.id !== itemId), deleted],
        }),
      },
    })
  }

  const handleUpdateText = (itemId: string, text: string) => {
    onUpdateCategory({
      ...category,
      items: category.items.map(item => item.id === itemId ? { ...item, text } : item),
    })
  }

  const handleUpdateDueDate = (itemId: string, dueDate: string) => {
    onUpdateCategory({
      ...category,
      items: category.items.map(item =>
        item.id === itemId ? { ...item, dueDate: dueDate || undefined } : item
      ),
    })
  }

  const commitTitleEdit = () => {
    if (editTitleText.trim()) onUpdateCategory({ ...category, name: editTitleText.trim() })
    else setEditTitleText(category.name)
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitTitleEdit()
    if (e.key === "Escape") { setEditTitleText(category.name); setEditingTitle(false) }
  }

  const handleDeleteNote = () => {
    if (confirmDeleteNote) {
      onDeleteCategory()
    } else {
      setConfirmDeleteNote(true)
      confirmNoteTimer.current = setTimeout(() => setConfirmDeleteNote(false), 3000)
    }
  }

  useEffect(() => {
    return () => { if (confirmNoteTimer.current) clearTimeout(confirmNoteTimer.current) }
  }, [])

  const sortItems = (items: TodoItem[]) => {
    switch (sortOrder) {
      case "flagged": return [...items].sort((a, b) => (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0))
      case "incomplete": return [...items].sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0))
      case "alpha": return [...items].sort((a, b) => a.text.localeCompare(b.text))
      default: return items
    }
  }

  const incompleteItems = sortItems(category.items.filter(item => item.type !== "todo" || !item.completed))
  const completedItems = sortItems(category.items.filter(item => item.type === "todo" && item.completed))
  const todoTotal = category.items.filter(i => i.type === "todo").length
  const todoRemaining = category.items.filter(i => i.type === "todo" && !i.completed).length

  const sortLabels: Record<SortOrder, string> = {
    default: "Default", flagged: "Flagged first", incomplete: "Incomplete first", alpha: "A → Z",
  }

  const renderRows = (items: TodoItem[]) =>
    items.map(item => (
      <NoteItemRow
        key={item.id}
        item={item}
        categoryColor={category.color}
        isDragging={draggingId === item.id}
        isDragOver={dragOverId === item.id}
        onToggleComplete={() => handleToggleComplete(item.id)}
        onToggleFlag={() => handleToggleFlag(item.id)}
        onToggleRecurring={() => handleToggleRecurring(item.id)}
        onDelete={() => handleDeleteItem(item.id)}
        onUpdateText={(text) => handleUpdateText(item.id, text)}
        onUpdateDueDate={(date) => handleUpdateDueDate(item.id, date)}
        onDragStart={() => handleDragStart(item.id)}
      />
    ))

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowColorPicker(s => !s)}
              className="w-4 h-4 rounded-full border-2 border-white/30 shadow-sm"
              style={{ backgroundColor: category.color }}
              title="Change color"
            />
            {showColorPicker && (
              <div className="absolute top-7 left-0 bg-card rounded-xl shadow-lg border border-border p-3 z-20 flex flex-wrap gap-2 w-48">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => { onUpdateCategory({ ...category, color }); setShowColorPicker(false) }}
                    className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: color, boxShadow: category.color === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined }}
                  />
                ))}
              </div>
            )}
          </div>

          {editingTitle ? (
            <Input autoFocus value={editTitleText} onChange={(e) => setEditTitleText(e.target.value)}
              onBlur={commitTitleEdit} onKeyDown={handleTitleKeyDown}
              className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-lg font-semibold" />
          ) : (
            <h1 onClick={() => { setEditTitleText(category.name); setEditingTitle(true) }}
              className="text-lg font-semibold cursor-pointer hover:opacity-70 transition-opacity truncate">
              {category.name}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={cn("text-sm font-medium", todoRemaining === 0 && todoTotal > 0 ? "text-green-500" : "text-muted-foreground")}>
            {todoTotal === 0 ? "" : todoRemaining === 0 ? "All done" : `${todoRemaining} left`}
          </span>
          <Button variant="ghost" size="icon" onClick={handleDeleteNote}
            className={cn("h-8 w-8 rounded-full transition-colors",
              confirmDeleteNote ? "text-destructive bg-destructive/10" : "text-muted-foreground/40 hover:text-destructive")}
            title={confirmDeleteNote ? "Tap again to delete note" : "Delete note"}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-auto">
        {incompleteItems.length > 0 && (
          <div className="divide-y divide-border/50">{renderRows(incompleteItems)}</div>
        )}

        {completedItems.length > 0 && (
          <div className="mt-6">
            <div className="px-4 py-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Completed ({completedItems.length})
              </p>
            </div>
            <div className="divide-y divide-border/50 opacity-60">{renderRows(completedItems)}</div>
          </div>
        )}

        {category.items.length === 0 && !addingType && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-muted-foreground text-center">This note is empty</p>
            <p className="text-sm text-muted-foreground/70 text-center mt-1">Tap + to add items</p>
          </div>
        )}

        {addingType && (
          <div className="border-t border-border bg-card animate-in fade-in slide-in-from-bottom-1">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-5 flex items-center justify-center text-muted-foreground">
                {addingType === "header" && <Heading className="w-4 h-4" />}
                {addingType === "text" && <AlignLeft className="w-4 h-4" />}
                {addingType === "todo" && <CheckSquare className="w-4 h-4" />}
              </div>
              <Input autoFocus
                placeholder={addingType === "header" ? "Header text..." : addingType === "text" ? "Note text..." : "Todo item..."}
                value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={handleKeyDown}
                className={cn("flex-1 border-0 bg-transparent p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50",
                  addingType === "header" ? "text-base font-semibold" : "text-sm")} />
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setAddingType(null); setNewItemText("") }}
                  className="h-8 px-2 text-muted-foreground">Done</Button>
                <Button size="sm" onClick={commitNewItem} disabled={!newItemText.trim()} className="h-8 px-3">Add</Button>
              </div>
            </div>
            {addingType === "todo" && (
              <div className="flex items-center gap-2 px-4 pb-3">
                <span className="text-xs text-muted-foreground">Due date:</span>
                <input type="date" value={newItemDueDate} onChange={e => setNewItemDueDate(e.target.value)}
                  className="text-xs bg-transparent border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" />
                {newItemDueDate && (
                  <button onClick={() => setNewItemDueDate("")} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="sticky bottom-0 border-t border-border bg-card/90 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="relative">
            <button onClick={() => setShowSortMenu(s => !s)}
              className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors",
                sortOrder !== "default" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary")}>
              <ArrowUpDown className="w-3 h-3" />
              {sortLabels[sortOrder]}
            </button>
            {showSortMenu && (
              <div className="absolute bottom-10 left-0 bg-card rounded-xl shadow-lg border border-border overflow-hidden w-44 animate-in fade-in slide-in-from-bottom-2 z-10">
                {(["default", "flagged", "incomplete", "alpha"] as SortOrder[]).map(opt => (
                  <button key={opt} onClick={() => { setSortOrder(opt); setShowSortMenu(false) }}
                    className={cn("w-full text-left px-4 py-3 text-sm hover:bg-secondary/50 transition-colors border-b border-border last:border-0",
                      sortOrder === opt && "text-primary font-medium")}>
                    {sortLabels[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setAddMenuOpen(prev => !prev)}
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-5 h-5" />
            </Button>
            {addMenuOpen && (
              <div className="absolute bottom-12 right-0 bg-card rounded-xl shadow-lg border border-border overflow-hidden w-44 animate-in fade-in slide-in-from-bottom-2">
                {[
                  { type: "header" as ItemType, icon: <Heading className="w-4 h-4 text-muted-foreground" />, label: "Header" },
                  { type: "text" as ItemType, icon: <AlignLeft className="w-4 h-4 text-muted-foreground" />, label: "Text" },
                  { type: "todo" as ItemType, icon: <CheckSquare className="w-4 h-4 text-muted-foreground" />, label: "Todo" },
                ].map(({ type, icon, label }, i, arr) => (
                  <button key={type} onClick={() => startAdding(type)}
                    className={cn("flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-secondary/50 transition-colors", i < arr.length - 1 && "border-b border-border")}>
                    {icon}<span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface NoteItemRowProps {
  item: TodoItem
  categoryColor: string
  isDragging: boolean
  isDragOver: boolean
  onToggleComplete: () => void
  onToggleFlag: () => void
  onToggleRecurring: () => void
  onDelete: () => void
  onUpdateText: (text: string) => void
  onUpdateDueDate: (date: string) => void
  onDragStart: () => void
}

function NoteItemRow({
  item, categoryColor, isDragging, isDragOver,
  onToggleComplete, onToggleFlag, onToggleRecurring, onDelete,
  onUpdateText, onUpdateDueDate, onDragStart,
}: NoteItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const [editingDate, setEditingDate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasVibratedSwipe = useRef(false)

  useEffect(() => {
    if (confirmDelete) {
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2000)
    }
    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }
  }, [confirmDelete])

  const commitEdit = () => {
    if (editText.trim()) onUpdateText(editText.trim())
    else setEditText(item.text)
    setEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit()
    if (e.key === "Escape") { setEditText(item.text); setEditing(false) }
  }

  const handleDelete = () => {
    if (confirmDelete) {
      haptics.heavy()
      onDelete()
    } else {
      haptics.medium()
      setConfirmDelete(true)
    }
  }

  // Swipe-to-delete via touch on the row body
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    hasVibratedSwipe.current = false
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.touches[0].clientX - touchStartX.current
    if (delta < 0) {
      const newOffset = Math.max(-80, delta)
      // Vibrate once when threshold is crossed
      if (newOffset <= -40 && !hasVibratedSwipe.current) {
        haptics.medium()
        hasVibratedSwipe.current = true
      }
      setSwipeOffset(newOffset)
    } else if (swipeOffset < 0) {
      setSwipeOffset(Math.min(0, swipeOffset + delta))
    }
  }
  const handleTouchEnd = () => {
    setSwipeOffset(swipeOffset < -40 ? -80 : 0)
    touchStartX.current = null
  }

  const today = new Date().toISOString().split("T")[0]
  const isOverdue = item.dueDate && item.dueDate < today && !item.completed
  const isDueToday = item.dueDate === today && !item.completed

  return (
    <div
      data-drag-id={item.id}
      className={cn("relative overflow-hidden", isDragOver && "border-t-2 border-primary")}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe-to-delete background */}
      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-destructive">
        <Trash2 className="w-5 h-5 text-white" />
      </div>

      <div
        className={cn("flex items-center gap-2 px-2 py-2.5 bg-card transition-all select-none",
          isDragging && "opacity-40 scale-95")}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onClick={() => swipeOffset < 0 ? setSwipeOffset(0) : undefined}
      >
        {/* Grip handle — grab to drag */}
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
          onPointerDown={(e) => {
            e.preventDefault()
            onDragStart()
          }}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Left indicator */}
        <div className="flex-shrink-0 flex items-center justify-center w-5">
          {item.type === "todo" && (
            <div onClick={onToggleComplete} className="cursor-pointer">
              <Checkbox checked={item.completed} className="h-5 w-5 rounded-full border-2" style={{ borderColor: categoryColor }} />
            </div>
          )}
          {item.type === "header" && <div className="w-1 h-4 rounded-full" style={{ backgroundColor: categoryColor }} />}
          {item.type === "text" && <AlignLeft className="w-3.5 h-3.5 text-muted-foreground/30" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input autoFocus value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitEdit} onKeyDown={handleEditKeyDown}
              className={cn("border-0 bg-transparent p-0 h-auto focus-visible:ring-0",
                item.type === "header" && "text-base font-semibold",
                item.type === "text" && "text-sm text-muted-foreground",
                item.type === "todo" && "text-sm")} />
          ) : (
            <p onClick={() => { setEditText(item.text); setEditing(true) }}
              className={cn("cursor-pointer select-none",
                item.type === "header" && "text-base font-semibold tracking-tight",
                item.type === "text" && "text-sm text-muted-foreground leading-relaxed",
                item.type === "todo" && "text-sm",
                item.type === "todo" && item.completed && "line-through text-muted-foreground")}>
              {item.text}
            </p>
          )}

          {item.type === "todo" && (
            <div className="mt-0.5">
              {editingDate ? (
                <input autoFocus type="date" defaultValue={item.dueDate ?? ""}
                  onBlur={(e) => { onUpdateDueDate(e.target.value); setEditingDate(false) }}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingDate(false) }}
                  className="text-xs bg-transparent border border-border rounded px-1 py-0.5 text-foreground focus:outline-none" />
              ) : item.dueDate ? (
                <button onClick={() => setEditingDate(true)}
                  className={cn("text-xs",
                    isOverdue && "text-red-500 font-medium",
                    isDueToday && "text-orange-500 font-medium",
                    !isOverdue && !isDueToday && "text-muted-foreground")}>
                  {isOverdue ? "Overdue · " : isDueToday ? "Due today · " : "Due "}{item.dueDate}
                </button>
              ) : (
                <button onClick={() => setEditingDate(true)} className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  + due date
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {item.type === "todo" && (
            <>
              {/* Recurring toggle — 🔄 icon, active = green */}
              <Button variant="ghost" size="icon" onClick={onToggleRecurring}
                className={cn("h-8 w-8 rounded-full transition-colors",
                  item.recurring
                    ? "text-green-500 hover:text-green-600"
                    : "text-muted-foreground/40 hover:text-muted-foreground")}
                title={item.recurring ? "Daily goal (tap to remove)" : "Make daily goal"}>
                <RefreshCw className={cn("w-3.5 h-3.5", item.recurring && "stroke-[2.5]")} />
              </Button>
              {/* Flag — only show if not recurring */}
              {!item.recurring && (
                <Button variant="ghost" size="icon" onClick={onToggleFlag}
                  className={cn("h-8 w-8 rounded-full transition-colors",
                    item.flagged ? "text-accent-foreground" : "text-muted-foreground/40 hover:text-muted-foreground")}
                  title={item.flagged ? "Unflag" : "Flag"}>
                  <Flag className={cn("w-4 h-4", item.flagged && "fill-current")} />
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" size="icon" onClick={handleDelete}
            className={cn("h-8 w-8 rounded-full transition-colors",
              confirmDelete ? "text-destructive bg-destructive/10" : "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10")}
            title={confirmDelete ? "Tap again to confirm" : "Delete"}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {swipeOffset <= -80 && (
        <button className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-destructive" onClick={onDelete}>
          <Trash2 className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  )
}
