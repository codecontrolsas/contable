import type { NextConfig } from "next";
import { instanceConfig } from "./instance.config";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Aumentar límite de body para Server Actions (subida de archivos)
  // El límite de storage es 10MB, ponemos 12MB para incluir overhead
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  // Configuración de imágenes remotas
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: String(instanceConfig.ports.minioApi), // MinIO local
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
