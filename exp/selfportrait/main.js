import { IMAGE_URLS, BLOG_SNIPPETS } from "./media.js";

/** --- 1. GLOBAL STATE & CONFIG --- **/
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const HOME_URL = "/home.html";
const FIXED_BG_COLOR = "#00aeef";
const BG_CHANGE_INTERVAL = 3000;
const MAX_SNIPPETS = 8;
const MAX_ACTIVE_IMAGES = 50;
const SNIPPET_FONT_SIZE = 16;
const LINE_HEIGHT = SNIPPET_FONT_SIZE * 1.2;
const MIN_SNIPPET_DURATION = 10000;
const CHAR_DURATION = 40;

const SNIPPET_FADE_IN_SPEED = 0.05;
const SNIPPET_FADE_OUT_SPEED = 0.02;
const IMAGE_FADE_IN_SPEED = 0.01;
const IMAGE_FADE_OUT_SPEED = 0.01;
const FADE_THRESHOLD = 10;

const OVERALL_SPEED = 2;
const MAX_BUFFER = 30;

let loadedPool = [];
let activeImages = [];
let activeSnippets = [];
let usedUrlIndices = new Set();
let bgColor = FIXED_BG_COLOR;
let bgTimer = 0;
let spawnTimer = 0;
let draggingSnippet = null, dragOffX = 0, dragOffY = 0;

let lastFrameTime = performance.now();
const FRAME_INTERVAL = 1000 / 60;

/** --- 2. HELPERS & LOADING --- **/

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
    perm.y = h - perm.h - 40;
  }
}
window.addEventListener("resize", resizeCanvas);

async function fetchNewImage() {
  let available = IMAGE_URLS.filter((_, i) => !usedUrlIndices.has(i));
  if (available.length === 0) { usedUrlIndices.clear(); available = IMAGE_URLS; }
  const randomIdx = Math.floor(Math.random() * available.length);
  const url = available[randomIdx];
  usedUrlIndices.add(IMAGE_URLS.indexOf(url));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    loadedPool.push(img);
    if (loadedPool.length > MAX_BUFFER) loadedPool.shift();
  } catch (e) { console.warn("Load failed:", url); }
}

function rectsOverlap(r1, r2) {
  const padding = 20;
  return !(r1.x + r1.w + padding < r2.x ||
           r1.x > r2.x + r2.w + padding ||
           r1.y + r1.h + padding < r2.y ||
           r1.y > r2.y + r2.h + padding);
}

/** --- 3. SPAWNING --- **/

function spawnPermanentBox() {
  const text = "ENTER THE SCORSBYZONE";
  ctx.font = `bold ${SNIPPET_FONT_SIZE}px BodyFont`;
  const metrics = ctx.measureText(text);
  const boxW = metrics.width + 40;
  const boxH = LINE_HEIGHT + 20;

  activeSnippets.push({
    text,
    x: (window.innerWidth - boxW) / 2,
    y: (window.innerHeight - boxH) / 2,
    w: boxW, h: boxH,
    isPermanent: true,
    hue: 0,
    color: "#ffffff",
    opacity: 1
  });
}

function spawnImage() {
  const img = loadedPool[(Math.random() * loadedPool.length) | 0];
  if (!img) return;

  const screenScale = 0.2 + Math.random() * 0.4;
  let dw = window.innerWidth * screenScale;
  const ratio = img.width / img.height;
  let dh = dw / ratio;

  const horizontalMargin = dw * 0.7;
  const verticalMargin = dh * 0.7;
  const dx = -horizontalMargin + Math.random() * (window.innerWidth + horizontalMargin - (dw * 0.3));
  const dy = -verticalMargin + Math.random() * (window.innerHeight + verticalMargin - (dh * 0.3));

  activeImages.push({
    img, sx: 0, sy: 0, sw: img.width, sh: img.height, dx, dy, dw, dh,
    duration: (2000 + Math.random() * 4000) / OVERALL_SPEED,
    opacity: 0, hue: 0
  });
}

async function addSnippet() {
  if (!BLOG_SNIPPETS.length || activeSnippets.length >= MAX_SNIPPETS) return;

  ctx.font = `${SNIPPET_FONT_SIZE}px BodyFont`;
  const text = BLOG_SNIPPETS[(Math.random() * BLOG_SNIPPETS.length) | 0];
  const maxWidth = window.innerWidth * (0.15 + Math.random() * 0.3);
  const words = text.split(" "), lines = [];
  let currentLine = "", finalMaxW = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = currentLine + words[n] + " ";
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      const w = ctx.measureText(currentLine.trim()).width;
      lines.push({ text: currentLine.trim(), w: w });
      finalMaxW = Math.max(finalMaxW, w);
      currentLine = words[n] + " ";
    } else { currentLine = testLine; }
  }
  lines.push({ text: currentLine.trim(), w: ctx.measureText(currentLine.trim()).width });
  finalMaxW = Math.max(finalMaxW, ctx.measureText(currentLine.trim()).width);

  const boxW = finalMaxW + 20, boxH = (lines.length * LINE_HEIGHT) + 15;

  let x, y, foundSpot = false;
  for(let i=0; i<25; i++) {
    x = 20 + Math.random() * (window.innerWidth - boxW - 40);
    y = 20 + Math.random() * (window.innerHeight - boxH - 120);
    if (!activeSnippets.some(existing => rectsOverlap({x, y, w: boxW, h: boxH}, existing))) {
      foundSpot = true; break;
    }
  }

  if (foundSpot) {
    const isDark = Math.random() < 0.5;
    activeSnippets.push({
      lines, x, y, w: boxW, h: boxH,
      duration: Math.max(MIN_SNIPPET_DURATION, text.length * CHAR_DURATION),
      color: isDark ? "#FFF" : "#000",
      bgColor: isDark ? "#000" : "#FFF",
      opacity: 0
    });
  }
}

/** --- 4. RENDER ENGINE --- **/

function drawFrame(delta) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  spawnTimer += delta * OVERALL_SPEED;
  if (spawnTimer > 400) { spawnTimer = 0; spawnImage(); }

  activeImages.forEach(imgObj => {
    const isFadingOut = imgObj.duration < FADE_THRESHOLD;
    imgObj.opacity = !isFadingOut ? Math.min(1, imgObj.opacity + IMAGE_FADE_IN_SPEED) : Math.max(0, imgObj.opacity - IMAGE_FADE_OUT_SPEED);
    ctx.save();
    ctx.globalAlpha = imgObj.opacity;
    ctx.globalCompositeOperation = "soft-light";
    if (isFadingOut) {
      imgObj.hue = (imgObj.hue + 10) % 360;
      ctx.filter = `hue-rotate(${imgObj.hue}deg)`;
    }
    ctx.drawImage(imgObj.img, 0, 0, imgObj.sw, imgObj.sh, imgObj.dx, imgObj.dy, imgObj.dw, imgObj.dh);
    ctx.restore();
    imgObj.duration -= delta;
  });
  activeImages = activeImages.filter(img => img.duration > 0 || img.opacity > 0);

  /*if (Math.random() < 0.05 * OVERALL_SPEED) {
    fetchNewImage();
    const sliceY = Math.random() * window.innerHeight;
    const sliceH = 30 + Math.random() * 100;
    const shift = (Math.random() * 40 - 20);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, sliceY*dpr, canvas.width, sliceH*dpr, shift*dpr, sliceY*dpr, canvas.width, sliceH*dpr);
    ctx.restore();
  }*/

  if (Math.random() < 0.1) addSnippet();

  activeSnippets.forEach((s) => {
    if (!s.isPermanent) {
      const isFadingOut = s.duration < FADE_THRESHOLD;
      s.opacity = !isFadingOut ? Math.min(1, s.opacity + SNIPPET_FADE_IN_SPEED) : Math.max(0, s.opacity - SNIPPET_FADE_OUT_SPEED);
      s.duration -= delta;
    } else {
      //s.hue = (s.hue + 1.5) % 360;
      s.hue = 0;
      s.bgColor = `hsl(${s.hue}, 80%, 60%)`;
    }

    if (s.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = s.opacity;
      if(s.isPermanent) { ctx.shadowBlur = 20; ctx.shadowColor = s.bgColor; }
      ctx.fillStyle = s.bgColor;
      ctx.fillRect(s.x | 0, s.y | 0, s.w | 0, s.h | 0);
      ctx.fillStyle = s.color;
      ctx.textBaseline = "top";
      if (s.isPermanent) {
        ctx.font = `bold ${SNIPPET_FONT_SIZE}px BodyFont`;
        ctx.textAlign = "center";
        ctx.fillText(s.text, (s.x + s.w / 2) | 0, (s.y + 10) | 0);
      } else {
        ctx.font = `${SNIPPET_FONT_SIZE}px BodyFont`;
        ctx.textAlign = "left";
        s.lines.forEach((line, j) => ctx.fillText(line.text, (s.x + 10) | 0, (s.y + j * LINE_HEIGHT + 8) | 0));
      }
      ctx.restore();
    }
  });
  activeSnippets = activeSnippets.filter(s => s.isPermanent || s.duration > 0 || s.opacity > 0 || draggingSnippet === s);
}

/** --- 5. INTERACTION (MOUSE + TOUCH) --- **/

function handleStart(e) {
  const isTouch = e.type === "touchstart";
  const pageX = isTouch ? e.touches[0].clientX : e.offsetX;
  const pageY = isTouch ? e.touches[0].clientY : e.offsetY;

  for (let i = activeSnippets.length - 1; i >= 0; i--) {
    const s = activeSnippets[i];
    if (pageX >= s.x && pageX <= s.x + s.w && pageY >= s.y && pageY <= s.y + s.h) {
      if (s.isPermanent) { window.top.location.href = HOME_URL; return; }
      draggingSnippet = s;
      dragOffX = pageX - s.x;
      dragOffY = pageY - s.y;
      activeSnippets.push(...activeSnippets.splice(i, 1));
      if (isTouch) e.preventDefault();
      break;
    }
  }
}

function handleMove(e) {
  if (!draggingSnippet) return;
  const isTouch = e.type === "touchmove";
  const pageX = isTouch ? e.touches[0].clientX : e.offsetX;
  const pageY = isTouch ? e.touches[0].clientY : e.offsetY;
  draggingSnippet.x = pageX - dragOffX;
  draggingSnippet.y = pageY - dragOffY;
  if (isTouch) e.preventDefault();
}

function handleEnd() { draggingSnippet = null; }

canvas.addEventListener("mousedown", handleStart);
window.addEventListener("mousemove", handleMove);
window.addEventListener("mouseup", handleEnd);
canvas.addEventListener("touchstart", handleStart, { passive: false });
window.addEventListener("touchmove", handleMove, { passive: false });
window.addEventListener("touchend", handleEnd);

function loop(timestamp) {
  let delta = timestamp - lastFrameTime;
  if (delta >= FRAME_INTERVAL) {
    drawFrame(delta);
    lastFrameTime = timestamp - (delta % FRAME_INTERVAL);
  }
  requestAnimationFrame(loop);
}

(async function start() {
  resizeCanvas();
  for(let i=0; i<10; i++) await fetchNewImage();
  spawnPermanentBox();
  requestAnimationFrame(loop);
})();
