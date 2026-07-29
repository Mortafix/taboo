import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig({
  plugins: [react()],
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  preview: {
    host: "0.0.0.0",
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("cards.generated")) return "decks";
          if (id.includes("node_modules")) return "vendor";
          return undefined;
        },
      },
    },
  },
});
