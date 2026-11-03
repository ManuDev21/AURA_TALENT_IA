import type { NodeStatus } from '@/types/career'

export const STATUS_COLOR: Record<NodeStatus, string> = {
  acquired: '#ff7a1a',
  in_progress: '#ffb547',
  gap: '#5a5a63',
  target: '#f4efe6',
}

export const STATUS_LABEL: Record<NodeStatus, string> = {
  acquired: 'Adquirido',
  in_progress: 'En progreso',
  gap: 'Brecha',
  target: 'Objetivo',
}
