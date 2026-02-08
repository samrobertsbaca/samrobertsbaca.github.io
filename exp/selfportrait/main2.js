import { IMAGE_URLS, BLOG_SNIPPETS } from "./media.js";

/** --- 1. CONFIG & STATE --- **/
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const MAX_IMAGE_SIZE = 400;
const OVERALL_SPEED = 0.5;
const SNIPPET_FONT = '30px "BodyFont", sans-serif';

let activeEntities = [];
let loadedImages = [];
let bgColor = "#00aeef";
let lastFrameTime = performance.now();

/** --- 2. THE ENTITY CLASSES --- **/

class WordClump {
  constructor(text, x, y) {
    this.text = text;
    this.words = text.split(" ").map(w => ({ text: w, relX: 0, relY: 0, w: 0 }));
    this.x = x;
    this.y = y;
    this.opacity = 0;
    this.duration = 6000 + Math.random() * 4000; // Decoupled reading time
    this.isDark = Math.random() > 0.5;
    this.initialized = false;
    this.w = 0;
    this.h = 0;
  }

  // Measures text only when the font is confirmed active in the context
  init(context) {
    context.font = SNIPPET_FONT;
    let curX = 0, curY = 0, maxW = 0;
    const spacing = 10, lineHeight = 36, maxWidth = window.innerWidth * 0.3;

    this.words.forEach(word => {
      word.w = context.measureText(word.text).width;
      if (curX + word.w > maxWidth) {
        curX = 0;
        curY += lineHeight;
      }
      word.relX = curX;
      word.relY = curY;
      curX += word.w + spacing;
      maxW = Math.max(maxW, curX);
    });

    this.w = maxW + 10;
    this.h = curY + lineHeight + 10;
    this.initialized = true;
  }

  update(delta) {
    this.duration -= delta;
    // Standard fade without speed scaling
    if (this.duration > 600) this.opacity = Math.min(1, this.opacity + 0.05);
    else this.opacity = Math.max(0, this.opacity - 0.05);
  }

  draw(context) {
    if (!this.initialized) this.init(context);

    context.save();
    context.translate(this.x, this.y);
    context.globalAlpha = this.opacity;

    // Draw the "Shrink-wrap" box
    context.fillStyle = this.isDark ? "#000" : "#fff";
    context.fillRect(-10, -5, this.w, this.h);

    // Draw the words
    context.font = SNIPPET_FONT;
    context.fillStyle = this.isDark ? "#fff" : "#000";
    context.textBaseline = "top";
    this.words.forEach(word => {
      context.fillText(word.text, word.relX, word.relY);
    });
    context.restore();
  }
}

class GlitchImage {
  constructor(img, x, y) {
    this.img = img;
    this.x = x;
    this.y = y;

    // The "Chop"
    const isFull = Math.random() > 0.8;
    this.sw = isFull ? img.width : 100 + Math.random() * (img.width - 100);
    this.sh = isFull ? img.height : 100 + Math.random() * (img.height - 100);
    this.sx = isFull ? 0 : Math.random() * (img.width - this.sw);
    this.sy = isFull ? 0 : Math.random() * (img.height - this.sh);

    // Scaling to Max Size
    const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(this.sw, this.sh));
    this.dw = this.sw * scale;
    this.dh = this.sh * scale;

    this.duration = (3000 + Math.random() * 3000) / OVERALL_SPEED;
    this.opacity = 0;
    this.hue = 0;
  }

  update(delta) {
    this.duration -= delta;
    if (this.duration > 600) this.opacity = Math.min(1, this.opacity + 0.05);
    else this.opacity = Math.max(0, this.opacity - 0.05);
  }

  draw(context) {
    context.save();
    context.globalAlpha = this.opacity;

    // Hue shift on fade out
    if (this.duration < 600) {
      this.hue = (this.hue + 10) % 360;
      context.filter = `hue-rotate(${this.hue}deg) brightness(1.2)`;
    }

    context.drawImage(this.img, this.sx, this.sy, this.sw, this.sh, this.x, this.y, this.dw, this.dh);
    context.restore();
  }
}

/** --- 3. ENGINE CORE --- **/

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Re-initialize text boxes on resize
  activeEntities.forEach(e => { if (e instanceof WordClump) e.initialized = false; });
}
window.addEventListener("resize", resize);
resize();

async function safeLoadImages(urls) {
  const promises = urls.map(url => new Promise(res => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  }));
  const results = await Promise.all(promises);
  return results.filter(img => img !== null);
}

function spawn() {
  // Spawn Text
  if (Math.random() < 0.02) {
    const text = BLOG_SNIPPETS[Math.floor(Math.random() * BLOG_SNIPPETS.length)];
    // Simple non-overlap spawn attempt
    let x = Math.random() * (window.innerWidth - 350);
    let y = Math.random() * (window.innerHeight - 250);
    activeEntities.push(new WordClump(text, x, y));
  }

  // Spawn Images around text
  if (Math.random() < 0.03 * OVERALL_SPEED && loadedImages.length) {
    const img = loadedImages[Math.floor(Math.random() * loadedImages.length)];
    const texts = activeEntities.filter(e => e instanceof WordClump);

    let x, y;
    if (texts.length > 0) {
      const anchor = texts[Math.floor(Math.random() * texts.length)];
      x = anchor.x + (Math.random() * 400 - 200);
      y = anchor.y + (Math.random() * 400 - 200);
    } else {
      x = Math.random() * canvas.width;
      y = Math.random() * canvas.height;
    }
    activeEntities.push(new GlitchImage(img, x, y));
  }
}

function loop(now) {
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  // 1. Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  spawn();

  // 2. Filter layers
  const imgs = activeEntities.filter(e => e instanceof GlitchImage);
  const words = activeEntities.filter(e => e instanceof WordClump);

  // 3. Draw Images
  imgs.forEach(img => { img.update(delta); img.draw(ctx); });

  // 4. Mid-Layer Glitch (Slices the images/BG)
  if (Math.random() < 0.05 * OVERALL_SPEED) {
    const sy = Math.random() * canvas.height;
    const sh = 40 + Math.random() * 100;
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, (Math.random() - 0.5) * 60, sy, canvas.width, sh);
  }

  // 5. Draw Words (Top Layer)
  words.forEach(word => { word.update(delta); word.draw(ctx); });

  // 6. Cleanup
  activeEntities = activeEntities.filter(e => e.duration > 0);

  requestAnimationFrame(loop);
}

/** --- 4. START --- **/

(async function boot() {
  await document.fonts.ready;
  loadedImages = await safeLoadImages(IMAGE_URLS.slice(0, 25));
  requestAnimationFrame(loop);
})();
