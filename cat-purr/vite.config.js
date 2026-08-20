import { defineConfig } from 'vite';

// Own dev port so this can run alongside sibling three.js/MIDI visual
// projects (forest, plant-midi, ...) at the same time.
export default defineConfig({
  server: {
    port: 5183,
    strictPort: true,
  },
});
