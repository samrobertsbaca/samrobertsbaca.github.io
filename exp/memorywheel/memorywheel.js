import { IMAGE_URLS, BLOG_SNIPPETS } from './media.js';

// ── Configuration ──────────────────────────────────────────────
const CONFIG = {
  numRings: 5,
  baseRadius: 20,
  ringSpacing: 65,
  ringWidth: 65,
  centerRadius: 42,
  itemsPerRing: 12,
  maxWordLength: 12,
  maxWordLengthPerRing: [6, 8, 10, 12, 12, 12],
  friction: 0.92,
  inertia: 0.85,
  fontScale: 0.065,
  minFontSize: 9,
  maxFontSize: 22,
  ringColors: [
    '#2255cc',
    '#1a4daa',
    '#0088cc',
    '#00aacc',
    '#00cccc',
    '#40e0d0',
  ],
  ringGlows: [
    'rgba(34,85,204,0.25)',
    'rgba(26,77,170,0.22)',
    'rgba(0,136,204,0.20)',
    'rgba(0,170,204,0.18)',
    'rgba(0,204,204,0.16)',
    'rgba(64,224,208,0.14)',
  ],
  bgColor1: '#0a0a14',
  bgColor2: '#0e0e1e',
  textColor: '#c8b888',
  textHoverColor: '#fff8e0',
  textDimColor: 'rgba(200,184,136,0.3)',
  lineColor: '#00ffcc',
  lineColor2: '#ff66cc',
  fontFamily: "'IBM Plex Mono', monospace",
  fontTitle: "'IBM Plex Mono', monospace",
  labelFontSize: 11,
};

// ── Utility Functions ──────────────────────────────────────────
function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function polarToCartesian(cx, cy, r, angle) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function angleDiff(a, b) {
  return Math.abs(normalizeAngle(a - b));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ── Ring Class ─────────────────────────────────────────────────
class Ring {
  constructor(radius, items, color, glowColor, index) {
    this.radius = radius;
    this.items = items;
    this.color = color;
    this.glowColor = glowColor;
    this.index = index;
    this.rotation = 0;
    this.targetRotation = 0;
    this.angularVelocity = 0;
    this.width = CONFIG.ringWidth;
  }

  rotateBy(delta) {
    this.rotation += delta;
    this.targetRotation = this.rotation;
  }

  update() {
    this.angularVelocity *= CONFIG.friction;
    if (Math.abs(this.angularVelocity) < 0.0001) this.angularVelocity = 0;
    this.rotation += this.angularVelocity;
  }

  getItemAtAngle(angle) {
    const normAngle = normalizeAngle(angle);
    let best = null;
    let bestDiff = Infinity;
    const itemAngleStep = (Math.PI * 2) / this.items.length;

    for (let i = 0; i < this.items.length; i++) {
      const itemAngle = normalizeAngle(this.rotation + i * itemAngleStep);
      const diff = angleDiff(normAngle, itemAngle);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = { item: this.items[i], index: i, angle: itemAngle };
      }
    }

    // Only return if close enough to an item
    const tolerance = itemAngleStep * 0.6;
    return bestDiff < tolerance ? best : null;
  }
}

// ── MemoryWheel Class ──────────────────────────────────────────
class MemoryWheel {
  constructor() {
    this.canvas = document.getElementById('wheel');
    this.ctx = this.canvas.getContext('2d');
    this.tooltipEl = document.getElementById('tooltip');
    this.hintEl = document.getElementById('hint');

    this.rings = [];
    this.centerImage = new Image();
    this.centerImageLoaded = false;

    this.hoveredItem = null;
    this.hoveredRing = null;
    this.draggingRing = null;
    this.lastMouse = { x: 0, y: 0 };
    this.lastMouseAngle = 0;

    this.lockedItem = null;

    this.animTime = 0;
    this.idleTime = 0;

    this.init();
  }

  init() {
    this.resize();
    this.loadAssets();
    this.generateRings();
    this.setupEvents();
    this.animate(0);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.cx = window.innerWidth / 2;
    this.cy = window.innerHeight / 2;
    this.wheelRadius = Math.min(this.cx, this.cy) * 0.85;

    // Recalculate ring radii based on new size
    const maxRingRadius = this.wheelRadius - 30;
    const totalSpacing = CONFIG.numRings * CONFIG.ringSpacing;
    const availableSpace = maxRingRadius - CONFIG.baseRadius;
    const scale = Math.min(1, availableSpace / totalSpacing);

    this.rings.forEach((ring, i) => {
      ring.radius = CONFIG.baseRadius + i * CONFIG.ringSpacing * scale;
      ring.width = CONFIG.ringWidth * scale;
    });
  }

  loadAssets() {
    this.centerImage.src = 'scorsby.png';
    this.centerImage.onload = () => {
      this.centerImageLoaded = true;
    };
  }

  generateRings() {
    // Extract all unique single words from BLOG_SNIPPETS
    const stopWords = new Set([
      'the','a','an','is','are','was','were','be','been','being',
      'have','has','had','do','does','did','will','would','could',
      'should','may','might','shall','can','need','dare','ought',
      'used','to','of','in','for','on','with','at','by','from',
      'as','into','through','during','before','after','above','below',
      'between','out','off','over','under','again','further','then',
      'once','here','there','when','where','why','how','all','both',
      'each','few','more','most','other','some','such','no','nor',
      'not','only','own','same','so','than','too','very','s','t',
      'just','don','now','and','but','or','if','while','it','its',
      'this','that','these','those','i','me','my','myself','we',
      'our','ours','ourselves','you','your','yours','yourself',
      'yourselves','he','him','his','himself','she','her','hers',
      'herself','they','them','their','theirs','themselves','what',
      'which','who','whom','this','that','these','those','am','is',
      'are','was','were','be','been','being','have','has','had',
      'having','do','does','did','doing','a','an','the','and','but',
      'if','or','because','until','while','of','at','by','for',
      'with','about','against','between','into','through','during',
      'before','after','above','below','to','from','up','down','in',
      'out','on','off','over','under','again','further','then','once',
      'here','there','when','where','why','how','all','any','both',
      'each','few','more','most','other','some','such','no','nor',
      'not','only','own','same','so','than','too','very','s','t',
      'can','will','just','don','should','now','d','ll','m','o',
      're','ve','y','ain','aren','couldn','didn','doesn','hadn',
      'hasn','haven','isn','ma','mightn','mustn','needn','shan',
      'shouldn','wasn','weren','won','wouldn','also','like','get',
      'got','say','said','know','think','see','come','go','take',
      'make','want','look','use','find','give','tell','work',
      'call','try','ask','need','feel','become','leave','put',
      'mean','keep','let','begin','seem','help','show','hear',
      'play','run','move','live','believe','hold','bring','happen',
      'write','provide','sit','stand','lose','pay','meet','include',
      'continue','set','learn','change','lead','understand','watch',
      'follow','stop','create','speak','read','allow','add','grow',
      'open','walk','win','teach','offer','remember','love','believe',
      'belong','scorsby','ring','wheel','memory','bruno','cosmos',
      'star','light','shadow','truth','freedom','love','life','death',
      'time','space','mind','body','soul','spirit','god','world',
      'earth','fire','water','air','ether','circle','sphere','plane',
    ]);

    // Collect all words from all snippets
    const allWords = new Set();
    for (const snippet of BLOG_SNIPPETS) {
      const words = snippet
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && w.length <= CONFIG.maxWordLength && !stopWords.has(w));
      for (const w of words) {
        allWords.add(w);
      }
    }

    // Also extract words from image URLs (filename stems)
    for (const url of IMAGE_URLS) {
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      const name = filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_]/gi, ' ');
      const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w.length <= CONFIG.maxWordLength && !stopWords.has(w));
      for (const w of words) {
        allWords.add(w);
      }
    }

    const wordList = Array.from(allWords);
    const shuffled = shuffle(wordList);
    const totalItems = CONFIG.itemsPerRing * CONFIG.numRings;
    const usedWords = shuffled.slice(0, Math.min(totalItems, shuffled.length));

     for (let i = 0; i < CONFIG.numRings; i++) {
       const ringMaxLength = CONFIG.maxWordLengthPerRing[i] || CONFIG.maxWordLength;
       const start = i * CONFIG.itemsPerRing;
       const end = Math.min(start + CONFIG.itemsPerRing, usedWords.length);
       const ringWords = usedWords.slice(start, end).filter(w => w.length <= ringMaxLength);

       const radius = CONFIG.baseRadius + i * CONFIG.ringSpacing;
       const color = CONFIG.ringColors[i % CONFIG.ringColors.length];
       const glowColor = CONFIG.ringGlows[i % CONFIG.ringGlows.length];

      const items = ringWords.map((word, j) => {
        const baseAngle = (j / CONFIG.itemsPerRing) * Math.PI * 2;
        return {
          text: word,
          displayText: word,
          fullText: word,
          baseAngle: baseAngle,
          keyword: word,
        };
      });

      this.rings.push(new Ring(radius, items, color, glowColor, i));
    }
  }

  setupEvents() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));

    // Touch events
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

    // Resize
    window.addEventListener('resize', this.resize.bind(this));

    // Hide hint after first interaction
    this.canvas.addEventListener('mousedown', () => this.hideHint(), { once: true });
    this.canvas.addEventListener('touchstart', () => this.hideHint(), { once: true });

    // Keyboard: R to regenerate
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        this.regenerate();
      }
    });
  }

  regenerate() {
    this.rings = [];
    this.hoveredItem = null;
    this.hoveredRing = null;
    this.generateRings();
    this.hideTooltip();
  }

  hideHint() {
    this.hintEl.style.opacity = '0';
  }

  // ── Event Handlers ──────────────────────────────────────────
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  getAngleFromCenter(pos) {
    return Math.atan2(pos.y - this.cy, pos.x - this.cx);
  }

  getRingAtDistance(dist) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      if (Math.abs(dist - ring.radius) < ring.width / 2 + 10) {
        return ring;
      }
    }
    return null;
  }

  onMouseDown(e) {
    const pos = this.getMousePos(e);
    const dist = Math.hypot(pos.x - this.cx, pos.y - this.cy);
    const angle = this.getAngleFromCenter(pos);

    const ring = this.getRingAtDistance(dist);
    if (ring) {
      this.draggingRing = ring;
      this.lastMouseAngle = angle;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  onMouseMove(e) {
    const pos = this.getMousePos(e);
    const dist = Math.hypot(pos.x - this.cx, pos.y - this.cy);
    const angle = this.getAngleFromCenter(pos);

    if (this.draggingRing) {
      const delta = angle - this.lastMouseAngle;
       this.draggingRing.rotateBy(delta);
       this.lastMouseAngle = angle;
       this.idleTime = 0;
       this.hideTooltip();
     } else {
      // Hover detection
      const ring = this.getRingAtDistance(dist);
      if (ring) {
        const hit = ring.getItemAtAngle(angle);
        if (hit) {
          this.hoveredItem = hit;
          this.hoveredRing = ring;
          this.showTooltip(hit, ring, pos);
          this.canvas.style.cursor = 'pointer';
        } else {
          this.hoveredItem = null;
          this.hoveredRing = null;
          this.hideTooltip();
          this.canvas.style.cursor = 'grab';
        }
      } else {
        this.hoveredItem = null;
        this.hoveredRing = null;
        this.hideTooltip();
        this.canvas.style.cursor = 'grab';
      }
    }

    this.lastMouse.x = pos.x;
    this.lastMouse.y = pos.y;
  }

  onMouseUp(e) {
    if (this.draggingRing) {
      this.draggingRing = null;
      this.canvas.style.cursor = 'grab';
    }
  }

  onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = { x: touch.clientX, y: touch.clientY };
    const dist = Math.hypot(pos.x - this.cx, pos.y - this.cy);
    const angle = this.getAngleFromCenter(pos);

    const ring = this.getRingAtDistance(dist);
    if (ring) {
      this.draggingRing = ring;
      this.lastMouseAngle = angle;
      this.idleTime = 0;
    }
  }

  onTouchMove(e) {
    e.preventDefault();
    if (!this.draggingRing || !e.touches.length) return;
    const touch = e.touches[0];
    const pos = { x: touch.clientX, y: touch.clientY };
    const angle = this.getAngleFromCenter(pos);

    const delta = angle - this.lastMouseAngle;
    this.draggingRing.rotateBy(delta);
    this.lastMouseAngle = angle;
    this.hideTooltip();
  }

  onTouchEnd(e) {
    this.draggingRing = null;
  }

  // ── Tooltip ─────────────────────────────────────────────────
  showTooltip(hit, ring, pos) {
    const tooltip = this.tooltipEl;
    tooltip.querySelector('.tooltip-label').textContent = 'Word';
    tooltip.querySelector('.tooltip-text').textContent = hit.item.fullText;
    tooltip.querySelector('.tooltip-ring').textContent = `Ring ${ring.index + 1}`;
    tooltip.style.display = 'block';

    // Position tooltip near mouse but keep on screen
    let tx = pos.x + 16;
    let ty = pos.y - 10;
    if (tx + 340 > window.innerWidth) tx = pos.x - 356;
    if (ty + 120 > window.innerHeight) ty = pos.y - 120;
    if (ty < 10) ty = 10;
    if (tx < 10) tx = 10;

    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  }

   hideTooltip() {
     this.tooltipEl.style.display = 'none';
   }

   // ── Rendering ─────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bgGrad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.wheelRadius * 1.5);
    bgGrad.addColorStop(0, CONFIG.bgColor2);
    bgGrad.addColorStop(1, CONFIG.bgColor1);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle starfield
    this.drawStarfield(ctx);

    // Rings
    for (const ring of this.rings) {
      this.drawRing(ctx, ring);
    }

    // Items on rings
    this.drawItems(ctx);

    // Center image
    this.drawCenterImage(ctx);

    // Outer decorative ring
    this.drawOuterRing(ctx);
  }

  drawStarfield(ctx) {
    // Use a seeded pseudo-random for consistent stars
    const seed = 42;
    const starCount = 80;
    ctx.save();
    for (let i = 0; i < starCount; i++) {
      const x = ((seed * (i + 1) * 7919) % 1000) / 1000 * window.innerWidth;
      const y = ((seed * (i + 1) * 6271) % 1000) / 1000 * window.innerHeight;
      const r = ((seed * (i + 1) * 3571) % 100) / 1000 * 1.5 + 0.3;
      const alpha = ((seed * (i + 1) * 9181) % 100) / 100 * 0.4 + 0.1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,190,160,${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }

  drawRing(ctx, ring) {
    const { cx, cy } = this;

    // Ring glow
    ctx.beginPath();
    ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = ring.glowColor;
    ctx.lineWidth = ring.width + 8;
    ctx.stroke();

    // Ring border
    ctx.beginPath();
    ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color + '40';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ring fill (very subtle)
    ctx.beginPath();
    ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color + '08';
    ctx.lineWidth = ring.width;
    ctx.stroke();
  }

  drawItems(ctx) {
    for (const ring of this.rings) {
      const step = (Math.PI * 2) / ring.items.length;
      const textR = ring.radius;

      for (let i = 0; i < ring.items.length; i++) {
        const itemAngle = ring.rotation + i * step;
        const pos = polarToCartesian(this.cx, this.cy, textR, itemAngle);
        const isHovered = this.hoveredItem && this.hoveredItem.index === i && this.hoveredRing === ring;

        // Draw text tangentially (in line with the circle)
        ctx.save();
        ctx.translate(pos.x, pos.y);

        // Tangential orientation: text follows the ring's circumference
        // Rotate by item angle + PI/2 so text is tangent to the circle
        let textAngle = itemAngle + Math.PI / 2;
        // Flip text on the horizontal axis (left and right sides) so it's
        // upside down there, readable on top and bottom
        if (Math.abs(Math.cos(itemAngle)) > Math.abs(Math.sin(itemAngle))) {
          textAngle += Math.PI;
        }
        ctx.rotate(textAngle);

        const fontSize = clamp(ring.radius * CONFIG.fontScale, CONFIG.minFontSize, CONFIG.maxFontSize);
        ctx.font = `${isHovered ? '600' : '400'} ${fontSize}px ${CONFIG.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isHovered) {
          ctx.fillStyle = CONFIG.textHoverColor;
          ctx.shadowColor = ring.color;
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = CONFIG.textColor;
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.fillText(ring.items[i].displayText, 0, 0);
        ctx.restore();
      }
    }
   }

   drawCenterImage(ctx) {
     if (!this.centerImageLoaded) return;

     const { cx, cy } = this;

     // Draw image on top of everything, not confined within a circle
     const imgSize = CONFIG.centerRadius * 2.5;
     ctx.drawImage(this.centerImage, cx - imgSize / 2, cy - imgSize / 2, imgSize, imgSize);
   }

  drawOuterRing(ctx) {
    const { cx, cy } = this;
    const outerR = this.rings.length > 0
      ? this.rings[this.rings.length - 1].radius + this.rings[this.rings.length - 1].width / 2 + 20
      : 100;

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,168,76,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Animation Loop ──────────────────────────────────────────
  animate(timestamp) {
    this.animTime = timestamp * 0.001;

    // Slow idle rotation for all rings
    if (!this.draggingRing) {
      this.idleTime += 0.016;
      for (const ring of this.rings) {
        if (ring.angularVelocity === 0) {
          ring.rotateBy(Math.sin(this.idleTime * 0.3 + ring.index * 1.7) * 0.0003);
        }
      }
    }

    // Update physics
    for (const ring of this.rings) {
      ring.update();
    }

    // Render
    this.render();

    requestAnimationFrame((t) => this.animate(t));
  }
}

// ── Initialize ────────────────────────────────────────────────
const wheel = new MemoryWheel();
