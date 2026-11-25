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

// Like stubCtx, but logs every method call as [name, ...args] in `ctx.calls`.
export function recordingCtx() {
  const calls = [];
  const base = stubCtx();
  return new Proxy(base, {
    get: (t, k) => {
      if (k === 'calls') return calls;
      const v = t[k];
      if (typeof v !== 'function') return v;
      return (...args) => { calls.push([k, ...args]); return v(...args); };
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
}
