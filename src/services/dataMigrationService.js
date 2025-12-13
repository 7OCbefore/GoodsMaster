import { supabase } from '../lib/supabaseClient';

/**
 * Migrate localStorage data to Supabase
 * @param {string} userId - The authenticated user ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function migrateLocalStorageToSupabase(userId) {
  try {
    // Check if user already has data in Supabase
    const { data: existingPackages, error: packagesError } = await supabase
      .from('packages')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (packagesError) {
      console.error('Error checking existing packages:', packagesError);
      return { success: false, message: '检查现有数据时出错' };
    }

    // If user already has data, don't migrate
    if (existingPackages && existingPackages.length > 0) {
      return { success: true, message: '数据已存在，无需迁移' };
    }

    // Get data from localStorage
    const packages = JSON.parse(localStorage.getItem('tm_packages') || '[]');
    const goodsList = JSON.parse(localStorage.getItem('tm_goods_list') || '[]');
    const salesHistory = JSON.parse(localStorage.getItem('tm_sales_history') || '[]');
    const sellPrices = JSON.parse(localStorage.getItem('tm_sell_prices') || '{}');

    // Migrate packages
    if (packages.length > 0) {
      const packagesWithUserId = packages.map(pkg => ({
        ...pkg,
        user_id: userId,
        // Ensure proper data types
        quantity: parseInt(pkg.quantity) || 0,
        cost_price: parseFloat(pkg.costPrice) || 0,
        verified: Boolean(pkg.verified),
        timestamp: pkg.timestamp ? parseInt(pkg.timestamp) : Date.now()
      }));

      const { error } = await supabase
        .from('packages')
        .insert(packagesWithUserId);

      if (error) {
        console.error('Error migrating packages:', error);
        return { success: false, message: '迁移进货数据时出错' };
      }
    }

    // Migrate goods list
    if (goodsList.length > 0) {
      const goodsWithUserId = goodsList.map(name => ({
        user_id: userId,
        name: name,
        category: '未分类',
        unit: '件'
      }));

      const { error } = await supabase
        .from('goods_list')
        .insert(goodsWithUserId);

      if (error) {
        console.error('Error migrating goods list:', error);
        return { success: false, message: '迁移商品列表时出错' };
      }
    }

    // Migrate sales history
    if (salesHistory.length > 0) {
      const salesWithUserId = salesHistory.map(sale => ({
        ...sale,
        user_id: userId,
        id: sale.id.toString(),
        timestamp: sale.timestamp.toString(),
        total_amount: parseFloat(sale.totalAmount) || 0,
        total_profit: parseFloat(sale.totalProfit) || 0,
        items: sale.items.map(item => ({
          ...item,
          quantity: parseInt(item.quantity) || 0,
          sellPrice: parseFloat(item.sellPrice) || 0,
          costSnapshot: parseFloat(item.costSnapshot) || 0
        }))
      }));

      const { error } = await supabase
        .from('sales_history')
        .insert(salesWithUserId);

      if (error) {
        console.error('Error migrating sales history:', error);
        return { success: false, message: '迁移销售记录时出错' };
      }
    }

    // Migrate sell prices
    const priceEntries = Object.entries(sellPrices);
    if (priceEntries.length > 0) {
      const pricesWithUserId = priceEntries.map(([goods_name, price]) => ({
        user_id: userId,
        goods_name: goods_name,
        price: parseFloat(price) || 0
      }));

      const { error } = await supabase
        .from('sell_prices')
        .insert(pricesWithUserId);

      if (error) {
        console.error('Error migrating sell prices:', error);
        return { success: false, message: '迁移售价数据时出错' };
      }
    }

    return { success: true, message: '数据迁移成功' };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, message: '数据迁移过程中发生错误' };
  }
}

/**
 * Clear localStorage after successful migration
 */
export function clearLocalStorageAfterMigration() {
  localStorage.removeItem('tm_packages');
  localStorage.removeItem('tm_goods_list');
  localStorage.removeItem('tm_sales_history');
  localStorage.removeItem('tm_sell_prices');
}