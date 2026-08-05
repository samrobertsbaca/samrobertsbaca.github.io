import { IMAGE_URLS, BLOG_SNIPPETS } from "./media.js";

/** --- 1. CONFIG & STATE --- **/
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const HOME_URL = "/home.html";
const LOGO_URL = "/images/scorsby_hearteyes_scale.png";
const LOGO_SCALE = 0.7;
const FIXED_BG_COLOR = "#00aeef";

const MAX_SNIPPETS = 10;
const MAX_ACTIVE_IMAGES = 10;
const SNIPPET_FONT_SIZE = 16;
const FONT_STR = `${SNIPPET_FONT_SIZE}px BodyFont`;
const FONT_STR_BOLD = `bold ${SNIPPET_FONT_SIZE}px BodyFont`;
const LINE_HEIGHT = SNIPPET_FONT_SIZE * 1.2;
const MIN_SNIPPET_DURATION = 5000;
const CHAR_DURATION = 60;

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

// Cache DOM properties to avoid reading them in the render loop
let sysW = window.innerWidth;
let sysH = window.innerHeight;
let dpr = window.devicePixelRatio || 1;

/** --- 2. ASSET HELPERS --- **/

// Use OffscreenCanvas if supported to prevent DOM layout thrashing
function createBufferCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const oCanvas = createBufferCanvas(10, 10);
const oCtx = oCanvas.getContext("2d");

function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  sysW = window.innerWidth;
  sysH = window.innerHeight;
  canvas.width = sysW * dpr;
  canvas.height = sysH * dpr;
  canvas.style.width = sysW + "px";
  canvas.style.height = sysH + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < activeSnippets.length; i++) {
    const s = activeSnippets[i];
    if (s.isPermanent) {
      s.x = (sysW - s.w) / 2;
      s.y = (sysH - s.h) / 2;
      break;
    }
  }
}
window.addEventListener("resize", resizeCanvas);

function rectsOverlap(x1, y1, w1, h1, r2) {
  const p = 15;
  return !(x1 + w1 + p < r2.x || x1 > r2.x + r2.w + p || y1 + h1 + p < r2.y || y1 > r2.y + r2.h + p);
}

async function fetchNewImage() {
  let available = IMAGE_URLS.filter((_, i) => !usedUrlIndices.has(i));
  if (available.length === 0) { usedUrlIndices.clear(); available = IMAGE_URLS; }
  const url = available[Math.floor(Math.random() * available.length)];
  usedUrlIndices.add(IMAGE_URLS.indexOf(url));

  try {
    const img = new Image();
    const raw = await new Promise((res, rej) => {
      img.onload = () => res(img); img.onerror = rej; img.src = url;
    });

    const tCanvas = createBufferCanvas(raw.width, raw.height);
    const tCtx = tCanvas.getContext("2d", { alpha: false });

    tCtx.drawImage(raw, 0, 0);
    tCtx.globalCompositeOperation = "source-atop";
    tCtx.fillStyle = "rgba(0, 174, 239, 0.35)";
    tCtx.fillRect(0, 0, raw.width, raw.height);
    tCtx.globalCompositeOperation = "multiply";
    tCtx.fillRect(0, 0, raw.width, raw.height);

    loadedPool.push(tCanvas);
    if (loadedPool.length > MAX_BUFFER) loadedPool.shift();
  } catch (e) { console.warn("Load failed:", url); }
}

/** --- 3. THE SNIPPET ENGINE --- **/

async function addSnippet() {
  let currentCount = 0;
  for (let i = 0; i < activeSnippets.length; i++) {
    if (!activeSnippets[i].isPermanent) currentCount++;
  }

  if (!BLOG_SNIPPETS.length || (currentCount + loadingSnippetsCount) >= MAX_SNIPPETS) return;

  loadingSnippetsCount++;
  try {
    await document.fonts.load(FONT_STR);

    const available = [];
    for (let i = 0; i < BLOG_SNIPPETS.length; i++) {
      const t = BLOG_SNIPPETS[i];
      let isActive = false;
      for (let j = 0; j < activeSnippets.length; j++) {
        if (activeSnippets[j].originalText === t) { isActive = true; break; }
      }
      if (!isActive) available.push(t);
    }

    const text = available.length ? available[(Math.random() * available.length)|0] : BLOG_SNIPPETS[0];
    const maxWidth = sysW * (0.15 + Math.random() * 0.3);

    oCtx.font = FONT_STR;
    const words = text.split(/\s+/);
    let lines = [], currentLine = "", finalMaxW = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const test = currentLine + word + " ";
      if (oCtx.measureText(test.trim()).width > maxWidth && currentLine !== "") {
        lines.push(currentLine.trim());
        finalMaxW = Math.max(finalMaxW, oCtx.measureText(currentLine.trim()).width);
        currentLine = word + " ";
      } else {
        currentLine = test;
      }
    }
    lines.push(currentLine.trim());
    finalMaxW = Math.max(finalMaxW, oCtx.measureText(currentLine.trim()).width);

    const boxW = finalMaxW + 24, boxH = (lines.length * LINE_HEIGHT) + 18;
    let x, y, found = false;

    for (let i = 0; i < 30; i++) {
      x = 20 + Math.random() * (sysW - boxW - 40);
      y = 20 + Math.random() * (sysH - boxH - 120);
      let overlap = false;
      for (let j = 0; j < activeSnippets.length; j++) {
        if (rectsOverlap(x, y, boxW, boxH, activeSnippets[j])) {
          overlap = true;
          break;
        }
      }
      if (!overlap) { found = true; break; }
    }

    if (found) {
      const cache = createBufferCanvas(boxW * dpr, boxH * dpr);
      const cCtx = cache.getContext("2d");
      cCtx.scale(dpr, dpr);

      const isDark = Math.random() < 0.5;
      cCtx.fillStyle = isDark ? "#000" : "#FFF";
      cCtx.fillRect(0, 0, boxW, boxH);
      cCtx.fillStyle = isDark ? "#FFF" : "#000";
      cCtx.font = FONT_STR;
      cCtx.textBaseline = "top";

      for (let i = 0; i < lines.length; i++) {
        cCtx.fillText(lines[i], 12, 10 + i * LINE_HEIGHT);
      }

      const duration = Math.max(MIN_SNIPPET_DURATION, text.length * CHAR_DURATION);
      activeSnippets.push({
        originalText: text, cache, x, y, w: boxW, h: boxH,
        duration: duration, maxDuration: duration,
        opacity: 0
      });
    }
  } finally { loadingSnippetsCount--; }
}

async function fillSnippets() {
  let currentCount = 0;
  for (let i = 0; i < activeSnippets.length; i++) {
    if (!activeSnippets[i].isPermanent) currentCount++;
  }
  const needed = MAX_SNIPPETS - currentCount;
  for (let i = 0; i < needed; i++) {
    addSnippet();
    await new Promise(r => setTimeout(r, 0));
  }
}

/** --- 4. BACKGROUND WORKER --- **/
// Moved generation out of the render loop to prevent stutters
setInterval(() => {
  if (loadedPool.length < 10) {
    fetchNewImage();
  }

  let nonPermCount = 0;
  for (let i = 0; i < activeSnippets.length; i++) {
    if (!activeSnippets[i].isPermanent) nonPermCount++;
  }

  if ((nonPermCount + loadingSnippetsCount) < MAX_SNIPPETS) {
    addSnippet();
  }
}, 250);

/** --- 5. RENDER ENGINE --- **/

function drawFrame(delta) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, sysW, sysH);

  spawnTimer += delta * OVERALL_SPEED;
  if (spawnTimer > 400) {
    spawnTimer = 0;
    spawnImage();
  }

  // Draw Images
  for (let i = activeImages.length - 1; i >= 0; i--) {
    const imgObj = activeImages[i];
    const isFadingOut = imgObj.duration < FADE_THRESHOLD;

    imgObj.opacity = !isFadingOut
        ? Math.min(1, imgObj.opacity + IMAGE_FADE_IN_SPEED)
        : Math.max(0, imgObj.opacity - IMAGE_FADE_OUT_SPEED);

    ctx.globalAlpha = imgObj.opacity;
    // Enforce integer drawing for maximum GPU performance
    ctx.drawImage(imgObj.img, imgObj.dx | 0, imgObj.dy | 0, imgObj.dw | 0, imgObj.dh | 0);
    imgObj.duration -= delta;

    if (imgObj.duration <= 0 && imgObj.opacity <= 0) {
      activeImages.splice(i, 1);
    }
  }

  // Draw Snippets
  for (let i = activeSnippets.length - 1; i >= 0; i--) {
    const s = activeSnippets[i];
    let renderY = s.y;

    if (!s.isPermanent) {
      if (draggingSnippet !== s) {
        const isFadingOut = s.duration < FADE_THRESHOLD;
        s.opacity = !isFadingOut
            ? Math.min(1, s.opacity + SNIPPET_FADE_IN_SPEED)
            : Math.max(0, s.opacity - SNIPPET_FADE_OUT_SPEED);
        s.duration -= delta;
      } else {
        s.opacity = 1;
      }
    } else {
      s.bobTimer += delta * 0.002;
      renderY += Math.sin(s.bobTimer) * 12;
      s.hue = (s.hue + 1) % 360;
    }

    if (s.opacity > 0) {
      ctx.globalAlpha = s.opacity;
      if (s.isPermanent) {
        if (s.useLogo) {
          ctx.drawImage(logoImg, s.x | 0, renderY | 0, s.w | 0, s.h | 0);
          s.currentRenderY = renderY;
        } else {
          ctx.fillStyle = `hsl(${s.hue}, 80%, 30%)`;
          ctx.fillRect(s.x | 0, renderY | 0, s.w | 0, s.h | 0);
          ctx.fillStyle = "#FFF";
          ctx.font = FONT_STR_BOLD;
          ctx.textAlign = "center";
          ctx.fillText("ENTER", (s.x + s.w / 2) | 0, (renderY + 10) | 0);
        }
        s.currentRenderY = renderY;
      } else {
        ctx.drawImage(s.cache, s.x | 0, renderY | 0, s.w | 0, s.h | 0);
      }
    }

    if (!s.isPermanent && s.duration <= 0 && s.opacity <= 0 && draggingSnippet !== s) {
      activeSnippets.splice(i, 1);
    }
  }
}

/** --- 6. INITIALIZATION & EVENTS --- **/

function spawnImage() {
  if (activeImages.length >= MAX_ACTIVE_IMAGES || !loadedPool.length) return;

  const index = (Math.random() * loadedPool.length) | 0;
  const img = loadedPool.splice(index, 1)[0];

  let dw = sysW * (0.2 + Math.random() * 0.4);
  // Using .width and .height directly from OffscreenCanvas/HTMLCanvasElement
  let dh = dw / (img.width / img.height);

  activeImages.push({
    img,
    dx: -dw * 0.3 + Math.random() * sysW,
    dy: -dh * 0.3 + Math.random() * sysH,
    dw,
    dh,
    duration: (3000 + Math.random() * 5000) / OVERALL_SPEED,
    opacity: 0
  });
}

function spawnPermanentBox() {
  const hasLogo = logoImg && logoImg.complete;
  const boxW = hasLogo ? (logoImg.width * LOGO_SCALE) | 0 : 200;
  const boxH = hasLogo ? (logoImg.height * LOGO_SCALE) | 0 : 40;

  activeSnippets.push({
    text: "ENTER",
    x: (sysW - boxW) / 2,
    y: (sysH - boxH) / 2,
    w: boxW,
    h: boxH,
    isPermanent: true,
    hue: 0,
    opacity: 1,
    bobTimer: 0,
    useLogo: hasLogo
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
      activeSnippets.push(...activeSnippets.splice(i, 1));
      break;
    }
  }
}

function handleMove(e) {
  if (!draggingSnippet) return;
  const pX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
  const pY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
  draggingSnippet.x = pX - dragOffX; draggingSnippet.y = pY - dragOffY;

  draggingSnippet.duration = draggingSnippet.maxDuration;
  draggingSnippet.opacity = 1;
}

canvas.addEventListener("mousedown", handleStart);
window.addEventListener("mousemove", handleMove);
window.addEventListener("mouseup", () => draggingSnippet = null);
canvas.addEventListener("touchstart", handleStart, { passive: false });
window.addEventListener("touchmove", handleMove, { passive: false });
window.addEventListener("touchend", () => draggingSnippet = null);

function loop(t) {
  let delta = t - lastFrameTime;

  // Cap the delta very strictly to prevent physics/timer jumping
  if (delta > 32) delta = 32;

  if (delta >= FRAME_INTERVAL) {
    drawFrame(delta);
    lastFrameTime = t - (delta % FRAME_INTERVAL);
  }
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
