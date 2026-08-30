import "@testing-library/jest-dom/vitest";

// React Flow measures the DOM; jsdom lacks ResizeObserver and layout metrics.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverStub;

if (!("DOMMatrixReadOnly" in globalThis)) {
  // @ts-expect-error minimal stub for React Flow transforms
  globalThis.DOMMatrixReadOnly = class {
    m22 = 1;
    constructor(_t?: string) {}
  };
}
