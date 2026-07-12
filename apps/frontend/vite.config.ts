import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routeFileIgnorePattern: ".server.",
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // Rotas com prefixo /api → backend Fastify (porta 3333)
      // configure() desabilita bufferização para SSE (text/event-stream)
      "/api": {
        target: "http://localhost:3333",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const ct = proxyRes.headers["content-type"] ?? "";
            if (ct.includes("text/event-stream")) {
              // Desativa compressão e bufferização para SSE
              proxyRes.headers["cache-control"] = "no-cache";
              delete proxyRes.headers["content-encoding"];
            }
          });
        },
      },
      // Rotas de auth/users (backend NÃO tem prefixo /api)
      "/auth": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
      "/users": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
    },
  },
});
