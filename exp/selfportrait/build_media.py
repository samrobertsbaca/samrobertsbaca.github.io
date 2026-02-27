import os
import json
import re
from pathlib import Path

# ---------------- CONFIG ----------------
ROOT = Path(__file__).parent.resolve()
SITE_ROOT = ROOT.parents[1]  # this maps to "./" in the browser

MEDIA_DIRS = [
    SITE_ROOT / "images",
    SITE_ROOT / "media",
]

BLOG_DIRS = [
    SITE_ROOT / "blog"
]

OUTPUT_JS = ROOT / "media.js"
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_IMAGES = 10000
# ----------------------------------------

urls = []

for base in MEDIA_DIRS:
    for root, _, files in os.walk(base):
        for f in files:
            if Path(f).suffix.lower() in EXTS:
                full_path = Path(root) / f

                # 🔑 convert filesystem path → website-rooted URL
                rel_path = full_path.relative_to(SITE_ROOT).as_posix()
                urls.append(f"/{rel_path}")

urls.sort()
urls = urls[:MAX_IMAGES]

print(f"Found {len(urls)} images")

# --- Collect text snippets from blog markdown ---
snippets = []

# Regex to match markdown links: [text](url)
md_link_pattern = re.compile(r'\[([^\]]+)\]\([^\)]+\)')

# Regex to match markdown images: ![alt](url)
md_image_pattern = re.compile(r'!\[[^\]]*\]\([^\)]+\)')

# Regex to match dates like "Jan 5", "Feb 12", etc.
date_pattern = re.compile(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b')

# Markdown horizontal rules (---, ***, ___)
hr_pattern = re.compile(r'^(\*{3,}|-{3,}|_{3,})$')

# Lines that are only equals signs
equals_pattern = re.compile(r'^=+$')

# Non-breaking space entity
nbsp_pattern = re.compile(r'^&nbsp;$')

# line break entity
br_pattern = re.compile(r'^<br></br>$')
br_pattern2 = re.compile(r'^<br/><br/>$')
vf_pattern = re.compile(r'^View fullsize$')

for base in BLOG_DIRS:
    for root, _, files in os.walk(base):
        # 🚫 Skip any folder named "archive"
        if "archive" in Path(root).parts:
            continue
        if "old" in Path(root).parts:
            continue

        for f in files:
            if f.lower().endswith(".md"):
                full_path = Path(root) / f
                try:
                    text = full_path.read_text(encoding="utf-8")
                    for line in text.splitlines():
                        line = line.strip()
                        if not line:
                            continue
                        # Skip markdown horizontal rules (---, ***, ___)
                        if hr_pattern.match(line):
                            continue

                        # Skip lines that are only equals signs
                        if equals_pattern.match(line):
                            continue

                        # Skip &nbsp;
                        if nbsp_pattern.match(line):
                            continue

                        # Skip <br></br>;
                        if br_pattern.match(line):
                            continue
                        if br_pattern2.search(line):
                            continue

                        # Skip image lines
                        if md_image_pattern.search(line):
                            continue

                        if vf_pattern.search(line):
                            continue

                        # Remove asterisks and hash characters
                        line = line.replace("*", "").replace("#", "")

                        # Replace markdown links with just the link text
                        line = md_link_pattern.sub(r'\1', line)

                        # Remove leftover &nbsp; if embedded
                        line = line.replace("&nbsp;", "").strip()
                        # Skip lines that are just dates
                        if date_pattern.search(line):
                            continue
                        snippets.append(line)
                except Exception as e:
                    print(f"Failed to read {full_path}: {e}")

print(f"Collected {len(snippets)} text snippets")

# --- Write media.js ---
with open(OUTPUT_JS, "w", encoding="utf-8") as f:
    f.write("// AUTO-GENERATED — DO NOT EDIT\n")
    f.write("export const IMAGE_URLS = ")
    json.dump(urls, f, indent=2)
    f.write(";\n\n")

    f.write("export const BLOG_SNIPPETS = ")
    json.dump(snippets, f, indent=2)
    f.write(";\n")

print("media.js written successfully")
