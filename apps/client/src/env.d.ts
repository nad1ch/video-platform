/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute WebSocket base for Nadraw Show (static hosting). */
  readonly VITE_NADRAW_WS_URL?: string
  /** Optional absolute WebSocket base for Checkers rooms (static hosting). */
  readonly VITE_CHECKERS_WS_URL?: string
  /**
   * Temporary: when `"true"` at build time, allows call audio QA `localStorage` overrides
   * (Opus DTX off, diagnostics). Normal production builds omit this — unset is safe default.
   */
  readonly VITE_ENABLE_CALL_AUDIO_QA_TOOLS?: string
}

declare module 'ui-theme' {}
