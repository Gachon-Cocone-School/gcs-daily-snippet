/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    domains: ['lh3.googleusercontent.com'], // Google 프로필 이미지 도메인 추가
  },
};

export default config;