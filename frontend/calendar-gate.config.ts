import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "experiments/calendar",
  plugins: [react()],
  build: { outDir: "../../../output/calendar-gate-dist", emptyOutDir: true },
});
