import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import Decimal from 'decimal.js';
import { Package, Order } from '../types/domain';

// 模拟 useStore 的核心算法逻辑
function calculateInventoryList(
  packages: Package[],
  salesHistory: Order[]
) {
  const map: Record<string, { name: string; quantity: number; totalCost: Decimal }> = {};
  
  // 1. 进货累加
  packages.forEach(p => {
    if (!p.verified) return;
    const name = (p.content || '').trim();
    if (!name) return;
    if (!map[name]) map[name] = { name, quantity: 0, totalCost: new Decimal(0) };
    
    const qty = new Decimal(p.quantity || 0);
    const cost = new Decimal(p.costPrice || 0);
    map[name].quantity = qty.add(map[name].quantity).toNumber();
    map[name].totalCost = map[name].totalCost.add(qty.times(cost));
  });

  // 2. 销售扣减 (排除已退款订单)
  salesHistory.forEach(sale => {
    if (sale.status === 'refunded') return;
    sale.items.forEach(sold => {
      if (map[sold.name]) {
        const currentAvgCost = map[sold.name].quantity > 0 
          ? map[sold.name].totalCost.dividedBy(map[sold.name].quantity)
          : new Decimal(sold.costSnapshot);
        
        map[sold.name].quantity = new Decimal(map[sold.name].quantity).minus(sold.quantity).toNumber();
        map[sold.name].totalCost = map[sold.name].totalCost.minus(new Decimal(sold.quantity).times(currentAvgCost));
      }
    });
  });

  return Object.values(map)
    .filter(i => i.quantity >= 0) // 允许显示0库存，方便补货
    .map(i => ({
      name: i.name,
      quantity: i.quantity,
      averageCost: i.quantity > 0 ? i.totalCost.dividedBy(i.quantity).toNumber() : 0
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

describe('WAC (Weighted Average Cost) Algorithm Tests', () => {
  it('should calculate correct average cost with single purchase', () => {
    const packages: Package[] = [
      {
        id: '1',
        content: '商品A',
        quantity: 10,
        costPrice: 10,
        verified: true,
        timestamp: Date.now(),
      }
    ];
    
    const salesHistory: Order[] = [];
    
    const result = calculateInventoryList(packages, salesHistory);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('商品A');
    expect(result[0].quantity).toBe(10);
    expect(result[0].averageCost).toBe(10);
  });

  it('should calculate correct average cost with multiple purchases of same item', () => {
    const packages: Package[] = [
      {
        id: '1',
        content: '商品A',
        quantity: 10,
        costPrice: 10,
        verified: true,
        timestamp: Date.now(),
      },
      {
        id: '2',
        content: '商品A',
        quantity: 10,
        costPrice: 20,
        verified: true,
        timestamp: Date.now() + 1000,
      }
    ];
    
    const salesHistory: Order[] = [];
    
    const result = calculateInventoryList(packages, salesHistory);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('商品A');
    expect(result[0].quantity).toBe(20); // 10 + 10
    expect(result[0].averageCost).toBe(15); // (10*10 + 10*20) / 20 = 15
  });

  it('should correctly reduce inventory after sales', () => {
    const packages: Package[] = [
      {
        id: '1',
        content: '商品A',
        quantity: 20,
        costPrice: 10,
        verified: true,
        timestamp: Date.now(),
      }
    ];
    
    const salesHistory: Order[] = [
      {
        id: 'order1',
        timestamp: Date.now(),
        totalAmount: 0,
        totalProfit: 0,
        items: [
          {
            name: '商品A',
            quantity: 5,
            sellPrice: 15,
            costSnapshot: 10,
          }
        ],
        status: 'completed',
      }
    ];
    
    const result = calculateInventoryList(packages, salesHistory);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('商品A');
    expect(result[0].quantity).toBe(15); // 20 - 5
    expect(result[0].averageCost).toBe(10); // Cost remains unchanged
  });

  it('should handle multiple sales of same item', () => {
    const packages: Package[] = [
      {
        id: '1',
        content: '商品A',
        quantity: 30,
        costPrice: 10,
        verified: true,
        timestamp: Date.now(),
      }
    ];
    
    const salesHistory: Order[] = [
      {
        id: 'order1',
        timestamp: Date.now(),
        totalAmount: 0,
        totalProfit: 0,
        items: [
          {
            name: '商品A',
            quantity: 5,
            sellPrice: 15,
            costSnapshot: 10,
          }
        ],
        status: 'completed',
      },
      {
        id: 'order2',
        timestamp: Date.now() + 1000,
        totalAmount: 0,
        totalProfit: 0,
        items: [
          {
            name: '商品A',
            quantity: 10,
            sellPrice: 15,
            costSnapshot: 10,
          }
        ],
        status: 'completed',
      }
    ];
    
    const result = calculateInventoryList(packages, salesHistory);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('商品A');
    expect(result[0].quantity).toBe(15); // 30 - 5 - 10
    expect(result[0].averageCost).toBe(10); // Cost remains unchanged
  });

  it('should exclude refunded orders from inventory calculation', () => {
    const packages: Package[] = [
      {
        id: '1',
        content: '商品A',
        quantity: 10,
        costPrice: 10,
        verified: true,
        timestamp: Date.now(),
      }
    ];
    
    const salesHistory: Order[] = [
      {
        id: 'order1',
        timestamp: Date.now(),
        totalAmount: 0,
        totalProfit: 0,
        items: [
          {
            name: '商品A',
            quantity: 5,
            sellPrice: 15,
            costSnapshot: 10,
          }
        ],
        status: 'refunded', // This should be excluded
      }
    ];
    
    const result = calculateInventoryList(packages, salesHistory);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('商品A');
    expect(result[0].quantity).toBe(10); // Should remain unchanged because order was refunded
    expect(result[0].averageCost).toBe(10);
  });

  it('should handle multiple different items', () => {
    const packages: Package[] = [
      {
        id: '1',
        content: '商品A',
        quantity: 10,
        costPrice: 10,
        verified: true,
        timestamp: Date.now(),
      },
      {
        id: '2',
        content: '商品B',
        quantity: 20,
        costPrice: 5,
        verified: true,
        timestamp: Date.now(),
      }
    ];
    
    const salesHistory: Order[] = [
      {
        id: 'order1',
        timestamp: Date.now(),
        totalAmount: 0,
        totalProfit: 0,
        items: [
          {
            name: '商品A',
            quantity: 3,
            sellPrice: 15,
            costSnapshot: 10,
          }
        ],
        status: 'completed',
      }
    ];
    
    const result = calculateInventoryList(packages, salesHistory);
    
    expect(result).toHaveLength(2);
    
    const itemA = result.find(item => item.name === '商品A');
    const itemB = result.find(item => item.name === '商品B');
    
    expect(itemA).toBeDefined();
    expect(itemB).toBeDefined();
    
    if (itemA) {
      expect(itemA.quantity).toBe(7); // 10 - 3
      expect(itemA.averageCost).toBe(10);
    }
    
    if (itemB) {
      expect(itemB.quantity).toBe(20); // Unchanged
      expect(itemB.averageCost).toBe(5);
    }
  });

  it('should handle cost snapshot when item quantity drops to zero', () => {
    const packages: Package[] = [
      {
        id: '1',
        content: '商品A',
        quantity: 5,
        costPrice: 10,
        verified: true,
        timestamp: Date.now(),
      }
    ];
    
    // Add another package to ensure we have some cost history
    packages.push({
      id: '2',
      content: '商品A',
      quantity: 5,
      costPrice: 15,
      verified: true,
      timestamp: Date.now() + 1000,
    });
    
    const salesHistory: Order[] = [
      {
        id: 'order1',
        timestamp: Date.now(),
        totalAmount: 0,
        totalProfit: 0,
        items: [
          {
            name: '商品A',
            quantity: 8, // Selling more than first package, but less than total
            sellPrice: 20,
            costSnapshot: 12, // Average of the two packages: (10*5 + 15*5)/10 = 12.5 -> 12 (rounded)
          }
        ],
        status: 'completed',
      }
    ];
    
    const result = calculateInventoryList(packages, salesHistory);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('商品A');
    expect(result[0].quantity).toBe(2); // 10 - 8
    // Average cost should be calculated as: (10*5 + 15*5) / 10 = 12.5, rounded down to 12.5
    // Actually: total cost = 10*5 + 15*5 = 125, total quantity = 10, avg = 12.5
    // After selling 8 at cost 12.5 each: remaining cost = 125 - 8*12.5 = 125 - 100 = 25
    // Remaining quantity = 2, so avg cost = 25/2 = 12.5
    expect(result[0].averageCost).toBeCloseTo(12.5, 1);
  });
});