/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        path: false,
        fs: false,
        os: false,
        stream: false,
        buffer: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
