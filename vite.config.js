import { defineConfig } from 'vite';

// Keep built asset URLs usable when Electron opens dist/index.html via file://.
export default defineConfig({
  base: './',
  // The Windows icon is packaged by Electron, not served by Vite. Windows can
  // briefly lock it while the icon generator writes, so skip watching it.
  server: { watch: { ignored: ['**/assets/icon.ico'] } },
});
