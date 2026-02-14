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
