import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Package, Order } from '../types/domain';

// 模拟 useStore 的金额计算逻辑
function calculateOrderProfit(order: Order): number {
  let totalProfit = new Decimal(0);
  for (const item of order.items) {
    const itemProfit = new Decimal(item.sellPrice).minus(item.costSnapshot).times(item.quantity);
    totalProfit = totalProfit.plus(itemProfit);
  }
  return totalProfit.toNumber();
}

function calculateTotalAmount(order: Order): number {
  let total = new Decimal(0);
  for (const item of order.items) {
    const itemTotal = new Decimal(item.sellPrice).times(item.quantity);
    total = total.plus(itemTotal);
  }
  return total.toNumber();
}

function calculateDailyStats(salesHistory: Order[], targetDate: Date) {
  const isSameDay = (d1: Date | number, d2: Date | number): boolean => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const validSales = salesHistory.filter(s => s.status !== 'refunded');
  const dayOrders = validSales.filter(s => isSameDay(s.timestamp, targetDate));
  
  const revenue = dayOrders.reduce((sum, o) => sum + calculateTotalAmount(o), 0);
  const profit = dayOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);
  const count = dayOrders.length;
  const aov = count > 0 ? (revenue / count) : 0;

  return {
    revenue,
    profit,
    count,
    aov,
    marginRate: revenue ? ((profit / revenue) * 100).toFixed(1) : '0.0',
    orders: dayOrders.sort((a,b) => b.timestamp - a.timestamp)
  };
}

describe('Financial Calculation Tests', () => {
  it('should correctly calculate order profit', () => {
    const order: Order = {
      id: 'order1',
      timestamp: Date.now(),
      items: [
        {
          name: '商品A',
          quantity: 2,
          sellPrice: 15.5,
          costSnapshot: 10,
        },
        {
          name: '商品B',
          quantity: 1,
          sellPrice: 20,
          costSnapshot: 12,
        }
      ],
      totalAmount: 0,
      totalProfit: 0,
      status: 'completed',
    };

    const profit = calculateOrderProfit(order);
    
    // (15.5 - 10) * 2 + (20 - 12) * 1 = 5.5 * 2 + 8 * 1 = 11 + 8 = 19
    expect(profit).toBeCloseTo(19, 2);
  });

  it('should correctly calculate order total amount', () => {
    const order: Order = {
      id: 'order1',
      timestamp: Date.now(),
      items: [
        {
          name: '商品A',
          quantity: 3,
          sellPrice: 10.5,
          costSnapshot: 8,
        },
        {
          name: '商品B',
          quantity: 2,
          sellPrice: 15,
          costSnapshot: 10,
        }
      ],
      totalAmount: 0,
      totalProfit: 0,
      status: 'completed',
    };

    const totalAmount = calculateTotalAmount(order);
    
    // 10.5 * 3 + 15 * 2 = 31.5 + 30 = 61.5
    expect(totalAmount).toBeCloseTo(61.5, 2);
  });

  it('should handle decimal precision in calculations', () => {
    // 测试浮点数精度问题
    const order: Order = {
      id: 'order1',
      timestamp: Date.now(),
      items: [
        {
          name: '商品A',
          quantity: 1,
          sellPrice: 0.1,
          costSnapshot: 0.2,
        }
      ],
      totalAmount: 0,
      totalProfit: 0,
      status: 'completed',
    };

    const profit = calculateOrderProfit(order);
    // (0.1 - 0.2) * 1 = -0.1
    expect(profit).toBeCloseTo(-0.1, 10); // 保留足够小数位以验证精度
    
    const totalAmount = calculateTotalAmount(order);
    // 0.1 * 1 = 0.1
    expect(totalAmount).toBeCloseTo(0.1, 10);
  });

  it('should calculate daily stats correctly', () => {
    const targetDate = new Date(2023, 5, 15); // June 15, 2023
    const salesHistory: Order[] = [
      {
        id: 'order1',
        timestamp: new Date(2023, 5, 15).getTime(), // Same day
        items: [
          {
            name: '商品A',
            quantity: 2,
            sellPrice: 15,
            costSnapshot: 10,
          }
        ],
        totalAmount: 0,
        totalProfit: 0,
        status: 'completed',
      },
      {
        id: 'order2',
        timestamp: new Date(2023, 5, 14).getTime(), // Different day
        items: [
          {
            name: '商品B',
            quantity: 1,
            sellPrice: 20,
            costSnapshot: 15,
          }
        ],
        totalAmount: 0,
        totalProfit: 0,
        status: 'completed',
      },
      {
        id: 'order3',
        timestamp: new Date(2023, 5, 15).getTime(), // Same day
        items: [
          {
            name: '商品C',
            quantity: 1,
            sellPrice: 25,
            costSnapshot: 20,
          }
        ],
        totalAmount: 0,
        totalProfit: 0,
        status: 'refunded', // Should be excluded
      }
    ];

    const stats = calculateDailyStats(salesHistory, targetDate);
    
    // Only order1 should be counted (order3 is refunded, order2 is different day)
    expect(stats.count).toBe(1);
    expect(stats.revenue).toBeCloseTo(30, 2); // 15 * 2
    expect(stats.profit).toBeCloseTo(10, 2); // (15 - 10) * 2
    expect(stats.aov).toBeCloseTo(30, 2); // 30 / 1
    expect(stats.marginRate).toBe('33.3'); // (10 / 30) * 100
  });

  it('should handle edge case of zero division in AOV calculation', () => {
    const targetDate = new Date();
    const salesHistory: Order[] = [];

    const stats = calculateDailyStats(salesHistory, targetDate);
    
    expect(stats.count).toBe(0);
    expect(stats.aov).toBe(0); // Should not be NaN or Infinity
  });

  it('should handle edge case of zero revenue in margin rate calculation', () => {
    const targetDate = new Date();
    const salesHistory: Order[] = [
      {
        id: 'order1',
        timestamp: targetDate.getTime(),
        items: [
          {
            name: '商品A',
            quantity: 1,
            sellPrice: 0,
            costSnapshot: 10,
          }
        ],
        totalAmount: 0,
        totalProfit: 0,
        status: 'completed',
      }
    ];

    const stats = calculateDailyStats(salesHistory, targetDate);
    
    expect(stats.revenue).toBe(0);
    expect(stats.marginRate).toBe('0.0'); // Should not be NaN or Infinity
  });

  it('should calculate profit correctly with multiple items in order', () => {
    const order: Order = {
      id: 'order1',
      timestamp: Date.now(),
      items: [
        {
          name: '商品A',
          quantity: 10,
          sellPrice: 1.1,
          costSnapshot: 1.0,
        },
        {
          name: '商品B',
          quantity: 10,
          sellPrice: 1.2,
          costSnapshot: 1.1,
        },
        {
          name: '商品C',
          quantity: 10,
          sellPrice: 1.3,
          costSnapshot: 1.2,
        }
      ],
      totalAmount: 0,
      totalProfit: 0,
      status: 'completed',
    };

    const profit = calculateOrderProfit(order);
    
    // (1.1 - 1.0) * 10 + (1.2 - 1.1) * 10 + (1.3 - 1.2) * 10
    // = 0.1 * 10 + 0.1 * 10 + 0.1 * 10 = 1 + 1 + 1 = 3
    expect(profit).toBeCloseTo(3.0, 10);
  });

  it('should correctly format currency using Decimal.js', () => {
    // 测试 decimal.js 精确计算
    const a = new Decimal(0.1);
    const b = new Decimal(0.2);
    const sum = a.plus(b);
    
    expect(sum.toNumber()).toBeCloseTo(0.3, 10);
    
    // 测试精度计算
    const result = new Decimal(0.1).plus(0.2).minus(0.3);
    expect(result.toNumber()).toBeCloseTo(0, 10);
  });
});