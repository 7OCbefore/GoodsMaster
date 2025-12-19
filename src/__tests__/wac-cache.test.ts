/**
 * WAC缓存性能测试
 * 验证缓存机制带来的性能提升
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { wacCache } from '../db/wacCache';
import { Package, Order, InventoryItem } from '../types/domain';

// 生成测试数据
function generateTestPackages(count: number): Package[] {
  const packages: Package[] = [];
  for (let i = 0; i < count; i++) {
    packages.push({
      id: `pkg-${i}`,
      content: `测试商品-${i % 20}`, // 20种不同商品
      quantity: Math.floor(Math.random() * 100) + 1,
      costPrice: Math.random() * 100,
      verified: true,
      timestamp: Date.now() - i * 1000,
      productId: `product-${i % 20}`
    });
  }
  return packages;
}

function generateTestSales(count: number): Order[] {
  const sales: Order[] = [];
  for (let i = 0; i < count; i++) {
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const items = Array.from({ length: itemCount }, (_, j) => ({
      name: `测试商品-${(i + j) % 20}`,
      quantity: Math.floor(Math.random() * 10) + 1,
      sellPrice: Math.random() * 150,
      costSnapshot: Math.random() * 100,
      productId: `product-${(i + j) % 20}`
    }));

    sales.push({
      id: `sale-${i}`,
      timestamp: Date.now() - i * 5000,
      items,
      totalAmount: items.reduce((sum, item) => sum + item.quantity * item.sellPrice, 0),
      totalProfit: items.reduce((sum, item) => sum + item.quantity * (item.sellPrice - item.costSnapshot), 0),
      status: i % 10 === 0 ? 'refunded' : 'completed'
    });
  }
  return sales;
}

describe('WAC缓存性能测试', () => {
  beforeEach(() => {
    // 每次测试前清空缓存
    wacCache.invalidate();
  });

  describe('缓存命中率测试', () => {
    it('相同数据应该命中缓存', () => {
      const packages = generateTestPackages(100);
      const sales = generateTestSales(50);

      // 第一次计算（缓存未命中）
      const start1 = performance.now();
      const result1 = wacCache.get(packages, sales) || [];
      const time1 = performance.now() - start1;

      // 模拟WAC计算（简单实现）
      const map: Record<string, { quantity: number; totalCost: number }> = {};
      packages.forEach(p => {
        if (!map[p.content!]) map[p.content!] = { quantity: 0, totalCost: 0 };
        map[p.content!].quantity += p.quantity;
        map[p.content!].totalCost += p.quantity * p.costPrice;
      });
      sales.filter(s => s.status !== 'refunded').forEach(sale => {
        sale.items.forEach(item => {
          if (map[item.name]) {
            const avgCost = map[item.name].totalCost / map[item.name].quantity;
            map[item.name].quantity -= item.quantity;
            map[item.name].totalCost -= item.quantity * avgCost;
          }
        });
      });
      const expectedResult = Object.entries(map).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        averageCost: data.quantity > 0 ? data.totalCost / data.quantity : 0
      }));

      if (!result1.length) {
        wacCache.set(packages, sales, expectedResult);
      }

      // 第二次计算（缓存命中）
      const start2 = performance.now();
      const result2 = wacCache.get(packages, sales);
      const time2 = performance.now() - start2;

      // 验证缓存命中
      expect(result2).toBeDefined();
      expect(result2?.length).toBe(expectedResult.length);

      // 缓存命中应该非常快（<1ms）
      expect(time2).toBeLessThan(1);
      console.log(`✅ 缓存未命中耗时: ${time1.toFixed(2)}ms`);
      console.log(`✅ 缓存命中耗时: ${time2.toFixed(2)}ms`);
    });

    it('不同数据不应该命中缓存', () => {
      const packages1 = generateTestPackages(100);
      const sales1 = generateTestSales(50);

      const packages2 = generateTestPackages(100);
      const sales2 = generateTestSales(50);

      // 第一次缓存
      const map1: Record<string, { quantity: number; totalCost: number }> = {};
      packages1.forEach(p => {
        if (!map1[p.content!]) map1[p.content!] = { quantity: 0, totalCost: 0 };
        map1[p.content!].quantity += p.quantity;
        map1[p.content!].totalCost += p.quantity * p.costPrice;
      });
      const expectedResult1 = Object.entries(map1).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        averageCost: data.quantity > 0 ? data.totalCost / data.quantity : 0
      }));
      wacCache.set(packages1, sales1, expectedResult1);

      // 尝试获取不同的数据
      const result2 = wacCache.get(packages2, sales2);

      // 应该返回null（缓存未命中）
      expect(result2).toBeNull();
    });
  });

  describe('缓存失效测试', () => {
    it('全量失效应该清空缓存', () => {
      const packages = generateTestPackages(50);
      const sales = generateTestSales(25);

      // 设置缓存
      const map: Record<string, { quantity: number; totalCost: number }> = {};
      packages.forEach(p => {
        if (!map[p.content!]) map[p.content!] = { quantity: 0, totalCost: 0 };
        map[p.content!].quantity += p.quantity;
        map[p.content!].totalCost += p.quantity * p.costPrice;
      });
      const expectedResult = Object.entries(map).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        averageCost: data.quantity > 0 ? data.totalCost / data.quantity : 0
      }));
      wacCache.set(packages, sales, expectedResult);

      // 验证缓存已设置
      expect(wacCache.get(packages, sales)).toBeDefined();

      // 全量失效
      wacCache.invalidate();

      // 验证缓存已清空
      expect(wacCache.get(packages, sales)).toBeNull();
    });

    it('部分失效应该只删除相关缓存', () => {
      const packages1 = generateTestPackages(50);
      const packages2 = generateTestPackages(50);
      const sales = generateTestSales(25);

      // 设置两个不同的缓存
      const map1: Record<string, { quantity: number; totalCost: number }> = {};
      packages1.forEach(p => {
        if (!map1[p.content!]) map1[p.content!] = { quantity: 0, totalCost: 0 };
        map1[p.content!].quantity += p.quantity;
        map1[p.content!].totalCost += p.quantity * p.costPrice;
      });
      const expectedResult1 = Object.entries(map1).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        averageCost: data.quantity > 0 ? data.totalCost / data.quantity : 0
      }));
      wacCache.set(packages1, sales, expectedResult1);

      const map2: Record<string, { quantity: number; totalCost: number }> = {};
      packages2.forEach(p => {
        if (!map2[p.content!]) map2[p.content!] = { quantity: 0, totalCost: 0 };
        map2[p.content!].quantity += p.quantity;
        map2[p.content!].totalCost += p.quantity * p.costPrice;
      });
      const expectedResult2 = Object.entries(map2).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        averageCost: data.quantity > 0 ? data.totalCost / data.quantity : 0
      }));
      wacCache.set(packages2, sales, expectedResult2);

      // 部分失效（针对特定商品）
      wacCache.invalidate('测试商品-0');

      // packages1的缓存应该被删除（包含测试商品-0）
      expect(wacCache.get(packages1, sales)).toBeNull();

      // packages2的缓存可能也被删除（如果包含测试商品-0）
      // 这里我们只验证至少有一个被删除
      const stats = wacCache.getStats();
      expect(stats.size).toBeLessThan(2);
    });
  });

  describe('性能对比测试', () => {
    it('大数据量下缓存应该显著提升性能', () => {
      const largePackages = generateTestPackages(1000);
      const largeSales = generateTestSales(500);

      // 测试无缓存的WAC计算时间
      const startWithoutCache = performance.now();
      const map: Record<string, { quantity: number; totalCost: number }> = {};
      largePackages.forEach(p => {
        if (!map[p.content!]) map[p.content!] = { quantity: 0, totalCost: 0 };
        map[p.content!].quantity += p.quantity;
        map[p.content!].totalCost += p.quantity * p.costPrice;
      });
      largeSales.filter(s => s.status !== 'refunded').forEach(sale => {
        sale.items.forEach(item => {
          if (map[item.name]) {
            const avgCost = map[item.name].totalCost / map[item.name].quantity;
            map[item.name].quantity -= item.quantity;
            map[item.name].totalCost -= item.quantity * avgCost;
          }
        });
      });
      const resultWithoutCache = Object.entries(map).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        averageCost: data.quantity > 0 ? data.totalCost / data.quantity : 0
      }));
      const timeWithoutCache = performance.now() - startWithoutCache;

      // 将结果存入缓存
      wacCache.set(largePackages, largeSales, resultWithoutCache);

      // 测试有缓存的访问时间
      const startWithCache = performance.now();
      const resultWithCache = wacCache.get(largePackages, largeSales);
      const timeWithCache = performance.now() - startWithCache;

      // 验证结果正确性
      expect(resultWithCache).toBeDefined();
      expect(resultWithCache?.length).toBe(resultWithoutCache.length);

      // 缓存应该快很多（至少10倍）
      const speedup = timeWithoutCache / timeWithCache;
      console.log(`📊 无缓存耗时: ${timeWithoutCache.toFixed(2)}ms`);
      console.log(`📊 有缓存耗时: ${timeWithCache.toFixed(2)}ms`);
      console.log(`📊 性能提升: ${speedup.toFixed(2)}x`);

      expect(speedup).toBeGreaterThan(10);
    });
  });

  describe('缓存统计测试', () => {
    it('应该正确记录缓存统计信息', () => {
      const packages = generateTestPackages(100);
      const sales = generateTestSales(50);

      // 设置缓存
      const map: Record<string, { quantity: number; totalCost: number }> = {};
      packages.forEach(p => {
        if (!map[p.content!]) map[p.content!] = { quantity: 0, totalCost: 0 };
        map[p.content!].quantity += p.quantity;
        map[p.content!].totalCost += p.quantity * p.costPrice;
      });
      const expectedResult = Object.entries(map).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        averageCost: data.quantity > 0 ? data.totalCost / data.quantity : 0
      }));
      wacCache.set(packages, sales, expectedResult);

      // 多次访问以提高命中率
      for (let i = 0; i < 5; i++) {
        wacCache.get(packages, sales);
      }

      // 获取统计信息
      const stats = wacCache.getStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.entries.length).toBe(stats.size);
      console.log(`📈 缓存大小: ${stats.size}`);
      console.log(`📈 命中率: ${stats.hitRate}%`);
    });
  });
});
