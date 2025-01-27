import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        format: "iife",
        entryFileNames: "index.js",
        manualChunks: () => {
          return "index";
        },
      },
    },
  },
});
