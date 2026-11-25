// A canvas 2D context stand-in for drawing tests: every method is a no-op, assignments are kept.
// Not a test file (node --test only picks up *.test.js).
export function stubCtx() {
  const props = {
    measureText: text => ({ width: String(text).length * 5 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    getLineDash: () => [],
  };
  return new Proxy(props, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}
