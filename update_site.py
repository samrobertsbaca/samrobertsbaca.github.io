import os
from pathlib import Path
import markdown
from bs4 import BeautifulSoup

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

# Sort by date extracted from filename (reverse chronological)
def extract_date(file):
    name = file.name
    try:
        return name.split("_")[0]  # 'YYYY-MM-DD'
    except IndexError:
        return "0000-00-00"

md_files.sort(key=lambda f: extract_date(f), reverse=True)

# List to hold JS paths
js_lines = ["window.postFiles = ["]

# Convert each Markdown to HTML page
for md_file in md_files:
    # Read markdown
    with open(md_file, "r", encoding="utf-8") as f:
        md_text = f.read()

    # Convert markdown to HTML
    html_content = markdown.markdown(md_text, extensions=["extra", "toc"])

    # Parse HTML content
    content_soup = BeautifulSoup(html_content, "html.parser")

    # Title from first header
    title_tag = content_soup.find(["h1", "h2", "h3", "h4", "h5", "h6"])
    title = title_tag.get_text() if title_tag else "Blog Post"

    # Description from first <p> after first header
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

    # Update all images in content to be site-root relative
    for img in content_soup.find_all("img"):
        src = img.get("src", "")
        if not src.startswith("/"):
            img["src"] = "/" + src.lstrip("./")

    # Copy the template soup for this post
    post_soup = BeautifulSoup(template_html, "html.parser")

    # Insert content into the existing div#blog-content
    blog_div = post_soup.find("div", {"id": "blog-content"})
    if blog_div:
        blog_div.clear()  # remove any placeholder text
        for element in content_soup.contents:
            blog_div.append(element)

    # Update meta tags
    title_tag_meta = post_soup.find("title")
    if title_tag_meta:
        title_tag_meta.string = title

    description_meta = post_soup.find("meta", {"name": "description"})
    if description_meta:
        description_meta["content"] = description

    og_image_meta = post_soup.find("meta", {"property": "og:image"})
    if og_image_meta:
        og_image_meta["content"] = image_src

    # Save HTML file
    output_html_file = md_file.with_suffix(".html")
    with open(output_html_file, "w", encoding="utf-8") as f:
        f.write(str(post_soup))

    # Add to JS array
    rel_path = f"/blog/{output_html_file.name}"
    js_lines.append(f'  "{rel_path}",')

# Close JS array
js_lines.append("];\n")

# Write to blogposts.js
with open(output_js_file, "w", encoding="utf-8") as js_file:
    js_file.write("\n".join(js_lines))

print(f"✅ Generated {len(md_files)} HTML blog posts with content inserted into blog-content and updated blogposts.js.")
