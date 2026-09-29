import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendPort =
    env.BACKEND_PORT || process.env.BACKEND_PORT || process.env.MI_BACKEND_PORT || "3334";
  const frontendPort = Number(env.FRONTEND_PORT || process.env.FRONTEND_PORT || 5173);
  const backendTarget = `http://127.0.0.1:${backendPort}`;

  return {
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
  };
});
