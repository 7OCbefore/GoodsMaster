import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'

// 引入 Phosphor Icons 的核心 CSS
// 这行代码会引入所有基础样式，无需再引入 bold/fill 等单独文件
// import '@phosphor-icons/web/css/regular.css'
// import '@phosphor-icons/web/css/bold.css'
// import '@phosphor-icons/web/css/fill.css'
// import '@phosphor-icons/web/css/duotone.css'

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    // We'll define routes as needed
  ]
})

createApp(App).use(router).mount('#app')