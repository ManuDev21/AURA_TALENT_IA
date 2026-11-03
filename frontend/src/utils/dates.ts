const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** 'YYYY-MM-DD' (API) -> 'YYYY-MM' (input type=month). */
export function toMonthInput(value: string | null | undefined): string {
  return value ? value.slice(0, 7) : ''
}

/** 'YYYY-MM' (input type=month) -> 'YYYY-MM-01' (API) o null. */
export function fromMonthInput(value: string | null | undefined): string | null {
  return value ? `${value}-01` : null
}

export function formatMonth(value: string | null | undefined): string {
  if (!value) return ''
  const [year, month] = value.split('-')
  const index = Number(month) - 1
  return MONTHS[index] ? `${MONTHS[index]} ${year}` : (year ?? '')
}

export function formatRange(start: string | null | undefined, end: string | null | undefined, current = false): string {
  const from = formatMonth(start)
  const to = current ? 'actualidad' : formatMonth(end)
  if (from && to) return `${from} - ${to}`
  return from || to
}
