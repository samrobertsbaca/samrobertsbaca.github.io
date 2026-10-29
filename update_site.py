import os
from pathlib import Path
import markdown
from bs4 import BeautifulSoup
from datetime import datetime

import subprocess
import sys
import re


import argparse

# 1. Initialize the parser
parser = argparse.ArgumentParser(description="A script that uses a flag.")

# 2. Add the argument
# We can provide a short version (-ns) and a long version (--no-save)
parser.add_argument('-ns', '--no-story', action='store_true', help="Set this flag to skip story generation.")

# 3. Parse the arguments
args = parser.parse_args()


# Paths
blog_folder = Path(__file__).parent / "blog"
template_file = Path(__file__).parent / "blog/blog_template.html"
output_js_file = blog_folder / "blogposts.js"

# Default image if none found
default_image = "/images/scorsby_hearteyes.png"

# Read template
with open(template_file, "r", encoding="utf-8") as f:
    template_html = f.read()

# Parse template with BeautifulSoup
template_soup = BeautifulSoup(template_html, "html.parser")

# Get all .md files
md_files = [f for f in blog_folder.glob("*.md") if f.is_file()]

# Sort Markdown files by date in filename (descending)
def extract_date(file):
    name = file.name
    try:
        return datetime.strptime(name.split("_")[0], "%Y-%m-%d")
    except Exception:
        return datetime.min  # fallback for files without a date

md_files.sort(key=lambda f: extract_date(f), reverse=True)

# --- NEW: Collect JS paths in a list first ---
blog_paths = []

# Add manual entry
blog_paths.append("/blog/2026-01-23_personality_quiz.html")
blog_paths.append("/blog/2026-01-26_its_a_beautiful_day_in_the_neighborhood.html")
blog_paths.append("/blog/2026-02-14_14_valentines.html")
blog_paths.append("/blog/2026-02-28_bubbletest.html")
blog_paths.append("/blog/2026-03-09_car_wheels_on_a_glonging_road.html")
blog_paths.append("/blog/2026-03-29_blessed_tears.html")
blog_paths.append("/blog/2026-05-17_life_on_shuffle.html")
blog_paths.append("/blog/2026-08-05_look_at_me!.html")

# Add paths from Markdown files
for md_file in md_files:
    output_html_file = md_file.with_suffix(".html")
    rel_path = f"/blog/{output_html_file.name}"
    blog_paths.append(rel_path)

# --- NEW: Sort JS paths by date in filename (descending) ---
def extract_date_from_path(path):
    date_str = path.split("/")[-1][:10]  # first 10 chars should be YYYY-MM-DD
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except Exception:
        return datetime.min

blog_paths.sort(key=extract_date_from_path, reverse=True)

# Build JS array
js_lines = ["window.postFiles = ["]
for path in blog_paths:
    js_lines.append(f'  "{path}",')
js_lines.append("];\n")

SITE = "https://scorsby.us"
DATE_LINE = re.compile(r"^\s*([A-Za-z]{3,9}\.?\s+\d{1,2}(st|nd|rd|th)?,?(\s+\d{4})?|\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?)\s*$")

def describe(soup, title_tag, limit=155):
    # the first words of the post, skipping a date line, cut at a word near the limit
    words = []
    paras = title_tag.find_all_next("p") if title_tag else soup.find_all("p")
    for p in paras:
        text = " ".join(p.get_text(" ").split())
        if not text or DATE_LINE.match(text):
            continue
        words += text.split()
        if len(" ".join(words)) >= limit:
            break
    text = " ".join(words)
    if not text:
        # a post that's only pictures: the first picture's caption, or else just what it is
        alt = next((" ".join(i.get("alt", "").split()) for i in soup.find_all("img") if i.get("alt", "").strip()), "")
        title = " ".join(title_tag.get_text(" ").split()) if title_tag else "a post"
        text = alt or f"{title}: a picture post from the world of scorsby."
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0].rstrip(",;:-") + "…"
    return text

def set_meta(soup, tag, match, attrs):
    # finds the tag in the head (or adds it), and sets its attributes
    el = soup.head.find(tag, match) if soup.head else None
    if not el:
        el = soup.new_tag(tag, attrs=match)
        soup.head.append(el)
    for k, v in attrs.items():
        el[k] = v

# Convert Markdown to HTML pages
for md_file in md_files:
    # Read markdown
    with open(md_file, "r", encoding="utf-8") as f:
        md_text = f.read()

    # Convert markdown to HTML
    html_content = markdown.markdown(md_text, extensions=["extra", "toc"])

    # Parse HTML content
    content_soup = BeautifulSoup(html_content, "html.parser")

    # Title
    title_tag = content_soup.find(["h1","h2","h3","h4","h5","h6"])
    title = title_tag.get_text() if title_tag else "Blog Post"

    # Description: the post's opening words, about a sentence or two (skipping the date line), for search results and
    # share previews
    description = describe(content_soup, title_tag)

    # First image
    img_tag = content_soup.find("img")
    if img_tag:
        img_src = img_tag["src"]
        if not img_src.startswith("/"):
            img_src = "/" + img_src.lstrip("./")
        image_src = img_src
    else:
        image_src = default_image

    # Update all images to site-root relative
    for img in content_soup.find_all("img"):
        src = img.get("src", "")
        if not src.startswith("/"):
            img["src"] = "/" + src.lstrip("./")

    # Copy template and insert content
    post_soup = BeautifulSoup(template_html, "html.parser")
    blog_div = post_soup.find("div", {"id":"blog-content"})
    if blog_div:
        blog_div.clear()
        for element in content_soup.contents:
            blog_div.append(element)

    # Update meta tags
    title_tag_meta = post_soup.find("title")
    if title_tag_meta:
        title_tag_meta.string = title
    description_meta = post_soup.find("meta", {"name":"description"})
    if description_meta:
        description_meta["content"] = description
    og_image_meta = post_soup.find("meta", {"property":"og:image"})
    if og_image_meta:
        og_image_meta["content"] = SITE + image_src  # (share previews need the whole address)
    # the rest of what search engines and share previews read: the post's own address, its title and its opening words
    url = f"{SITE}/blog/{md_file.with_suffix('.html').name}"
    set_meta(post_soup, "link", {"rel": "canonical"}, {"href": url})
    set_meta(post_soup, "meta", {"property": "og:type"}, {"content": "article"})
    set_meta(post_soup, "meta", {"property": "og:site_name"}, {"content": "world of scorsby"})
    set_meta(post_soup, "meta", {"property": "og:url"}, {"content": url})
    set_meta(post_soup, "meta", {"property": "og:title"}, {"content": title})
    set_meta(post_soup, "meta", {"property": "og:description"}, {"content": description})
    set_meta(post_soup, "meta", {"name": "twitter:card"}, {"content": "summary_large_image"})

    # Save HTML file
    output_html_file = md_file.with_suffix(".html")
    with open(output_html_file, "w", encoding="utf-8") as f:
        f.write(str(post_soup))

# Write JS file
with open(output_js_file, "w", encoding="utf-8") as js_file:
    js_file.write("\n".join(js_lines))

print(f"✅ Generated {len(md_files)} HTML blog posts and updated blogposts.js.")

# the sitemap: every page and post, so search engines know what's here (and robots.txt, which points them to it,
# and asks them to leave the archived and old corners alone)
root = Path(__file__).parent
today = datetime.now().strftime("%Y-%m-%d")
pages = ["/", "/peace", "/love", "/joy", "/books/blueroses/", "/books/gold.html", "/books/comix2025.html",
         "/books/littlebookofscorsby.html", "/books/gentlefallingsnow.html", "/exp/", "/exp/sacred-geometry/", "/exp/chance/",
         "/exp/chance/score/", "/exp/memorywheel/", "/exp/meltbg/", "/exp/apr14/scorsby_vcr.html", "/media/bubbleboo.html"]
urls = [(SITE + p, today) for p in pages]
for path in blog_paths:
    d = extract_date_from_path(path)
    urls.append((SITE + path, d.strftime("%Y-%m-%d") if d != datetime.min else today))
xml_escape = lambda s: s.replace("&", "&amp;").replace("'", "&apos;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
with open(root / "sitemap.xml", "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for loc, mod in urls:
        f.write(f"  <url><loc>{xml_escape(loc)}</loc><lastmod>{mod}</lastmod></url>\n")
    f.write("</urlset>\n")
with open(root / "robots.txt", "w", encoding="utf-8") as f:
    f.write("User-agent: *\nDisallow: /blog/archive/\nDisallow: /blog/old/\nDisallow: /old_site/\nDisallow: /archive/\n\n"
            f"Sitemap: {SITE}/sitemap.xml\n")
print(f"🗺️  sitemap.xml: {len(urls)} pages")

# the peace page's search: every post's words, so they can be found
subprocess.run([sys.executable, "./tools/build_search.py"])

subprocess.run([sys.executable, "./exp/selfportrait/build_media.py"])


if args.no_story == False:
    # Define the path to your script's folder
    script_dir = "./exp/storygen"
    subprocess.run(
        [sys.executable, "storygen.py"],
        cwd=script_dir  # This "teleports" the execution into that folder
    )
