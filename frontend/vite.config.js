import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the browser talks only to Vite (http://localhost:5173).
// Vite forwards every /api request to Django, so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
