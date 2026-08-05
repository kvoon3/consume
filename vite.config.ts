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
    nitro({ serverDir: './server' }),
  ],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.runtime-with-vapor.esm-browser.js',
    },
  },
})
