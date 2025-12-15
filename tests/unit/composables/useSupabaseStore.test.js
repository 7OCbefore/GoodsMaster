import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useStore } from '../../../src/composables/useSupabaseStore'

describe('useSupabaseStore', () => {
  beforeEach(() => {
    // Create a new Pinia instance for each test
    setActivePinia(createPinia())
  })

  it('should initialize with default values', () => {
    const store = useStore()
    
    // Check initial state
    expect(store.packages.value).toEqual([])
    expect(store.goodsList.value).toEqual([])
    expect(store.salesHistory.value).toEqual([])
    expect(store.sellPrice.value).toEqual({})
    expect(store.loading.value).toBe(false)
    expect(store.error.value).toBe(null)
  })

  it('should format currency correctly', () => {
    const store = useStore()
    
    expect(store.formatCurrency(1000)).toBe('1,000.00')
    expect(store.formatCurrency(1234.56)).toBe('1,234.56')
    expect(store.formatCurrency(0)).toBe('0.00')
  })

  it('should check if dates are the same day', () => {
    const store = useStore()
    
    expect(store.isSameDay('2023-01-01', '2023-01-01')).toBe(true)
    expect(store.isSameDay('2023-01-01', '2023-01-02')).toBe(false)
    expect(store.isSameDay(new Date('2023-01-01'), new Date('2023-01-01'))).toBe(true)
  })
})