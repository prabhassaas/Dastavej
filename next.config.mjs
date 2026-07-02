/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export — the app has no server component. Deploy the `out/`
  // directory to any static host (GitHub Pages, Netlify, Cloudflare Pages…).
  output: 'export',
  reactStrictMode: true,
};

export default nextConfig;
