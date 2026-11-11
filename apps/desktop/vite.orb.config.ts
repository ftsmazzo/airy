import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/** Preview só da orbe — sem Electron. */
export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  publicDir: false,
  server: {
    port: 5174,
    open: "/orb.html",
    watch: {
      // Windows/OneDrive: .ico fica locked e derruba o Vite (EBUSY)
      ignored: ["**/assets/**", "**/*.ico"],
    },
  },
  build: {
    outDir: "dist-orb",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "orb.html"),
    },
  },
});
