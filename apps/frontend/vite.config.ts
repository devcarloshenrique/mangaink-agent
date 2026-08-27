import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// Portas configuráveis por env (worktrees/instâncias paralelas).
// Padrões mantidos: backend 3333, frontend 5173.
const backendPort = process.env.BACKEND_PORT ?? "3333";
const frontendPort = Number(process.env.FRONTEND_PORT ?? 5173);
const backendTarget = `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routeFileIgnorePattern: ".server.|.test.",
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "0.0.0.0",
    port: frontendPort,
    proxy: {
      // Rotas com prefixo /api → backend Fastify (porta via BACKEND_PORT ou MI_BACKEND_PORT)
      // configure() desabilita bufferização para SSE (text/event-stream)
      "/api": {
        target: backendTarget,
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
        target: backendTarget,
        changeOrigin: true,
      },
      "/users": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
