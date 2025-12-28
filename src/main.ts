import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { migrateFromLocalStorage, normalizeRecordIds } from './db/migration'

// 引入 Phosphor Icons 的核心 CSS
// 这行代码会引入所有基础样式，无需再引入 bold/fill 等单独文件
// import '@phosphor-icons/web/css/regular.css'
// import '@phosphor-icons/web/css/bold.css'
// import '@phosphor-icons/web/css/fill.css'
// import '@phosphor-icons/web/css/duotone.css'

async function bootstrap() {
  try {
    // 执行数据迁移（如果需要）
    await migrateFromLocalStorage();
    await normalizeRecordIds();
  } catch (error) {
    console.error('启动失败:', error);
    // 迁移失败时仍然启动应用，但用户可能看不到数据
    // 可以考虑显示错误提示，这里简单继续启动
  }

  createApp(App).use(router).mount('#app');
}

bootstrap();
