// ============================================================
// UUID
// ============================================================
export function generateId() {
  return 'DL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2,5).toUpperCase();
}

// ── Grootte hulpfuncties ──────────────────────────────────────
export function byteSize(str) {
  return new Blob([str]).size;
}
