import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import InboxView from '../views/InboxView.vue';
import InventoryView from '../views/InventoryView.vue';
import SalesView from '../views/SalesView.vue';
import SettingsView from '../views/SettingsView.vue';

// 定义路由
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { depth: 0, keepAlive: true }
  },
  {
    path: '/inbox',
    name: 'Inbox',
    component: InboxView,
    meta: { depth: 0, keepAlive: true }
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: InventoryView,
    meta: { depth: 0, keepAlive: true }
  },
  {
    path: '/sales',
    name: 'Sales',
    component: SalesView,
    meta: { depth: 0, keepAlive: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { depth: 0, keepAlive: true }
  },
  // 二级页面示例
  {
    path: '/order/:id',
    name: 'OrderDetail',
    component: () => import('../views/OrderDetailView.vue'), // 懒加载
    meta: { depth: 1 }
  },
  {
    path: '/product/:id',
    name: 'ProductDetail',
    component: () => import('../views/ProductDetailView.vue'), // 懒加载
    meta: { depth: 1 }
  }
];

// 创建路由实例
const router = createRouter({
  // 使用 Hash 模式，适用于 GitHub Pages 部署
  history: createWebHashHistory('/GoodsMaster/'),
  routes
});

export default router;