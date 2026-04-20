/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute WebSocket base for Nadraw Show (static hosting). */
  readonly VITE_NADRAW_WS_URL?: string
}

declare module 'ui-theme' {}
