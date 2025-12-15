import { db } from './index';
import { Product, Package, Order } from '../types/domain';

/**
 * 迁移到Product主数据模型
 * 此函数应在应用启动时调用，确保数据迁移完成后再渲染UI
 * 幂等设计：如果products表已有数据，则跳过迁移
 */
export async function migrateDataStructure(): Promise<void> {
  try {
    // 检查是否已经迁移（products表有数据）
    const productCount = await db.products.count();
    if (productCount > 0) {
      console.log('Product数据模型已迁移，跳过');
      return;
    }

    console.log('开始迁移到Product主数据模型...');

    // 获取全局用户ID（用于云端同步）
    const globalUserId = import.meta.env.VITE_GLOBAL_USER_ID || 'local-user';

    // 1. Extract: 从goods表获取所有商品名称
    const goodsRecords = await db.goods.toArray();
    const goodsNames = goodsRecords.map(g => g.name).filter(name => name.trim());

    // 从sellPrices表获取价格映射
    const sellPriceRecords = await db.sellPrices.toArray();
    const priceMap = new Map<string, number>();
    sellPriceRecords.forEach(record => {
      priceMap.set(record.goodsName, record.price);
    });

    // 从packages表获取所有商品名称（防止有商品不在goods表中）
    const packages = await db.packages.toArray();
    const packageGoodsNames = packages.map(p => p.content).filter(name => name.trim());

    // 合并所有商品名称并去重
    const allGoodsNames = Array.from(new Set([...goodsNames, ...packageGoodsNames]));

    if (allGoodsNames.length === 0) {
      console.log('没有找到商品数据，跳过迁移');
      return;
    }

    console.log(`找到 ${allGoodsNames.length} 个唯一商品`);

    // 2. Transform: 为每个商品创建Product对象
    const products: Product[] = [];
    const productNameToId = new Map<string, string>();

    for (const name of allGoodsNames) {
      const id = crypto.randomUUID();
      const price = priceMap.get(name) || 0; // 默认价格为0，后续可手动设置

      const product: Product = {
        id,
        user_id: globalUserId,
        name,
        price,
        stock_warning: 5, // 默认预警阈值
        updated_at: new Date().toISOString(),
        is_deleted: false
      };

      products.push(product);
      productNameToId.set(name, id);
    }

    // 3. Load: 批量写入products表
    await db.products.bulkAdd(products);
    console.log(`成功创建 ${products.length} 个Product记录`);

    // 4. Re-link: 更新packages表，添加productId
    let updatedPackagesCount = 0;
    for (const pkg of packages) {
      const productId = productNameToId.get(pkg.content);
      if (productId && !pkg.productId) {
        await db.packages.update(pkg.id!, { productId });
        updatedPackagesCount++;
      }
    }
    console.log(`更新了 ${updatedPackagesCount} 个Package记录的productId`);

    // 5. 可选：更新sales表中的OrderItem，添加productId
    // 注意：sales表中的items是JSON数组，需要解析和更新
    const sales = await db.sales.toArray();
    let updatedSalesCount = 0;
    let updatedItemsCount = 0;

    for (const sale of sales) {
      const items = sale.items;
      let hasUpdates = false;

      const updatedItems = items.map(item => {
        const productId = productNameToId.get(item.name);
        if (productId && !item.productId) {
          hasUpdates = true;
          return { ...item, productId };
        }
        return item;
      });

      if (hasUpdates) {
        await db.sales.update(sale.id, { items: updatedItems });
        updatedSalesCount++;
        updatedItemsCount += updatedItems.filter(item => item.productId).length;
      }
    }

    console.log(`更新了 ${updatedSalesCount} 个Sales记录，共 ${updatedItemsCount} 个OrderItem`);

    console.log('Product数据模型迁移完成');
  } catch (error) {
    console.error('Product数据模型迁移失败:', error);
    throw error;
  }
}