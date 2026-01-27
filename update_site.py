import os
from pathlib import Path
import markdown
from bs4 import BeautifulSoup
from datetime import datetime

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

    # Description
    description = ""
    if title_tag:
        for sibling in title_tag.find_next_siblings():
            if sibling.name == "p":
                description = sibling.get_text()
                break
    if not description:
        p_tag = content_soup.find("p")
        description = p_tag.get_text() if p_tag else ""

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
        og_image_meta["content"] = image_src

    # Save HTML file
    output_html_file = md_file.with_suffix(".html")
    with open(output_html_file, "w", encoding="utf-8") as f:
        f.write(str(post_soup))

# Write JS file
with open(output_js_file, "w", encoding="utf-8") as js_file:
    js_file.write("\n".join(js_lines))

print(f"✅ Generated {len(md_files)} HTML blog posts and updated blogposts.js.")
