export type ItemType = "todo" | "header" | "text"

export interface TodoItem {
  id: string
  text: string
  type: ItemType
  completed: boolean
  flagged: boolean
  createdAt: Date
  dueDate?: string // ISO date string YYYY-MM-DD
}

export interface Category {
  id: string
  name: string
  color: string
  priority: number
  items: TodoItem[]
}
