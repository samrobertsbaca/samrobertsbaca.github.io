import os
from pathlib import Path

# Path to your blog folder (adjust if needed)
blog_folder = Path(__file__).parent / "blog"
output_file = blog_folder / "blogposts.js"

# Get all .md files
md_files = [f for f in blog_folder.glob("*.md") if f.is_file()]

# Sort by date extracted from filename (reverse chronological)
# Assuming filenames start with YYYY-MM-DD_
def extract_date(file):
    name = file.name
    try:
        return name.split("_")[0]  # '2025-10-09'
    except IndexError:
        return "0000-00-00"

md_files.sort(key=lambda f: extract_date(f), reverse=True)

# Generate JavaScript array
lines = ["window.postFiles = ["]

for f in md_files:
    rel_path = f"/blog/{f.name}"
    lines.append(f'  "{rel_path}",')

lines.append("];\n")

# Write to blogposts.js
with open(output_file, "w", encoding="utf-8") as js_file:
    js_file.write("\n".join(lines))

print(f"✅ blogposts.js updated with {len(md_files)} posts.")
