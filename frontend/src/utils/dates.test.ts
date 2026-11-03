import { describe, expect, it } from 'vitest'
import { formatMonth, formatRange, fromMonthInput, toMonthInput } from '@/utils/dates'

describe('dates', () => {
  it('convierte entre API e input month', () => {
    expect(toMonthInput('2023-05-01')).toBe('2023-05')
    expect(fromMonthInput('2023-05')).toBe('2023-05-01')
    expect(fromMonthInput('')).toBeNull()
  })

  it('formatea meses y rangos en espanol', () => {
    expect(formatMonth('2023-05-01')).toBe('may 2023')
    expect(formatRange('2022-01-01', '2023-12-01')).toBe('ene 2022 - dic 2023')
    expect(formatRange('2022-01-01', null, true)).toBe('ene 2022 - actualidad')
  })
})
