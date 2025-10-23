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
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const fragment = document.createDocumentFragment();
      node.textContent.split('').forEach(char => {
        const span = document.createElement('span');
        span.textContent = char;
        if (char === ' ') span.classList.add('space');
        fragment.appendChild(span);
      });
      node.replaceWith(fragment);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      wrapTextNodes(node); // recurse into children like <h3>
    }
  });
}

function startTwitterEffect(container = document) {
  // Step 1: wrap text nodes in all .twitter-text elements
  const twitterDivs = container.querySelectorAll('.twitter-text');

  twitterDivs.forEach(div => wrapTextNodes(div));

  // Step 2: start animation
  setInterval(() => {
    twitterDivs.forEach(div => {
      div.querySelectorAll('span, img').forEach(el => {
        const x = (Math.random() - 0.5) * 4;   // horizontal jitter
        const y = (Math.random() - 0.5) * 4;   // vertical jitter
        const rotate = (Math.random() - 0.5) * 20; // random rotation
        el.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
      });
    });
  }, 100);
}

// ✅ Just call this once after DOM loads
startTwitterEffect();
