import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
// Use repo name as base when building for GitHub Pages
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isPages = !!process.env.GITHUB_PAGES;
const base = isPages && repoName ? `/${repoName}/` : "/";

export default defineConfig({
  base,
  plugins: [react()],
});
