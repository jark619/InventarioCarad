/** @type {import('next').NextConfig} */
const nextConfig = { distDir: '.build', images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] } };
export default nextConfig;
