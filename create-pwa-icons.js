// 简单的 PWA 图标生成脚本
// 由于我们没有图像处理库，我们将创建一个基本的 SVG 图标并转换为不同尺寸的 PNG

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建一个简单的 SVG 图标
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0A84FF" rx="64" ry="64"/>
  <path d="M128 128h256v64H128zM128 256h256v64H128zM128 384h128v64H128z" fill="white" opacity="0.9"/>
  <text x="50%" y="80" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle">GM</text>
</svg>`;

// 将 SVG 内容写入文件
fs.writeFileSync(path.join(__dirname, 'public', 'pwa-icon.svg'), svgContent);

console.log('PWA SVG 图标已创建');
console.log('注意：实际部署时您需要使用图像处理库（如 sharp）来生成不同尺寸的 PNG 图标');
console.log('或者使用在线 PWA 图标生成器创建 192x192 和 512x512 的 PNG 图标');