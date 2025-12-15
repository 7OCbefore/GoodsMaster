/**
 * Excel 导出功能 Composable
 * 支持将销售数据、订单汇总、库存快照导出为 .xlsx 格式
 * 使用动态导入避免在初始加载时引入庞大的 xlsx 库
 */
export function useExport() {
  /**
   * 导出综合报表（包含3个Sheet）
   * @param {Object} params - 导出参数
   * @param {Array} params.salesHistory - 销售历史数据
   * @param {Array} params.inventoryList - 库存列表
   * @param {Date} params.selectedDate - 选中日期（可选，用于文件名）
   */
  const exportToExcel = async ({ salesHistory, inventoryList, selectedDate }) => {
    try {
      // 动态导入 xlsx 库
      const XLSX = await import('xlsx');

      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // Sheet 1: 销售流水明细 (Sales Line Items)
      const salesLineItems = generateSalesLineItems(salesHistory);
      const ws1 = XLSX.utils.json_to_sheet(salesLineItems);
      
      // 设置列宽（可选，提升可读性）
      ws1['!cols'] = [
        { wch: 15 }, // 订单号
        { wch: 12 }, // 日期
        { wch: 8 },  // 时间
        { wch: 10 }, // 客户
        { wch: 20 }, // 商品名称
        { wch: 10 }, // 销售单价
        { wch: 10 }, // 成本单价
        { wch: 8 },  // 数量
        { wch: 12 }, // 小计金额
        { wch: 12 }, // 小计毛利
        { wch: 10 }  // 订单状态
      ];
      
      XLSX.utils.book_append_sheet(workbook, ws1, '销售流水明细');

      // Sheet 2: 订单总表 (Orders Summary)
      const ordersSummary = generateOrdersSummary(salesHistory);
      const ws2 = XLSX.utils.json_to_sheet(ordersSummary);
      
      ws2['!cols'] = [
        { wch: 15 }, // 订单号
        { wch: 18 }, // 时间
        { wch: 10 }, // 客户
        { wch: 12 }, // 总金额
        { wch: 12 }, // 总毛利
        { wch: 10 }, // 商品种类数
        { wch: 30 }, // 备注
        { wch: 10 }  // 状态
      ];
      
      XLSX.utils.book_append_sheet(workbook, ws2, '订单总表');

      // Sheet 3: 当前库存快照 (Inventory Snapshot)
      const inventorySnapshot = generateInventorySnapshot(inventoryList);
      const ws3 = XLSX.utils.json_to_sheet(inventorySnapshot);
      
      ws3['!cols'] = [
        { wch: 20 }, // 商品名称
        { wch: 12 }, // 当前库存
        { wch: 12 }, // 平均成本
        { wch: 15 }  // 库存资产值
      ];
      
      XLSX.utils.book_append_sheet(workbook, ws3, '当前库存快照');

      // 生成文件名
      const dateStr = selectedDate 
        ? new Date(selectedDate).toLocaleDateString('zh-CN').replace(/\//g, '-')
        : new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
      const fileName = `GoodsMaster数据导出_${dateStr}.xlsx`;

      // 导出文件
      XLSX.writeFile(workbook, fileName);
      
      return { success: true, fileName };
    } catch (error) {
      console.error('导出失败:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * 生成销售流水明细数据
   * 每一行代表一个订单中的一个商品
   */
  const generateSalesLineItems = (salesHistory) => {
    const items = [];
    
    salesHistory.forEach(order => {
      const orderDate = new Date(order.timestamp);
      const dateStr = orderDate.toLocaleDateString('zh-CN');
      const timeStr = orderDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      order.items.forEach(item => {
        const subtotalAmount = item.sellPrice * item.quantity;
        const subtotalProfit = (item.sellPrice - item.costSnapshot) * item.quantity;
        
        items.push({
          '订单号': order.id,
          '日期': dateStr,
          '时间': timeStr,
          '客户': order.customer || '散客',
          '商品名称': item.name,
          '销售单价': Number(item.sellPrice).toFixed(2),
          '成本单价': Number(item.costSnapshot).toFixed(2),
          '数量': item.quantity,
          '小计金额': Number(subtotalAmount).toFixed(2),
          '小计毛利': Number(subtotalProfit).toFixed(2),
          '订单状态': order.status === 'refunded' ? '已退款' : '已完成'
        });
      });
    });
    
    return items;
  };

  /**
   * 生成订单总表数据
   * 每一行代表一个订单
   */
  const generateOrdersSummary = (salesHistory) => {
    return salesHistory.map(order => ({
      '订单号': order.id,
      '时间': new Date(order.timestamp).toLocaleString('zh-CN'),
      '客户': order.customer || '散客',
      '总金额': Number(order.totalAmount).toFixed(2),
      '总毛利': Number(order.totalProfit).toFixed(2),
      '商品种类数': order.items.length,
      '备注': order.note || '',
      '状态': order.status === 'refunded' ? '已退款' : '已完成'
    }));
  };

  /**
   * 生成库存快照数据
   * 当前时刻的库存状态
   */
  const generateInventorySnapshot = (inventoryList) => {
    return inventoryList.map(item => ({
      '商品名称': item.name,
      '当前库存': item.quantity,
      '平均成本': Number(item.averageCost).toFixed(2),
      '库存资产值': Number(item.quantity * item.averageCost).toFixed(2)
    }));
  };

  return {
    exportToExcel
  };
}
