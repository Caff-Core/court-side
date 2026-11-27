import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
