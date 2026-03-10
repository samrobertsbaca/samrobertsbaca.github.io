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

// Load navbar from external file
function loadNavbar(targetSelector = 'nav') {
  fetch('/navbar.html')
    .then(response => response.text())
    .then(html => {
      document.querySelector(targetSelector).innerHTML = html;

      // navbar text on home page
      if (window.location.pathname.includes('home.html')) {
        document.querySelector('.as-seen-on-tv').style.color = '#00b4ff';
      } else {
        {
          document.querySelector('.as-seen-on-tv').innerHTML = "";
        }
      }
    })
    .catch(err => console.error('Failed to load navbar:', err));
}

// Set up the scroll listener
window.addEventListener('scroll', handleNavbarShadow);

// Initialize blog
document.addEventListener('DOMContentLoaded', () => {

  const footer = document.querySelector('footer');
  // One-time check
  if (document.documentElement.scrollHeight > window.innerHeight) {
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


/*const RES_SCALE = 0.03;
const WARP = 3.4;
const SPEED = 0.006;
const NOISE_SCALE = 0.009;*/

(function() {
  const P5_CDN = "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js";

  // === CONFIG ===
  const PIXELATED = true;
  const RES_SCALE = 0.75;
  const ENABLE_MOUSE = false;
  const MOUSE_SENSITIVITY = 5.1; // How much the mouse distorts the field
  const SLIPPERINESS = 0.025;     // 0.01 (very slippery/slow) to 0.2 (snappy)

  const WARP = 3.4;
  const SPEED = 0.05;
  const NOISE_SCALE = 0.008;
  const MOBILE_BREAKPOINT = 768;

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
           || window.innerWidth < MOBILE_BREAKPOINT;
  };

  const initFluid = () => {
    if (isMobile()) return;

    new p5((p) => {
      let fluidShader;
      let mouseFollower = { x: 0.5, y: 0.5 }; // Starts at center

      const vs = `
        precision highp float;
        attribute vec3 aPosition;
        void main() {
          vec4 positionVec4 = vec4(aPosition, 1.0);
          positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
          gl_Position = positionVec4;
        }
      `;

      const fs = `
        precision highp float;
        uniform vec2 u_res;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform bool u_useMouse;
        uniform float u_sensitivity;
        uniform float u_warp;
        uniform float u_noise_scale;

        vec2 hash(vec2 p) {
            p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
            return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                           dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                       mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                           dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * noise(p);
            p *= 2.1;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / u_res.xy;
          vec2 p = (uv - 0.5) * u_noise_scale * u_res.xy;
          float t = u_time;

          vec2 globalShift = vec2(0.0);
          if(u_useMouse) {
            // Use the eased mouse position passed from JS
            vec2 m = u_mouse * 2.0 - 1.0;
            globalShift = m * u_sensitivity;
          }

          vec2 q = vec2(fbm(p + t * 0.2 + globalShift), fbm(p + vec2(1.0) - globalShift.yx));
          vec2 r = vec2(fbm(p + u_warp * q + vec2(1.7, 9.2) + t * 0.15 + globalShift * 0.5),
                        fbm(p + u_warp * q + vec2(8.3, 2.8) + t * 0.126 - globalShift * 0.5));

          float f = fbm(p + u_warp * r + (globalShift * 0.2));

          vec3 pink = vec3(1.0, 0.44, 0.83);
          vec3 blue = vec3(0.22, 0.75, 1.0);

          float val = smoothstep(0.25, 0.75, 0.5 + 0.5 * f);
          gl_FragColor = vec4(mix(pink, blue, val), 1.0);
        }
      `;

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
        p.pixelDensity(PIXELATED ? RES_SCALE : p.displayDensity());

        canvas.style('position', 'fixed');
        canvas.style('top', '0');
        canvas.style('left', '0');
        canvas.style('width', '100vw');
        canvas.style('height', '100vh');
        canvas.style('z-index', '-1');
        canvas.style('pointer-events', 'none');

        if (PIXELATED) {
          canvas.style('image-rendering', 'pixelated');
          canvas.style('image-rendering', 'crisp-edges');
        }

        fluidShader = p.createShader(vs, fs);
        p.noStroke();
      };

      p.draw = () => {
        // --- SLIPPERY LOGIC ---
        // Target is the actual mouse position (0..1)
        let targetX = p.mouseX / p.width;
        let targetY = 1.0 - (p.mouseY / p.height);

        // If mouse is off-screen or hasn't moved, target the center (0.5)
        if (p.mouseX <= 0 || p.mouseX >= p.width || p.mouseY <= 0 || p.mouseY >= p.height) {
           targetX = 0.5;
           targetY = 0.5;
        }

        // Lerp the follower toward the target
        mouseFollower.x = p.lerp(mouseFollower.x, targetX, SLIPPERINESS);
        mouseFollower.y = p.lerp(mouseFollower.y, targetY, SLIPPERINESS);

        p.shader(fluidShader);

        fluidShader.setUniform('u_res', [p.drawingContext.drawingBufferWidth, p.drawingContext.drawingBufferHeight]);
        fluidShader.setUniform('u_time', p.frameCount * SPEED);

        // Pass the eased follower instead of the raw mouse
        fluidShader.setUniform('u_mouse', [mouseFollower.x, mouseFollower.y]);
        fluidShader.setUniform('u_useMouse', ENABLE_MOUSE);
        fluidShader.setUniform('u_sensitivity', MOUSE_SENSITIVITY);
        fluidShader.setUniform('u_warp', WARP);
        fluidShader.setUniform('u_noise_scale', NOISE_SCALE);

        p.rect(0, 0, p.width, p.height);
      };

      p.windowResized = () => {
        if (isMobile()) {
          p.remove();
        } else {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
        }
      };
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
