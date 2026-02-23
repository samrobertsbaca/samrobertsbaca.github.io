import { IMAGE_URLS, BLOG_SNIPPETS } from "./media.js";

/** --- 1. CONFIG & STATE --- **/
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false }); // Optimization: Ignore alpha for the main layer

const HOME_URL = "/home.html";
const LOGO_URL = "/images/scorsby_hearteyes_scale.png";
const FIXED_BG_COLOR = "#00aeef";

const MAX_SNIPPETS = 15;
const MAX_ACTIVE_IMAGES = 15;
const SNIPPET_FONT_SIZE = 16;
const LINE_HEIGHT = SNIPPET_FONT_SIZE * 1.2;
const MIN_SNIPPET_DURATION = 10000;
const CHAR_DURATION = 40;

const SNIPPET_FADE_IN_SPEED = 0.05;
const SNIPPET_FADE_OUT_SPEED = 0.02;
const IMAGE_FADE_IN_SPEED = 0.02;
const IMAGE_FADE_OUT_SPEED = 0.01;
const FADE_THRESHOLD = 10;

const OVERALL_SPEED = 2;
const MAX_BUFFER = 40;

let loadedPool = [];
let activeImages = [];
let activeSnippets = [];
let usedUrlIndices = new Set();
let bgColor = FIXED_BG_COLOR;

let spawnTimer = 0;
let loadingSnippetsCount = 0;
let draggingSnippet = null, dragOffX = 0, dragOffY = 0;
let logoImg = null;

let lastFrameTime = performance.now();
const FRAME_INTERVAL = 1000 / 60;

// Reusable off-screen context for measurements
const oCtx = document.createElement("canvas").getContext("2d");

/** --- 2. ASSET PRE-PROCESSING --- **/

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.imageSmoothingEnabled = false;

  const perm = activeSnippets.find(s => s.isPermanent);
  if (perm) {
    perm.x = (w - perm.w) / 2;
    perm.y = (h - perm.h) / 2;
  }
}
window.addEventListener("resize", resizeCanvas);

function rectsOverlap(r1, r2) {
  const p = 15;
  return !(r1.x+r1.w+p < r2.x || r1.x > r2.x+r2.w+p || r1.y+r1.h+p < r2.y || r1.y > r2.y+r2.h+p);
}

// PRE-TINT IMAGES: Done once per load to save CPU/GPU later
async function fetchNewImage() {
  let available = IMAGE_URLS.filter((_, i) => !usedUrlIndices.has(i));
  if (available.length === 0) { usedUrlIndices.clear(); available = IMAGE_URLS; }
  const url = available[Math.floor(Math.random() * available.length)];
  usedUrlIndices.add(IMAGE_URLS.indexOf(url));

  try {
    const img = new Image();
    const raw = await new Promise((res, rej) => {
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });

    const tCanvas = document.createElement("canvas");
    const tCtx = tCanvas.getContext("2d");
    tCanvas.width = raw.width; tCanvas.height = raw.height;

    tCtx.drawImage(raw, 0, 0);
    tCtx.globalCompositeOperation = "source-atop";
    tCtx.fillStyle = "rgba(0, 174, 239, 0.35)"; // Blue tint
    tCtx.fillRect(0, 0, tCanvas.width, tCanvas.height);
    tCtx.globalCompositeOperation = "multiply";
    tCtx.fillRect(0, 0, tCanvas.width, tCanvas.height);

    loadedPool.push(tCanvas);
    if (loadedPool.length > MAX_BUFFER) loadedPool.shift();
    return tCanvas;
  } catch (e) { console.warn("Load failed:", url); }
}

/** --- 3. CONCURRENT SNIPPET LOGIC --- **/

async function addSnippet() {
  const currentCount = activeSnippets.filter(s => !s.isPermanent).length;
  if (!BLOG_SNIPPETS.length || (currentCount + loadingSnippetsCount) >= MAX_SNIPPETS) return;

  loadingSnippetsCount++;
  try {
    await document.fonts.load(`${SNIPPET_FONT_SIZE}px BodyFont`);

    const activeTexts = new Set(activeSnippets.map(s => s.originalText));
    const available = BLOG_SNIPPETS.filter(t => !activeTexts.has(t));
    const text = available.length ? available[(Math.random() * available.length)|0] : BLOG_SNIPPETS[0];

    const maxWidth = window.innerWidth * (0.15 + Math.random() * 0.3);
    oCtx.font = `${SNIPPET_FONT_SIZE}px BodyFont`;
    const words = text.split(/\s+/);
    let lines = [], currentLine = "", finalMaxW = 0;

    words.forEach(word => {
      const test = currentLine + word + " ";
      if (oCtx.measureText(test.trim()).width > maxWidth && currentLine !== "") {
        lines.push(currentLine.trim());
        finalMaxW = Math.max(finalMaxW, oCtx.measureText(currentLine.trim()).width);
        currentLine = word + " ";
      } else { currentLine = test; }
    });
    lines.push(currentLine.trim());
    finalMaxW = Math.max(finalMaxW, oCtx.measureText(currentLine.trim()).width);

    const boxW = finalMaxW + 24, boxH = (lines.length * LINE_HEIGHT) + 18;

    let x, y, found = false;
    for (let i = 0; i < 30; i++) {
      x = 20 + Math.random() * (window.innerWidth - boxW - 40);
      y = 20 + Math.random() * (window.innerHeight - boxH - 120);
      if (!activeSnippets.some(s => rectsOverlap({x, y, w: boxW, h: boxH}, s))) {
        found = true; break;
      }
    }

    if (found) {
      // BITMAP CACHING: Render text to canvas once
      const cache = document.createElement("canvas");
      const dpr = window.devicePixelRatio || 1;
      cache.width = boxW * dpr; cache.height = boxH * dpr;
      const cCtx = cache.getContext("2d");
      cCtx.scale(dpr, dpr);

      const isDark = Math.random() < 0.5;
      cCtx.fillStyle = isDark ? "#000" : "#FFF";
      cCtx.fillRect(0, 0, boxW, boxH);
      cCtx.fillStyle = isDark ? "#FFF" : "#000";
      cCtx.font = `${SNIPPET_FONT_SIZE}px BodyFont`;
      cCtx.textBaseline = "top";
      lines.forEach((l, i) => cCtx.fillText(l, 12, 10 + i * LINE_HEIGHT));

      activeSnippets.push({
        originalText: text, cache, x, y, w: boxW, h: boxH,
        duration: Math.max(MIN_SNIPPET_DURATION, text.length * CHAR_DURATION),
        opacity: 0
      });
    }
  } finally { loadingSnippetsCount--; }
}

// Burst-load snippets without locking the UI
async function fillSnippets() {
  const needed = MAX_SNIPPETS - activeSnippets.filter(s => !s.isPermanent).length;
  for (let i = 0; i < needed; i++) {
    addSnippet();
    await new Promise(r => setTimeout(r, 0)); // Yield to keep 60FPS
  }
}

/** --- 4. RENDER ENGINE --- **/

function drawFrame(delta) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  spawnTimer += delta * OVERALL_SPEED;
  if (spawnTimer > 400) { spawnTimer = 0; spawnImage(); fetchNewImage(); }

  // Maintain density
  if (activeSnippets.filter(s => !s.isPermanent).length + loadingSnippetsCount < MAX_SNIPPETS) {
    addSnippet();
  }

  // Draw Images (Reverse loop for safe deletion)
  for (let i = activeImages.length - 1; i >= 0; i--) {
    const imgObj = activeImages[i];
    const isFadingOut = imgObj.duration < FADE_THRESHOLD;
    imgObj.opacity = !isFadingOut ? Math.min(1, imgObj.opacity + IMAGE_FADE_IN_SPEED) : Math.max(0, imgObj.opacity - IMAGE_FADE_OUT_SPEED);
    ctx.globalAlpha = imgObj.opacity;
    ctx.drawImage(imgObj.img, imgObj.dx, imgObj.dy, imgObj.dw, imgObj.dh);
    imgObj.duration -= delta;
    if (imgObj.duration <= 0 && imgObj.opacity <= 0) activeImages.splice(i, 1);
  }

  // Draw Snippets
  for (let i = activeSnippets.length - 1; i >= 0; i--) {
    const s = activeSnippets[i];
    let renderY = s.y;

    if (!s.isPermanent) {
      const isFadingOut = s.duration < FADE_THRESHOLD;
      s.opacity = !isFadingOut ? Math.min(1, s.opacity + SNIPPET_FADE_IN_SPEED) : Math.max(0, s.opacity - SNIPPET_FADE_OUT_SPEED);
      s.duration -= delta;
    } else {
      s.bobTimer += delta * 0.002;
      renderY += Math.sin(s.bobTimer) * 9;
      s.hue = (s.hue + 1) % 360;
    }

    if (s.opacity > 0) {
      ctx.globalAlpha = s.opacity;
      if (s.isPermanent) {
        if (s.useLogo) {
          ctx.drawImage(logoImg, s.x | 0, renderY | 0, s.w | 0, s.h | 0);
        } else {
          ctx.fillStyle = `hsl(${s.hue}, 80%, 30%)`;
          ctx.fillRect(s.x | 0, renderY | 0, s.w | 0, s.h | 0);
          ctx.fillStyle = "#FFF";
          ctx.font = `bold ${SNIPPET_FONT_SIZE}px BodyFont`;
          ctx.textAlign = "center";
          ctx.fillText("ENTER", (s.x + s.w / 2) | 0, (renderY + 10) | 0);
        }
        s.currentRenderY = renderY;
      } else {
        ctx.drawImage(s.cache, s.x | 0, renderY | 0, s.w | 0, s.h | 0);
      }
    }
    if (!s.isPermanent && s.duration <= 0 && s.opacity <= 0 && draggingSnippet !== s) activeSnippets.splice(i, 1);
  }
  ctx.globalAlpha = 1;
}

/** --- 5. INITIALIZATION & EVENTS --- **/

function spawnImage() {
  if (activeImages.length >= MAX_ACTIVE_IMAGES || !loadedPool.length) return;
  const img = loadedPool[(Math.random() * loadedPool.length) | 0];
  let dw = window.innerWidth * (0.2 + Math.random()*0.4), dh = dw / (img.width / img.height);
  activeImages.push({
    img, dx: -dw*0.3 + Math.random()*window.innerWidth, dy: -dh*0.3 + Math.random()*window.innerHeight, dw, dh,
    duration: (3000 + Math.random()*5000) / OVERALL_SPEED, opacity: 0
  });
}

function spawnPermanentBox() {
  const hasLogo = logoImg && logoImg.complete;
  const boxW = hasLogo ? logoImg.width * 0.5 : 200, boxH = hasLogo ? logoImg.height * 0.5 : 40;
  activeSnippets.push({
    text: "ENTER", x: (window.innerWidth - boxW) / 2, y: (window.innerHeight - boxH) / 2,
    w: boxW, h: boxH, isPermanent: true, hue: 0, opacity: 1, bobTimer: 0, useLogo: hasLogo
  });
}

function handleStart(e) {
  const pX = e.type.startsWith("touch") ? e.touches[0].clientX : e.offsetX;
  const pY = e.type.startsWith("touch") ? e.touches[0].clientY : e.offsetY;
  for (let i = activeSnippets.length - 1; i >= 0; i--) {
    const s = activeSnippets[i];
    const checkY = s.isPermanent ? s.currentRenderY : s.y;
    if (pX >= s.x && pX <= s.x + s.w && pY >= checkY && pY <= checkY + s.h) {
      if (s.isPermanent) { window.top.location.href = HOME_URL; return; }
      draggingSnippet = s; dragOffX = pX - s.x; dragOffY = pY - s.y;
      activeSnippets.push(...activeSnippets.splice(i, 1)); // Bring to front
      break;
    }
  }
}

function handleMove(e) {
  if (!draggingSnippet) return;
  const pX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
  const pY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
  draggingSnippet.x = pX - dragOffX; draggingSnippet.y = pY - dragOffY;
}

canvas.addEventListener("mousedown", handleStart);
window.addEventListener("mousemove", handleMove);
window.addEventListener("mouseup", () => draggingSnippet = null);
canvas.addEventListener("touchstart", handleStart, { passive: false });
window.addEventListener("touchmove", handleMove, { passive: false });
window.addEventListener("touchend", () => draggingSnippet = null);

function loop(t) {
  let delta = t - lastFrameTime;
  if (delta >= FRAME_INTERVAL) { drawFrame(delta); lastFrameTime = t - (delta % FRAME_INTERVAL); }
  requestAnimationFrame(loop);
}

(async function init() {
  resizeCanvas();
  if (document.fonts) await document.fonts.ready;
  if (LOGO_URL) {
    logoImg = new Image();
    await new Promise(res => { logoImg.onload = res; logoImg.onerror = res; logoImg.src = LOGO_URL; });
  }
  await Promise.all(Array.from({ length: 8 }, () => fetchNewImage()));
  spawnPermanentBox();
  requestAnimationFrame(loop);
  fillSnippets();
})();
