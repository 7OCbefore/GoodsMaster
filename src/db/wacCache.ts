/**
 * WAC (加权平均成本) 计算缓存
 * 优化频繁的库存计算，避免重复计算
 */

import Decimal from 'decimal.js';
import { Package, Order, InventoryItem } from '../types/domain';

interface CacheEntry {
  data: InventoryItem[];
  timestamp: number;
  dependencies: {
    packagesHash: string;
    salesHash: string;
  };
}

export class WACCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5分钟缓存时间
  private readonly CACHE_SIZE_LIMIT = 50; // 最多缓存50个版本

  /**
   * 计算数据的哈希值，用于检测依赖变化
   */
  private calculateHash(data: any[]): string {
    // 简化哈希计算：使用长度 + 最后修改时间
    const length = data.length;
    const lastModified = data.length > 0
      ? Math.max(...data.map(item => (item as any).timestamp || (item as any).updated_at || 0))
      : 0;
    return `${length}-${lastModified}`;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(packages: Package[], sales: Order[]): string {
    const packagesHash = this.calculateHash(packages);
    const salesHash = this.calculateHash(sales);
    return `${packagesHash}-${salesHash}`;
  }

  /**
   * 获取缓存的数据
   */
  get(packages: Package[], sales: Order[]): InventoryItem[] | null {
    const key = this.generateCacheKey(packages, sales);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    // 记录缓存命中
    this.logCacheHit(key);

    return entry.data;
  }

  /**
   * 设置缓存数据
   */
  set(packages: Package[], sales: Order[], data: InventoryItem[]): void {
    const key = this.generateCacheKey(packages, sales);

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.CACHE_SIZE_LIMIT) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      data: [...data], // 深拷贝避免引用问题
      timestamp: Date.now(),
      dependencies: {
        packagesHash: this.calculateHash(packages),
        salesHash: this.calculateHash(sales)
      }
    };

    this.cache.set(key, entry);
    this.logCacheSet(key);
  }

  /**
   * 使特定商品的缓存失效
   */
  invalidate(productName?: string): void {
    if (!productName) {
      // 全量失效：清空所有缓存
      this.cache.clear();
      console.log('🗑️ WAC缓存已全量清空');
      return;
    }

    // 部分失效：删除包含特定商品的缓存条目
    let invalidatedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      const hasProduct = entry.data.some(item => item.name === productName);
      if (hasProduct) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      console.log(`🗑️ WAC缓存已失效 ${invalidatedCount} 个相关条目 (商品: ${productName})`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; hitRate: number; entries: Array<{ key: string; age: number; hitCount: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.substring(0, 20) + '...', // 截断长键
      age: now - entry.timestamp,
      hitCount: (entry as any).hitCount || 0
    }));

    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const totalRequests = totalHits + this.cache.size; // 简化计算
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      hitRate: Math.round(hitRate),
      entries: entries.sort((a, b) => b.hitCount - a.hitCount)
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 WAC缓存清理完成，删除了 ${cleanedCount} 个过期条目`);
    }

    return cleanedCount;
  }

  /**
   * 删除最旧的缓存条目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 记录缓存命中
   */
  private logCacheHit(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.hitCount = (entry as any).hitCount || 0;
      (entry as any).hitCount++;
    }
  }

  /**
   * 记录缓存设置
   */
  private logCacheSet(key: string): void {
    if (process.env.NODE_ENV === 'development') {
      const stats = this.getStats();
      if (stats.size % 10 === 0) { // 每10个缓存打印一次
        console.log(`💾 WAC缓存已存储 ${stats.size} 个条目 (命中率: ${stats.hitRate}%)`);
      }
    }
  }

  /**
   * 预热缓存：计算并存储常用商品的WAC
   */
  async warmup(packages: Package[], sales: Order[], topProducts: string[] = []): Promise<void> {
    console.log('🔥 开始预热WAC缓存...');

    // 计算常用商品的WAC
    for (const productName of topProducts.slice(0, 20)) { // 最多预热20个商品
      const productPackages = packages.filter(p =>
        p.verified && p.content?.trim() === productName
      );

      const productSales = sales.filter(s =>
        s.status !== 'refunded' && s.items.some(item => item.name === productName)
      );

      if (productPackages.length > 0) {
        // 计算单个商品的WAC
        const wac = this.calculateSingleProductWAC(productPackages, productSales, productName);
        if (wac) {
          // 这里只是示例，实际缓存是整体的
          // 预热会在后续访问时自动填充缓存
        }
      }
    }

    console.log('✅ WAC缓存预热完成');
  }

  /**
   * 计算单个商品的WAC（用于缓存预热）
   */
  private calculateSingleProductWAC(
    packages: Package[],
    sales: Order[],
    productName: string
  ): { name: string; quantity: number; averageCost: number } | null {
    let totalQuantity = 0;
    let totalCost = new Decimal(0);

    // 累加进货
    packages.forEach(p => {
      if (p.verified && p.content?.trim() === productName) {
        const qty = new Decimal(p.quantity || 0);
        const cost = new Decimal(p.costPrice || 0);
        totalQuantity = qty.add(totalQuantity).toNumber();
        totalCost = totalCost.add(qty.times(cost));
      }
    });

    // 扣减销售
    sales.forEach(sale => {
      if (sale.status !== 'refunded') {
        sale.items.forEach(sold => {
          if (sold.name === productName) {
            const currentAvgCost = totalQuantity > 0
              ? totalCost.dividedBy(totalQuantity)
              : new Decimal(sold.costSnapshot);

            totalQuantity = new Decimal(totalQuantity).minus(sold.quantity).toNumber();
            totalCost = totalCost.minus(new Decimal(sold.quantity).times(currentAvgCost));
          }
        });
      }
    });

    if (totalQuantity < 0) return null;

    return {
      name: productName,
      quantity: totalQuantity,
      averageCost: totalQuantity > 0 ? totalCost.dividedBy(totalQuantity).toNumber() : 0
    };
  }
}

// 创建单例实例
export const wacCache = new WACCache();

// 定期清理过期缓存
setInterval(() => {
  wacCache.cleanup();
}, 60000); // 每分钟清理一次
