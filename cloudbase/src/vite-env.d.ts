/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TCB_ENV_ID?: string;
  readonly VITE_TCB_REGION?: string;
  readonly VITE_TCB_ACCESS_KEY?: string;
  readonly VITE_TCB_FUNCTION_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
