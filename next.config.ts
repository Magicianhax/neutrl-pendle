import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static optimization where possible
  reactStrictMode: true,
  
  // For Vercel/Netlify deployment with API routes
  // API routes work as serverless functions on these platforms
  
  // If you need pure static export (GitHub Pages), uncomment below
  // and move API calls to client-side:
  // output: "export",
};

export default nextConfig;
