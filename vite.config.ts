import vue from '@vitejs/plugin-vue'
import { nitro } from 'nitro/vite'
import unocss from 'unocss/vite'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    '*.{js,ts,vue}': 'vp lint --fix',
  },
  plugins: [
    vue(),
    unocss(),
    nitro({
      serverDir: './server',
      preset: 'cloudflare_module',
      compatibilityDate: '2024-09-19',
      cloudflare: {
        deployConfig: true,
        nodeCompat: true,
        wrangler: {
          name: 'watch',
          compatibility_flags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
        },
      },
    }),
  ],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.runtime-with-vapor.esm-browser.js',
    },
  },
})
