// functional_scripts.js

// Hamburger toggle
function toggleMenu() {
  const navLinks = document.getElementById('nav-links');
  navLinks.classList.toggle('show');
}

// Navbar shadow on scroll
function handleNavbarShadow() {
  const nav = document.querySelector('nav');
  if (window.scrollY > 0) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }

}

const isScrollable = () => {
  return document.documentElement.scrollHeight > window.innerHeight;
};

// the navbar, drawn to match the world of scorsby on the home page
const NAV_LINKS = [['peace', '/blog.html'], ['love', '/works.html'], ['joy', '/about.html'], ['subscribe', '#subscribe'], ['shop', 'https://shop.scorsby.us']];
const DISCORD_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';

// "sun, oct 18 · 08:50:36 pm · now here" (the same clock as on the home page)
function scorsbyClock(d = new Date()) {
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).toLowerCase();
  return `${date} · ${time} · now here`;
}

function loadNavbar(targetSelector = 'nav') {
  const nav = document.querySelector(targetSelector);
  if (!nav) return;
  const here = location.pathname.replace(/\.html$/, '');
  const links = NAV_LINKS.map(([name, href]) => {
    const external = href.startsWith('http');
    const current = !external && (here === href.replace(/\.html$/, '') || (name === 'peace' && here.startsWith('/blog/')));
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}${current ? ' aria-current="page"' : ''}${href === '#subscribe' ? ' data-subscribe' : ''}>${name}</a>`;
  }).join('');
  nav.classList.add('world-nav');
  nav.innerHTML = `
    <div class="wn-left">
      <a class="wn-title" href="/home.html"><img class="wn-face" src="/scorsbyface.png" alt="scorsby"><span>world of scorsby</span></a>
      <p class="wn-clock">${scorsbyClock()}</p>
    </div>
    <button class="wn-burger" type="button" aria-label="menu" aria-expanded="false" aria-controls="wn-menu"><span></span><span></span><span></span></button>
    <div class="wn-right" id="wn-menu">
      <div class="wn-links">${links}</div>
      <a class="wn-discord" href="https://discord.gg/RBQ3dbYsaZ" target="_blank" rel="noopener">${DISCORD_SVG}<span>join the dream district</span></a>
      <p class="wn-clock wn-clock-menu">${scorsbyClock()}</p>
    </div>`;
  // the subscribe link opens a little letters window, the same one as on the home page
  if (!document.querySelector('script[src^="/subscribe.js"]')) { const sc = document.createElement('script'); sc.src = '/subscribe.js?v=2'; sc.defer = true; document.head.appendChild(sc); }
  const clocks = nav.querySelectorAll('.wn-clock');
  setInterval(() => { const t = scorsbyClock(); clocks.forEach((c) => { c.textContent = t; }); }, 1000);

  // on a phone the links fold away behind a hamburger
  const burger = nav.querySelector('.wn-burger');
  const setOpen = (open) => { nav.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); };
  burger.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

// Set up the scroll listener
window.addEventListener('scroll', handleNavbarShadow);

// Initialize blog
document.addEventListener('DOMContentLoaded', () => {

  const footer = document.querySelector('footer');
  // One-time check
  if (footer && document.documentElement.scrollHeight > window.innerHeight) {
    // Page is scrollable
    //footer.style.backgroundColor = '#00b4ff';
    footer.style.position = 'relative';
    footer.style.bottom = 'auto';
  }

});



// twitchy
function wrapTextNodes(element) {
  Array.from(element.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
      const fragment = document.createDocumentFragment();
      // Split by words/whitespace
      const words = node.textContent.split(/(\s+)/);

      words.forEach(word => {
        if (word.trim().length === 0) {
          // It's a space: keep it simple
          const spaceSpan = document.createElement('span');
          spaceSpan.textContent = word;
          spaceSpan.classList.add('space');
          fragment.appendChild(spaceSpan);
        } else {
          // It's a word: Wrap it so it doesn't break mid-way
          const wordWrap = document.createElement('span');
          wordWrap.style.whiteSpace = 'nowrap';
          wordWrap.style.display = 'inline-block';

          // Now wrap the actual characters for the jitter
          word.split('').forEach(char => {
            const charSpan = document.createElement('span');
            charSpan.textContent = char;
            charSpan.classList.add('jitter-bit'); // Unique class for the effect
            wordWrap.appendChild(charSpan);
          });
          fragment.appendChild(wordWrap);
        }
      });
      node.replaceWith(fragment);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      wrapTextNodes(node);
    }
  });
}

function startTwitterEffect(container = document) {
  const twitterDivs = container.querySelectorAll('.twitter-text');
  twitterDivs.forEach(div => wrapTextNodes(div));

  // The core logic extracted so we can call it immediately
  function applyJitter() {
    twitterDivs.forEach(div => {
      div.querySelectorAll('.jitter-bit, img').forEach(el => {
        const x = (Math.random() - 0.5) * 4; // Range of 3px
        const y = (Math.random() - 0.5) * 4;
        const rotate = (Math.random() - 0.5) * 25; // Range of 8 degrees

        el.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
      });
    });
  }

  // 1. Run it immediately
  applyJitter();

  // 2. Then set the interval to keep it twitching
  // 60-80ms is the sweet spot for a "frantic" but readable twitch
  setInterval(applyJitter, 60);
}

startTwitterEffect();






// 1. Setup the Markdown Renderer
const renderer = new marked.Renderer();

// In modern Marked, the first argument is an object!
// We destructure it to get 'text'
renderer.heading = function({ text, depth }) {
    // 'depth' is the heading level (1 for h1, 2 for h2, etc.)
    return `
        <div class="twitter-text">
            <h${depth} style="font-weight: bold;">${text}</h${depth}>
        </div>`;
};

// 2. The Loading Function
async function loadScorsbyJournal(filePath,div_tag) {
    try {
        const response = await fetch(filePath);
        const mdText = await response.text();

        // Convert MD to HTML with our custom header wrapper
        const htmlContent = marked.parse(mdText, { renderer: renderer });

        // Inject into your page container
        const container = document.getElementById(div_tag);
        container.innerHTML = htmlContent;

        // 3. TRIGGER YOUR FUNCTIONS
        // We pass the container to your effect function so it
        // specifically targets the newly injected content.
        startTwitterEffect(container);

    } catch (error) {
        console.error("Failed to load journal:", error);
    }
}


(function() {

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
  if (isMobile) return;
  // peace, love and joy (and every post on peace) are plain white
  if (/^\/(blog|works|about)(\.html)?$|^\/blog\//.test(location.pathname)) return;

  const P5_CDN = "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js";

  // === CONFIG ===
  const FOLLOW_MOUSE = false;  // SET TO FALSE TO CENTER DISTORTION ON WINDOW
  const PIXELATED = true;
  const RES_SCALE = 0.4;
  const STRENGTH = 12.0;
  const SLIPPERINESS = 0.05;
  const WARP = 4.0;
  const SPEED = 0.03;
  const NOISE_SCALE = 0.006;

  const initFluid = () => {
    new p5((p) => {
      let fluidShader;
      let mouseFollower = { x: 0.5, y: 0.5 };

      const vs = `
        precision highp float;
        attribute vec3 aPosition;
        void main() {
          gl_Position = vec4(aPosition.xy * 2.0 - 1.0, 0.0, 1.0);
        }
      `;

      const fs = `
        precision highp float;
        uniform vec2 u_res;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform float u_strength;
        uniform float u_warp;
        uniform float u_noise_scale;

        vec2 hash(vec2 p) {
            p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
            return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
        }

        float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(dot(hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),
                           dot(hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),
                       mix(dot(hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),
                           dot(hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);
        }

        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * noise(p);
            p *= 2.1; a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / u_res.xy;
          vec2 p = (uv - 0.5) * u_noise_scale * u_res.xy;

          float dist = distance(uv, u_mouse);
          float influence = exp(-dist * 5.0);

          vec2 stir = (uv - u_mouse) * influence * u_strength;
          vec2 distortedP = p + stir;

          float t = u_time;

          vec2 q = vec2(fbm(distortedP + t * 0.2), fbm(distortedP + vec2(1.0)));
          vec2 r = vec2(fbm(distortedP + u_warp * q + vec2(1.7, 9.2) + t * 0.15),
                        fbm(distortedP + u_warp * q + vec2(8.3, 2.8) + t * 0.126));

          float f = fbm(distortedP + u_warp * r);

          vec3 pink = vec3(1.0, 0.44, 0.83);
          vec3 blue = vec3(0.22, 0.75, 1.0);

          float activity = length(stir) * 0.5 + f * 0.5;
          float val = smoothstep(0.1, 0.9, activity + 0.3);

          gl_FragColor = vec4(mix(pink, blue, clamp(val, 0.0, 1.0)), 1.0);
        }
      `;

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
        p.pixelDensity(PIXELATED ? RES_SCALE : p.displayDensity());
        canvas.style('position', 'fixed');
        canvas.style('top', '0');
        canvas.style('left', '0');
        canvas.style('z-index', '-1');
        canvas.style('pointer-events', 'none');
        if (PIXELATED) canvas.style('image-rendering', 'pixelated');
        fluidShader = p.createShader(vs, fs);
        p.noStroke();
      };

      p.draw = () => {
        let tx, ty;

        if (FOLLOW_MOUSE) {
            // Standard mouse following logic
            tx = p.mouseX / p.width;
            ty = 1.0 - (p.mouseY / p.height);

            // If mouse is off-canvas, use idle movement
            if (p.mouseX <= 0 || p.mouseX >= p.width || p.mouseY <= 0 || p.mouseY >= p.height) {
                tx = 0.5 + Math.sin(p.frameCount * 0.01) * 0.1;
                ty = 0.5 + Math.cos(p.frameCount * 0.01) * 0.1;
            }
        } else {
            // Locked to center
            tx = 0.5;
            ty = 0.5;
        }

        mouseFollower.x = p.lerp(mouseFollower.x, tx, SLIPPERINESS);
        mouseFollower.y = p.lerp(mouseFollower.y, ty, SLIPPERINESS);

        p.shader(fluidShader);
        fluidShader.setUniform('u_res', [p.drawingContext.drawingBufferWidth, p.drawingContext.drawingBufferHeight]);
        fluidShader.setUniform('u_time', p.frameCount * SPEED);
        fluidShader.setUniform('u_mouse', [mouseFollower.x, mouseFollower.y]);
        fluidShader.setUniform('u_strength', STRENGTH);
        fluidShader.setUniform('u_warp', WARP);
        fluidShader.setUniform('u_noise_scale', NOISE_SCALE);
        p.rect(0, 0, p.width, p.height);
      };

      p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
    });
  };

  if (typeof p5 === 'undefined') {
    const script = document.createElement('script');
    script.src = P5_CDN;
    script.onload = initFluid;
    document.head.appendChild(script);
  } else {
    initFluid();
  }
})();
