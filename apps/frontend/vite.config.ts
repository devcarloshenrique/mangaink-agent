import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

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
    port: 5173,
    // Porta do backend alvo do proxy — override por instância (ex.: worktrees)
    // sem conflitar com outras instâncias rodando na porta padrão.
    proxy: (() => {
      const backendTarget = `http://localhost:${process.env.MI_BACKEND_PORT || "3333"}`;
      return {
        // Rotas com prefixo /api → backend Fastify
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
      };
    })(),
  },
});
