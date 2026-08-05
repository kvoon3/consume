import 'vue'

declare module 'vue' {
  // Vapor runtime entries (aliased build), not yet in vue's public types
  export function createVaporApp(...args: any[]): { mount: (el: Element | string) => any, use: (p: any) => any }
  export const vaporInteropPlugin: any
}
