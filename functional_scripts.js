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

// Load navbar from external file
function loadNavbar(targetSelector = 'nav') {
  fetch('./navbar.html')
    .then(response => response.text())
    .then(html => {
      document.querySelector(targetSelector).innerHTML = html;
    })
    .catch(err => console.error('Failed to load navbar:', err));
}

// Set up the scroll listener
window.addEventListener('scroll', handleNavbarShadow);


// Utility to convert filename to display text
function getPostDisplay(file) {
  const parts = file.split('/').pop().replace('.md', '').split('_');
  const date = parts[0];
  const title = parts.slice(1).join(' ').replace(/-/g, ' ');
  return { date, title };
}

// Wrap headers in twitter divs for animation
function wrapHeadersWithTwitter(container) {
  // Select all headers in the container

  // Select all h1 and images
  container.querySelectorAll('h1').forEach(el => {
    // wrap in a div for twitter animation
    const wrapper = document.createElement('div');
    wrapper.classList.add('twitter-text');

    // Move element into wrapper
    el.parentNode.replaceChild(wrapper, el);
    wrapper.appendChild(el);
  });
}

// Load a markdown file and render post
async function loadBlogPost(mdFile, postName) {
  const indexContainer = document.getElementById('blog-index');
  const contentContainer = document.getElementById('blog-content');

  indexContainer.style.display = 'none';

  const res = await fetch(mdFile);
  if (!res.ok) {
    contentContainer.innerHTML = "<p>Failed to load post.</p>";
    return;
  }
  const md = await res.text();
  contentContainer.innerHTML = marked.parse(md);

  // Wrap headers in twitter-text divs
  wrapHeadersWithTwitter(contentContainer);

  // Add Back links at top and bottom
  const backLinkTop = document.createElement('a');
  backLinkTop.href = "#";
  backLinkTop.textContent = "← Back to Blog List";
  backLinkTop.style.display = "block";
  backLinkTop.style.textAlign = "center";
  backLinkTop.style.margin = "1em 0";

  const backLinkBottom = backLinkTop.cloneNode(true);

  const backHandler = () => {
    contentContainer.innerHTML = "";
    indexContainer.style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Clear the hash so the same link works again
    history.pushState("", document.title, window.location.pathname + window.location.search);
  };

  backLinkTop.addEventListener('click', (e) => { e.preventDefault(); backHandler(); });
  backLinkBottom.addEventListener('click', (e) => { e.preventDefault(); backHandler(); });

  contentContainer.prepend(backLinkTop);
  contentContainer.appendChild(backLinkBottom);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Optional: call your twitching function here
  startTwitterEffect(contentContainer); // make sure this function exists
}


// Render the blog list
function renderBlogList(indexContainer) {
  indexContainer.innerHTML = "";

  const isMobile = window.innerWidth <= 768;

  window.postFiles.forEach(file => {
    const { date, title } = getPostDisplay(file);
    const postName = file.split('/').pop().replace('.md','');

    const wrapper = document.createElement('div'); // each line
    wrapper.style.margin = '0.3em 0';
    wrapper.style.fontFamily = 'inherit';  // ensures same font
    wrapper.style.fontSize = '1em';
    wrapper.style.lineHeight = '1.4em';

    // Date text
    const dateSpan = document.createElement('span');
    dateSpan.textContent = `${date} : `;
    dateSpan.style.marginRight = '0.3em';
    wrapper.appendChild(dateSpan);

    // Title link
    const link = document.createElement('a');
    link.href = `#${postName}`;

    let displayTitle = title;
    if (isMobile && title.length > 29) {
      displayTitle = title.slice(0,29) + '…';
      link.title = title; // tooltip shows full title
    }
    link.textContent = displayTitle;

    //link.textContent = title;
    link.style.color = '#00b4ff';   // default link color
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';

    // Hover color for title
    link.addEventListener('mouseover', () => link.style.color = '#551a8b');
    link.addEventListener('mouseout', () => link.style.color = '#00b4ff');

    wrapper.appendChild(link);

    indexContainer.appendChild(wrapper);
  });
}

// Handle hash change
async function handleHashChange() {
  const postName = window.location.hash.substring(1);
  if (!postName) return;

  const mdFile = window.postFiles.find(f => f.endsWith(`${postName}.md`));
  if (mdFile) {
    await loadBlogPost(mdFile, postName);
  }
}

// Initialize blog
document.addEventListener('DOMContentLoaded', () => {
  const indexContainer = document.getElementById('blog-index');
  renderBlogList(indexContainer);
  handleHashChange();
  window.addEventListener('hashchange', handleHashChange);
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

// Usage
const container = document.querySelector('.twitter-text');
wrapTextNodes(container);

Array.from(container.childNodes).forEach(node => {
  if (node.nodeType === Node.TEXT_NODE) {
    // wrap text in spans
    const text = node.textContent;
    const fragment = document.createDocumentFragment();

    for (let char of text) {
      const span = document.createElement('span');
      span.textContent = char;
      if (char === ' ') span.classList.add('space');
      fragment.appendChild(span);
    }

    node.replaceWith(fragment);
  } else if (node.tagName === 'IMG') {
    // mark images for animation
    node.classList.add('twitter-img');
  }
});

// animate letters and images
setInterval(() => {
  container.querySelectorAll('span, img.twitter-img').forEach(el => {
    const x = (Math.random() - 0.25) * 4;   // horizontal jitter
    const y = (Math.random() - 0.25) * 4;   // vertical jitter
    const rotate = -5 + (Math.random() - 0.25) * 20; // rotation
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
  });
}, 100);

function startTwitterEffect(container = document) {
  // Step 1: wrap text nodes and images
  const twitterDivs = container.querySelectorAll('.twitter-text');

  twitterDivs.forEach(div => {
    wrapTextNodes(div); // recursive function we made earlier
  });

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
