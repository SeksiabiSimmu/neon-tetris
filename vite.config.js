import { defineConfig } from 'vite';

// Keep built asset URLs usable when Electron opens dist/index.html via file://.
export default defineConfig({ base: './' });
