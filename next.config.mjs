/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure server components can import pg correctly
  serverExternalPackages: ["pg"],
};

export default nextConfig;
