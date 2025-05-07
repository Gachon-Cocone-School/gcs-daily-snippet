/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

// Log the PORT environment variable to debug
console.log("Environment PORT:", process.env.PORT);

/** @type {import("next").NextConfig} */
const config = {
  images: {
    domains: ["lh3.googleusercontent.com"], // Google 프로필 이미지 도메인 추가
  },
  eslint: {
    // 빌드 시 경고는 무시하고 에러만 처리합니다
    ignoreDuringBuilds: true,
  },
};

export default config;
