// Safari (iOS en macOS) kan nog niet met "for await" over een ReadableStream lopen; pdf.js doet dat wel.
if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
  const iter = async function* ({ preventCancel = false } = {}) {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      if (!preventCancel) { try { await reader.cancel(); } catch { /* al gesloten */ } }
      reader.releaseLock();
    }
  };
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { value: iter, writable: true, configurable: true });
  if (!ReadableStream.prototype.values) Object.defineProperty(ReadableStream.prototype, 'values', { value: iter, writable: true, configurable: true });
}
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () { let resolve, reject; const promise = new this((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
}
