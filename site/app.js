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

function tokens(query) {
  return query.toLowerCase().split(/[\s-]+/).filter(Boolean);
}

function matches() {
  const toks = tokens(state.query);
  return state.items.filter(
    (it) =>
      (!state.year || it.year === state.year) &&
      state.kinds.has(it.kind) &&
      toks.every((t) => it.key.includes(t)),
  );
}

function rowEl(it) {
  const li = document.createElement("li");
  li.className = "row";

  const head = document.createElement("button");
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
  panel.innerHTML = `<pre>fetching&hellip;</pre><a target="_blank" rel="noopener">view on GitHub &nearr;</a>`;
  panel.querySelector("a").href = UPSTREAM + it.path;
  li.append(panel);
  head.setAttribute("aria-expanded", "true");

  if (!state.previews.has(it.path)) {
    try {
      const res = await fetch(RAW + it.path);
      state.previews.set(it.path, res.ok ? await res.text() : `fetch failed (${res.status})`);
    } catch {
      state.previews.set(it.path, "fetch failed — are you offline?");
    }
  }
  panel.querySelector("pre").textContent = state.previews.get(it.path);
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
    if (firstRender && i < 25) el.style.animationDelay = `${i * 18}ms`;
    list.append(el);
  });
  firstRender = false;

  $("#count").textContent = found.length
    ? `${found.length.toLocaleString()} of ${state.items.length.toLocaleString()} notices` +
      (found.length > shown.length ? ` — showing first ${shown.length}` : "")
    : "";
  $("#more").hidden = found.length <= state.limit;

  if (!found.length && state.items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing in the record.";
    list.append(li);
  }
}

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

  $("#year").addEventListener("change", (e) => {
    state.year = e.target.value;
    state.limit = PAGE;
    render();
  });

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
  const res = await fetch("data/index.json");
  if (!res.ok) {
    $("#stats").textContent = "index unavailable — try again later";
    return;
  }
  const index = await res.json();

  state.items = index.paths.map(parse).reverse(); // newest first

  const years = [...new Set(state.items.map((it) => it.year))].sort().reverse();
  $("#year").append(...years.map((y) => new Option(y, y)));

  const built = index.generated.slice(0, 10);
  const total = state.items.length.toLocaleString();
  $("#stats").textContent = `${total} notices · index built ${built}`;
  $("#q").placeholder = `search ${total} notices…`;

  const foot = $("#foot");
  const upstream = document.createElement("a");
  upstream.href = `https://github.com/github/dmca/tree/${encodeURIComponent(index.commit)}`;
  upstream.textContent = `github/dmca@${index.commit.slice(0, 7)}`;
  const source = document.createElement("a");
  source.href = "https://github.com/Riyoway/dmca-search";
  source.textContent = "source";
  foot.replaceChildren(`index built ${built} from `, upstream, " · ", source, " · MIT");

  render();
}

main();
