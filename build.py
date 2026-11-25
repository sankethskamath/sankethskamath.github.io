#!/usr/bin/env python3
"""Builds the site into this folder.

    pip install markdown pymdown-extensions
    python3 build.py

Edit these, then run the build:
  content/site.json     name, links, projects, resume
  content/posts/*.md    blog posts   (file name: YYYY-MM-DD-short-name.md)
  content/notes/*.md    notes        (same naming)

Posts and notes are Markdown. They can include LaTeX ($inline$ and $$display$$),
code blocks, tables, and images. Put image files in assets/img/ and write
![what it shows](../assets/img/file.png "Optional caption").

Each Markdown file starts with a small header:
    ---
    title: The title
    summary: One line shown in the list (optional)
    ---
Text wrapped in [[double brackets]] is shown as a placeholder (dotted underline).
Everything in *.html, posts/ and notes/ is generated; don't edit those by hand.
"""
import html
import json
import re
import shutil
import struct
import subprocess
from datetime import date
from pathlib import Path

import markdown

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
SITE = json.loads((CONTENT / "site.json").read_text(encoding="utf-8"))
RESUME_PDF = "assets/sanketh-kamath-resume.pdf"   # the resume PDF; replace the file to update it
RESUME_PAGES = "assets/resume-pages"              # pictures of its pages, shown on the PDF viewer page
NAV = [("resume", "Resume"), ("projects", "Projects"), ("blog", "Blog"), ("notes", "Notes"), ("contact", "Contact")]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


# ---------- small helpers ----------

def esc(text):
    return html.escape(str(text), quote=True)


def ph(text):
    """Escape text, turning [[placeholders]] into marked spans."""
    return re.sub(r"\[\[(.+?)\]\]", r'<span class="ph">\1</span>', esc(text))


def plain(text):
    """Text with the placeholder brackets removed, for titles and metadata."""
    return re.sub(r"\[\[(.+?)\]\]", r"\1", str(text))


def nice_date(d):
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def render_markdown(text):
    """Markdown to HTML. Math is left as LaTeX inside .arithmatex elements for KaTeX to typeset in the browser."""
    out = markdown.markdown(
        text,
        extensions=["fenced_code", "tables", "footnotes", "smarty", "pymdownx.arithmatex"],
        extension_configs={"pymdownx.arithmatex": {"generic": True}},
        output_format="html5",
    )

    # An image on its own line becomes a figure; its "title" becomes the caption.
    def figure(match):
        img = match.group(1)
        title = re.search(r' title="([^"]*)"', img)
        caption = f"<figcaption>{title.group(1)}</figcaption>" if title else ""
        img = re.sub(r' title="[^"]*"', "", img).replace("<img ", '<img loading="lazy" ', 1)
        return f"<figure>{img}{caption}</figure>"

    return re.sub(r"<p>(<img [^>]*>)</p>", figure, out)


def load_entries(folder):
    """Read content/<folder>/YYYY-MM-DD-slug.md files, newest first."""
    entries = []
    for path in sorted((CONTENT / folder).glob("*.md")):
        match = re.match(r"(\d{4})-(\d{2})-(\d{2})-(.+)", path.stem)
        if not match:
            raise SystemExit(f"{path.name}: name it YYYY-MM-DD-short-name.md")
        raw = path.read_text(encoding="utf-8")
        meta, body = {}, raw
        if raw.startswith("---"):
            _, header, body = raw.split("---", 2)
            for line in header.strip().splitlines():
                key, _, value = line.partition(":")
                meta[key.strip()] = value.strip()
        words = len(re.findall(r"\w+", body))
        body_html = render_markdown(body)
        summary = meta.get("summary", "")
        if not summary:                      # fall back to the start of the first paragraph
            first = re.search(r"<p>(.*?)</p>", body_html, re.S)
            text = html.unescape(re.sub(r"<[^>]+>", "", first.group(1))).strip() if first else ""
            summary = text if len(text) <= 150 else text[:147].rsplit(" ", 1)[0] + "…"
        entries.append({
            "slug": match.group(4),
            "date": date(int(match.group(1)), int(match.group(2)), int(match.group(3))),
            "title": meta.get("title", match.group(4)),
            "summary": summary,
            "sample": meta.get("sample", "").lower() == "true",
            "html": body_html,
            "math": 'class="arithmatex"' in body_html,
            "minutes": max(1, round(words / 220)),
        })
    return sorted(entries, key=lambda e: e["date"], reverse=True)


def resume_page_images():
    """Pictures of the resume PDF's pages, remade whenever the PDF is newer than them.

    Needs the `pdftoppm` tool (part of poppler). Without it the viewer page embeds
    the PDF directly instead, which works on computers but not on every phone.
    """
    pdf = ROOT / RESUME_PDF
    folder = ROOT / RESUME_PAGES
    if not pdf.exists():
        return []
    pages = sorted(folder.glob("page-*.png"))
    stale = not pages or any(p.stat().st_mtime < pdf.stat().st_mtime for p in pages)
    if stale and shutil.which("pdftoppm"):
        folder.mkdir(parents=True, exist_ok=True)
        for old in pages:
            old.unlink()
        subprocess.run(["pdftoppm", "-r", "200", "-png", str(pdf), str(folder / "page")], check=True)
        pages = sorted(folder.glob("page-*.png"))
        try:                                   # optional: shrink the pictures if Pillow is installed
            from PIL import Image
            for p in pages:
                Image.open(p).convert("RGB").quantize(colors=48).save(p, optimize=True)
        except ImportError:
            pass
    out = []
    for p in pages:
        with open(p, "rb") as f:
            width, height = struct.unpack(">II", f.read(24)[16:24])   # size from the PNG header
        out.append((p.relative_to(ROOT).as_posix(), width, height))
    return out


# ---------- page shell ----------

def head(title, description, path, root, math=False):
    url = SITE["url"] + "/" + ("" if path == "index.html" else path)
    math_css = f'\n<link rel="stylesheet" href="{root}assets/vendor/katex/katex.min.css">' if math else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#7600f0">
<link rel="canonical" href="{esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(SITE['name'])}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(url)}">
<meta property="og:image" content="{esc(SITE['url'])}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{root}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="{root}assets/fonts/fraunces.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{root}assets/css/site.css">{math_css}
</head>
"""


def inner_page(key, title, description, path, body, root="", math=False):
    """A page with the shared header, nav and footer."""
    links = "\n      ".join(
        f'<a href="{root}{k}.html"{" aria-current=\"page\"" if k == key else ""}>{label}</a>' for k, label in NAV
    )
    math_js = f'<script src="{root}assets/vendor/katex/katex.min.js" defer></script>\n' if math else ""
    return head(f"{title} · {SITE['name']}", description, path, root, math) + f"""<body>
<header class="site-header">
  <a class="brand" href="{root}index.html"><span class="orb" aria-hidden="true"></span><span>{esc(SITE['first'])} <em>{esc(SITE['last'])}</em></span></a>
  <nav class="site-nav" aria-label="Sections">
      {links}
  </nav>
</header>
<main class="page">
{body}
</main>
<footer class="site-footer">
  <div class="site-footer-inner mono">
    <span>© {date.today().year} {esc(SITE['name'])}</span>
    <span class="site-footer-links">
      <a href="{root}index.html">Home</a>
      <a href="https://www.linkedin.com/in/sankethk" target="_blank" rel="noopener">LinkedIn</a>
      <a href="https://github.com/sankethskamath" target="_blank" rel="noopener">GitHub</a>
    </span>
  </div>
</footer>
{math_js}<script src="{root}assets/js/site.js" defer></script>
</body>
</html>
"""


def page_head(title_html, lede=""):
    lede_html = f'\n    <p class="page-lede">{lede}</p>' if lede else ""
    return f"""  <header class="page-head">
    <h1 class="page-title">{title_html}</h1>{lede_html}
  </header>"""


def tag(text):
    return f' <span class="tag">{text}</span>'


def row(side, main, attrs=""):
    return f"""      <li class="row"{attrs}>
        <div class="row-side mono">{side}</div>
        <div class="row-main">
          {main}
        </div>
      </li>"""


def link_list(links):
    out = []
    for link in links:
        if link.get("url"):
            ext = ' target="_blank" rel="noopener"' if link["url"].startswith("http") else ""
            out.append(f'<a href="{esc(link["url"])}"{ext}>{ph(link["text"])}</a>')
        else:
            out.append(f"<span>{ph(link['text'])}</span>")
    return "".join(out)


# ---------- pages ----------

def build_home():
    pills = "\n    ".join(f'<a class="pill" href="{k}.html" data-mood="{k}">{label}</a>' for k, label in NAV)
    return head(SITE["name"], SITE["description"], "index.html", "") + f"""<body class="home">
<div class="home-shell">
<header class="home-top mono">
  <span>{esc(SITE['affiliation'])}</span>
  <span class="home-top-links">
    <a href="https://www.linkedin.com/in/sankethk" target="_blank" rel="noopener">LinkedIn ↗</a>
    <a href="https://github.com/sankethskamath" target="_blank" rel="noopener">GitHub ↗</a>
  </span>
</header>
<main class="home-hero">
  <div class="stage" id="stage">
    <canvas id="blob" aria-hidden="true"></canvas>
    <div id="grab" tabindex="0" role="img" aria-label="A floating, colorful 3D blob. Press to squeeze it, drag to stretch it."></div>
    <div class="fallback" aria-hidden="true"></div>
  </div>
  <h1 class="name"><span class="name-first">{esc(SITE['first'])}</span> <span class="name-last">{esc(SITE['last'])}</span></h1>
  <p class="tagline">{SITE['tagline']}</p>
</main>
<nav class="home-nav" aria-label="Sections">
    {pills}
  <span class="home-hint mono">Press the blob to squeeze it, drag to stretch it</span>
</nav>
</div>
<script src="assets/js/site.js" defer></script>
<script src="assets/js/blob.js" defer></script>
</body>
</html>
"""


def build_projects():
    rows = []
    for p in SITE["projects"]:
        main = [f'<h2 class="row-title">{ph(p["title"])}{tag("draft") if p.get("draft") else ""}</h2>']
        if p.get("sub"):
            main.append(f'<p class="row-sub">{ph(p["sub"])}</p>')
        if p.get("text"):
            main.append(f'<p class="row-text">{ph(p["text"])}</p>')
        if p.get("bullets"):
            main.append("<ul>" + "".join(f"<li>{ph(b)}</li>" for b in p["bullets"]) + "</ul>")
        if p.get("tags"):
            main.append('<ul class="chips">' + "".join(f"<li>{esc(t)}</li>" for t in p["tags"]) + "</ul>")
        if p.get("links"):
            main.append(f'<p class="row-links">{link_list(p["links"])}</p>')
        rows.append(row(ph(p["when"]), "\n          ".join(main)))
    body = page_head("Projects", "Research and things I've built, newest first.") + f"""
  <div class="page-body">
    <ul class="rows">
{chr(10).join(rows)}
    </ul>
  </div>"""
    return inner_page("projects", "Projects", "Research projects and things built by Sanketh Kamath.", "projects.html", body)


def build_resume():
    parts = []
    for section in SITE["resume"]:
        rows = []
        for item in section["items"]:
            main = []
            if item.get("title"):
                main.append(f'<h3 class="row-title">{ph(item["title"])}{tag("draft") if item.get("draft") else ""}</h3>')
            if item.get("sub"):
                main.append(f'<p class="row-sub">{ph(item["sub"])}</p>')
            if item.get("text"):
                main.append(f'<p class="row-text">{ph(item["text"])}</p>')
            if item.get("bullets"):
                main.append("<ul>" + "".join(f"<li>{ph(b)}</li>" for b in item["bullets"]) + "</ul>")
            rows.append(row(ph(item["when"]), "\n          ".join(main)))
        parts.append(f"""    <h2 class="section-label">{esc(section['label'])}</h2>
    <ul class="rows">
{chr(10).join(rows)}
    </ul>""")
    updated = f"{FULL_MONTHS[date.today().month - 1]} {date.today().year}"
    bar = ""
    if (ROOT / RESUME_PDF).exists():
        bar = """    <div class="download-bar">
      <span class="download-bar-title">Resume as a PDF</span>
      <a class="download-btn is-view" href="resume-pdf.html">View PDF</a>
    </div>
"""
    github = next((l["text"] for l in SITE["links"] if l["label"] == "GitHub"), "")
    contact_line = " · ".join(x for x in [plain(SITE["email"]), github, SITE["url"].replace("https://", "")] if x)
    print_head = f"""    <div class="print-head">
      <h1>{esc(SITE['name'])}</h1>
      <p>{esc(contact_line)}</p>
    </div>
"""
    body = page_head("Resume", f"The short version of where I've been and what I've worked on. Updated {updated}.") + f"""
  <div class="page-body">
{bar}{print_head}{chr(10).join(parts)}
  </div>"""
    return inner_page("resume", "Resume", "Resume of Sanketh Kamath: education, research, experience and skills.", "resume.html", body)


def build_resume_pdf():
    """The PDF viewer: the resume's pages as pictures, with download and open buttons."""
    pages = resume_page_images()
    if pages:
        many = len(pages) > 1
        sheets = "\n".join(
            f'      <img class="sheet" src="{src}" width="{w}" height="{h}" alt="Resume of {esc(SITE["name"])}{f", page {i}" if many else ""}">'
            for i, (src, w, h) in enumerate(pages, 1)
        )
    else:
        sheets = f'      <iframe class="sheet sheet-frame" src="{RESUME_PDF}" title="Resume of {esc(SITE["name"])}"></iframe>'
    body = f"""  <header class="viewer-head">
    <h1 class="page-title viewer-title">Resume <em>PDF</em></h1>
    <div class="viewer-actions">
      <a class="download-btn" href="{RESUME_PDF}" download="Sanketh-Kamath-Resume.pdf">Download PDF</a>
      <a class="btn" href="{RESUME_PDF}" target="_blank" rel="noopener">Open in a new tab</a>
      <a class="btn" href="resume.html">Back to resume</a>
    </div>
  </header>
  <div class="sheets">
{sheets}
  </div>"""
    return inner_page("resume", "Resume PDF", "Resume of Sanketh Kamath as a PDF, to view or download.", "resume-pdf.html", body)


def build_blog(posts):
    rows = entry_rows(posts, "posts")
    listing = f'<ul class="rows">\n{chr(10).join(rows)}\n    </ul>' if rows else '<p class="empty">Nothing here yet. The first post is on its way.</p>'
    body = page_head("Blog", "Longer pieces on AI research, and the things I got wrong the first time.") + f"""
  <div class="page-body">
    {listing}
  </div>"""
    return inner_page("blog", "Blog", "Writing on AI research by Sanketh Kamath.", "blog.html", body)


def build_entry(e, kind):
    """The page for one blog post (kind "posts") or one note (kind "notes")."""
    section, back, label = ("blog", "../blog.html", "All posts") if kind == "posts" else ("notes", "../notes.html", "All notes")
    body = f"""  <header class="page-head">
    <h1 class="page-title post-title">{esc(e['title'])}</h1>
  </header>
  <div class="post-layout">
    <div class="post-side mono">
      <span>{nice_date(e['date'])}</span>
      <span>{e['minutes']} min read</span>
      <a href="{back}">← {label}</a>
    </div>
    <article class="prose">
{e['html']}
    </article>
  </div>"""
    return inner_page(section, e["title"], e["summary"] or SITE["description"], f"{kind}/{e['slug']}.html", body, root="../", math=e["math"])


def entry_rows(entries, kind):
    rows = []
    for e in entries:
        side = f"<span>{nice_date(e['date'])}</span><span>{e['minutes']} min read</span>"
        main = f'<h2 class="row-title"><a href="{kind}/{e["slug"]}.html">{esc(e["title"])}</a>{tag("sample") if e["sample"] else ""}</h2>'
        if e["summary"]:
            main += f'\n          <p class="row-text muted">{esc(e["summary"])}</p>'
        rows.append(row(side, main))
    return rows


def build_notes(notes):
    rows = entry_rows(notes, "notes")
    listing = f'<ul class="rows">\n{chr(10).join(rows)}\n    </ul>' if rows else '<p class="empty">No notes yet.</p>'
    body = page_head("Notes", "Working notes: papers I'm reading, derivations, experiments that surprised me, and ideas that aren't posts yet.") + f"""
  <div class="page-body">
    {listing}
  </div>"""
    return inner_page("notes", "Notes", "Research notes by Sanketh Kamath.", "notes.html", body)


def build_contact():
    email = SITE["email"]
    real = "[[" not in email
    email_html = f'<a href="mailto:{esc(email)}">{esc(email)}</a>' if real else ph(email)
    copy = '\n          <button class="btn" type="button" data-copy="' + esc(email) + '">Copy address</button><span class="mono muted" data-copy-status role="status"></span>' if real else ""
    rows = [row("Email", f'<p class="contact-email" id="email">{email_html}</p>{copy}')]
    for link in SITE["links"]:
        rows.append(row(esc(link["label"]), f'<p class="row-title">{link_list([link])}</p>'))
    body = page_head("Contact", "The best way to reach me is email. I'm happy to talk about research, roles, or anything I've written.") + f"""
  <div class="page-body">
    <ul class="rows">
{chr(10).join(rows)}
    </ul>
  </div>"""
    return inner_page("contact", "Contact", "How to reach Sanketh Kamath.", "contact.html", body)


def build_404():
    body = page_head("Not <em>here</em>", "That page doesn't exist, or it moved.") + """
  <div class="page-body">
    <p><a class="btn" href="/">Back to the home page</a></p>
  </div>"""
    # Absolute paths, because GitHub Pages serves this file for any missing address.
    return inner_page("", "Page not found", "Page not found.", "404.html", body, root="/")


def main():
    posts = load_entries("posts")
    notes = load_entries("notes")
    out = {
        "index.html": build_home(),
        "resume.html": build_resume(),
        "projects.html": build_projects(),
        "blog.html": build_blog(posts),
        "notes.html": build_notes(notes),
        "contact.html": build_contact(),
        "404.html": build_404(),
        # Ask search engines not to list the resume PDF or the pictures of it.
        "robots.txt": f"User-agent: *\nDisallow: /{RESUME_PDF}\nDisallow: /{RESUME_PAGES}/\n",
    }
    if (ROOT / RESUME_PDF).exists():
        out["resume-pdf.html"] = build_resume_pdf()
    for kind, entries in (("posts", posts), ("notes", notes)):
        folder = ROOT / kind
        folder.mkdir(exist_ok=True)
        for old in folder.glob("*.html"):
            old.unlink()
        for e in entries:
            out[f"{kind}/{e['slug']}.html"] = build_entry(e, kind)
    for name, text in out.items():
        (ROOT / name).write_text(text, encoding="utf-8")
    print(f"Built {len(out)} files: {len(posts)} posts, {len(notes)} notes.")


if __name__ == "__main__":
    main()
