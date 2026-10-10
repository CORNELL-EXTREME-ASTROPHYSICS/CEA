/* ============================================================
   Cornell Extreme Astrophysics — shared behavior
   ============================================================ */

/* ---------- starfield: monochrome, runs in both themes ----------
   Ink-black flecks on the marble (light) theme, silver flecks on
   the matte-black (dark) theme — a single hue per theme, read fresh
   each frame from [data-theme], so a toggle recolors the field
   instantly with no restart. */
var Starfield = (function(){
  var canvas, ctx, stars = [], w, h, dpr, raf = null, running = false;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize(){
    if(!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width  = window.innerWidth  * dpr;
    h = canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    var count = Math.round((window.innerWidth * window.innerHeight) / 9000);
    stars = [];
    for(var i=0;i<count;i++){
      stars.push({
        x: Math.random()*w,
        y: Math.random()*h,
        r: (Math.random()*1.15 + 0.25) * dpr,
        base: Math.random()*0.45 + 0.2,
        amp: Math.random()*0.4,
        speed: Math.random()*0.02 + 0.006,
        phase: Math.random()*Math.PI*2
      });
    }
  }

  function dotColor(a){
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? 'rgba(196,199,206,'+a+')' : 'rgba(23,22,19,'+a+')';
  }

  var t = 0;
  function frame(){
    if(!running) return;
    t += 1;
    ctx.clearRect(0,0,w,h);
    for(var i=0;i<stars.length;i++){
      var s = stars[i];
      var tw = reduced ? s.base : s.base + s.amp * Math.sin(t*s.speed + s.phase);
      ctx.beginPath();
      ctx.fillStyle = dotColor(Math.max(0, Math.min(1, tw)));
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    }
    if(!reduced) raf = requestAnimationFrame(frame);
  }

  function start(){
    if(running) return;
    canvas = document.getElementById('stars');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    running = true;
    resize();
    window.addEventListener('resize', resize);
    if(reduced){ frame(); } else { raf = requestAnimationFrame(frame); }
  }

  function stop(){
    running = false;
    if(raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    if(ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* redraws once with the current theme's color — needed after a
     toggle when prefers-reduced-motion means frame() isn't looping */
  function repaint(){
    if(reduced && running) frame();
  }

  return { start: start, stop: stop, repaint: repaint };
})();

/* ---------- theme: light (default) / dark switch ----------
   The <head> of every page carries a small blocking script that
   applies a saved choice before first paint, so there's no flash.
   This module wires up the toggle button; the starfield above runs
   in both themes and just re-reads its color each frame. */
(function theme(){
  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');

  function isDark(){ return root.getAttribute('data-theme') === 'dark'; }

  Starfield.start();

  if(toggle){
    toggle.addEventListener('click', function(){
      if(isDark()){
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', 'dark');
      }
      try{ localStorage.setItem('ceag-theme', isDark() ? 'dark' : 'light'); }catch(e){}
      Starfield.repaint();
    });
  }
})();

/* ---------- pen-draw: trace chart paths in on load, once ----------
   Each .pen-draw path is measured and drawn from nothing to its full
   length, like a recorder needle sweeping across the paper — a single
   settle-in moment per page, not a continuous or ambient effect. */
(function penDraw(){
  var paths = document.querySelectorAll('.pen-draw');
  if(!paths.length) return;
  paths.forEach(function(p, i){
    var len = Math.ceil(p.getTotalLength());
    p.style.setProperty('--len', len);
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    p.style.animationDelay = (i * 0.12) + 's';
  });
})();

/* ---------- nav: mobile toggle + active link ---------- */
(function nav(){
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if(toggle && links){
    toggle.addEventListener('click', function(){
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ links.classList.remove('open'); });
    });
  }

  var page = document.body.getAttribute('data-page');
  if(!page){
    var path = location.pathname;
    if(path === '' || path.slice(-1) === '/' || /(^|\/)index\.html?$/.test(path)) page = 'home';
  }
  if(page){
    document.querySelectorAll('.nav-links a').forEach(function(a){
      if(a.getAttribute('data-nav') === page){ a.classList.add('active'); }
    });
  }
})();

/* ---------- updates ticker: rotating "recent updates" card (home page only) ----------
   PLACEHOLDER CONTENT — the array below is dummy/example text, not real
   group news. Replace each { what, when } entry with a real update
   (someone joining, a defense, a new preprint, a talk) before this ships;
   nothing in this list is presented elsewhere on the site as fact. Cross-
   fades through the list one item at a time in the #updates-list card and
   loops forever at a readable pace. */
(function updatesTicker(){
  var list = document.getElementById('updates-list');
  if(!list) return;

  var UPDATES = [
    // { what, when } — "when" is optional (a real date, once there's one to show).
    { what: 'New graduate student joined the group.' },
    { what: 'A group member successfully defended their PhD.' },
    { what: 'New preprint posted to arXiv.' },
    { what: 'Group presented a talk at a conference.' },
    { what: 'Undergraduate researcher started a summer project.' }
  ];

  list.innerHTML = UPDATES.map(function(u, i){
    return '<li' + (i === 0 ? ' class="active"' : '') + '>' +
      '<span class="u-what">' + u.what + '</span>' +
      (u.when ? '<span class="u-when">' + u.when + '</span>' : '') +
    '</li>';
  }).join('');

  var items = list.querySelectorAll('li');
  if(items.length < 2) return;
  var i = 0;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced) return; // static on the first item — no forced motion

  setInterval(function(){
    items[i].classList.remove('active');
    i = (i + 1) % items.length;
    items[i].classList.add('active');
  }, 4000);
})();

/* ---------- footer signal strip: live UTC clock ---------- */
(function clock(){
  var el = document.querySelector('[data-utc-clock]');
  if(!el) return;
  function pad(n){ return String(n).padStart(2,'0'); }
  function tick(){
    var d = new Date();
    el.textContent = pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())+' UTC';
  }
  tick();
  setInterval(tick, 1000);
})();

/* ---------- publications: filter + runtime refresh (research page's Publications section) ----------
   The page ships with a real, static list baked into the HTML — that's
   what renders instantly and what you get if this file is opened
   directly (file://) or publications.json is unreachable. On top of
   that, this tries a same-origin fetch of publications.json at load
   time and, if it succeeds, swaps in whatever that file currently
   holds — so hosting the site and periodically refreshing that one
   JSON file (via update_publications.py, pointed at NASA ADS) is
   enough to keep the page current with no HTML edits.
   Google Scholar and arXiv can't be fetched this way — browsers block
   cross-site requests to either from another site's JS (no CORS on
   their end) — see update_publications.py for why ADS is the source. */
(function publications(){
  var buttons = document.querySelectorAll('[data-filter]');
  var list = document.querySelector('.pub-list');
  if(!buttons.length || !list) return;

  var TAG_LABELS = { gw:'Gravitational Waves', frb:'Fast Radio Bursts', instr:'Instrumentation', exo:'Exoplanets' };
  var BATCH_SIZE = 6; // how many more rows a scroll-to-bottom reveals at a time
  var activeFilter = 'all';
  var revealed = BATCH_SIZE;
  var sentinel = null;
  var observer = null;

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* every row's real, true publication year drives the order — sorted
     here in JS rather than trusted to stay in whatever order the HTML
     or publications.json happens to list them in, so a future hand
     edit or script run can't silently put the list out of order. */
  function sortChronological(){
    var rows = Array.prototype.slice.call(list.children);
    rows.sort(function(a, b){
      var ya = parseInt((a.querySelector('.year') || {}).textContent, 10) || 0;
      var yb = parseInt((b.querySelector('.year') || {}).textContent, 10) || 0;
      return yb - ya; // newest first
    });
    rows.forEach(function(row){ list.appendChild(row); });
  }

  /* shows, next to each paper's title, the real favicon of wherever
     that particular link goes (ADS, arXiv, a journal's own site,
     whatever a future entry links to) — computed from the link's own
     href rather than hard-coded, so it's correct for any source
     without needing per-entry markup. Same blocked-favicon fallback
     as the team page's link icons: hide the icon rather than show a
     broken image if the favicon can't be fetched. */
  function injectFavicons(){
    list.querySelectorAll('h3 a').forEach(function(a){
      if(a.querySelector('.pub-favicon')) return;
      var host = '';
      try { host = new URL(a.href).hostname; } catch(e){ return; }
      var img = document.createElement('img');
      img.className = 'pub-favicon';
      img.alt = '';
      img.width = 14; img.height = 14;
      img.loading = 'lazy';
      img.src = 'https://www.google.com/s2/favicons?sz=32&domain=' + encodeURIComponent(host);
      img.onerror = function(){ img.style.display = 'none'; };
      img.onload = function(){ if(img.naturalWidth <= 2){ img.style.display = 'none'; } };
      a.insertBefore(img, a.firstChild);
    });
  }

  function ensureSentinel(){
    if(sentinel) return sentinel;
    sentinel = document.createElement('div');
    sentinel.className = 'pub-sentinel';
    list.parentNode.insertBefore(sentinel, list.nextSibling);
    return sentinel;
  }

  function matchesFilter(row){
    var tags = row.getAttribute('data-tags') || '';
    return activeFilter === 'all' || tags.indexOf(activeFilter) !== -1;
  }

  /* one shared pass that both the filter buttons and the scroll
     sentinel call: shows whichever rows match the active filter, up
     to however many have been "revealed" by scrolling so far — an
     unlimited list under the hood, paged in visually as you scroll
     instead of all dumped in at once or capped off entirely. */
  function applyView(){
    var rows = Array.prototype.slice.call(list.children);
    var visible = rows.filter(matchesFilter);
    rows.forEach(function(row){
      row.hidden = !matchesFilter(row);
    });
    visible.forEach(function(row, i){
      if(matchesFilter(row)) row.hidden = i >= revealed;
    });
    var sent = ensureSentinel();
    sent.hidden = revealed >= visible.length;
  }

  function revealMore(){
    revealed += BATCH_SIZE;
    applyView();
  }

  function wireScroll(){
    var sent = ensureSentinel();
    if(!('IntersectionObserver' in window)) { revealed = Infinity; applyView(); return; }
    if(observer) observer.disconnect();
    observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){ if(entry.isIntersecting) revealMore(); });
    }, { rootMargin: '400px 0px' });
    observer.observe(sent);
  }

  /* (re)wires the filter buttons against whatever [data-tags] rows are
     in the DOM right now — safe to call again after a re-render since
     assigning .onclick replaces rather than stacks the handler */
  function wireFilter(){
    buttons.forEach(function(btn){
      btn.onclick = function(){
        buttons.forEach(function(b){ b.classList.remove('on'); });
        btn.classList.add('on');
        activeFilter = btn.getAttribute('data-filter');
        revealed = BATCH_SIZE; // start each new filter view from the first batch again
        applyView();
      };
    });
  }

  function renderFromData(items){
    if(!items.length) return;
    list.innerHTML = items.map(function(p){
      var tags = (p.tags || []).filter(function(t){ return TAG_LABELS[t]; });
      var tagSpans = tags.map(function(t){ return '<span class="tag on">'+TAG_LABELS[t]+'</span>'; }).join('');
      return (
        '<div class="pub" data-tags="'+esc(tags.join(' '))+'">' +
          '<div class="year">'+esc(p.year)+'</div>' +
          '<div>' +
            '<h3><a href="'+esc(p.link)+'" target="_blank" rel="noopener">'+esc(p.title)+'</a></h3>' +
            '<div class="meta authors">'+esc(p.authors)+'</div>' +
            '<div class="meta">'+esc(p.journal)+' &middot; '+esc(p.year)+'</div>' +
            '<div class="tags">'+tagSpans+'</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  // the static, baked-in list — works immediately, no network needed
  sortChronological();
  injectFavicons();
  wireFilter();
  applyView();
  wireScroll();

  fetch('publications.json', { cache: 'no-store' })
    .then(function(r){ if(!r.ok) throw new Error('no publications.json'); return r.json(); })
    .then(function(data){
      if(!data || !Array.isArray(data.items) || !data.items.length) return;
      renderFromData(data.items);
      sortChronological();
      injectFavicons();
      revealed = BATCH_SIZE;
      wireFilter(); // re-wire against the freshly rendered rows
      applyView();
      wireScroll();
    })
    .catch(function(){ /* offline, opened via file://, or file missing — static list stands */ });
})();

/* ---------- research page: "fields at a glance" spiderweb ----------
   Hovering/focusing/tapping a node updates the italic blurb below the
   diagram, and — where the field maps onto one of the Publications
   filter buttons further down the page — also clicks that button, so
   the reading list updates to match whatever field is being explored. */
(function researchWeb(){
  var nodes = document.querySelectorAll('.web-node');
  var tipField = document.querySelector('.web-tip-field');
  var tipText = document.querySelector('.web-tip-text');
  if(!nodes.length || !tipField || !tipText) return;

  var FIELD_INFO = {
    gw:   { label: 'Nanohertz gravitational waves', desc: 'A galaxy-sized detector built from dozens of millisecond pulsars, sensitive to wavelengths no ground-based interferometer can reach.' },
    pta:  { label: 'Pulsar timing arrays', desc: 'The instrument behind the GW search itself — years of precision timing on well-behaved millisecond pulsars scattered across the sky.' },
    frb:  { label: 'Fast radio bursts', desc: 'Millisecond flashes from other galaxies, timed and localized to trace the ionized gas between us and them.' },
    ism:  { label: 'Interstellar medium', desc: 'The turbulent plasma every radio signal has to cross — a source of noise, and, read carefully, a source of information too.' },
    seti: { label: 'SETI & astrobiology', desc: 'A side interest, pursued with the same telescopes and statistical toolkit built for pulsars and bursts.' },
    grex: { label: 'Galactic Radio Explorer', desc: 'Survey work mapping radio sources and transients across the Galactic plane.' }
  };

  function activate(node){
    nodes.forEach(function(n){ n.classList.remove('is-active'); });
    node.classList.add('is-active');
    var info = FIELD_INFO[node.getAttribute('data-field')];
    if(info){
      tipField.textContent = info.label;
      tipText.textContent = '“' + info.desc + '”';
    }
    var filterKey = node.getAttribute('data-web-filter');
    if(filterKey){
      var btn = document.querySelector('.filter-row [data-filter="' + filterKey + '"]');
      if(btn) btn.click();
    }
  }

  nodes.forEach(function(node){
    node.addEventListener('mouseenter', function(){ activate(node); });
    node.addEventListener('focus', function(){ activate(node); });
    node.addEventListener('click', function(){ activate(node); });
  });
})();

/* ---------- videos: click-to-play panels + runtime refresh (outreach page's Talks & Media section) ----------
   A real, static set of panels is baked into the HTML for outreach.html
   (works immediately, and is the fallback for file:// or an unreachable
   videos.json), and this tries a same-origin fetch of videos.json at
   load time to replace it with whatever that file currently holds.
   videos.json is auto-generated by update_videos.py from talks.yaml —
   real title/channel/thumbnail/embeddability come from YouTube's oEmbed
   endpoint; the one field that's human-set is "choice" ("featured" or
   null), read straight from talks.yaml. To add or move a talk, edit
   talks.yaml and rerun update_videos.py — no manual JSON or HTML edits.
   Every .video-frame starts as a thumbnail image, not a live embed, so
   the page never loads a dozen YouTube iframes up front — clicking one
   swaps just that panel for a playing embed (or, for videos whose
   uploader disabled embedding, opens it on YouTube instead). */
(function videos(){
  var featuredWrap = document.querySelector('.video-featured-grid');
  var gridWrap = document.querySelector('.video-grid');
  if(!featuredWrap && !gridWrap) return;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function byline(item){
    var parts = [];
    if(item.speaker) parts.push(item.speaker);
    if(item.channel && item.channel !== item.speaker) parts.push(item.channel);
    return parts.length ? parts.join(' &middot; ') : 'YouTube';
  }

  /* swaps a clicked .video-frame's thumbnail for a live, autoplaying
     embed — or, if the video isn't embeddable, opens it on YouTube
     instead. Delegated on each wrap so it survives re-renders. */
  function wirePlay(wrap){
    if(!wrap) return;
    wrap.onclick = function(e){
      var frame = e.target.closest('.video-frame');
      if(!frame || frame.classList.contains('is-playing')) return;
      var card = frame.closest('[data-video-id]');
      if(!card) return;
      var id = card.getAttribute('data-video-id');
      var embeddable = card.getAttribute('data-embeddable') !== 'false';
      if(!embeddable){
        var url = card.getAttribute('data-video-url') || ('https://www.youtube.com/watch?v=' + id);
        window.open(url, '_blank', 'noopener');
        return;
      }
      frame.classList.add('is-playing');
      frame.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1" ' +
        'title="' + esc(card.querySelector('h3,h4') ? card.querySelector('h3,h4').textContent : 'YouTube video') + '" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
        'allowfullscreen></iframe>';
    };
  }

  function panelHTML(item, headingTag){
    var title = item.title || 'Watch on YouTube';
    var embeddable = item.embeddable !== false;
    var watchUrl = item.url || ('https://www.youtube.com/watch?v=' + item.id);
    var extra = embeddable ? '' : ' data-video-url="' + esc(watchUrl) + '"';
    return (
      '<div class="video-' + (headingTag === 'h3' ? 'feature' : 'card') + '" data-video-id="' + esc(item.id) + '" data-embeddable="' + embeddable + '"' + extra + '>' +
        '<div class="video-frame" style="background-image:url(\'' + esc(item.thumbnail) + '\')">' +
          '<button class="video-play" type="button" aria-label="' + (embeddable ? 'Play video' : 'Watch on YouTube') + '">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>' +
          '</button>' +
        '</div>' +
        '<div class="video-meta">' +
          '<' + headingTag + '><a class="video-title-link" href="' + esc(watchUrl) + '" target="_blank" rel="noopener">' + esc(title) + '</a></' + headingTag + '>' +
          '<p class="meta">' + byline(item) + '</p>' +
        '</div>' +
      '</div>'
    );
  }

  function renderFromData(items){
    if(!items.length) return;
    /* "choice" is the one human-set field in videos.json (set in
       talks.yaml, carried through by update_videos.py) — "featured"
       puts a video in the large panels, anything else (null/absent)
       puts it in the grid. Nothing here is positional any more. */
    var featured = items.filter(function(it){ return it.choice === 'featured'; });
    var grid = items.filter(function(it){ return it.choice !== 'featured'; });
    if(featuredWrap && featured.length){
      featuredWrap.innerHTML = featured.map(function(it){ return panelHTML(it, 'h3'); }).join('');
    }
    if(gridWrap && grid.length){
      gridWrap.innerHTML = grid.map(function(it){ return panelHTML(it, 'h4'); }).join('');
    }
  }

  /* hover preview: on a device with a real mouse (never on touch — a tap
     both hovers and clicks, so previewing first would waste a load), rest
     the pointer on a not-yet-played panel and it starts a silent, looping
     preview after a short pause; move away and it reverts to the still
     thumbnail. Wired once, via delegation on the wrap, so it keeps working
     after renderFromData() replaces the cards inside it. Clicking through
     a preview still starts the real, unmuted embed — the preview iframe is
     pointer-events:none so the click reaches the play button beneath it. */
  var canHoverPreview = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function wireHoverPreview(wrap){
    if(!wrap || !canHoverPreview) return;
    var timer = null;
    wrap.addEventListener('mouseover', function(e){
      var frame = e.target.closest('.video-frame');
      if(!frame || frame.classList.contains('is-playing') || frame.classList.contains('is-previewing')) return;
      var card = frame.closest('[data-video-id]');
      if(!card || card.getAttribute('data-embeddable') === 'false') return;
      var id = card.getAttribute('data-video-id');
      clearTimeout(timer);
      timer = setTimeout(function(){
        if(!frame.matches(':hover') || frame.classList.contains('is-playing')) return;
        frame.classList.add('is-previewing');
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(id) +
          '?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&loop=1&playlist=' + encodeURIComponent(id);
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        iframe.setAttribute('tabindex', '-1');
        iframe.style.pointerEvents = 'none';
        frame.appendChild(iframe);
      }, 450);
    });
    wrap.addEventListener('mouseout', function(e){
      var frame = e.target.closest('.video-frame');
      if(!frame || frame.contains(e.relatedTarget)) return;
      clearTimeout(timer);
      if(frame.classList.contains('is-previewing')){
        frame.classList.remove('is-previewing');
        var iframe = frame.querySelector('iframe');
        if(iframe) iframe.remove();
      }
    });
  }

  wirePlay(featuredWrap); // the static, baked-in panels — playable immediately, no network needed
  wirePlay(gridWrap);
  wireHoverPreview(featuredWrap);
  wireHoverPreview(gridWrap);

  fetch('videos.json', { cache: 'no-store' })
    .then(function(r){ if(!r.ok) throw new Error('no videos.json'); return r.json(); })
    .then(function(data){
      if(!data || !Array.isArray(data.items) || !data.items.length) return;
      renderFromData(data.items);
      wirePlay(featuredWrap); // re-wire against the freshly rendered panels
      wirePlay(gridWrap);
    })
    .catch(function(){ /* offline, opened via file://, or file missing — static panels stand */ });
})();

/* ---------- team: staff / graduate-student / undergraduate panels + past
   members, driven from team.json (team.html's roster section) ----------
   team.json is hand-maintained — edit it directly to add someone, move
   them between categories ("staff" / "grad" / "undergrad" / null for
   not-yet-classified), or add a name to pastMembers; no build step.
   Staff and graduate-student panels can carry a short description and
   any of website/linkedin/email — each renders as an icon link only
   when that field is actually set, never a placeholder. Undergraduate
   panels are name-only, per how the group wants that tier shown. The
   baked HTML (this page's markup as shipped, all "pending" empty
   states except the still-unclassified current roster) is the fallback
   for file:// or an unreachable team.json. */
(function team(){
  var staffEl = document.getElementById('team-staff');
  var gradEl = document.getElementById('team-grad');
  var undergradEl = document.getElementById('team-undergrad');
  var unclassifiedEl = document.getElementById('team-unclassified');
  var unclassifiedSection = document.getElementById('team-unclassified-section');
  var pastEl = document.getElementById('team-past');
  if(!staffEl && !gradEl && !undergradEl && !unclassifiedEl && !pastEl) return;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  var ICONS = {
    website: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9s1.3-6.4 3.8-9Z"></path></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 5a2 2 0 1 1-4-.002 2 2 0 0 1 4 .002ZM3.5 8.75h3.9V21H3.5V8.75Zm6.5 0h3.74v1.68h.05c.52-.98 1.8-2.02 3.7-2.02 3.96 0 4.7 2.6 4.7 5.98V21h-3.9v-5.86c0-1.4-.03-3.2-1.95-3.2-1.96 0-2.26 1.53-2.26 3.1V21H10V8.75Z"></path></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.2c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.5 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.19-3.37-1.19-.45-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 2.5-.35c.85 0 1.71.12 2.5.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .28.18.61.69.5A10.02 10.02 0 0 0 22 12.2C22 6.58 17.52 2 12 2Z"></path></svg>'
  };
  /* team.json data may use varied key casing for links ("Website",
     "GitHub", etc.) since it's hand-edited — normalize to lowercase
     keys here so linkRow() always finds them regardless of how the
     JSON capitalized them. */
  function normalizeLinks(links){
    var out = {};
    if(links){
      Object.keys(links).forEach(function(k){
        var v = links[k];
        if(v) out[k.toLowerCase()] = v;
      });
    }
    return out;
  }

  /* deterministic per-person "constellation" placeholder avatar — same
     visual language as the hand-drawn PI avatars above, but generated
     from a hash of the name so every person gets a distinct, stable
     pattern with no per-person artwork to maintain in team.json. Once
     someone has a real headshot, set "photo" on their entry and that
     renders instead. */
  var AVATAR_COLORS = ['var(--signal)', 'var(--cyan)', 'var(--burst)', 'var(--nebula)', 'var(--starlight-dim)'];
  function hashStr(s){
    var h = 0;
    for(var i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function avatarSVG(name){
    var h = hashStr(name || '?');
    var color = AVATAR_COLORS[h % AVATAR_COLORS.length];
    var points = 6 + (h % 3) * 2;
    var rot = h % 60;
    var lines = '';
    for(var i = 0; i < points; i++){
      var angle = (360 / points) * i + rot;
      var rad = angle * Math.PI / 180;
      var x2 = (42 + 34 * Math.cos(rad)).toFixed(1);
      var y2 = (42 + 34 * Math.sin(rad)).toFixed(1);
      lines += '<line x1="42" y1="42" x2="' + x2 + '" y2="' + y2 + '"></line>';
    }
    return (
      '<svg viewBox="0 0 84 84" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">' +
        '<rect width="84" height="84" fill="var(--void-deep)"></rect>' +
        '<g stroke="' + color + '" stroke-width="1" opacity="0.85">' + lines + '</g>' +
        '<circle cx="42" cy="42" r="5" fill="' + color + '"></circle>' +
        '<circle cx="42" cy="42" r="14" fill="none" stroke="' + color + '" stroke-width="0.8" opacity="0.5"></circle>' +
      '</svg>'
    );
  }
  /* team.json's "photo" field holds just a filename (e.g. "turner.jpg")
     — the actual images live in the team-hshots/ folder next to this
     page, and this builds the path from the two. No photo set, or the
     file doesn't load, → the generated placeholder avatar stands in
     (rendered as a hidden sibling, swapped in via onerror). */
  function avatarHTML(m){
    if(!m.photo) return avatarSVG(m.name);
    return (
      '<img src="team-hshots/' + esc(m.photo) + '" alt="" style="width:100%;height:100%;object-fit:cover;" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';">' +
      '<span style="display:none;width:100%;height:100%;">' + avatarSVG(m.name) + '</span>'
    );
  }

  /* link icons show the real favicon of the site being linked (fetched
     client-side, same pattern the site already uses for YouTube
     thumbnails/oEmbed) so a personal site or lab page gets its own
     mark instead of a generic one; if a favicon fails to load, the
     matching outline icon underneath takes over. Email has no
     meaningful favicon, so it keeps a plain envelope icon. */
  function faviconLink(url, label, fallbackIcon){
    var host = '';
    try { host = new URL(url).hostname; } catch(e){ /* leave host empty — fallback icon only */ }
    var favicon = host ? 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(host) : '';
    /* some ad blockers / privacy extensions don't error the request —
       they quietly swap in a 1x1 transparent pixel with a normal 200
       response, so onerror never fires and the icon just looks blank.
       Checking naturalWidth on load catches that case too. */
    var swapToFallback = "this.style.display='none';this.nextElementSibling.style.display='flex';";
    return (
      '<a href="' + esc(url) + '" class="team-icon" target="_blank" rel="noopener" aria-label="' + esc(label) + '">' +
        (favicon
          ? '<img src="' + esc(favicon) + '" alt="" width="14" height="14" ' +
              'onerror="' + swapToFallback + '" ' +
              'onload="if(this.naturalWidth<=2){' + swapToFallback + '}">' +
            '<span class="team-icon-fallback">' + fallbackIcon + '</span>'
          : fallbackIcon) +
      '</a>'
    );
  }

  function linkRow(rawLinks){
    var links = normalizeLinks(rawLinks);
    var out = [];
    if(links.website) out.push(faviconLink(links.website, 'Website', ICONS.website));
    if(links.github) out.push(faviconLink(links.github, 'GitHub', ICONS.github));
    if(links.linkedin) out.push(faviconLink(links.linkedin, 'LinkedIn', ICONS.linkedin));
    if(links.email) out.push('<a href="mailto:' + esc(links.email) + '" class="team-icon" aria-label="Email">' + ICONS.email + '</a>');
    return out.length ? '<div class="team-links">' + out.join('') + '</div>' : '';
  }

  function staffCard(m){
    return (
      '<div class="card team-card">' +
        '<div class="team-top">' +
          '<div class="team-avatar">' + avatarHTML(m) + '</div>' +
          '<div>' +
            '<div class="team-name">' + esc(m.name) + '</div>' +
            (m.role ? '<div class="team-role">' + esc(m.role) + '</div>' : '') +
            (m.area ? '<div class="team-area">' + esc(m.area) + '</div>' : '') +
          '</div>' +
        '</div>' +
        (m.description ? '<p class="team-desc">' + esc(m.description) + '</p>' : '') +
        linkRow(m.links) +
      '</div>'
    );
  }

  function chip(m){
    return '<div class="undergrad-chip">' + esc(m.name) + (m.area ? ' <span class="chip-area">' + esc(m.area) + '</span>' : '') + '</div>';
  }

  function emptyNote(text){ return '<p class="empty-note">' + esc(text) + '</p>'; }

  /* pastMembers entries are name-only at minimum (a bare string still
     works) but can carry role/area (their role while in the group) and
     current (where they are now) — no photo, no links, no category:
     this list stays a plain name list, just with optional context. */
  function pastMemberHTML(p){
    if(typeof p === 'string') return '<span class="past-name">' + esc(p) + '</span>';
    var bits = [];
    if(p.role) bits.push(p.role);
    if(p.area) bits.push(p.area);
    var context = bits.length ? ' <span class="past-context">(' + esc(bits.join(', ')) + ')</span>' : '';
    var current = p.current ? ' <span class="past-current">&middot; Currently: ' + esc(p.current) + '</span>' : '';
    return '<span class="past-name">' + esc(p.name || '') + context + current + '</span>';
  }

  function renderGroup(el, items, cardFn, emptyText){
    if(!el) return;
    el.innerHTML = items.length ? items.map(cardFn).join('') : emptyNote(emptyText);
  }

  function renderFromData(data){
    var members = Array.isArray(data.members) ? data.members : [];
    renderGroup(staffEl, members.filter(function(m){ return m.category === 'staff'; }), staffCard, 'Roster confirmation pending — check back soon.');
    renderGroup(gradEl, members.filter(function(m){ return m.category === 'grad'; }), staffCard, 'Roster confirmation pending — check back soon.');
    renderGroup(undergradEl, members.filter(function(m){ return m.category === 'undergrad'; }), chip, 'Roster confirmation pending — check back soon.');
    var unclassified = members.filter(function(m){ return !m.category; });
    renderGroup(unclassifiedEl, unclassified, chip, '');
    if(unclassifiedSection) unclassifiedSection.style.display = unclassified.length ? '' : 'none';
    if(pastEl){
      var past = Array.isArray(data.pastMembers) ? data.pastMembers : [];
      pastEl.innerHTML = past.length
        ? past.map(pastMemberHTML).join('')
        : emptyNote('List coming soon.');
    }
  }

  fetch('team.json', { cache: 'no-store' })
    .then(function(r){ if(!r.ok) throw new Error('no team.json'); return r.json(); })
    .then(function(data){ if(data) renderFromData(data); })
    .catch(function(){ /* offline, opened via file://, or file missing — baked fallback stands */ });
})();