import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import { supabase } from '../services/supabase';

// 定义路由
const routes: Array<RouteRecordRaw> = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { depth: 0, keepAlive: true, requiresAuth: false }
  },
  {
    path: '/inbox',
    name: 'Inbox',
    component: () => import('../views/InboxView.vue'),
    meta: { depth: 0, keepAlive: true, requiresAuth: false }
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('../views/InventoryView.vue'),
    meta: { depth: 0, keepAlive: true, requiresAuth: false }
  },
  {
    path: '/sales',
    name: 'Sales',
    component: () => import('../views/SalesView.vue'),
    meta: { depth: 0, keepAlive: true, requiresAuth: false }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { depth: 0, keepAlive: true, requiresAuth: false }
  },
  // 二级页面示例
  {
    path: '/order/:id',
    name: 'OrderDetail',
    component: () => import('../views/OrderDetailView.vue'), // 懒加载
    meta: { depth: 1, requiresAuth: false }
  },
  {
    path: '/product/:id',
    name: 'ProductDetail',
    component: () => import('../views/ProductDetailView.vue'), // 懒加载
    meta: { depth: 1, requiresAuth: false }
  }
];

// 创建路由实例
const router = createRouter({
  // 使用 Hash 模式，适用于 GitHub Pages 部署
  history: createWebHashHistory('/GoodsMaster/'),
  routes
});

// 全局前置守卫
router.beforeEach(async (to, from, next) => {
  // 检查路由是否需要身份验证
  const requiresAuth = to.meta.requiresAuth !== false;
  
  if (requiresAuth && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // 如果需要身份验证但用户未登录，则重定向到登录页
      next({
        path: '/login',
        query: { redirect: to.fullPath }  // 保存目标路径
      });
    } else {
      // 用户已登录，继续导航
      next();
    }
  } else {
    // 不需要身份验证或supabase未配置，继续导航
    next();
  }
});

export default router;