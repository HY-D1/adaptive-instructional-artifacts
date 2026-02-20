/// <reference types="vite/client" />

// Type declarations for SQL.js WASM imports
// Vite handles these with the ?url suffix to provide the asset URL
declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string;
  export default url;
}
