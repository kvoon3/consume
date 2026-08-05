import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: {
    '*.{js,ts,vue}': 'vp lint --fix',
  },
  plugins: [
    vue(),
    unocss(),
  ],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.runtime-with-vapor.esm-browser.js',
    },
  },
})
