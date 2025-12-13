import os
import re

def natural_key(string):
    return [int(s) if s.isdigit() else s.lower() for s in re.split(r'(\d+)', string)]

def generate_gallery():
    folder = "./media/gold/"
    output_file = "gold.html"

    images = sorted(
        [f for f in os.listdir(folder)
         if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp'))],
        key=natural_key
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
      <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-F0TBFJSGJ9"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());

    gtag('config', 'G-F0TBFJSGJ9');
  </script>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta property="og:description" content="An electronic holiday novella to enjoy with love 💛">
<meta property="og:image" content="https://scorsby.us/media/gold/1.png">
<meta property="og:type" content="website">
<meta property="og:url" content="https://scorsby.us/gold.html">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Go For Gold: A Glongingston Manifesto">
<meta name="twitter:description" content="An electronic holiday novella to enjoy with love 💛">
<meta name="twitter:image" content="https://scorsby.us/media/gold/1.png">

<link rel="icon" href="./favicon_gold2.png" type="image/x-icon">
<title>Go For Gold</title>
<style>
  :root{{--nav-right:12px; --nav-gap:6px; --nav-thumb-size:120px; --preview-w:240px; --preview-h:240px;}}
  body {{
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    background: #1a2d57;
    margin: 0;
    padding: 20px;
  }}

  /* image area */
  .content {{
    max-width: 800px;
    margin: 0 auto;
  }}
  .img-container {{
    width: 100%;
    margin: 0 0 30px 0;
  }}
  .img-container img {{
    width: 100%;
    height: auto;
    display: block;
    border-radius: 6px;
  }}

  /* donation block: simple centered block that won't be squeezed */
.donation-wrap {{
    max-width: 800px;    /* same as images */
    width: 100%;         /* expand to container width */
    margin: 60px auto;   /* center horizontally with margin */
    text-align: center;  /* center contents */
}}
#paypal-container-BH3DJYC53LCMW {{
    display: inline-block; /* allow it to size naturally */
    width: 100%;           /* fill donation-wrap */
    max-width: 100%;       /* never exceed container */
}}

#paypal-container-BH3DJYC53LCMW h3, p, label {{
    color:white;
}}

  /* Right-side page nav as nice compact grid */
  .page-nav {{
    position: fixed;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    grid-template-columns: repeat(auto-fill, 36px); /* as many columns as needed */
    grid-auto-rows: 28px;      /* row height */
    gap: 6px;
    padding: 8px;
    background: rgba(0,0,0,0.15);
    border-radius: 10px;
    z-index: 999;
    max-height: 80vh;          /* limit to viewport height */
    overflow: hidden;          /* hide any overflow */
    justify-content: start;    /* left-align the grid inside its block */
    align-content: start;      /* top-align content vertically */
  }}
  .page-nav a {{
    width: 36px;
    height: 28px;
    line-height: 28px;
    display: block;
    text-align: center;
    font-size: 13px;
    text-decoration: none;
    color: #000;
    background: rgba(255,255,255,0.9);
    border-radius: 6px;
  }}

  @media (max-width: 800px) {{
    .page-nav {{ display: none; }}
  }}

  /* preview image element (created by JS) */
  .page-preview {{
    position: fixed;
    right: calc(var(--nav-right) + 56px + var(--nav-gap));
    width: var(--preview-w);
    height: var(--preview-h);
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    z-index: 2000;
    background: #fff;
    display: none;
    pointer-events: none;
  }}
  .page-preview.show {{ display: block; }}

  #page-counter {{
    position: fixed;
    bottom: 12px;
    right: 12px;
    background: rgba(0,0,0,0.86);
    color: #fddc54;
    padding: 6px 10px;
    border-radius: 6px;
    font-family: sans-serif;
    font-size: 14px;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}}

  #page-counter a {{
    color: #fddc54;
}}

/* Mobile styling */
@media (max-width: 800px) {{
    #page-counter {{
        right: 50%;
        transform: translateX(50%);
        bottom: 12px;
        background: rgba(0,0,0,0.86);
        border-radius: 8px;
        font-size: 16px;
        padding: 8px 12px;
    }}
}}


</style>

<script src="https://www.paypal.com/sdk/js?client-id=BAA7eEf9ewzwU-1sUQB6E3GE8KXM4kcZEAly1iMLTlj5-gREq6CGUEH2H9GvJ_eSPxB0Q34PviobUdPJ0Q&components=hosted-buttons&enable-funding=venmo&currency=USD"></script>
</head>
<body>
  <div class="content">
"""

    # add images into content area
    for i, img in enumerate(images):
        img_path = f"{folder}{img}"
        html += f'    <div class="img-container" id="page{i+1}"><img src="{img_path}" loading="lazy" alt="{img}"></div>\n'

    # donation block (centered)
    html += """
  </div>

  <div id="page-counter">
    <span id="counter-text">1 / 123</span> &nbsp;❤︎&nbsp; <a href="https://www.scorsby.us/home.html" target="_blank" style="text-decoration: underline;">scorsby.us</a>
</div>

  <div class="donation-wrap">
    <div id="paypal-container-BH3DJYC53LCMW"></div>
  </div>
"""

    # page nav (right side) with data-preview attributes
    #html += '  <div class="page-nav" aria-hidden="true">\n'
    #for i, img in enumerate(images):
    #    img_path = f"{folder}{img}"
    #    html += f'    <a href="#page{i+1}" data-preview="{img_path}">{i+1}</a>\n'
    #html += '  </div>\n'

    # preview element + scripts
    html += """
  <!--<img class="page-preview" id="page-preview" alt="preview" />!-->

<script>
  // Render Paypal hosted button
  if (window.paypal && paypal.HostedButtons) {
    paypal.HostedButtons({ hostedButtonId: "BH3DJYC53LCMW" }).render("#paypal-container-BH3DJYC53LCMW");
  }

  // Hover preview logic
  (function(){
    const nav = document.querySelector('.page-nav');
    const preview = document.getElementById('page-preview');
    if (!nav || !preview) return;

    // show preview when hovering a link
    nav.addEventListener('pointerenter', e => {
      // use pointerover to catch children
    }, {capture: true});

    nav.addEventListener('pointerover', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      const src = a.getAttribute('data-preview');
      if (!src) return;
      preview.src = src;
      preview.classList.add('show');

      // Position preview vertically near the link's center, but keep it fully on-screen
      const rect = a.getBoundingClientRect();
      const previewH = parseInt(getComputedStyle(preview).height) || 240;
      // center the preview on the link's vertical center
      let top = rect.top + (rect.height / 2) - (previewH / 2);

      // clamp to viewport
      const pad = 12;
      const minTop = pad;
      const maxTop = window.innerHeight - previewH - pad;
      top = Math.max(minTop, Math.min(maxTop, top));

      preview.style.top = top + 'px';
    });

    nav.addEventListener('pointerout', (e) => {
      const related = e.relatedTarget;
      // if leaving to a child of the nav keep it
      if (related && nav.contains(related)) return;
      preview.classList.remove('show');
      // small delay clear src to avoid flash on quick moves
      setTimeout(() => { if (!preview.classList.contains('show')) preview.src = ''; }, 200);
    });

    // also hide when mouse leaves individual anchors
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('pointerleave', () => {
        preview.classList.remove('show');
      });
    });

    // hide preview on small screens
    function updatePreviewVisibility(){
      if (window.innerWidth <= 800) {
        preview.style.display = 'none';
      } else {
        preview.style.display = '';
      }
    }
    window.addEventListener('resize', updatePreviewVisibility);
    updatePreviewVisibility();
  })();
</script>

<script>
document.addEventListener('DOMContentLoaded', () => {
    const images = document.querySelectorAll('.img-container img');
    const body = document.body;
    const counter = document.getElementById('page-counter');
    const total = images.length;

    body.style.transition = 'background-color 0.8s ease';

    function getAverageColor(img) {
        if (!img.complete) return null;
        const size = 5;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size, 0, 0, size, size);
        const data = ctx.getImageData(0,0,size,size).data;
        let r=0,g=0,b=0;
        const pixels = size*size;
        for (let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
        r=Math.round(r/pixels); g=Math.round(g/pixels); b=Math.round(b/pixels);
        return `rgb(${r},${g},${b})`;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (!img.complete) return;

                // update background
                const avgColor = getAverageColor(img);
                if (avgColor) body.style.backgroundColor = avgColor;

                // update page counter
                const pageIndex = Array.from(images).indexOf(img) + 1;
                const counterText = document.getElementById('counter-text');

                // inside IntersectionObserver or first image load:
                counterText.textContent = `${pageIndex} / ${total}`;
            }
        });
    }, { threshold: 0.6 });

    images.forEach(img => {
        observer.observe(img);

        // initialize background and counter on first image load
        img.addEventListener('load', () => {
            if (img === images[0]) {
                const avgColor = getAverageColor(img);
                if (avgColor) body.style.backgroundColor = avgColor;
                const counterText = document.getElementById('counter-text');

                // inside IntersectionObserver or first image load:
                counterText.textContent = `${pageIndex} / ${total}`;
            }
        });
    });
});

</script>



</body>
</html>
"""

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Created {output_file} with {len(images)} images (centered donation + working previews).")

if __name__ == "__main__":
    generate_gallery()
