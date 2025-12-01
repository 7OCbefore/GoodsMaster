/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0F172A', // 黑曜石色
        accent: '#F59E0B',  // 黑金色
        surface: '#F8FAFC', // 背景色
      }
    },
  },
  plugins: [],
}