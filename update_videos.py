#!/usr/bin/env python3
"""
update_videos.py
=================
Regenerates the group's Talks & Media video list from YouTube — the
real, working way to auto-fill outreach.html. Run it whenever a new
talk recording should be added or removed, or whenever a video's
"choice" (featured vs. grid) changes in talks.yaml.

It writes two things, and both matter:
  - videos.json — the file outreach.html fetches at RUNTIME, every
    time someone loads the page (see the "videos" module near the
    bottom of script.js). Host the site anywhere and just replace
    this one file to push an update — no HTML edits, no redeploying
    the page.
  - the static markup baked into outreach.html, between the
    "<!-- VIDEOS:FEATURED:START/END -->" and "<!-- VIDEOS:GRID:START/END -->"
    marker pairs — what renders instantly and what you get if the
    page is opened directly (file://) or videos.json can't be reached.
    The page always tries the JSON first and only falls back to this.

WHY YOUTUBE'S OEMBED ENDPOINT
------------------------------
YouTube's oEmbed endpoint (https://www.youtube.com/oembed) is public,
free, and needs no API key or login — pass it a normal watch URL and
it returns the video's real title, channel name, thumbnail, and an
embed snippet, straight from YouTube. That's the only data this
script fetches automatically; nothing here is guessed or invented. If
a video has embedding disabled by its uploader, oEmbed returns an
error for it — this script catches that per-video and marks it
"embeddable: false" instead of failing the whole run; outreach.html
links straight to YouTube for those instead of trying to embed them.

THE ONE HUMAN-SET FIELD: "choice"
----------------------------------
Everything oEmbed returns is fetched for real. The one exception is
"choice", which is never looked up — it comes straight from the
"choice: featured" line (or its absence) next to a video's "- url:"
entry in talks.yaml, and is carried through unchanged into every
record. A video with "choice: featured" renders in the large Featured
panels on outreach.html; every other video renders in the grid below.
Reorder or add entries in talks.yaml freely — only the "choice:"
lines control what's featured.

SETUP
-----
Needs network access to www.youtube.com — nothing else. No account,
no API key.

USAGE
-----
   python3 update_videos.py
   python3 update_videos.py --dry-run

This rewrites the blocks in outreach.html between the VIDEOS:FEATURED
and VIDEOS:GRID marker pairs. Everything else on the page is left
untouched. Run with --dry-run first to preview the generated output
without touching any files.

WHICH VIDEOS SHOW WHERE
------------------------
Tracked videos live in talks.yaml, not in this script — open that
file to add, remove, or reorder one, and to mark one "choice: featured"
or leave it in the grid.
"""

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import urllib.error

OEMBED_URL = "https://www.youtube.com/oembed"
VIDEOS_YAML = "talks.yaml"

VIDEO_ID_RE = re.compile(r"(?:v=|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})")


def load_videos(path):
    """Minimal parser for talks.yaml's fixed "- url: ..." / "choice: ..."
    shape — deliberately not a real YAML parser, so no dependency to
    install; keep the file in that exact shape and this keeps working.
    Returns a list of {"url": ..., "choice": ... or None} dicts, in
    file order."""
    if not os.path.exists(path):
        sys.exit(f"{path} not found — it should list which YouTube URLs to show.")
    entries = []
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if line.startswith("#") or not line:
                continue
            if line.startswith("- url:"):
                url = line.split(":", 1)[1].strip().strip('"').strip("'")
                entries.append({"url": url, "choice": None})
            elif line.startswith("choice:") and entries:
                choice = line.split(":", 1)[1].strip().strip('"').strip("'").lower()
                entries[-1]["choice"] = choice if choice and choice != "null" else None
    if not entries:
        sys.exit(f"No entries found in {path} — check it's in the '- url: ...' shape.")
    return entries


def extract_video_id(url):
    m = VIDEO_ID_RE.search(url)
    if not m:
        sys.exit(f"Couldn't find a YouTube video ID in this URL:\n  {url}")
    return m.group(1)


def fetch_oembed(video_id):
    """Looks up real metadata for one video via YouTube's public oEmbed
    endpoint. Returns None (rather than raising) if the video can't be
    embedded/found, so the caller can fall back to a link-out card."""
    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    params = urllib.parse.urlencode({"url": watch_url, "format": "json"})
    req = urllib.request.Request(f"{OEMBED_URL}?{params}")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"  ({video_id}: oEmbed returned {e.code} — probably embedding-disabled or private; "
              f"will show as a link-out card)", file=sys.stderr)
        return None
    except urllib.error.URLError as e:
        print(f"  ({video_id}: network error fetching oEmbed data — {e.reason})", file=sys.stderr)
        return None


def guess_speaker(title):
    """The group's two PIs' names appear directly in several of the
    real talk titles pulled from YouTube — surface that as a speaker
    tag only when the name is literally present in the title, so
    nothing here is inferred beyond what YouTube itself returned."""
    t = title.lower()
    for name in ("Lydia Guertin", "James Cordes", "Jim Cordes", "Shami Chatterjee", "Jacobson-Bell"):
        if name.lower() in t:
            if "cordes" in name.lower():
                return "James M. Cordes"
            if "chatterjee" in name.lower():
                return "Shami Chatterjee"
            if "jacobson-bell" in name.lower():
                return "B. Jacobson-Bell"
            return name
    return None


def to_record(video_id, url, meta, choice):
    thumb = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    if meta is None:
        return {
            "id": video_id,
            "url": url,
            "title": None,
            "channel": None,
            "speaker": None,
            "thumbnail": thumb,
            "embeddable": False,
            "choice": choice,
        }
    title = meta.get("title", "")
    return {
        "id": video_id,
        "url": url,
        "title": title,
        "channel": meta.get("author_name"),
        "speaker": guess_speaker(title),
        "thumbnail": meta.get("thumbnail_url", thumb),
        "embeddable": True,
        "choice": choice,
    }


FEATURED_TEMPLATE = """      <div class="video-feature" data-video-id="{id}" data-embeddable="{embeddable_attr}">
        <div class="video-frame" style="background-image:url('{thumbnail}')">
          <button class="video-play" type="button" aria-label="Play video">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
          </button>
        </div>
        <div class="video-meta">
          <h3><a class="video-title-link" href="{url}" target="_blank" rel="noopener">{title}</a></h3>
          <p class="meta">{byline}</p>
        </div>
      </div>"""

GRID_TEMPLATE = """      <div class="video-card" data-video-id="{id}" data-embeddable="{embeddable_attr}">
        <div class="video-frame" style="background-image:url('{thumbnail}')">
          <button class="video-play" type="button" aria-label="Play video">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
          </button>
        </div>
        <div class="video-meta">
          <h4><a class="video-title-link" href="{url}" target="_blank" rel="noopener">{title}</a></h4>
          <p class="meta">{byline}</p>
        </div>
      </div>"""


def byline_for(r):
    parts = [p for p in (r["speaker"], r["channel"]) if p]
    if r["speaker"] and r["channel"] and r["speaker"] == r["channel"]:
        parts = [r["speaker"]]
    return " &middot; ".join(parts) if parts else "YouTube"


def esc(s):
    if not s:
        return ""
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def build_html_block(records, template):
    blocks = []
    for r in records:
        title = esc(r["title"]) if r["title"] else "Watch on YouTube"
        blocks.append(template.format(
            id=r["id"],
            embeddable_attr="true" if r["embeddable"] else "false",
            thumbnail=r["thumbnail"],
            title=title,
            url=esc(r["url"]),
            byline=esc(byline_for(r)),
        ))
    return "\n".join(blocks)


def build_json(records):
    import datetime
    payload = {
        "generated": datetime.date.today().isoformat(),
        "source": "Fetched from YouTube's public oEmbed endpoint by update_videos.py. "
                   "\"choice\" is the one field that's human-set, from talks.yaml.",
        "items": records,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def replace_between(content, start_marker, end_marker, inner_html, wrapper_open, wrapper_close, file_label):
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    if start_idx == -1 or end_idx == -1:
        sys.exit(f"Could not find {start_marker}/{end_marker} markers in {file_label} — was the page edited?")
    start_line_end = content.find("\n", start_idx) + 1
    return (
        content[:start_line_end]
        + wrapper_open + "\n"
        + inner_html + "\n"
        + wrapper_close + "\n    "
        + content[end_idx:]
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--videos-file", default=VIDEOS_YAML, help="path to talks.yaml")
    ap.add_argument("--file", default="outreach.html", help="path to outreach.html")
    ap.add_argument("--json-file", default="videos.json", help="path to videos.json")
    ap.add_argument("--dry-run", action="store_true", help="print generated output instead of writing files")
    args = ap.parse_args()

    entries = load_videos(args.videos_file)
    print(f"Tracking {len(entries)} videos from {args.videos_file}.", file=sys.stderr)

    records = []
    for entry in entries:
        vid = extract_video_id(entry["url"])
        print(f"Looking up {vid}...", file=sys.stderr)
        meta = fetch_oembed(vid)
        records.append(to_record(vid, entry["url"], meta, entry["choice"]))

    featured = [r for r in records if r["choice"] == "featured"]
    grid = [r for r in records if r["choice"] != "featured"]
    json_text = build_json(records)
    featured_html = build_html_block(featured, FEATURED_TEMPLATE)
    grid_html = build_html_block(grid, GRID_TEMPLATE)

    if args.dry_run:
        print("=== " + args.json_file + " ===")
        print(json_text)
        print("\n=== " + args.file + " (featured block) ===")
        print(featured_html)
        print("\n=== " + args.file + " (grid block) ===")
        print(grid_html)
        return

    with open(args.json_file, "w", encoding="utf-8") as f:
        f.write(json_text + "\n")
    print(f"Wrote {args.json_file} with {len(records)} videos ({len(featured)} featured).", file=sys.stderr)

    with open(args.file, "r", encoding="utf-8") as f:
        content = f.read()

    content = replace_between(
        content, "<!-- VIDEOS:FEATURED:START", "<!-- VIDEOS:FEATURED:END -->",
        featured_html, '    <div class="video-featured-grid" data-observe>', "    </div>", args.file,
    )
    content = replace_between(
        content, "<!-- VIDEOS:GRID:START", "<!-- VIDEOS:GRID:END -->",
        grid_html, '    <div class="video-grid" data-observe>', "    </div>", args.file,
    )

    with open(args.file, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated {args.file} (offline fallback) with {len(records)} videos.", file=sys.stderr)


if __name__ == "__main__":
    main()