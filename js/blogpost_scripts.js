// Initialize blog
function wrapHeaders() {
  // Select all h1 elements
  const h1Elements = document.querySelectorAll("h1");

  h1Elements.forEach(h1 => {
    // Create a wrapper div
    const wrapper = document.createElement("div");
    wrapper.className = "twitter-text";

    // Insert the h1 inside the wrapper
    h1.parentNode.insertBefore(wrapper, h1);
    wrapper.appendChild(h1);
  });

  // make all links open in a new tab
  document.getElementById('blog-content').querySelectorAll('a').forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer'); // recommended for security
  });
};

// arriving from the peace page's search (?q=words): the words light up in the post, and the page goes to the first one
window.addEventListener('load', () => {
  const q = new URLSearchParams(location.search).get('q');
  const box = document.getElementById('blog-content');
  if (!q || !box) return;
  const terms = q.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return;
  const re = new RegExp('(' + terms.join('|') + ')', 'gi');
  const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => n.parentNode.closest('script, style, mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walk.nextNode()) if (re.test(walk.currentNode.nodeValue)) nodes.push(walk.currentNode), re.lastIndex = 0;
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    n.nodeValue.split(re).forEach((part, i) => {
      if (i % 2) { const m = document.createElement('mark'); m.className = 'found'; m.textContent = part; frag.appendChild(m); }
      else if (part) frag.appendChild(document.createTextNode(part));
    });
    n.parentNode.replaceChild(frag, n);
  }
  const first = box.querySelector('mark.found');
  if (first) setTimeout(() => first.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200);
});
