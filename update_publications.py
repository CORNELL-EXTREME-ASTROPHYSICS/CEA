#!/usr/bin/env python3
"""
update_publications.py
=======================
Regenerates the group's publication list from NASA ADS — the real,
working way to auto-fill the Publications section of research.html.
Run it whenever the group publishes something new.

It writes two things, and both matter:
  - publications.json — the file research.html fetches at RUNTIME,
    every time someone loads the page (see the "publications" module
    near the bottom of script.js). Host the site anywhere and just
    replace this one file to push an update — no HTML edits, no
    redeploying the page itself.
  - the static list baked into research.html's Publications section
    (id="publications"), between the "<!-- PUBLICATIONS:START -->" /
    "<!-- PUBLICATIONS:END -->" markers — what renders instantly and
    what you get if the file is opened directly (file://) or
    publications.json can't be reached (fetch() is blocked from a
    file:// page, and would 404 if you ever serve the HTML without its
    JSON alongside it). The page always tries the JSON first and only
    falls back to this.

SETUP
-----------------
1. Create a free ADS account: https://ui.adsabs.harvard.edu/user/account/register
2. Get an API token: https://ui.adsabs.harvard.edu/user/settings/token
3. Either:
     export ADS_API_TOKEN="your-token-here"
   or pass it directly:
     python3 update_publications.py --token your-token-here

USAGE
-----
   python3 update_publications.py
   python3 update_publications.py --max-per-author 40 --dry-run

This rewrites the block in research.html (the Publications section)
between the "<!-- PUBLICATIONS:START -->" and "<!-- PUBLICATIONS:END -->"
markers. Everything else on the page — including the Research topics
above it — is left untouched. Run with --dry-run first to preview the
generated HTML without touching the file.

HOW AUTHORS ARE MATCHED
------------------------
Tracked people live in authors.yaml, not in this script — open that
file to add, remove, or check someone. Each entry is just a name plus
the URL of an ADS "search by author" page; this script parses the
"fq_author" identity filter and "q" author term straight out of that
URL, so pasting a link there is the whole job. That filter is ADS's
own disambiguated-author-identity system, so it matches one specific
"James M. Cordes," not just anyone with a similar name.

HOW TAGS ARE ASSIGNED
----------------------
Each paper is tagged gw / frb / instr by simple keyword matching on
its title (see TAG_KEYWORDS below) — good enough for a first pass, but
skim the output and hand-edit publications.json for anything
miscategorized (the next run will overwrite hand edits, so fix
TAG_KEYWORDS instead if a whole pattern is consistently wrong). No
exoplanet ("exo") tag gets produced unless a title matches one of its
keywords — add some to TAG_KEYWORDS if that ever changes.
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

ADS_SEARCH_URL = "https://api.adsabs.harvard.edu/v1/search/query"
AUTHORS_YAML = "authors.yaml"

FIELDS = ["title", "author", "year", "pub", "bibcode", "identifier", "doi", "doctype"]

TAG_KEYWORDS = {
    "gw": ["gravitational-wave", "gravitational wave", "nanograv", "pulsar timing array",
           "pta", "black hole binar", "hellings", "stochastic background"],
    "frb": ["fast radio burst", "frb ", "frb121102", "frb 121102", "repeating burst"],
    "instr": ["telescope", "backend", "receiver", "survey", "instrument", "array",
              "scintillation", "dispersion", "interstellar medium", "electron density",
              "scattering", "vla", "chime", "arecibo", "digital signal"],
}

PUB_TEMPLATE = """      <div class="pub" data-tags="{tags}">
        <div class="year">{year}</div>
        <div>
          <h3><a href="{link}" target="_blank" rel="noopener">{title}</a></h3>
          <div class="meta authors">{authors}</div>
          <div class="meta">{journal} &middot; {year}</div>
          <div class="tags">{tag_spans}</div>
        </div>
      </div>"""

TAG_LABELS = {"gw": "Gravitational Waves", "frb": "Fast Radio Bursts", "instr": "Instrumentation", "exo": "Exoplanets"}


def load_authors(path):
    """Minimal parser for authors.yaml's fixed two-line "- name: / url:"
    shape — deliberately not a real YAML parser, so no dependency to
    install; keep the file in that exact shape and this keeps working."""
    if not os.path.exists(path):
        sys.exit(f"{path} not found — it should list who to pull from ADS.")
    authors = []
    name = None
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if line.startswith("#") or not line:
                continue
            if line.startswith("- name:"):
                name = line.split(":", 1)[1].strip()
            elif line.startswith("url:") and name:
                url = line.split(":", 1)[1].strip().strip('"').strip("'")
                authors.append({"name": name, "url": url})
                name = None
    if not authors:
        sys.exit(f"No entries found in {path} — check it's in the '- name: / url:' shape.")
    return authors


def query_from_ads_url(url):
    """Pulls the 'fq_author' identity filter and 'q' author term straight
    out of a pasted ADS search-by-author URL, so nobody has to hand-write
    an API query string. ADS's search UI puts its params directly after
    '/search/' with no '?', which is non-standard but parse_qs handles
    fine once that prefix is stripped."""
    tail = url.split("/search/", 1)[-1]
    qs = urllib.parse.parse_qs(tail)
    fq_author = qs.get("fq_author", [None])[0]
    q = qs.get("q", [None])[0]
    if not fq_author or not q:
        sys.exit(f"Couldn't find fq_author/q in this URL — is it a full ADS search URL?\n  {url}")
    return f"{q.strip()} AND {fq_author}"


def fetch_author_papers(token, ads_query, max_rows):
    params = {
        "q": ads_query,
        "fl": ",".join(FIELDS),
        "sort": "date desc",
        "rows": str(max_rows),
    }
    url = ADS_SEARCH_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    return data["response"]["docs"]


def classify_tags(title):
    t = title.lower()
    tags = [tag for tag, kws in TAG_KEYWORDS.items() if any(kw in t for kw in kws)]
    return tags or ["instr"]  # fall back rather than emit an untagged, unfilterable entry


def format_authors(author_list, limit=3):
    if not author_list:
        return "Author list unavailable"
    shown = author_list[:limit]
    s = ", ".join(shown)
    if len(author_list) > limit:
        s += ", et al."
    return s


def ads_link(bibcode):
    return f"https://ui.adsabs.harvard.edu/abs/{urllib.parse.quote(bibcode)}/abstract"


def to_records(papers):
    """Shared shape used to build both publications.json and the HTML fallback."""
    records = []
    for p in papers:
        records.append({
            "title": p["title"][0],
            "authors": format_authors(p.get("author", [])),
            "year": p.get("year", "n.d."),
            "journal": p.get("pub", "arXiv preprint"),
            "tags": classify_tags(p["title"][0]),
            "link": ads_link(p["bibcode"]),
        })
    return records


def build_html(records):
    blocks = []
    for r in records:
        tag_spans = "".join(f'<span class="tag on">{TAG_LABELS[t]}</span>' for t in r["tags"])
        blocks.append(PUB_TEMPLATE.format(
            tags=" ".join(r["tags"]),
            year=r["year"],
            link=r["link"],
            title=r["title"],
            authors=r["authors"],
            journal=r["journal"],
            tag_spans=tag_spans,
        ))
    return "\n".join(blocks)


def build_json(records):
    import datetime
    payload = {
        "generated": datetime.date.today().isoformat(),
        "source": "Fetched from NASA ADS by update_publications.py.",
        "items": records,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--token", default=os.environ.get("ADS_API_TOKEN"), help="ADS API token (or set ADS_API_TOKEN)")
    ap.add_argument("--max-per-author", type=int, default=25, help="max papers to pull per person (default 25)")
    ap.add_argument("--authors-file", default=AUTHORS_YAML, help="path to authors.yaml")
    ap.add_argument("--file", default="research.html", help="path to research.html (Publications is a section within it)")
    ap.add_argument("--json-file", default="publications.json", help="path to publications.json")
    ap.add_argument("--dry-run", action="store_true", help="print generated output instead of writing files")
    args = ap.parse_args()

    if not args.token:
        sys.exit(
            "No ADS API token found. Get a free one at "
            "https://ui.adsabs.harvard.edu/user/settings/token then either\n"
            "  export ADS_API_TOKEN=your-token\n"
            "or pass --token your-token."
        )

    tracked = load_authors(args.authors_file)
    print(f"Tracking {len(tracked)} people from {args.authors_file}.", file=sys.stderr)

    seen_bibcodes = set()
    all_papers = []
    for person in tracked:
        print(f"Querying ADS for {person['name']}...", file=sys.stderr)
        ads_query = query_from_ads_url(person["url"])
        papers = fetch_author_papers(args.token, ads_query, args.max_per_author)
        if not papers:
            print(f"  (0 results — {person['name']}'s URL in {args.authors_file} may need a re-check)", file=sys.stderr)
        for p in papers:
            if p["bibcode"] not in seen_bibcodes:
                seen_bibcodes.add(p["bibcode"])
                all_papers.append(p)

    all_papers.sort(key=lambda p: p.get("year", "0"), reverse=True)
    print(f"Fetched {len(all_papers)} unique papers.", file=sys.stderr)

    records = to_records(all_papers)
    html = build_html(records)
    json_text = build_json(records)

    if args.dry_run:
        print("=== " + args.json_file + " ===")
        print(json_text)
        print("\n=== " + args.file + " (pub-list block) ===")
        print(html)
        return

    with open(args.json_file, "w", encoding="utf-8") as f:
        f.write(json_text + "\n")
    print(f"Wrote {args.json_file} with {len(records)} publications.", file=sys.stderr)

    with open(args.file, "r", encoding="utf-8") as f:
        content = f.read()

    start_marker = "<!-- PUBLICATIONS:START"
    end_marker = "<!-- PUBLICATIONS:END -->"
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    if start_idx == -1 or end_idx == -1:
        sys.exit(f"Could not find PUBLICATIONS:START/END markers in {args.file} — was the page edited?")

    # keep the START comment line itself, replace everything between it and END
    start_line_end = content.find("\n", start_idx) + 1
    new_content = (
        content[:start_line_end]
        + '    <div class="pub-list" data-observe>\n'
        + html + "\n"
        + "    </div>\n    "
        + content[end_idx:]
    )

    with open(args.file, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Updated {args.file} (offline fallback) with {len(records)} publications.", file=sys.stderr)


if __name__ == "__main__":
    main()
