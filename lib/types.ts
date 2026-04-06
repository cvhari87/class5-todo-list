export type ItemType = "todo" | "header" | "text"

export interface TodoItem {
  id: string
  text: string
  type: ItemType
  completed: boolean
  flagged: boolean
  createdAt: Date
}

export interface Category {
  id: string
  name: string
  color: string
  priority: number
  items: TodoItem[]
}
