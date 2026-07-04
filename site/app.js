const UPSTREAM = "https://github.com/github/dmca/blob/master/";
const RAW = "https://raw.githubusercontent.com/github/dmca/master/";
const PAGE = 200;

const $ = (s) => document.querySelector(s);
const KINDS = ["counternotice", "retraction", "reversal"];
const KIND_LABEL = {
  notice: "notice",
  counternotice: "counter notice",
  retraction: "retraction",
  reversal: "reversal",
};

const state = {
  items: [],
  query: "",
  year: "",
  kinds: new Set(["notice", ...KINDS]),
  limit: PAGE,
  previews: new Map(),
};

function parse(path) {
  const base = path.slice(path.lastIndexOf("/") + 1).replace(/\.(md|markdown)$/, "");
  const m = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  let name = m ? m[2] : base;
  let kind = "notice";
  for (const k of KINDS) {
    const re = new RegExp(`-${k}(?:-\\d+)?$`);
    if (re.test(name)) {
      kind = k;
      name = name.replace(re, "");
      break;
    }
  }
  return {
    path,
    date: m ? m[1] : path.slice(0, 4),
    year: path.slice(0, 4),
    name: name.replace(/-/g, " "),
    kind,
    key: `${base.toLowerCase().replace(/-/g, " ")} ${kind}`,
  };
}

const tokens = (q) => q.toLowerCase().split(/[\s-]+/).filter(Boolean);

function matches() {
  const toks = tokens(state.query);
  return state.items.filter(
    (it) =>
      (!state.year || it.year === state.year) &&
      state.kinds.has(it.kind) &&
      toks.every((t) => it.key.includes(t)),
  );
}

/* ---- markdown → DOM (built node-by-node, so untrusted text can't inject HTML) ---- */

const SAFE_URL = /^(https?:|mailto:)/i;
// Source only — inline() compiles a fresh regex per call so recursion
// (bold/italic/link contents) can't clobber a shared lastIndex.
const INLINE_SRC = "(`[^`]+`)|(\\*\\*[\\s\\S]+?\\*\\*)|(\\*[^*\\n]+?\\*)|(!?\\[[^\\]]*\\]\\([^)\\s]+\\))|(\\bhttps?:\\/\\/[^\\s<>()]+)|(\\[(?:private|redacted)\\])";

function redaction(token) {
  const s = document.createElement("span");
  s.className = "redact";
  s.textContent = token;
  s.title = "redacted in the public record";
  return s;
}

function link(url, label) {
  if (!SAFE_URL.test(url)) return document.createTextNode(label);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener nofollow";
  if (typeof label === "string") a.textContent = label;
  else inline(label, a);
  return a;
}

function inline(text, parent) {
  const re = new RegExp(INLINE_SRC, "gi");
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parent.append(text.slice(last, m.index));
    if (m[1]) {
      const c = document.createElement("code");
      c.textContent = m[1].slice(1, -1);
      parent.append(c);
    } else if (m[2]) {
      const b = document.createElement("strong");
      inline(m[2].slice(2, -2), b);
      parent.append(b);
    } else if (m[3]) {
      const i = document.createElement("em");
      inline(m[3].slice(1, -1), i);
      parent.append(i);
    } else if (m[4]) {
      const mm = m[4].match(/^!?\[([^\]]*)\]\(([^)\s]+)\)$/);
      parent.append(link(mm[2], mm[1] || mm[2]));
    } else if (m[5]) {
      const trail = (m[5].match(/[.,;:!?]+$/) || [""])[0];
      const url = m[5].slice(0, m[5].length - trail.length);
      parent.append(link(url, url));
      if (trail) parent.append(trail);
    } else if (m[6]) {
      parent.append(redaction(m[6]));
    }
    last = re.lastIndex;
  }
  if (last < text.length) parent.append(text.slice(last));
}

function renderDoc(src) {
  const root = document.createDocumentFragment();
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para = [];
  let i = 0;

  const flush = () => {
    if (!para.length) return;
    const p = document.createElement("p");
    para.forEach((ln, k) => {
      if (k) p.append(document.createElement("br"));
      inline(ln, p);
    });
    root.append(p);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    let m;

    if (/^```/.test(line)) {
      flush();
      const buf = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) buf.push(lines[i]);
      i++;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = buf.join("\n");
      pre.append(code);
      root.append(pre);
    } else if (/^\s*$/.test(line)) {
      flush();
      i++;
    } else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flush();
      const h = document.createElement(`h${m[1].length}`);
      inline(m[2].trim(), h);
      root.append(h);
      i++;
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      root.append(document.createElement("hr"));
      i++;
    } else if (/^\s*>\s?/.test(line)) {
      flush();
      const bq = document.createElement("blockquote");
      let first = true;
      for (; i < lines.length && /^\s*>\s?/.test(lines[i]); i++) {
        if (!first) bq.append(document.createElement("br"));
        inline(lines[i].replace(/^\s*>\s?/, ""), bq);
        first = false;
      }
      root.append(bq);
    } else if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const list = document.createElement(ordered ? "ol" : "ul");
      for (; i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]); i++) {
        const li = document.createElement("li");
        inline(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""), li);
        list.append(li);
      }
      root.append(list);
    } else {
      para.push(line);
      i++;
    }
  }
  flush();
  return root;
}

function rowEl(it) {
  const li = document.createElement("li");
  li.className = "row";

  const head = document.createElement("button");
  head.type = "button";
  head.className = "row-head";
  head.setAttribute("aria-expanded", "false");
  for (const [cls, text] of [
    ["date", it.date],
    ["name", it.name],
    [it.kind === "notice" ? "kind" : "kind flag", KIND_LABEL[it.kind]],
  ]) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    head.append(span);
  }
  head.addEventListener("click", () => togglePreview(li, head, it));
  li.append(head);
  return li;
}

async function togglePreview(li, head, it) {
  const open = li.querySelector(".preview");
  if (open) {
    open.remove();
    head.setAttribute("aria-expanded", "false");
    return;
  }
  const panel = document.createElement("div");
  panel.className = "preview";

  const pageHead = document.createElement("div");
  pageHead.className = "page-head";
  const ornament = document.createElement("span");
  ornament.className = "ornament";
  ornament.textContent = "❦";
  const title = document.createElement("span");
  title.className = "page-title";
  title.textContent = it.name;
  pageHead.append(ornament, title);

  const doc = document.createElement("div");
  doc.className = "doc loading";
  doc.textContent = "retrieving from the record…";

  const filed = document.createElement("div");
  filed.className = "filed";
  const link = document.createElement("a");
  link.href = UPSTREAM + it.path;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "view original ↗";
  filed.append(`filed ${it.date}`, sep(), KIND_LABEL[it.kind], sep(), link);

  panel.append(pageHead, doc, filed);
  li.append(panel);
  head.setAttribute("aria-expanded", "true");

  if (!state.previews.has(it.path)) {
    try {
      const res = await fetch(RAW + it.path);
      state.previews.set(it.path, res.ok ? await res.text() : `Unavailable (HTTP ${res.status}).`);
    } catch {
      state.previews.set(it.path, "Could not reach the record — are you offline?");
    }
  }
  doc.classList.remove("loading");
  doc.replaceChildren(renderDoc(state.previews.get(it.path).trim()));
}

function sep() {
  const s = document.createElement("span");
  s.className = "sep";
  s.textContent = "·";
  return s;
}

let firstRender = true;

function render() {
  const found = matches();
  const list = $("#results");
  list.classList.toggle("fresh", firstRender);
  list.replaceChildren();

  const shown = found.slice(0, state.limit);
  shown.forEach((it, i) => {
    const el = rowEl(it);
    if (firstRender && i < 25) el.style.animationDelay = `${i * 16}ms`;
    list.append(el);
  });
  firstRender = false;

  const total = state.items.length.toLocaleString();
  $("#count").textContent = found.length
    ? `${found.length.toLocaleString()} of ${total} records` +
      (found.length > shown.length ? ` — disclosing first ${shown.length}` : "")
    : "";
  $("#more").hidden = found.length <= state.limit;

  if (!found.length && state.items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No matching records on file.";
    list.append(li);
  }
}

/* ------- custom listbox (replaces native <select>) ------- */

function mountSelect({ btn, value, list }, options, onChange) {
  let active = -1;

  list.replaceChildren();
  options.forEach((opt, i) => {
    const li = document.createElement("li");
    li.id = `opt-${i}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(i === 0));
    const label = document.createElement("span");
    label.textContent = opt.label;
    li.append(label);
    if (opt.tally != null) {
      const t = document.createElement("span");
      t.className = "tally";
      t.textContent = opt.tally.toLocaleString();
      li.append(t);
    }
    li.addEventListener("click", () => choose(i));
    li.addEventListener("mousemove", () => setActive(i));
    list.append(li);
  });

  const items = () => [...list.children];
  const open = () => btn.getAttribute("aria-expanded") === "true";

  function setActive(i) {
    items().forEach((el, j) => el.classList.toggle("active", i === j));
    active = i;
    if (i >= 0) {
      list.setAttribute("aria-activedescendant", `opt-${i}`);
      items()[i].scrollIntoView({ block: "nearest" });
    }
  }

  function setOpen(v) {
    btn.setAttribute("aria-expanded", String(v));
    list.hidden = !v;
    if (v) {
      const sel = items().findIndex((el) => el.getAttribute("aria-selected") === "true");
      setActive(sel < 0 ? 0 : sel);
      list.focus();
    } else {
      btn.focus();
    }
  }

  function choose(i) {
    items().forEach((el, j) => el.setAttribute("aria-selected", String(i === j)));
    value.textContent = options[i].label;
    setOpen(false);
    onChange(options[i].value);
  }

  btn.addEventListener("click", () => setOpen(!open()));

  btn.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  });

  list.addEventListener("keydown", (e) => {
    const n = items().length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (active >= 0) choose(active); }
    else if (e.key === "Escape" || e.key === "Tab") { setOpen(false); }
  });

  document.addEventListener("pointerdown", (e) => {
    if (open() && !btn.parentElement.contains(e.target)) setOpen(false);
  });
}

/* ------- custom overlay scrollbar (replaces native window scrollbar) ------- */

function mountScrollbar() {
  const track = document.createElement("div");
  track.className = "scroll-track";
  const thumb = document.createElement("div");
  thumb.className = "scroll-thumb";
  track.append(thumb);
  document.body.append(track);

  const max = () => document.documentElement.scrollHeight - window.innerHeight;

  function update() {
    const vh = window.innerHeight;
    const sh = document.documentElement.scrollHeight;
    if (sh <= vh + 1) { track.style.display = "none"; return; }
    track.style.display = "block";
    const h = Math.max(30, (vh / sh) * vh);
    const top = max() > 0 ? (window.scrollY / max()) * (vh - h) : 0;
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }

  let startY = 0, startScroll = 0, dragging = false;
  thumb.addEventListener("pointerdown", (e) => {
    dragging = true;
    startY = e.clientY;
    startScroll = window.scrollY;
    thumb.setPointerCapture(e.pointerId);
    document.body.classList.add("scrolling");
  });
  thumb.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const trackH = window.innerHeight - thumb.offsetHeight;
    const ratio = trackH > 0 ? (e.clientY - startY) / trackH : 0;
    window.scrollTo(0, startScroll + ratio * max());
  });
  const stop = () => { dragging = false; document.body.classList.remove("scrolling"); };
  thumb.addEventListener("pointerup", stop);
  thumb.addEventListener("pointercancel", stop);

  track.addEventListener("pointerdown", (e) => {
    if (e.target === thumb) return;
    const y = e.clientY - thumb.offsetHeight / 2;
    const trackH = window.innerHeight - thumb.offsetHeight;
    window.scrollTo({ top: Math.min(1, Math.max(0, y / trackH)) * max(), behavior: "smooth" });
  });

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  new ResizeObserver(update).observe(document.body);
  update();
}

/* ------- wiring ------- */

function wire() {
  let t;
  $("#q").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.query = e.target.value;
      state.limit = PAGE;
      render();
    }, 60);
  });
  $("#searchbar").addEventListener("submit", (e) => e.preventDefault());

  for (const btn of document.querySelectorAll(".kinds button")) {
    btn.addEventListener("click", () => {
      const k = btn.dataset.kind;
      const on = !state.kinds.has(k);
      state.kinds[on ? "add" : "delete"](k);
      btn.setAttribute("aria-pressed", String(on));
      state.limit = PAGE;
      render();
    });
  }

  // chip groups that flip an <html data-*> attribute and persist
  for (const [sel, attr, key] of [
    [".fonts", "doc", "docFont"],
    [".marks", "md", "docMarks"],
    [".views", "view", "docView"],
  ]) {
    const btns = [...document.querySelectorAll(`${sel} button`)];
    const set = (v) => {
      document.documentElement.dataset[attr] = v;
      for (const b of btns) b.setAttribute("aria-pressed", String(b.dataset.val === v));
      try { localStorage.setItem(key, v); } catch {}
    };
    for (const b of btns) b.addEventListener("click", () => set(b.dataset.val));
    let saved;
    try { saved = localStorage.getItem(key); } catch {}
    if (saved && btns.some((b) => b.dataset.val === saved)) set(saved);
  }

  $("#more").addEventListener("click", () => {
    state.limit += PAGE;
    render();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== $("#q")) {
      e.preventDefault();
      $("#q").focus();
    }
  });
}

async function main() {
  wire();
  mountScrollbar();

  const res = await fetch("data/index.json");
  if (!res.ok) {
    $("#stats").textContent = "the register is unavailable — try again later";
    return;
  }
  const index = await res.json();
  state.items = index.paths.map(parse).reverse(); // newest first

  const byYear = new Map();
  for (const it of state.items) byYear.set(it.year, (byYear.get(it.year) || 0) + 1);
  const years = [...byYear.keys()].sort().reverse();

  mountSelect(
    { btn: $("#yearBtn"), value: $("#yearValue"), list: $("#yearList") },
    [
      { label: "All years", value: "", tally: state.items.length },
      ...years.map((y) => ({ label: y, value: y, tally: byYear.get(y) })),
    ],
    (year) => {
      state.year = year;
      state.limit = PAGE;
      render();
    },
  );

  const total = state.items.length.toLocaleString();
  const built = index.generated.slice(0, 10);
  $("#stats").textContent = `${total} notices on record · register updated ${built}`;
  $("#q").placeholder = `search ${total} notices…`;

  const foot = $("#foot");
  const upstream = document.createElement("a");
  upstream.href = `https://github.com/github/dmca/tree/${encodeURIComponent(index.commit)}`;
  upstream.textContent = `github/dmca@${index.commit.slice(0, 7)}`;
  const source = document.createElement("a");
  source.href = "https://github.com/Riyoway/dmca-search";
  source.textContent = "source";
  foot.replaceChildren(`register updated ${built} from `, upstream, " · ", source, " · MIT");

  render();
}

main();

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
