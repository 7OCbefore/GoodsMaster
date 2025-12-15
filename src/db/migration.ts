import { db } from './index';
import { Package, Order } from '../types/domain';

/**
 * 从LocalStorage迁移数据到IndexedDB
 * 此函数应在应用启动时调用，确保数据迁移完成后再渲染UI
 */
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    // 检查数据库是否已有数据（任意表有数据即认为已迁移）
    const [packageCount, salesCount, goodsCount, sellPricesCount] = await Promise.all([
      db.packages.count(),
      db.sales.count(),
      db.goods.count(),
      db.sellPrices.count()
    ]);

    const hasData = packageCount > 0 || salesCount > 0 || goodsCount > 0 || sellPricesCount > 0;
    if (hasData) {
      console.log('数据库已有数据，跳过迁移');
      return;
    }

    console.log('开始从LocalStorage迁移数据...');

    // 从LocalStorage读取数据
    const packagesJson = localStorage.getItem('tm_packages');
    const goodsListJson = localStorage.getItem('tm_goods_list');
    const salesHistoryJson = localStorage.getItem('tm_sales_history');
    const sellPricesJson = localStorage.getItem('tm_sell_prices');

    // 如果没有LocalStorage数据，也跳过迁移
    if (!packagesJson && !goodsListJson && !salesHistoryJson && !sellPricesJson) {
      console.log('LocalStorage中无数据，跳过迁移');
      return;
    }

    // 迁移packages
    if (packagesJson) {
      const packages: Package[] = JSON.parse(packagesJson);
      if (packages.length > 0) {
        const packageRecords = packages.map(pkg => {
          // 确保每个package都有id，如果没有则生成一个
          const id = pkg.id || generateId();
          return { ...pkg, id };
        });
        await db.packages.bulkAdd(packageRecords);
        console.log(`迁移 ${packageRecords.length} 条进货记录`);
      }
    }

    // 迁移sales
    if (salesHistoryJson) {
      const sales: Order[] = JSON.parse(salesHistoryJson);
      if (sales.length > 0) {
        await db.sales.bulkAdd(sales);
        console.log(`迁移 ${sales.length} 条销售记录`);
      }
    }

    // 迁移goods list (字符串数组转换为GoodsRecord数组)
    if (goodsListJson) {
      const goodsList: string[] = JSON.parse(goodsListJson);
      if (goodsList.length > 0) {
        // 去重处理
        const uniqueGoods = Array.from(new Set(goodsList.filter(name => name.trim())));
        const goodsRecords = uniqueGoods.map(name => ({ name }));
        await db.goods.bulkAdd(goodsRecords);
        console.log(`迁移 ${goodsRecords.length} 个商品（已去重）`);
      }
    }

    // 迁移sell prices (Record<string, number>转换为SellPriceRecord数组)
    if (sellPricesJson) {
      const sellPrices: Record<string, number> = JSON.parse(sellPricesJson);
      const entries = Object.entries(sellPrices);
      if (entries.length > 0) {
        const sellPriceRecords = entries.map(([goodsName, price]) => ({ goodsName, price }));
        await db.sellPrices.bulkAdd(sellPriceRecords);
        console.log(`迁移 ${sellPriceRecords.length} 个商品价格`);
      }
    }

    // 迁移完成，清理LocalStorage
    localStorage.removeItem('tm_packages');
    localStorage.removeItem('tm_goods_list');
    localStorage.removeItem('tm_sales_history');
    localStorage.removeItem('tm_sell_prices');

    console.log('数据迁移完成，LocalStorage已清理');
  } catch (error) {
    console.error('数据迁移失败:', error);
    throw error;
  }
}

/**
 * 生成唯一ID (简化版，使用时间戳加随机数)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}