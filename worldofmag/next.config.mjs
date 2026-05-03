const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverActions: {
      allowedOrigins: ["localhost:3000", "worldofmag.onrender.com"],
    },
  },
};

export default nextConfig;
