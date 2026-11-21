/**
 * Nombres de canal IPC, compartidos entre `main` y `preload` — nunca
 * strings sueltos repetidos en los dos lados (design.md S3/S4).
 */
export const IPC = {
  getState: 'getState',
  selectAccount: 'selectAccount',
  hideWindow: 'hideWindow',
} as const
