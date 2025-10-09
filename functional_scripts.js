// functional_scripts.js

window.postFiles = [
  "/blog/2025-10-07_what_am_i.md",
  "/blog/2025-10-05_note_to_self.md",
  "/blog/2025-10-04_the_myth_of_separation.md",
  "/blog/2025-10-02_naked_and_in_love.md",
  "/blog/2025-09-29_may_we_all_die_in_peace.md",
  "/blog/2025-09-28_awaken_one.md",
  "/blog/2025-09-25_the_gift.md",
  "/blog/2025-09-23_a_pantilla_crumb_of_faith.md",
  "/blog/2025-09-22_on_tortillas_and_octaves.md",
  "/blog/2025-09-14_words_on_words_and_weapons.md",
  "/blog/2025-09-12_the_joy_of_chanting.md",
  "/blog/2025-09-10_the_path_of_meta_service_learning_to_live_as_love.md",
  "/blog/2025-09-05_simple_simple_simple.md",
  "/blog/2025-09-04_i_got_you_babe.md",
  "/blog/2025-09-01_just_between_you_and_me.md",
  "/blog/2025-08-20_scorsby_and_tonkabot_discuss_love_and_nothingness.md",
  "/blog/2025-08-03_walwan.md",
  "/blog/2025-07-20_07202025__99__9.md",
  "/blog/2025-05-21_notes_from_the_flappin_hearts_cafe.md",
  "/blog/2025-05-11_happy_motherships_dayyyyyyy.md",
  "/blog/2025-04-19_an_inquisition_between_little_and_big_scorsby.md",
  "/blog/2025-04-07_this_one_is_worth_remembering.md",
  "/blog/2025-03-27_marriage_is_an_eternity.md",
  "/blog/2025-03-25_a_beglonging_without_end.md",
  "/blog/2025-03-24_make_love_always.md",
  "/blog/2025-03-21_we_are_the_power.md",
  "/blog/2025-03-18_maybe_we_are_all_one_hemi.md",
  "/blog/2025-03-17_maybe_we_are_all_one_tree.md",
  "/blog/2025-03-06_emancipation_proclamation_for_the_new_hearth.md",
  "/blog/2025-03-02_we_have_arrived.md",
];


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

// Load a markdown file and render post
async function loadBlogPost(mdFile, postName) {
  const indexContainer = document.getElementById('blog-index');
  const contentContainer = document.getElementById('blog-content');

  // Hide blog list
  indexContainer.style.display = 'none';

  // Fetch markdown
  const res = await fetch(mdFile);
  if (!res.ok) {
    contentContainer.innerHTML = "<p>Failed to load post.</p>";
    return;
  }
  const md = await res.text();

  // Render markdown
  contentContainer.innerHTML = marked.parse(md);

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
  };

  backLinkTop.addEventListener('click', (e) => { e.preventDefault(); backHandler(); });
  backLinkBottom.addEventListener('click', (e) => { e.preventDefault(); backHandler(); });

  contentContainer.prepend(backLinkTop);
  contentContainer.appendChild(backLinkBottom);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render the blog list
function renderBlogList(indexContainer) {
  indexContainer.innerHTML = "";

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
    link.textContent = title;
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
