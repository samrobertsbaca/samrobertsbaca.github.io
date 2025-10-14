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
};
