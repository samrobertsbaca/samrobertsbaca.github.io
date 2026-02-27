import { rainbowCursor } from "https://unpkg.com/cursor-effects@latest/dist/esm.js";

// 1. Create the observer to watch for the new canvas
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Look at every new element added to the page
    mutation.addedNodes.forEach((node) => {
      if (node.tagName === 'CANVAS') {
        // We found it! Apply styles and stop watching
        applyCursorStyles(node);
        observer.disconnect();
      }
    });
  }
});

// 2. Start watching the body for changes
observer.observe(document.body, { childList: true });

// 3. Initialize the effect
new rainbowCursor();

// 4. The styling function
function applyCursorStyles(canvas) {
  canvas.id = "active-cursor-layer"; // Give it a name
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    zIndex: '999999',
    pointerEvents: 'none',
    border: 'none',      // Ensures your other canvas border doesn't apply
    background: 'none'   // Ensures no background color interferes
  });
  console.log("Cursor canvas detected and styled via MutationObserver.");
}
