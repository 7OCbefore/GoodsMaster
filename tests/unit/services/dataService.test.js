import { describe, it, expect, vi } from 'vitest'
import * as DataService from '../../../src/services/dataService'

describe('DataService', () => {
  it('should have getPackages function', () => {
    expect(typeof DataService.getPackages).toBe('function')
  })

  it('should have addPackage function', () => {
    expect(typeof DataService.addPackage).toBe('function')
  })

  it('should have verifyPackage function', () => {
    expect(typeof DataService.verifyPackage).toBe('function')
  })

  it('should have deletePackage function', () => {
    expect(typeof DataService.deletePackage).toBe('function')
  })

  it('should have getGoodsList function', () => {
    expect(typeof DataService.getGoodsList).toBe('function')
  })

  it('should have addGood function', () => {
    expect(typeof DataService.addGood).toBe('function')
  })

  it('should have getSalesHistory function', () => {
    expect(typeof DataService.getSalesHistory).toBe('function')
  })

  it('should have addSale function', () => {
    expect(typeof DataService.addSale).toBe('function')
  })

  it('should have refundOrder function', () => {
    expect(typeof DataService.refundOrder).toBe('function')
  })

  it('should have getSellPrices function', () => {
    expect(typeof DataService.getSellPrices).toBe('function')
  })

  it('should have setSellPrice function', () => {
    expect(typeof DataService.setSellPrice).toBe('function')
  })
})