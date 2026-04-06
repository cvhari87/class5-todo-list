import { Category, TodoItem } from "./types"

const STORAGE_KEY = "todo-categories"

const defaultCategories: Category[] = [
  {
    id: "1",
    name: "Work",
    color: "#007AFF",
    priority: 1,
    items: [
      { id: "w0", text: "This week", type: "header", completed: false, flagged: false, createdAt: new Date() },
      { id: "w1", text: "Review project proposal", type: "todo", completed: false, flagged: true, createdAt: new Date() },
      { id: "w2", text: "Send weekly report", type: "todo", completed: false, flagged: false, createdAt: new Date() },
      { id: "w3", text: "Focus on the Q3 deliverables before the end of month.", type: "text", completed: false, flagged: false, createdAt: new Date() },
      { id: "w4", text: "Schedule team meeting", type: "todo", completed: true, flagged: false, createdAt: new Date() },
    ],
  },
  {
    id: "2",
    name: "Personal",
    color: "#34C759",
    priority: 2,
    items: [
      { id: "p1", text: "Call mom", type: "todo", completed: false, flagged: true, createdAt: new Date() },
      { id: "p2", text: "Buy groceries", type: "todo", completed: false, flagged: false, createdAt: new Date() },
      { id: "p3", text: "Renew gym membership", type: "todo", completed: false, flagged: true, createdAt: new Date() },
    ],
  },
  {
    id: "3",
    name: "Health",
    color: "#FF9500",
    priority: 3,
    items: [
      { id: "h0", text: "Goals", type: "header", completed: false, flagged: false, createdAt: new Date() },
      { id: "h1", text: "Morning run", type: "todo", completed: true, flagged: false, createdAt: new Date() },
      { id: "h2", text: "Book dentist appointment", type: "todo", completed: false, flagged: true, createdAt: new Date() },
    ],
  },
]

export function getCategories(): Category[] {
  if (typeof window === "undefined") return defaultCategories

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return defaultCategories
    }
  }
  return defaultCategories
}

export function saveCategories(categories: Category[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
}

export function getFlaggedItems(categories: Category[]): { item: TodoItem; category: Category }[] {
  const flagged: { item: TodoItem; category: Category }[] = []

  const sortedCategories = [...categories].sort((a, b) => a.priority - b.priority)

  for (const category of sortedCategories) {
    for (const item of category.items) {
      if (item.type === "todo" && item.flagged && !item.completed) {
        flagged.push({ item, category })
      }
    }
  }

  return flagged
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}
