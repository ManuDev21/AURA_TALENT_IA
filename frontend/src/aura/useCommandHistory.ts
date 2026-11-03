import { useCallback, useState } from 'react'

const KEY = 'aura.command.history'
const LIMIT = 8

function read(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>(read)
  const push = useCallback((command: string) => {
    setHistory((prev) => {
      const next = [command, ...prev.filter((c) => c !== command)].slice(0, LIMIT)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])
  return { history, push }
}
