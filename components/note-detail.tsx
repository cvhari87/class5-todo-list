"use client"

import { useState, useRef, useCallback } from "react"
import { ArrowLeft, Plus, Flag, Trash2, GripVertical, Heading, AlignLeft, CheckSquare } from "lucide-react"
import { Category, TodoItem, ItemType } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { generateId } from "@/lib/store"

interface NoteDetailProps {
  category: Category
  onBack: () => void
  onUpdateCategory: (category: Category) => void
}

export function NoteDetail({ category, onBack, onUpdateCategory }: NoteDetailProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addingType, setAddingType] = useState<ItemType | null>(null)
  const [newItemText, setNewItemText] = useState("")
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitleText, setEditTitleText] = useState(category.name)
  const dragItemId = useRef<string | null>(null)

  const startAdding = (type: ItemType) => {
    setAddingType(type)
    setNewItemText("")
    setAddMenuOpen(false)
  }

  const commitNewItem = () => {
    if (!addingType || !newItemText.trim()) {
      setAddingType(null)
      return
    }
    const newItem: TodoItem = {
      id: generateId(),
      text: newItemText.trim(),
      type: addingType,
      completed: false,
      flagged: false,
      createdAt: new Date(),
    }
    onUpdateCategory({ ...category, items: [...category.items, newItem] })
    setNewItemText("")
    setAddingType(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitNewItem()
    if (e.key === "Escape") { setAddingType(null); setNewItemText("") }
  }

  const handleToggleComplete = (itemId: string) => {
    onUpdateCategory({
      ...category,
      items: category.items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
    })
  }

  const handleToggleFlag = (itemId: string) => {
    onUpdateCategory({
      ...category,
      items: category.items.map(item =>
        item.id === itemId ? { ...item, flagged: !item.flagged } : item
      ),
    })
  }

  const handleDeleteItem = (itemId: string) => {
    onUpdateCategory({
      ...category,
      items: category.items.filter(item => item.id !== itemId),
    })
  }

  const handleUpdateText = (itemId: string, text: string) => {
    onUpdateCategory({
      ...category,
      items: category.items.map(item =>
        item.id === itemId ? { ...item, text } : item
      ),
    })
  }

  const commitTitleEdit = () => {
    if (editTitleText.trim()) {
      onUpdateCategory({ ...category, name: editTitleText.trim() })
    } else {
      setEditTitleText(category.name)
    }
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitTitleEdit()
    if (e.key === "Escape") { setEditTitleText(category.name); setEditingTitle(false) }
  }

  // Drag and drop handlers
  const handleDragStart = (id: string) => {
    dragItemId.current = id
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOverId(id)
  }

  const handleDrop = (targetId: string) => {
    const sourceId = dragItemId.current
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null)
      dragItemId.current = null
      return
    }
    const items = [...category.items]
    const fromIndex = items.findIndex(i => i.id === sourceId)
    const toIndex = items.findIndex(i => i.id === targetId)
    const [moved] = items.splice(fromIndex, 1)
    items.splice(toIndex, 0, moved)
    onUpdateCategory({ ...category, items })
    setDragOverId(null)
    dragItemId.current = null
  }

  const handleDragEnd = () => {
    setDragOverId(null)
    dragItemId.current = null
  }

  const incompleteItems = category.items.filter(item => item.type !== "todo" || !item.completed)
  const completedItems = category.items.filter(item => item.type === "todo" && item.completed)

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-9 w-9 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
          {editingTitle ? (
            <Input
              autoFocus
              value={editTitleText}
              onChange={(e) => setEditTitleText(e.target.value)}
              onBlur={commitTitleEdit}
              onKeyDown={handleTitleKeyDown}
              className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-lg font-semibold"
            />
          ) : (
            <h1
              onClick={() => { setEditTitleText(category.name); setEditingTitle(true) }}
              className="text-lg font-semibold cursor-pointer hover:opacity-70 transition-opacity"
            >
              {category.name}
            </h1>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {category.items.filter(i => i.type === "todo" && !i.completed).length} remaining
        </span>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-auto">

        {/* Active items */}
        {incompleteItems.length > 0 && (
          <div className="divide-y divide-border/50">
            {incompleteItems.map(item => (
              <NoteItemRow
                key={item.id}
                item={item}
                categoryColor={category.color}
                isDragOver={dragOverId === item.id}
                onToggleComplete={() => handleToggleComplete(item.id)}
                onToggleFlag={() => handleToggleFlag(item.id)}
                onDelete={() => handleDeleteItem(item.id)}
                onUpdateText={(text) => handleUpdateText(item.id, text)}
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={() => handleDrop(item.id)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}

        {/* Completed todo items */}
        {completedItems.length > 0 && (
          <div className="mt-6">
            <div className="px-4 py-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Completed ({completedItems.length})
              </p>
            </div>
            <div className="divide-y divide-border/50 opacity-60">
              {completedItems.map(item => (
                <NoteItemRow
                  key={item.id}
                  item={item}
                  categoryColor={category.color}
                  isDragOver={dragOverId === item.id}
                  onToggleComplete={() => handleToggleComplete(item.id)}
                  onToggleFlag={() => handleToggleFlag(item.id)}
                  onDelete={() => handleDeleteItem(item.id)}
                  onUpdateText={(text) => handleUpdateText(item.id, text)}
                  onDragStart={() => handleDragStart(item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDrop={() => handleDrop(item.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </div>
        )}

        {category.items.length === 0 && !addingType && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-muted-foreground text-center">This note is empty</p>
            <p className="text-sm text-muted-foreground/70 text-center mt-1">
              Tap + to add a header, text, or todo item
            </p>
          </div>
        )}

        {/* Inline new item input */}
        {addingType && (
          <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-card animate-in fade-in slide-in-from-bottom-1">
            <div className="w-5 flex items-center justify-center text-muted-foreground">
              {addingType === "header" && <Heading className="w-4 h-4" />}
              {addingType === "text" && <AlignLeft className="w-4 h-4" />}
              {addingType === "todo" && <CheckSquare className="w-4 h-4" />}
            </div>
            <Input
              autoFocus
              placeholder={
                addingType === "header"
                  ? "Header text..."
                  : addingType === "text"
                  ? "Note text..."
                  : "Todo item..."
              }
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex-1 border-0 bg-transparent p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50",
                addingType === "header" ? "text-base font-semibold" : "text-sm"
              )}
            />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAddingType(null); setNewItemText("") }}
                className="h-8 px-2 text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={commitNewItem}
                disabled={!newItemText.trim()}
                className="h-8 px-3"
              >
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="sticky bottom-0 border-t border-border bg-card/90 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {category.items.length} {category.items.length === 1 ? "block" : "blocks"}
          </span>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAddMenuOpen(prev => !prev)}
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-5 h-5" />
            </Button>

            {/* Add menu popover */}
            {addMenuOpen && (
              <div className="absolute bottom-12 right-0 bg-card rounded-xl shadow-lg border border-border overflow-hidden w-44 animate-in fade-in slide-in-from-bottom-2">
                <button
                  onClick={() => startAdding("header")}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-secondary/50 transition-colors border-b border-border"
                >
                  <Heading className="w-4 h-4 text-muted-foreground" />
                  <span>Header</span>
                </button>
                <button
                  onClick={() => startAdding("text")}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-secondary/50 transition-colors border-b border-border"
                >
                  <AlignLeft className="w-4 h-4 text-muted-foreground" />
                  <span>Text</span>
                </button>
                <button
                  onClick={() => startAdding("todo")}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-secondary/50 transition-colors"
                >
                  <CheckSquare className="w-4 h-4 text-muted-foreground" />
                  <span>Todo</span>
                </button>
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
  isDragOver: boolean
  onToggleComplete: () => void
  onToggleFlag: () => void
  onDelete: () => void
  onUpdateText: (text: string) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}

function NoteItemRow({
  item,
  categoryColor,
  isDragOver,
  onToggleComplete,
  onToggleFlag,
  onDelete,
  onUpdateText,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: NoteItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const draggableRef = useRef<HTMLDivElement>(null)
  const dragEnabled = useRef(false)

  const commitEdit = () => {
    if (editText.trim()) onUpdateText(editText.trim())
    else setEditText(item.text)
    setEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit()
    if (e.key === "Escape") { setEditText(item.text); setEditing(false) }
  }

  // Only allow drag when initiated from the grip handle
  const handleGripMouseDown = useCallback(() => {
    dragEnabled.current = true
    if (draggableRef.current) draggableRef.current.draggable = true
  }, [])

  const handleDragStartGuarded = useCallback(() => {
    if (!dragEnabled.current) return
    onDragStart()
  }, [onDragStart])

  const handleDragEndGuarded = useCallback(() => {
    dragEnabled.current = false
    if (draggableRef.current) draggableRef.current.draggable = false
    onDragEnd()
  }, [onDragEnd])

  return (
    <div
      ref={draggableRef}
      draggable={false}
      onDragStart={handleDragStartGuarded}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={handleDragEndGuarded}
      className={cn(
        "flex items-center gap-2 px-2 py-2.5 bg-card transition-colors group",
        isDragOver && "border-t-2 border-primary bg-primary/5",
      )}
    >
      {/* Drag handle — always visible, initiates drag */}
      <div
        onMouseDown={handleGripMouseDown}
        className="cursor-grab active:cursor-grabbing flex-shrink-0 p-1 rounded text-muted-foreground/40 hover:text-muted-foreground/80 hover:bg-secondary/60 transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Left indicator */}
      <div className="flex-shrink-0 flex items-center justify-center w-5">
        {item.type === "todo" && (
          <div onClick={onToggleComplete} className="cursor-pointer">
            <Checkbox
              checked={item.completed}
              className="h-5 w-5 rounded-full border-2"
              style={{ borderColor: categoryColor }}
            />
          </div>
        )}
        {item.type === "header" && (
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: categoryColor }} />
        )}
        {item.type === "text" && (
          <AlignLeft className="w-3.5 h-3.5 text-muted-foreground/30" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleEditKeyDown}
            className={cn(
              "border-0 bg-transparent p-0 h-auto focus-visible:ring-0",
              item.type === "header" && "text-base font-semibold",
              item.type === "text" && "text-sm text-muted-foreground",
              item.type === "todo" && "text-sm",
            )}
          />
        ) : (
          <p
            onDoubleClick={() => { setEditText(item.text); setEditing(true) }}
            className={cn(
              "cursor-default select-none",
              item.type === "header" && "text-base font-semibold tracking-tight",
              item.type === "text" && "text-sm text-muted-foreground leading-relaxed",
              item.type === "todo" && "text-sm",
              item.type === "todo" && item.completed && "line-through text-muted-foreground",
            )}
          >
            {item.text}
          </p>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {item.type === "todo" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFlag}
            className={cn(
              "h-8 w-8 rounded-full transition-colors",
              item.flagged
                ? "text-accent-foreground opacity-100"
                : "text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100"
            )}
            title={item.flagged ? "Unflag" : "Flag"}
          >
            <Flag className={cn("w-4 h-4", item.flagged && "fill-current")} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
