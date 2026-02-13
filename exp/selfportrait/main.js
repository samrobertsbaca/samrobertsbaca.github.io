import { IMAGE_URLS, BLOG_SNIPPETS } from "./media.js";

/** --- 1. GLOBAL STATE & CONFIG --- **/
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const HOME_URL = "/home.html";
const LOGO_URL = "/images/scorsby_hearteyes_scale.png"; // Set your logo URL here
const FIXED_BG_COLOR = "#00aeef";
const BG_CHANGE_INTERVAL = 3000;
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
let bgTimer = 0;
let spawnTimer = 0;
let draggingSnippet = null, dragOffX = 0, dragOffY = 0;
let logoImg = null;

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
    perm.y = (h - perm.h) / 2; // Adjusted for bobbing room
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
    const loadPromise = new Promise((res, rej) => {
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
    const loadedImg = await loadPromise;
    loadedPool.push(loadedImg);
    if (loadedPool.length > MAX_BUFFER) loadedPool.shift();
    return loadedImg;
  } catch (e) { console.warn("Load failed:", url); }
}

function rectsOverlap(r1, r2) {
  const padding = 10;
  return !(r1.x + r1.w + padding < r2.x ||
           r1.x > r2.x + r2.w + padding ||
           r1.y + r1.h + padding < r2.y ||
           r1.y > r2.y + r2.h + padding);
}

/** --- 3. SPAWNING --- **/

function spawnPermanentBox() {
  const hasLogo = logoImg && logoImg.complete;
  let boxW, boxH;

  if (hasLogo) {
    const scale = 0.5; // Adjust logo scale
    boxW = logoImg.width * scale;
    boxH = logoImg.height * scale;
  } else {
    const text = "ENTER THE SCORSBYZONE";
    ctx.font = `bold ${SNIPPET_FONT_SIZE}px BodyFont`;
    boxW = ctx.measureText(text).width + 40;
    boxH = LINE_HEIGHT + 20;
  }

  activeSnippets.push({
    text: "ENTER THE SCORSBYZONE",
    x: (window.innerWidth - boxW) / 2,
    y: (window.innerHeight - boxH) / 2,
    w: boxW, h: boxH,
    isPermanent: true,
    hue: 0,
    color: "#ffffff",
    bgColor: "#000000",
    opacity: 1,
    bobTimer: 0,
    useLogo: hasLogo
  });
}

function spawnImage() {
  if (activeImages.length >= MAX_ACTIVE_IMAGES) return;
  const img = loadedPool[(Math.random() * loadedPool.length) | 0];
  if (!img) return;

  const screenScale = 0.2 + Math.random() * 0.4;
  let dw = window.innerWidth * screenScale;
  const ratio = img.width / img.height;
  let dh = dw / ratio;

  const dx = -dw * 0.7 + Math.random() * (window.innerWidth + dw * 0.4);
  const dy = -dh * 0.7 + Math.random() * (window.innerHeight + dh * 0.4);

  activeImages.push({
    img, sx: 0, sy: 0, sw: img.width, sh: img.height, dx, dy, dw, dh,
    duration: (2000 + Math.random() * 4000) / OVERALL_SPEED,
    opacity: 0, hue: 0
  });
}

// Add this at the top of your script (outside any functions)
const measureCanvas = document.createElement("canvas");
const mCtx = measureCanvas.getContext("2d");

async function addSnippet() {
  if (!BLOG_SNIPPETS.length || activeSnippets.length >= MAX_SNIPPETS) return;

  // 1. Ensure the font is actually loaded before measuring
  await document.fonts.load(`${SNIPPET_FONT_SIZE}px BodyFont`);

  // 2. Use the off-screen context to measure (isolated from the main loop)
  const fontStyle = `${SNIPPET_FONT_SIZE}px BodyFont`;
  mCtx.font = fontStyle;

  const text = BLOG_SNIPPETS[(Math.random() * BLOG_SNIPPETS.length) | 0];
  const maxWidth = window.innerWidth * (0.15 + Math.random() * 0.3);
  const words = text.split(/\s+/); // Split by any whitespace
  const lines = [];
  let currentLine = "";
  let finalMaxW = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = currentLine + words[n] + " ";
    // Measure using the isolated context
    const testWidth = mCtx.measureText(testLine.trim()).width;

    if (testWidth > maxWidth && n > 0) {
      const lineW = mCtx.measureText(currentLine.trim()).width;
      lines.push({ text: currentLine.trim(), w: lineW });
      finalMaxW = Math.max(finalMaxW, lineW);
      currentLine = words[n] + " ";
    } else {
      currentLine = testLine;
    }
  }

  // Final line
  const lastLineText = currentLine.trim();
  const lastLineW = mCtx.measureText(lastLineText).width;
  lines.push({ text: lastLineText, w: lastLineW });
  finalMaxW = Math.max(finalMaxW, lastLineW);

  // 3. Add generous padding
  // Increase horizontal padding to 40 to account for browser kerning differences
  const boxW = finalMaxW + 40;
  const boxH = (lines.length * LINE_HEIGHT) + 20;

  let x, y, foundSpot = false;
  for(let i=0; i<30; i++) {
    x = 20 + Math.random() * (window.innerWidth - boxW - 40);
    y = 20 + Math.random() * (window.innerHeight - boxH - 120);
    if (!activeSnippets.some(existing => rectsOverlap({x, y, w: boxW, h: boxH}, existing))) {
      foundSpot = true; break;
    }
  }

  if (foundSpot) {
    const isDark = Math.random() < 0.5;
    activeSnippets.push({
      lines, x, y, w: boxW - 10, h: boxH - 6,
      duration: Math.max(MIN_SNIPPET_DURATION, text.length * CHAR_DURATION),
      color: isDark ? "#FFF" : "#000",
      bgColor: isDark ? "#000" : "#FFF",
      opacity: 0,
      font: fontStyle // Store the font used for measurement
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
  if (spawnTimer > 250) {
    spawnTimer = 0;
    spawnImage();
    fetchNewImage();
  }

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

  if (Math.random() < 0.2) addSnippet();

  activeSnippets.forEach((s) => {
    let renderY = s.y;

    if (!s.isPermanent) {
      const isFadingOut = s.duration < FADE_THRESHOLD;
      s.opacity = !isFadingOut ? Math.min(1, s.opacity + SNIPPET_FADE_IN_SPEED) : Math.max(0, s.opacity - SNIPPET_FADE_OUT_SPEED);
      s.duration -= delta;
    } else {
      // Bobbing logic for permanent button
      s.bobTimer += delta * 0.002;
      renderY += Math.sin(s.bobTimer) * 9; // Bob height
      s.hue = (s.hue + 1) % 360;
    }

    if (s.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = s.opacity;

      if (s.isPermanent && s.useLogo) {
        ctx.drawImage(logoImg, s.x | 0, renderY | 0, s.w | 0, s.h | 0);
      } else {
        if(s.isPermanent) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsl(${s.hue}, 80%, 60%)`;
            ctx.fillStyle = `hsl(${s.hue}, 80%, 30%)`;
        } else {
            ctx.fillStyle = s.bgColor;
        }

        ctx.fillRect(s.x | 0, renderY | 0, s.w | 0, s.h | 0);
        ctx.fillStyle = s.color;
        ctx.textBaseline = "top";

        if (s.isPermanent) {
          ctx.font = `bold ${SNIPPET_FONT_SIZE}px BodyFont`;
          ctx.textAlign = "center";
          ctx.fillText(s.text, (s.x + s.w / 2) | 0, (renderY + 10) | 0);
        } else {
          ctx.font = `${SNIPPET_FONT_SIZE}px BodyFont`;
          ctx.textAlign = "left";
          s.lines.forEach((line, j) => ctx.fillText(line.text, (s.x + 10) | 0, (renderY + j * LINE_HEIGHT + 8) | 0));
        }
      }
      ctx.restore();

      // Update hit-box for dragging/clicking if it bobs
      if(s.isPermanent) s.currentRenderY = renderY;
    }
  });
  activeSnippets = activeSnippets.filter(s => s.isPermanent || s.duration > 0 || s.opacity > 0 || draggingSnippet === s);
}

/** --- 5. INTERACTION --- **/

function handleStart(e) {
  const isTouch = e.type === "touchstart";
  const pageX = isTouch ? e.touches[0].clientX : e.offsetX;
  const pageY = isTouch ? e.touches[0].clientY : e.offsetY;

  for (let i = activeSnippets.length - 1; i >= 0; i--) {
    const s = activeSnippets[i];
    const checkY = s.isPermanent ? (s.currentRenderY || s.y) : s.y;

    if (pageX >= s.x && pageX <= s.x + s.w && pageY >= checkY && pageY <= checkY + s.h) {
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

  // 1. Wait for your custom font to be ready
  if (document.fonts) {
    await document.fonts.ready;
  }

  // 2. Optional Logo Loading
  if (LOGO_URL) {
    logoImg = new Image();
    const logoPromise = new Promise(res => {
        logoImg.onload = res;
        logoImg.onerror = () => { logoImg = null; res(); };
        logoImg.src = LOGO_URL;
    });
    await logoPromise;
  }

  const initialLoads = Array.from({ length: 12 }, () => fetchNewImage());
  await Promise.all(initialLoads);

  // 3. Now spawn the box with accurate measurements
  spawnPermanentBox();
  requestAnimationFrame(loop);
})();
