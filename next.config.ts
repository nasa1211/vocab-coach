import type { NextConfig } from 'next';
// next-pwa 등의 설정이 있는 경우
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  // 💡 아래 turbopack: {} 항목을 추가하여 Turbopack 관련 경고/에러를 무시하도록 합니다.
  turbopack: {},
};

module.exports = withPWA(nextConfig);