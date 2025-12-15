/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 定义新的 "Premium Dark" 色系
        primary: '#1C1C1E', // 苹果风格深黑
        secondary: '#2C2C2E', // 浅一点的黑，用于卡片
        accent: '#0A84FF', // iOS 蓝，或者你可以改成 '#F59E0B' (琥珀金)
        surface: '#F2F2F7', // iOS 默认背景灰
        danger: '#FF453A',
        success: '#32D74B',
        warning: '#FF9F0A',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Helvetica Neue', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      }
    },
  },
  plugins: [],
}