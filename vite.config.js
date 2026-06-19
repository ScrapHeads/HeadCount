import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const demoAlias = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDemoMode = mode === 'demo' || env.VITE_DEMO_MODE === 'true';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: isDemoMode
        ? [
          { find: /^firebase\/app$/, replacement: demoAlias('./src/demo/firebase/app.js') },
          { find: /^firebase\/auth$/, replacement: demoAlias('./src/demo/firebase/auth.js') },
          { find: /^firebase\/firestore$/, replacement: demoAlias('./src/demo/firebase/firestore.js') },
          { find: /^firebase\/functions$/, replacement: demoAlias('./src/demo/firebase/functions.js') },
        ]
        : [],
    },
  };
});
