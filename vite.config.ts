import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site under /<repo>/, the workflow passes that as VITE_BASE. Locally it stays "/".
export default defineConfig({ base: process.env.VITE_BASE ?? '/', plugins: [react(), tailwindcss()] })
