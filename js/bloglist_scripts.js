
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
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';

    // Hover color for title
    link.addEventListener('mouseover', () => link.style.color = '#551a8b');
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


// Initialize blog
document.addEventListener('DOMContentLoaded', () => {
  const indexContainer = document.getElementById('blog-index');
  renderBlogList(indexContainer);
  handlePostParamOrHash();
  window.addEventListener('hashchange', handlePostParamOrHash);

  const footer = document.querySelector('footer');
  // One-time check
  if (document.documentElement.scrollHeight > window.innerHeight) {
    // Page is scrollable
    //footer.style.backgroundColor = '#00b4ff';
    footer.style.position = 'relative';
    footer.style.bottom = 'auto';
  }

});
