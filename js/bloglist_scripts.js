
// Utility to convert filename to display text
function getPostDisplay(file) {
  const parts = file.split('/').pop().replace('.html', '').split('_');
  const date = parts[0];
  const title = parts.slice(1).join(' ').replace(/-/g, ' ');
  return { date, title };
}

function renderBlogList(indexContainer) {
  indexContainer.innerHTML = "";

  const isMobile = window.innerWidth <= 768;

  window.postFiles.forEach(file => {
    const { date, title } = getPostDisplay(file);
    const postName = file.split('/').pop().replace('.html','');

    const wrapper = document.createElement('div'); // each line
    wrapper.style.margin = '0.3em 0';
    wrapper.style.fontFamily = 'inherit';  // ensures same font
    wrapper.style.fontSize = '1em';
    wrapper.style.lineHeight = '1.4em';

    // Date text
    const dateSpan = document.createElement('span');
    dateSpan.textContent = `${date} : `;
    dateSpan.style.marginRight = '0.3em';
    dateSpan.style.fontWeight = 'bold';
    wrapper.appendChild(dateSpan);

    // Title link
    const link = document.createElement('a');
    link.href = `/blog/${postName}.html`;
    //link.href = `#${postName}`;


    const width = window.innerWidth;
    let maxLength;

    if (width < 480) {
      maxLength = 20; // small mobile
    } else if (width < 768) {
      maxLength = 30; // larger mobile / small tablet
    } else if (width < 1024) {
      maxLength = 50; // tablet / small desktop
    } else {
      maxLength = 80; // desktop
    }

    let displayTitle = title;
    if (title.length > maxLength) {
      displayTitle = title.slice(0, maxLength) + '…';
      link.title = title; // full title as tooltip
    } else {
      link.removeAttribute('title');
    }

    link.textContent = displayTitle;

    //link.textContent = title;
    link.style.color = '#00b4ff';   // default link color
    link.style.textDecoration = 'none';
    link.style.cursor = 'pointer';

    // Hover color for title
    link.addEventListener('mouseover', () => link.style.color = 'red');
    link.addEventListener('mouseout', () => link.style.color = '#00b4ff');

    wrapper.appendChild(link);

    indexContainer.appendChild(wrapper);
  });
}

async function handlePostParamOrHash() {
  // Get the post name from query parameter
  const params = new URLSearchParams(window.location.search);
  let postName = params.get('post');

  // Fallback to hash
  if (!postName && window.location.hash) {
    postName = window.location.hash.substring(1);
    // Update URL to use query param (optional)
    history.replaceState(null, '', `?post=${postName}`);
  }

  if (!postName) return;

  // Find the HTML link corresponding to the post
  const htmlFile = window.postFiles.find(f => f.endsWith(`${postName}.html`));

  if (htmlFile) {
    // Redirect browser to the HTML page
    window.location.href = htmlFile;
  }
}


// search: the words of every post (blog/search_index.js) are loaded the first time someone searches.
// while there are words in the box, the list shows only the posts that have all of them, with a little of the text.
function setupSearch(indexContainer) {
  const input = document.getElementById('search-in');
  if (!input) return;
  let loading = null, timer = 0;
  const load = () => loading || (loading = new Promise((done) => {
    const sc = document.createElement('script');
    sc.src = '/blog/search_index.js?v=' + (window.postFiles ? window.postFiles.length : 0);
    sc.onload = done; sc.onerror = done;
    document.head.appendChild(sc);
  }));
  const esc = (t) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fold = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const show = async () => {
    const q = fold(input.value.trim());
    if (!q) return renderBlogList(indexContainer);
    await load();
    const terms = q.split(/\s+/).filter(Boolean);
    const found = (window.searchIndex || []).map((p) => {
      const t = fold(p.t), x = fold(p.x);
      if (!terms.every((w) => t.includes(w) || x.includes(w))) return null;
      return { p, score: terms.reduce((n, w) => n + (t.includes(w) ? 10 : 0) + Math.min(5, x.split(w).length - 1), 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score || (a.p.d < b.p.d ? 1 : -1));
    indexContainer.innerHTML = '';
    if (!found.length) { indexContainer.innerHTML = '<p class="search-none">nothing found. try fewer words.</p>'; return; }
    for (const { p } of found) {
      const x = fold(p.x), at = Math.max(0, x.indexOf(terms[0]));
      let bit = p.x.slice(Math.max(0, at - 50), at + 110).trim();
      bit = (at > 50 ? '…' : '') + esc(bit) + '…';
      for (const w of terms) bit = bit.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
      const row = document.createElement('div'); row.className = 'search-hit';
      row.innerHTML = `<span class="d">${esc(p.d)}</span> <a href="${esc(p.u)}?q=${encodeURIComponent(input.value.trim())}">${esc(p.t)}</a><p>${bit}</p>`;
      indexContainer.appendChild(row);
    }
  };
  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(show, 150); });
}

// Initialize blog
document.addEventListener('DOMContentLoaded', () => {
  const indexContainer = document.getElementById('blog-index');
  renderBlogList(indexContainer);
  setupSearch(indexContainer);
  handlePostParamOrHash();
  window.addEventListener('hashchange', handlePostParamOrHash);

  const footer = document.querySelector('footer');
  // One-time check
  if (footer && document.documentElement.scrollHeight > window.innerHeight) {
    // Page is scrollable
    //footer.style.backgroundColor = '#00b4ff';
    footer.style.position = 'relative';
    footer.style.bottom = 'auto';
  }

});
