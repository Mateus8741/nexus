import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Pacotes internos do monorepo consumidos como TypeScript "cru" (sem
   * etapa de build própria). O Next precisa transpilá-los explicitamente
   * porque eles vivem fora de apps/web.
   */
  transpilePackages: [
    "@nexus/ui",
    "@nexus/domain",
    "@nexus/application",
    "@nexus/infrastructure",
    "@nexus/auth",
    "@nexus/db",
  ],
  /**
   * Gera `.next/standalone`: um server.js autocontido com só os arquivos e
   * node_modules realmente usados em produção — a imagem Docker (ver
   * Dockerfile) copia só isso, em vez do monorepo inteiro.
   */
  output: "standalone",
};

export default nextConfig;
