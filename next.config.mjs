/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export — the app has no server component. Deploy the `out/`
  // directory to any static host (GitHub Pages, Netlify, Cloudflare Pages…).
  output: 'export',
  // emit route/index.html so plain static hosts serve /about/ correctly
  trailingSlash: true,
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs imports node:fs / node:https for its Node target; in the
      // browser those paths are dead code, so stub them out of the bundle.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
      };
    }
    return config;
  },
};

export default nextConfig;
