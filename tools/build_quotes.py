"""gather short quotes from every blog post into heartstar/quotes.js.
the world whispers them now and then; each one links back to its post."""
import json, pathlib, random, re

root = pathlib.Path(__file__).resolve().parent.parent
SENT = re.compile(r"[^.!?…]+[.!?…]+[\"”’)]*")
posts, quotes = [], []
random.seed(7)
for md in sorted((root / "blog").glob("*.md")):
    if not re.match(r"\d{4}-\d{2}-\d{2}_", md.name):
        continue
    title, paras, buf = None, [], []
    for line in md.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = line.strip()
        if s.startswith("# ") and title is None:
            title = s[2:].strip(); continue
        if not s or s.startswith(("![", "<", "|")) or re.fullmatch(r"[-*_]{3,}", s):
            if buf: paras.append(" ".join(buf)); buf = []
            continue
        if title is None and re.fullmatch(r"[A-Za-z]+\.? \d{1,2}", s):
            continue
        s = re.sub(r"^#+\s*|^>\s*", "", s)
        s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
        s = re.sub(r"[*_`]{1,3}", "", s)
        s = re.sub(r"<[^>]+>", "", s)
        if s: buf.append(s)
    if buf: paras.append(" ".join(buf))
    url = "/blog/" + md.stem + ".html"
    t = title or md.stem[11:].replace("_", " ")
    found = [q.strip() for p in paras for q in SENT.findall(p)]
    found = [q for q in found if 40 <= len(q) <= 150 and not q.lower().startswith(("q4u", "http")) and "@" not in q]
    if not found:
        continue
    posts.append([t, url])
    for q in random.sample(found, min(8, len(found))):
        quotes.append([q, len(posts) - 1])

out = root / "heartstar" / "quotes.js"
pack = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
out.write_text("// lines from the blog, whispered by the world now and then. QUOTES: [line, post], POSTS: [title, url]\n"
               f"window.POSTS={pack(posts)};\nwindow.QUOTES={pack(quotes)};\n", encoding="utf-8")
print(len(quotes), "quotes,", out.stat().st_size // 1024, "KB")
