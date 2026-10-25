# the peace page's search: every post's title, date and words, gathered into blog/search_index.js.
# update_site.py runs this after it builds the posts; it can also be run on its own.
import json, re
from pathlib import Path
from bs4 import BeautifulSoup
import markdown

root = Path(__file__).resolve().parent.parent
blog = root / "blog"

# the same list of posts the peace page shows (blogposts.js, written by update_site.py)
posts = re.findall(r'"(/blog/[^"]+\.html)"', (blog / "blogposts.js").read_text(encoding="utf-8"))

def plain(html):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return re.sub(r"\s+", " ", soup.get_text(" ")).strip()

index = []
for path in posts:
    name = Path(path).stem
    md = blog / f"{name}.md"
    page = blog / f"{name}.html"
    if md.exists():
        html = markdown.markdown(md.read_text(encoding="utf-8"), extensions=["extra"])
    elif page.exists():
        soup = BeautifulSoup(page.read_text(encoding="utf-8"), "html.parser")
        content = soup.find(id="blog-content") or soup.find("article") or soup.body
        html = str(content) if content else ""
    else:
        continue
    words = plain(html)
    date, _, rest = name.partition("_")
    index.append({"u": path, "d": date, "t": rest.replace("_", " "), "x": words[:20000]})

out = blog / "search_index.js"
out.write_text("window.searchIndex = " + json.dumps(index, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"search index: {len(index)} posts")
