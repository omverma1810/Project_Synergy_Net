/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/auth/login',
        destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/auth/login/`,
      },
      {
        source: '/api/auth/register',
        destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/auth/register/`,
      },
      {
        source: '/api/auth/token/refresh',
        destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/auth/token/refresh/`,
      },
      {
        source: '/api/auth/me',
        destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/auth/me/`,
      },
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
