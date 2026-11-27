import "@testing-library/jest-dom/vitest"
import { cleanup, configure } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// Lazy route chunks include the calendar; allow cold imports in parallel workers.
configure({ asyncUtilTimeout: 3000 })

// jsdom lacks matchMedia, which the theme provider reads.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom has no scrolling layout; calendar scrolling is verified in Chromium.
HTMLElement.prototype.scrollTo = function () {}
Element.prototype.getAnimations = () => []
Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
