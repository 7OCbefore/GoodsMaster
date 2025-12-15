import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// 使用函数形式，解构出 command 参数
export default defineConfig(({ command }) => {
  // 判断当前是在开发环境(serve) 还是 构建环境(build)
  const isProduction = command === 'build';

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    base: './', 
  }
})

