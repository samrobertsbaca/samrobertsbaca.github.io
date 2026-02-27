import { rainbowCursor } from "https://unpkg.com/cursor-effects@latest/dist/esm.js";

// Check if the screen is wider than a typical mobile device (e.g., 768px)
// and make sure it's not a touch-only device
const isMobile = window.matchMedia("(max-width: 768px)").matches ||
                 ('ontouchstart' in window);

if (!isMobile) {
  // 1. Setup the watcher
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === 'CANVAS') {
          applyCursorStyles(node);
          observer.disconnect();
        }
      });
    }
  });

  observer.observe(document.body, { childList: true });

  // 2. Only start the effect if we aren't on mobile
  new rainbowCursor();
}

function applyCursorStyles(canvas) {
  canvas.id = "active-cursor-layer";
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    zIndex: '999999',
    pointerEvents: 'none',
    display: 'block'
  });
}
