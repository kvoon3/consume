import 'vue'

declare module 'vue' {
  // Vapor runtime entry (aliased build), not yet in vue's public types
  export function createVaporApp(...args: any[]): { mount: (el: Element | string) => any }
}
