import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.PAGES_BASE || "/",
  plugins: [react()],
  build: process.env.ARTIFACT ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...(process.env.ARTIFACT
        ? {
            "./firebaseStore": path.resolve(__dirname, "./src/firebaseStub.ts"),
            "./firebase-config": path.resolve(__dirname, "./src/firebase-config.none.ts"),
          }
        : {}),
    },
  },
});
