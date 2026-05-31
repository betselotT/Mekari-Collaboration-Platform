/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async rewrites() {
    // Proxy all /api/* requests to the Express backend so the frontend never
    // makes cross-origin requests — eliminates CORS issues in development.
    const backendUrl =
      process.env.BACKEND_URL ||
      (process.env.VERCEL ? "https://mekari-collaboration-platform.onrender.com" : "http://localhost:4000");
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
