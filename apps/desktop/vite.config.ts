import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, "../..");

/** Em produção, embute agent/voice no main (instalador sem symlink de workspace). */
const mainExternals = [
  "electron",
  "pdf-parse",
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export default defineConfig({
  resolve: {
    alias: {
      // catálogo puro (sem Node) para a UI de Pacotes
      "@airy/packages-catalog": path.join(
        repoRoot,
        "packages/agent/src/packages.ts",
      ),
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          resolve: {
            alias: {
              "@airy/agent": path.join(repoRoot, "packages/agent/src/index.ts"),
              "@airy/voice": path.join(repoRoot, "packages/voice/src/index.ts"),
            },
          },
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: mainExternals,
            },
          },
        },
      },
      preload: {
        input: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            // Windows/Electron: CJS evita falha de ESM no preload
            rollupOptions: {
              output: {
                format: "cjs",
                entryFileNames: "preload.cjs",
              },
            },
          },
        },
      },
    }),
  ],
  server: {
    port: 5173,
    watch: {
      ignored: ["**/assets/**", "**/*.ico"],
    },
  },
});
