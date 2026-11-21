/* MAD700 Practice Lab: Java/XML // TODO lab. Built on the ML600 lab layout (Celeste) / Liora's v3 ideas.
   No code runs in the browser: each TODO is checked by key-element regex (normCode) and then self-marked. */
(function () {
"use strict";
const D = window.MAD, KEY = "mad700lab", $ = (s, r) => (r || document).querySelector(s), main = $("#main");
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const secById = Object.fromEntries(D.secs.map(s => [s.id, s]));
const exById = Object.fromEntries(D.ex.map(e => [e.id, e]));
const qById = Object.fromEntries(D.quiz.map(q => [q.id, q]));
const LV = ["easy", "medium", "hard"];
const fById = Object.fromEntries((D.flow || []).map(e => [e.id, e]));
const ROUTES = {};

/* ---------- storage: localStorage + IndexedDB mirror, file-based sync ---------- */
let S = { v: 1, xp: 0, streak: 0, ex: {}, quiz: {}, cards: {}, fill: {}, reels: {}, mock: null, t: 0 };
try { const j = JSON.parse(localStorage.getItem(KEY + ".state") || "null"); if (j) S = Object.assign(S, j); } catch (e) {}
let idb = null;
try {
  const rq = indexedDB.open(KEY, 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
  rq.onsuccess = () => {
    idb = rq.result;
    const g = idb.transaction("kv").objectStore("kv").get("state");
    g.onsuccess = () => { if (g.result && (g.result.t || 0) > (S.t || 0)) { S = merge(S, g.result); localStorage.setItem(KEY + ".state", JSON.stringify(S)); render(); } };
  };
} catch (e) {}
function save() {
  S.t = Date.now();
  try { localStorage.setItem(KEY + ".state", JSON.stringify(S)); } catch (e) {}
  try { if (idb) idb.transaction("kv", "readwrite").objectStore("kv").put(JSON.parse(JSON.stringify(S)), "state"); } catch (e) {}
  chips();
}
function merge(a, b) {  // newer record wins, per item
  const out = JSON.parse(JSON.stringify(a));
  for (const k of ["ex", "quiz", "cards", "fill"]) {
    out[k] = out[k] || {};
    for (const [id, r] of Object.entries(b[k] || {})) if (!out[k][id] || (r.t || 0) > (out[k][id].t || 0)) out[k][id] = r;
  }
  out.reels = Object.assign({}, a.reels || {}); for (const [d, n] of Object.entries(b.reels || {})) out.reels[d] = Math.max(out.reels[d] || 0, n);
  out.xp = Math.max(a.xp || 0, b.xp || 0); out.streak = Math.max(a.streak || 0, b.streak || 0);
  if (b.mock && (!a.mock || (b.mock.t || 0) > (a.mock.t || 0))) out.mock = b.mock;
  out.t = Math.max(a.t || 0, b.t || 0); return out;
}
function download(name, text, type) {
  const blob = new Blob([text], { type: type || "text/plain" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
function addXP(n) { S.xp = (S.xp || 0) + n; save(); }

/* ---------- key-element checks (must match src/checks.py norm) ---------- */
function normCode(code, lang, raw) {
  code = String(code || "");
  if (!raw) {
    if (lang === "xml") code = code.replace(/<!--[\s\S]*?-->/g, " ");
    else if (lang === "bash") code = code.replace(/^\s*#.*$/gm, " ");
    else if (lang === "sql") code = code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
    else code = code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/(?=(?:[^"\n]*"[^"\n]*")*[^"\n]*$).*$/gm, " ");
  }
  return code.replace(/\s+/g, " ").replace(/\s*([(){}\[\];,=<>.+\-*/!?:&|"@])\s*/g, "$1").trim();
}
function countRe(rx, t) { try { return (t.match(new RegExp(rx, "gi")) || []).length; } catch (e) { return 0; } }
function runChecks(ex, codes) {
  const res = {};
  for (const c of ex.checks) {
    const f = ex.files[c.file], t = normCode(codes[c.file], f.lang, c.raw), k = countRe(c.re, t);
    const ok = ("min" in c) ? k >= c.min : k <= c.max;
    (res[c.todo] = res[c.todo] || []).push({ ok, label: c.label, need: c.min, have: k, max: c.max });
  }
  return res;
}
window.MAD_normCode = normCode; window.MAD_runChecks = runChecks;

/* ---------- shell: nav, chips, theme ---------- */
const THEMES = [["light", "Light"], ["dark", "Dark"], ["dracula", "Dracula"], ["futuristic", "Futuristic"], ["solarized", "Solarized"], ["contrast", "High Contrast"]];
function setTheme(t) {
  const d = document.documentElement;
  if (t === "light") d.removeAttribute("data-theme"); else d.setAttribute("data-theme", t);
  try { localStorage.setItem(KEY + ".theme", t); } catch (e) {}
}
function chips() {
  $("#xpChip").textContent = "⭐ " + (S.xp || 0); $("#streakChip").textContent = "🔥 " + (S.streak || 0);
  const m = S.mock, mc = $("#mockChip");
  if (m && m.start && !m.done) { mc.style.display = ""; mc.textContent = "⏱ " + fmtLeft(m); } else mc.style.display = "none";
}
function fmtLeft(m) {
  const left = Math.max(0, m.start + D.mock.mins * 60000 - Date.now()), h = Math.floor(left / 3600000), mi = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
  return `${h}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
setInterval(() => { chips(); const t = $("#mockTimer"); if (t && S.mock && !S.mock.done) t.textContent = fmtLeft(S.mock); }, 1000);
function exDone(id) { const r = S.ex[id]; return r && r.done; }
function secStats(sid) {
  const ex = D.ex.filter(e => e.sec === sid), q = D.quiz.filter(x => x.sec === sid);
  return { ex: ex.length, exDone: ex.filter(e => exDone(e.id)).length, q: q.length, qDone: q.filter(x => S.quiz[x.id]).length };
}
function nav() {
  const h = location.hash || "#/";
  const link = (href, label, tick) => `<a href="${href}" class="${h === href || (href !== "#/" && h.startsWith(href + "/")) ? "active" : ""}">${label}${tick ? `<span class="tick">${tick}</span>` : ""}</a>`;
  let s = "<h6>Start</h6>" + link("#/", "🏠 Home + pointer map") + link("#/plan", "🗓 Game plan");
  s += "<h6>Flow through the lecturer's questions</h6>" + link("#/flow", "🌊 Flow mode", flowTick()) + link("#/map", "🗺 Pointer map") + link("#/cheat", "🧾 Cheatsheet (print)");
  s += "<h6>Exam pointers</h6>";
  for (const x of D.secs) { const st = secStats(x.id); s += link("#/s/" + x.id, esc(x.short), `${st.exDone}/${st.ex}`); }
  s += "<h6>Practise</h6>" + link("#/quiz/ALL", "🧠 Mixed quiz") + link("#/cards/ALL", "🃏 Keycards") + link("#/fill", "✏️ Fill-ins (practice only)") + link("#/videos", "🎬 My lesson videos") + link("#/reels", "📱 Reels feed") + link("#/mock", "⏱ Timed mock (3 h)");
  s += "<h6>You</h6>" + link("#/settings", "⚙️ Themes, sync, export");
  $("#nav").innerHTML = s;
}
$("#menuBtn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
$("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
window.addEventListener("hashchange", () => { document.body.classList.remove("nav-open"); render(); window.scrollTo(0, 0); });

/* ---------- views ---------- */
function home() {
  let cards = "";
  for (const x of D.secs) {
    const st = secStats(x.id), pc = st.ex ? Math.round(100 * st.exDone / st.ex) : 0;
    const lv = LV.map(l => { const n = D.ex.filter(e => e.sec === x.id && e.level === l); return `<span class="lvl ${l}">${l} ${n.filter(e => exDone(e.id)).length}/${n.length}</span>`; }).join("");
    cards += `<div class="card"><h3 style="margin:4px 0"><a href="#/s/${x.id}">${esc(x.title)}</a></h3><p class="muted" style="margin:4px 0">${esc(x.pointer)}</p>
      <div class="prog"><i style="width:${pc}%"></i></div><div>${lv}</div><p class="src">Quiz ${st.qDone}/${st.q} · Cards ${D.cards.filter(c => c.sec === x.id).length}</p>
      <div class="row"><a class="btn sm" href="#/s/${x.id}">Lesson</a><a class="btn sm" href="#/s/${x.id}/code">// TODO code</a><a class="btn sm" href="#/quiz/${x.id}">Quiz</a></div></div>`;
  }
  return `<h2>MAD700 Practice Lab</h2>
  <div class="note"><b>Exam:</b> Tue 24 Nov 2026, 09:00-12:00 (SAST), Lab 1. Paper style = the CA test: <b>// TODO</b> incomplete Java and XML, no fill-in-the-blanks. Strictly Mr Siyah's pointers P1-P5 (9 Nov) + light review.</div>
  <div class="note">How checking works: Android code can't run in a browser, so <b>Check</b> looks for the exact names and attributes the memo gives marks for, then you <b>self-mark</b> each TODO against the commented model answer. Run the code in Android Studio when you can.</div>
  <div class="row"><a class="btn" href="#/flow">🌊 Start Flow mode (the lecturer's questions, in order)</a><a class="btn sec" href="#/map">🗺 Pointer map</a><a class="btn sec" href="#/cheat">🧾 Cheatsheet</a><a class="btn sec" href="#/fill">✏️ Fill-ins</a><a class="btn sec" href="#/reels">📱 Reels</a></div>
  <h3>Pointers</h3><div class="grid2">${cards}</div>
  <div class="card"><h3>Exam-morning keyword card</h3>${D.home.keywords}</div>
  <details class="card"><summary><b>Exam facts and how answers earn marks</b></summary>${D.home.facts}</details>
  <details class="card"><summary><b>Source clashes (know both, follow the paper)</b></summary>${D.home.clashes}</details>
  <p class="src">Built ${esc(D.built)}. Sources: MAD700 lean pack (cheat sheet, 30 to-do questions + answers, keycards v2), question bank, study guide, Siyah's files. Model answers stay hidden until you attempt.</p>`;
}
function plan() {
  return `<h2>Game plan to Tue 24 Nov</h2><div class="card"><ol>
  <li><b>Sat 21 (tonight):</b> P4 RecyclerView: lesson → easy → medium (in Android Studio too). One P2 XML TODO.</li>
  <li><b>Sun 22 morning:</b> P3: <a href="#/s/P3">Fragments from zero</a>, then the DialogFragment TODOs (easy → hard). Manifest + versions.</li>
  <li><b>Sun 22 afternoon:</b> the official mock (unseen until then) under time, not this lab's mock.</li>
  <li><b>Mon 23 morning:</b> P5 SQLite TODOs, then P1 + P2 hard sets.</li>
  <li><b>Mon 23 afternoon:</b> this lab's <a href="#/mock">timed mock</a> (3 h) → Export → send it to Rigel to mark. Fix weak spots.</li>
  <li><b>Tue 24 morning:</b> keyword card on the Home page only.</li></ol>
  <p class="muted">Each TODO session: try → Check → Hint → model answer → self-mark → Export the commented file and run it in Android Studio.</p></div>`;
}
function secPage(sid, tab) {
  const x = secById[sid]; if (!x) return "<p>Unknown section.</p>";
  tab = tab || "lesson";
  const t = (k, l) => `<a href="#/s/${sid}/${k}" class="${tab === k ? "on" : ""}">${l}</a>`;
  let body = "";
  if (tab === "lesson") body = (D.lessons[sid] || []).map(l => `<details class="card" ${l.id === "ffz" || (D.lessons[sid].length === 1) ? "open" : ""}><summary><b>${esc(l.title)}</b></summary><p class="src"><b>Source:</b> ${esc(l.source)}</p>${l.html}</details>`).join("");
  if (tab === "code") body = LV.map(l => {
    const list = D.ex.filter(e => e.sec === sid && e.level === l);
    return `<h3><span class="lvl ${l}">${l}</span> ${list.length} TODO set${list.length === 1 ? "" : "s"}</h3>` + list.map(e => {
      const r = S.ex[e.id] || {};
      return `<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/ex/${e.id}"><b>${r.done ? "✅ " : r.checks ? "🟡 " : ""}${esc(e.title)}</b>${e.marks ? ` · ${e.marks} marks` : ""}<div class="src">${esc(e.files.filter(f => !f.given).map(f => f.name).join(", "))} · ${esc((e.source || "").slice(0, 140))}${(e.source || "").length > 140 ? "…" : ""}</div></a>`;
    }).join("");
  }).join("");
  if (tab === "quiz") body = `<p><a class="btn" href="#/quiz/${sid}">Start the ${esc(x.short)} quiz (${D.quiz.filter(q => q.sec === sid).length} questions)</a></p>`;
  if (tab === "cards") body = `<p><a class="btn" href="#/cards/${sid}">Flip the ${D.cards.filter(c => c.sec === sid).length} keycards</a></p>`;
  if (tab === "videos") { body = lessonVideosHTML(sid) + "<h3>Reels for this pointer</h3>" + reelsHTML(sid); }
  if (tab === "map") body = pointerSection(sid);
  return `<h2>${esc(x.title)}</h2><p class="muted">${esc(x.pointer)}</p><div class="tabs">${t("lesson", "📖 Lesson")}${t("code", "💻 // TODO code")}${t("quiz", "🧠 Quiz")}${t("cards", "🃏 Cards")}${t("map", "🗺 Map")}${t("videos", "🎬 Videos")}</div>${body}`;
}

/* ---------- exercise ---------- */
let cur = null;
function exPage(id, flow) {
  const e = (flow ? fById : exById)[id]; if (!e) return "<p>Unknown exercise.</p>";
  const r = S.ex[id] = S.ex[id] || { codes: e.files.map(f => f.skeleton), checks: 0, hints: 0, revealed: false, peeked: false, self: {}, opened: 0 };
  if (!r.codes || r.codes.length !== e.files.length) r.codes = e.files.map(f => f.skeleton);
  r.opened = (r.opened || 0) + 1; r.t = Date.now(); save();
  cur = { e, r, file: e.files.findIndex(f => !f.given), flow: !!flow };
  const todos = [...new Set(e.checks.map(c => c.todo))].sort((a, b) => a - b);
  const tasks = e.tasks && e.tasks.length ? `<ul>${e.tasks.map(([n, m, d]) => `<li><b>TODO ${n}</b> [${m}]: ${esc(d)}</li>`).join("")}</ul>` : "";
  const same = flow ? D.flow : D.ex.filter(x => x.sec === e.sec), i = same.indexOf(e);
  return `<p>${flow ? `<a href="#/flow">← Flow mode</a> · step ${i + 1} of ${same.length} · ${esc(secById[e.sec].short)}` : `<a href="#/s/${e.sec}/code">← ${esc(secById[e.sec].short)} TODO sets</a>`}</p>
  <h2><span class="lvl ${flow ? "flow" : e.level}">${flow ? esc(e.group) : e.level}</span>${esc(e.title)}${e.marks ? ` <small class="muted">(${e.marks} marks)</small>` : ""}</h2>
  <p class="src"><b>Source:</b> ${esc(e.source)}<br><b>From:</b> ${esc(e.origin)}</p>
  <div class="card">${e.task}${tasks}</div>
  <div class="ftabs">${e.files.map((f, k) => `<button class="sec ${k === cur.file ? "on" : ""}" data-f="${k}">${esc(f.name)}${f.given ? " (given)" : ""}</button>`).join("")}</div>
  <textarea id="code" class="code" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
  <div class="row"><button id="bCheck">✔ Check my code</button><button id="bHint" class="sec">💡 Hint</button><button id="bShow" class="warn">👀 Model answer</button>
  <button id="bExport" class="sec">⬇ Export .${e.files[cur.file].lang === "xml" ? "xml" : e.files[cur.file].lang === "java" ? "java" : "txt"}</button><button id="bReset" class="sec">↺ Reset</button></div>
  <div id="hints"></div><div id="res"></div><div id="model"></div><div id="selfmark"></div>${flow ? `<div id="interp"></div>` : ""}
  <div class="row">${i > 0 ? `<a class="btn sec" href="#/${flow ? "f" : "ex"}/${same[i - 1].id}">← Previous</a>` : ""}${i < same.length - 1 ? `<a class="btn sec" href="#/${flow ? "f" : "ex"}/${same[i + 1].id}">Next →</a>` : ""}</div>`;
}
function exWire() {
  const { e, r } = cur, ta = $("#code");
  const load = () => { const f = e.files[cur.file]; ta.value = r.codes[cur.file]; ta.readOnly = !!f.given; fit(ta); };
  load();
  ta.addEventListener("input", () => { r.codes[cur.file] = ta.value; r.t = Date.now(); fit(ta); saveSoon(); });
  ta.addEventListener("keydown", ev => { if (ev.key === "Tab" && !ta.readOnly) { ev.preventDefault(); const s = ta.selectionStart; ta.setRangeText("    ", s, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); } });
  document.querySelectorAll(".ftabs button").forEach(b => b.onclick = () => { cur.file = +b.dataset.f; document.querySelectorAll(".ftabs button").forEach(x => x.classList.toggle("on", x === b)); load(); });
  $("#bCheck").onclick = () => {
    const res = runChecks(e, r.codes); r.checks = (r.checks || 0) + 1; r.t = Date.now();
    const out = feedbackAll(e, r, res); const all = out.all, html = out.html;
    r.lastAll = all; r.lastMarks = out.got + "/" + out.tot; if (all && !r.xpCheck) { r.xpCheck = 1; addXP(10); }
    save(); $("#res").innerHTML = html;
  };
  $("#bHint").onclick = () => {
    r.hints = Math.min((r.hints || 0) + 1, e.hints.length); save();
    $("#hints").innerHTML = e.hints.length ? e.hints.slice(0, r.hints).map((h, k) => `<div class="fb info">💡 Hint ${k + 1}/${e.hints.length}: ${esc(h)}</div>`).join("") : `<div class="fb info">No extra hints: use the TODO comments.</div>`;
  };
  $("#bShow").onclick = () => {
    if (!r.checks && !r.revealed && !confirm("You haven't checked an attempt yet. Show the model answer anyway? (It is logged as a peek.)")) return;
    if (!r.checks) r.peeked = true;
    r.revealed = true; save(); showModel();
  };
  $("#bExport").onclick = () => exportEx(e, r);
  $("#bReset").onclick = () => { if (confirm("Reset this file to the skeleton?")) { r.codes[cur.file] = e.files[cur.file].skeleton; save(); load(); } };
  if (r.revealed) showModel();
  if (cur.flow) interpWire();
}
let saveT = 0; function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 600); }
function fit(ta) { ta.style.height = "auto"; ta.style.height = (ta.scrollHeight + 4) + "px"; }
function annHTML(f) {
  const cm = f.lang === "xml" ? ["<!-- ", " -->"] : f.lang === "bash" ? ["# ", ""] : ["// ", ""];
  return `<div class="codebox"><div class="cbhead"><span>${esc(f.name)} · model answer</span></div><div class="annwrap" style="border:0"><table class="ann">${f.ann.map(([l, n]) => `<tr><td class="c">${esc(l) || " "}</td><td class="n">${n ? esc(cm[0] + n + cm[1]) : ""}</td></tr>`).join("")}</table></div></div>`;
}
function showModel() {
  const { e, r } = cur;
  $("#model").innerHTML = `<h3>Model answer ${r.peeked ? '<small class="muted">(peeked before attempting)</small>' : ""}</h3>` + e.files.filter(f => !f.given).map(annHTML).join("") +
    (e.markscheme ? `<div class="card"><b>Marks</b>${e.markscheme}</div>` : "") + (e.mistakes ? `<div class="note"><b>Common mistakes:</b> ${esc(e.mistakes)}</div>` : "") + `<p class="src"><b>Source:</b> ${esc(e.source)}</p>`;
  const todos = [...new Set(e.checks.map(c => c.todo))].sort((a, b) => a - b), mk = Object.fromEntries((e.tasks || []).map(([n, m]) => [n, m]));
  const tot = todos.reduce((a, n) => a + (mk[n] || 1), 0);
  const paint = () => {
    const got = todos.reduce((a, n) => a + (r.self[n] ? (mk[n] || 1) : 0), 0);
    $("#selfmark").innerHTML = `<div class="card"><h3>Self-mark</h3>${todos.map(n => `<label style="display:block;margin:6px 0"><input type="checkbox" data-n="${n}" ${r.self[n] ? "checked" : ""}> TODO ${n}${mk[n] ? ` [${mk[n]}]` : ""}: my version matches the model (same idea, exact names)</label>`).join("")}
      <p><b>${got} / ${tot}</b> ${got === tot ? "✅ Done. Export it and run it in Android Studio." : ""}</p></div>`;
    document.querySelectorAll("#selfmark input").forEach(cb => cb.onchange = () => {
      r.self[cb.dataset.n] = cb.checked; const all = todos.every(n => r.self[n]);
      if (all && !r.done) { r.done = true; addXP(r.peeked ? 10 : 25); S.streak = (S.streak || 0) + 1; }
      if (!all) r.done = false; r.t = Date.now(); save(); paint(); nav();
    });
  };
  paint();
}
function commentBlock(lang, lines) {
  if (lang === "xml") return "<!--\n" + lines.map(l => "  " + String(l).replace(/--/g, "- -")).join("\n") + "\n-->\n";
  if (lang === "bash") return lines.map(l => "# " + l).join("\n") + "\n";
  return "/*\n" + lines.map(l => " * " + String(l).replace(/\*\//g, "* /")).join("\n") + "\n */\n";
}
function stripHTML(h) { const d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent.trim(); }
function exportEx(e, r) {
  const res = runChecks(e, r.codes), out = [];
  e.files.forEach((f, k) => {
    if (f.given) return;
    const head = [`MAD700 Practice Lab export · ${new Date().toLocaleString()}`, `${e.title} (${e.level}${e.marks ? ", " + e.marks + " marks" : ""}) · ${e.sec}`, `Source: ${e.source}`, "",
      "QUESTION:", ...stripHTML(e.task).split("\n"), ...(e.tasks || []).map(([n, m, d]) => `TODO ${n} [${m}]: ${d}`), "",
      "CHECK RESULTS:", ...Object.keys(res).map(n => `TODO ${n}: ${res[n].every(x => x.ok) ? "all key elements found" : "missing: " + res[n].filter(x => !x.ok).map(x => x.label).join(", ")}`),
      `Self-mark: ${Object.keys(r.self || {}).filter(n => r.self[n]).map(n => "TODO " + n).join(", ") || "not yet"} · checks run: ${r.checks || 0} · hints: ${r.hints || 0} · peeked before attempt: ${r.peeked ? "yes" : "no"}`, "",
      "YOUR ANSWER follows. The commented MODEL ANSWER is at the bottom."];
    const cm = f.lang === "xml" ? null : f.lang === "bash" ? "# " : "// ";
    const model = f.ann.map(([l, n]) => !n ? l : cm ? `${l}${" ".repeat(Math.max(1, 60 - l.length))}${cm}${n}` : null);
    let txt = commentBlock(f.lang, head) + "\n" + r.codes[k].replace(/\s+$/, "") + "\n\n";
    if (f.lang === "xml") txt += commentBlock("xml", ["MODEL ANSWER (line | note):", ...f.ann.map(([l, n]) => l + (n ? "   | " + n : ""))]);
    else txt += commentBlock(f.lang, ["MODEL ANSWER (every line commented):"]) + (f.lang === "java" ? "/* --- model --- */\n" : "") + model.map(l => (f.lang === "java" ? "// " : "") + l).join("\n") + "\n";
    if (e.mistakes) txt += "\n" + commentBlock(f.lang, ["COMMON MISTAKES: " + e.mistakes]);
    out.push([f.name.replace(/\.(\w+)$/, `_${e.id}_${stamp()}.$1`), txt]);
  });
  out.forEach(([n, t], k) => setTimeout(() => download(n, t), k * 400));
}

/* ---------- quiz (SoloLearn style: one at a time, MCQ or short answer + self-mark) ---------- */
let QZ = null;
function quizStart(sid) {
  const pool = D.quiz.filter(q => sid === "ALL" || q.sec === sid);
  const order = pool.slice().sort((a, b) => ((S.quiz[a.id] && S.quiz[a.id].ok) ? 1 : 0) - ((S.quiz[b.id] && S.quiz[b.id].ok) ? 1 : 0) || Math.random() - .5);
  QZ = { sid, list: order.slice(0, sid === "ALL" ? 15 : order.length), i: 0, right: 0, missed: [] };
}
function quizPage(sid) {
  if (!QZ || QZ.sid !== sid) quizStart(sid);
  const z = QZ;
  if (z.i >= z.list.length) {
    return `<h2>Quiz done: ${z.right}/${z.list.length}</h2><div class="card"><h3>CATCH-UP</h3>${z.missed.length ? "<ul>" + z.missed.map(q => `<li>${esc(q.title)} <span class="src">(${esc(q.source)})</span></li>`).join("") + "</ul>" : "<p>Nothing missed. 🔥</p>"}</div>
      <div class="row"><button id="qAgain">Again</button><a class="btn sec" href="${sid === "ALL" ? "#/" : "#/s/" + sid + "/code"}">Go code</a></div>`;
  }
  const q = z.list[z.i];
  const body = q.kind === "mcq" ? q.choices.map((c, k) => `<button class="choice" data-k="${k}">${"ABCDE"[k]}. ${c}</button>`).join("")
    : `<textarea class="tx" id="qa" placeholder="Answer like the paper: definition + how it works + example / code"></textarea><button id="qShow">Show model answer</button>`;
  return `<p class="muted">${esc(sid === "ALL" ? "Mixed" : secById[sid].short)} · question ${z.i + 1} of ${z.list.length}</p><div class="prog"><i style="width:${100 * z.i / z.list.length}%"></i></div>
    <div class="card"><h3>${esc(q.title)}${q.marks > 1 ? ` <small class="muted">(${q.marks} marks)</small>` : ""}</h3>${q.stem}${body}<div id="qfb"></div></div><p class="src"><b>Source:</b> ${esc(q.source)}</p>`;
}
function quizWire(sid) {
  const z = QZ; if ($("#qAgain")) { $("#qAgain").onclick = () => { quizStart(sid); render(); }; return; }
  const q = z.list[z.i], next = `<button id="qNext">Next →</button>`;
  const rec = ok => { S.quiz[q.id] = { ok, t: Date.now() }; if (ok) { z.right++; S.streak = (S.streak || 0) + 1; addXP(5); } else { z.missed.push(q); S.streak = 0; save(); } };
  if (q.kind === "mcq") document.querySelectorAll(".choice").forEach(b => b.onclick = () => {
    const k = +b.dataset.k, ok = k === q.answer;
    document.querySelectorAll(".choice").forEach(x => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add("ok"); });
    if (!ok) b.classList.add("no"); rec(ok);
    $("#qfb").innerHTML = `<div class="fb ${ok ? "ok" : "no"}">${ok ? "Correct" : "Not quite"}</div><div class="card">${q.answer_html}</div>${next}`; wireNext();
  });
  else $("#qShow").onclick = () => {
    $("#qShow").remove();
    $("#qfb").innerHTML = `<div class="card"><b>Model answer</b>${q.answer_html}</div><p>How did you do?</p><div class="row"><button id="sGot">Got it</button><button id="sPart" class="sec">Partly</button><button id="sMiss" class="warn">Missed</button></div>`;
    $("#sGot").onclick = () => { rec(true); z.i++; render(); }; $("#sPart").onclick = () => { rec(false); z.i++; render(); }; $("#sMiss").onclick = () => { rec(false); z.i++; render(); };
  };
  function wireNext() { $("#qNext").onclick = () => { z.i++; render(); }; }
}

/* ---------- keycards ---------- */
let CD = null;
function cardsPage(sid) {
  if (!CD || CD.sid !== sid) { const l = D.cards.filter(c => sid === "ALL" || c.sec === sid); CD = { sid, list: l.slice().sort((a, b) => ((S.cards[a.id] || {}).box || 0) - ((S.cards[b.id] || {}).box || 0)), i: 0, flip: false }; }
  const z = CD; if (!z.list.length) return "<p>No cards here.</p>";
  if (z.i >= z.list.length) return `<h2>All ${z.list.length} cards seen</h2><button id="cAgain">Again (weakest first)</button>`;
  const c = z.list[z.i];
  return `<h2>Keycards ${esc(sid === "ALL" ? "(all)" : secById[sid].short)}</h2><p class="muted">${z.i + 1}/${z.list.length} · tap the card to flip</p>
  <div class="card flash" id="flip">${z.flip ? `<pre>${esc(c.back)}</pre>` : `<p style="font-size:17px">${esc(c.front)}</p>`}</div>
  <p class="src">${esc(c.tags)} · <b>Source:</b> ${esc(c.source)}</p>
  ${z.flip ? `<div class="row"><button id="cAgain1" class="warn">Again</button><button id="cGood">Knew it</button></div>` : ""}`;
}
function cardsWire() {
  const z = CD; if (!z) return;
  if ($("#cAgain")) { $("#cAgain").onclick = () => { CD = null; render(); }; return; }
  $("#flip") && ($("#flip").onclick = () => { z.flip = !z.flip; render(); });
  const c = z.list[z.i];
  const mark = good => { const r = S.cards[c.id] || { box: 0 }; r.box = good ? Math.min(5, (r.box || 0) + 1) : 0; r.t = Date.now(); S.cards[c.id] = r; if (good) addXP(2); else save(); z.i++; z.flip = false; render(); };
  $("#cGood") && ($("#cGood").onclick = () => mark(true)); $("#cAgain1") && ($("#cAgain1").onclick = () => mark(false));
}

/* ---------- videos & reels ---------- */
function videosHTML(sid) {
  const list = D.videos.filter(v => !sid || v.sec === sid || v.sec === "ALL");
  let h = "";
  if (!sid) h += D.local_videos.map(v => `<div class="card"><b>${esc(v.title)}</b><video controls preload="metadata" playsinline style="width:100%;border-radius:10px;margin-top:6px" src="${esc(v.file)}"></video></div>`).join("");
  h += list.length ? list.map(v => `<div class="card"><a href="${esc(v.url)}" target="_blank" rel="noopener"><b>${esc(v.title)}</b></a>${v.note ? `<div class="src">${esc(v.note)}</div>` : ""}<div class="src">${esc(v.sec)} · ${esc(v.source)}</div></div>`).join("")
    : `<div class="note">No short-video links for this pointer yet (they come from reteach/links.md, ≤15 min each). ${sid ? 'The <a href="#/videos">Videos page</a> has the Topics 1-5 recap.' : ""}</div>`;
  return h;
}

/* ---------- timed mock (A30 / B30 / C40, 3 h) ---------- */
function mockPage() {
  const M = D.mock, m = S.mock;
  if (!m || !m.start) return `<h2>Timed mock: 3 hours, 100 marks</h2><div class="note">${esc(M.title)}. Built only from this lab's sources (CA, sample tests, study guide, the to-do questions). It is <b>not</b> the official mock and shares no questions with it. Layout: Section A 30 · Section B 30 · Section C 40. Closed book: no hints, no checks until you finish.</div>
    <ul>${M.sections.map(s => `<li>${esc(s.title)}: ${s.items.length} questions</li>`).join("")}</ul><button id="mStart" class="big">Start the 3-hour timer</button>`;
  let h = `<h2>Mock ${m.done ? "finished" : "in progress"} <span class="timer" id="mockTimer">${m.done ? "" : fmtLeft(m)}</span></h2>`;
  for (const s of M.sections) {
    h += `<h3>${esc(s.title)}</h3>`;
    s.items.forEach((it, k) => {
      const key = s.id + k, a = m.answers[key];
      if (it.k === "q") {
        const q = qById[it.id];
        h += `<div class="mockitem"><b>${s.id}${k + 1}. ${esc(q.title)}</b> <span class="muted">[${it.marks}]</span>${q.stem}` + (q.kind === "mcq" ? q.choices.map((c, j) => `<label style="display:block"><input type="radio" name="${key}" value="${j}" ${a == j ? "checked" : ""} ${m.done ? "disabled" : ""}> ${"ABCDE"[j]}. ${c}</label>`).join("")
          : `<textarea class="tx" data-key="${key}" ${m.done ? "readonly" : ""}>${esc(a || "")}</textarea>`);
        if (m.done) h += `<details class="card"><summary>Model answer</summary>${q.kind === "mcq" ? `<p><b>${"ABCDE"[q.answer]}</b></p>` : ""}${q.answer_html}</details><p class="src">${esc(q.source)}</p>`;
        h += markBox(key, it.marks, m) + "</div>";
      } else {
        const e = exById[it.id];
        h += `<div class="mockitem"><b>${s.id}${k + 1}. ${esc(e.title)}</b> <span class="muted">[${it.marks}]</span>${e.task}<ul>${(e.tasks || []).map(([n, mk, d]) => `<li>TODO ${n} [${mk}]: ${esc(d)}</li>`).join("")}</ul>`;
        e.files.forEach((f, j) => {
          const fk = key + "_" + j, val = (a && a[j] != null) ? a[j] : f.skeleton;
          h += `<p class="src"><b>${esc(f.name)}</b>${f.given ? " (given)" : ""}</p><textarea class="code" data-key="${key}" data-j="${j}" ${f.given || m.done ? "readonly" : ""} spellcheck="false">${esc(val)}</textarea>`;
        });
        if (m.done) h += e.files.filter(f => !f.given).map(annHTML).join("") + (e.markscheme ? `<div class="card"><b>Marks</b>${e.markscheme}</div>` : "");
        h += markBox(key, it.marks, m) + "</div>";
      }
    });
  }
  const tot = Object.values(m.marks || {}).reduce((x, y) => x + (+y || 0), 0);
  h += `<div class="row">${m.done ? `<b>Self-marked: ${tot} / 100</b>` : `<button id="mFinish" class="warn">Finish and show the memo</button>`}<button id="mExport">⬇ Export for marking</button><button id="mReset" class="sec">Discard attempt</button></div>`;
  return h;
}
function markBox(key, marks, m) { return m.done ? `<label class="row">Your mark: <input type="number" min="0" max="${marks}" step="0.5" data-mark="${key}" value="${(m.marks || {})[key] ?? ""}" style="width:80px"> / ${marks}</label>` : ""; }
function mockWire() {
  const M = D.mock;
  if ($("#mStart")) { $("#mStart").onclick = () => { S.mock = { start: Date.now(), answers: {}, marks: {}, t: Date.now() }; save(); render(); }; return; }
  const m = S.mock;
  document.querySelectorAll("textarea[data-key]").forEach(ta => { fit(ta); ta.addEventListener("input", () => {
    const k = ta.dataset.key; if (ta.dataset.j != null) { const e = exById[M.sections.find(s => k.startsWith(s.id)).items[+k.slice(1)].id]; m.answers[k] = m.answers[k] || e.files.map(f => f.skeleton); m.answers[k][+ta.dataset.j] = ta.value; } else m.answers[k] = ta.value;
    m.t = Date.now(); fit(ta); saveSoon(); }); });
  document.querySelectorAll("input[type=radio]").forEach(r => r.onchange = () => { m.answers[r.name] = +r.value; m.t = Date.now(); save(); });
  document.querySelectorAll("input[data-mark]").forEach(i => i.onchange = () => { m.marks = m.marks || {}; m.marks[i.dataset.mark] = i.value; m.t = Date.now(); save(); render(); });
  $("#mFinish") && ($("#mFinish").onclick = () => { if (confirm("Finish the mock and reveal the memo?")) { m.done = true; m.end = Date.now(); save(); render(); } });
  $("#mReset").onclick = () => { if (confirm("Discard this attempt?")) { S.mock = null; save(); render(); } };
  $("#mExport").onclick = () => {
    const L = [`MAD700 practice mock export · started ${new Date(m.start).toLocaleString()}${m.end ? " · finished " + new Date(m.end).toLocaleString() : ""}`, `Time used: ${Math.round(((m.end || Date.now()) - m.start) / 60000)} min of ${M.mins}`, "Please mark against the memo and list weak spots first.", ""];
    for (const s of M.sections) { L.push("==== " + s.title + " ===="); s.items.forEach((it, k) => {
      const key = s.id + k, a = m.answers[key];
      if (it.k === "q") { const q = qById[it.id]; L.push(`--- ${s.id}${k + 1} [${it.marks}] ${q.title} (${q.source})`, "Q: " + stripHTML(q.stem), q.kind === "mcq" ? "Choices: " + q.choices.map((c, j) => "ABCDE"[j] + ". " + stripHTML(c)).join(" | ") : "", "ANSWER: " + (q.kind === "mcq" ? (a != null ? "ABCDE"[a] : "(blank)") : (a || "(blank)")), ""); }
      else { const e = exById[it.id]; L.push(`--- ${s.id}${k + 1} [${it.marks}] ${e.title} (${e.source})`, ...(e.tasks || []).map(([n, mk, d]) => `TODO ${n} [${mk}]: ${d}`));
        e.files.forEach((f, j) => { if (!f.given) L.push(`// ===== ${f.name} =====`, (a && a[j] != null) ? a[j] : "(unchanged skeleton)\n" + f.skeleton); }); L.push(""); }
      if (m.marks && m.marks[key] != null) L.push(`Self-mark: ${m.marks[key]} / ${it.marks}`, "");
    }); }
    download(`MAD700_lab_mock_attempt_${stamp()}.txt`, L.join("\n"));
  };
}

/* ---------- settings: themes, sync, progress export ---------- */
function settingsPage() {
  const cur = localStorage.getItem(KEY + ".theme") || "light";
  const done = D.ex.filter(e => exDone(e.id)).length;
  return `<h2>Themes, sync, export</h2><div class="card"><h3>Theme</h3><div class="themegrid">${THEMES.map(([k, n]) => `<button class="${k === cur ? "on" : ""}" data-t="${k}">${n}</button>`).join("")}</div></div>
  <div class="card"><h3>Phone ↔ laptop sync (file-based)</h3><p class="muted">Download the sync file on one device, send it to the other (WhatsApp / email / Drive), then Load it there. Newer answers win.</p>
  <div class="row"><button id="sDown">⬇ Download sync file</button><label class="btn sec">⬆ Load sync file<input type="file" id="sLoad" accept=".json,application/json" style="display:none"></label>${navigator.share ? '<button id="sShare" class="sec">Share sync file</button>' : ""}</div><div id="sMsg"></div></div>
  <div class="card"><h3>Progress</h3><p>${done}/${D.ex.length} TODO sets done · ${Object.keys(S.quiz).length}/${D.quiz.length} quiz questions tried · ⭐ ${S.xp || 0}</p>
  <div class="row"><button id="pExport" class="sec">⬇ Export progress summary (for Rigel)</button><button id="pWipe" class="warn">Reset all progress</button></div></div>`;
}
function settingsWire() {
  document.querySelectorAll(".themegrid button").forEach(b => b.onclick = () => { setTheme(b.dataset.t); render(); });
  const syncText = () => JSON.stringify({ app: KEY, exported: new Date().toISOString(), state: S });
  $("#sDown").onclick = () => download(`mad700lab_sync_${stamp()}.json`, syncText(), "application/json");
  $("#sShare") && ($("#sShare").onclick = async () => { try { const f = new File([syncText()], `mad700lab_sync_${stamp()}.json`, { type: "application/json" }); await navigator.share({ files: [f], title: "MAD700 lab sync" }); } catch (e) { $("#sMsg").innerHTML = `<div class="fb info">Share not available: use Download.</div>`; } });
  $("#sLoad").onchange = ev => { const f = ev.target.files[0]; if (!f) return; f.text().then(t => { try { const j = JSON.parse(t); if (j.app !== KEY) throw new Error("not a MAD700 lab sync file"); S = merge(S, j.state); save(); $("#sMsg").innerHTML = `<div class="fb ok">Loaded. Progress merged.</div>`; nav(); } catch (e) { $("#sMsg").innerHTML = `<div class="fb no">Could not load: ${esc(e.message)}</div>`; } }); };
  $("#pExport").onclick = () => {
    const L = ["MAD700 lab progress · " + new Date().toLocaleString(), ""];
    for (const x of D.secs) { L.push("== " + x.title); for (const e of D.ex.filter(e => e.sec === x.id)) { const r = S.ex[e.id] || {}; L.push(`${r.done ? "[done]" : r.checks ? "[tried]" : "[ -- ]"} ${e.level} · ${e.title} · checks ${r.checks || 0} · hints ${r.hints || 0}${r.peeked ? " · PEEKED" : ""}`); }
      const qq = D.quiz.filter(q => q.sec === x.id), miss = qq.filter(q => S.quiz[q.id] && !S.quiz[q.id].ok); L.push(`quiz: ${qq.filter(q => S.quiz[q.id]).length}/${qq.length} tried, missed: ${miss.map(q => q.title).join("; ") || "none"}`, ""); }
    download(`MAD700_lab_progress_${stamp()}.txt`, L.join("\n"));
  };
  $("#pWipe").onclick = () => { if (confirm("Erase ALL lab progress on this device?")) { S = { v: 1, xp: 0, streak: 0, ex: {}, quiz: {}, cards: {}, fill: {}, reels: {}, mock: null, t: Date.now() }; save(); render(); } };
}

/* ===== MAD700 lab plugin: instant feedback, Flow mode, pointer map, fill-ins, reels, lesson videos, cheatsheet ===== */
const ptrName = id => (secById[id] || {}).short || id;
const halfFloor = x => Math.floor(x * 2 + 1e-9) / 2;
const fmtM = x => (Math.round(x * 2) / 2).toString();
const fmtT = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function flowTick() { const d = (D.flow || []).filter(s => exDone(s.id)).length; return `${d}/${(D.flow || []).length}`; }

/* ---------- marking style: QUESTION / YOUR ANSWER / FEEDBACK / MODEL ANSWER ---------- */
const WHY = [
  [/findViewById|^R\.id/i, "without finding the view, Java cannot touch the widget: nothing happens, or the app crashes (NullPointerException)"],
  [/setOnClickListener|onclick/i, "without a click listener, tapping the button does nothing"],
  [/commit\(\)/i, "without commit() the fragment transaction is never carried out"],
  [/addtobackstack/i, "without it, Back closes the app instead of returning to the previous fragment"],
  [/inputtype/i, "inputType decides the keyboard and what may be typed; the memo checks the exact value"],
  [/android:id|@\+id/i, "the id is how Java (and other views) find this widget"],
  [/layout_width|layout_height/i, "every view needs both a width and a height or the layout will not inflate"],
  [/orientation/i, "a LinearLayout without an orientation lays its children out in a row, not as the design shows"],
  [/apply\(\)|\.apply|commit/i, "nothing is saved until apply() (or commit()) runs"],
  [/contentvalues|put\(|put/i, "ContentValues carries the column values; without them the row is empty"],
  [/insert|update|delete|rawquery|query/i, "this is the database call itself: the memo gives a mark for the exact method"],
  [/movetonext|cursor/i, "without moveToNext() the loop never ends (or reads only one row)"],
  [/close/i, "an open Cursor leaks memory"],
  [/toast/i, "the Toast is the visible feedback the question asks for"],
  [/intent|startactivity/i, "the Intent says where to go and startActivity actually goes"],
  [/create table|primary key|autoincrement|not null|integer|text/i, "the table definition decides what can be stored: a wrong or missing keyword changes the schema"],
  [/super/i, "super(...) tells SQLiteOpenHelper the database name and version"],
  [/viewholder|oncreateviewholder|onbindviewholder|getitemcount/i, "RecyclerView calls these methods; a missing one means no rows, or wrong rows"],
  [/fragment|container/i, "the FragmentManager needs the container id and the fragment to know what to show and where"],
];
const whyOf = label => (WHY.find(([rx]) => rx.test(label)) || [0, "the memo awards a mark for this exact piece"])[1];
const stripComments = (t, lang) => normCode(t, lang, false);
function userBlock(code, n) {
  const lines = String(code || "").split("\n"), re = /^\s*(\/\/|<!--|--) TODO (\d+)/;
  const s = lines.findIndex(l => { const m = l.match(re); return m && +m[2] === n; });
  if (s < 0) return lines.join("\n");
  let t = lines.length; for (let i = s + 1; i < lines.length; i++) if (re.test(lines[i])) { t = i; break; }
  return lines.slice(s + 1, t).join("\n").replace(/\s+$/, "");
}
function modelTable(f, lang) {
  const cm = lang === "xml" ? ["<!-- ", " -->"] : ["// ", ""];
  return `<div class="codebox"><div class="annwrap" style="border:0"><table class="ann">${(f.ann || []).map(([l, n]) => `<tr><td class="c">${esc(l) || " "}</td><td class="n">${n ? esc(cm[0] + n + cm[1]) : ""}</td></tr>`).join("")}</table></div></div>`;
}
function feedbackAll(e, r, res) {
  const lang = e.files.find(f => !f.given).lang, fi = e.files.findIndex(f => !f.given);
  let html = "", got = 0, tot = 0, all = true; r.marks = r.marks || {};
  for (const n of Object.keys(res).sort((a, b) => a - b)) {
    const arr = res[n], fb = (e.fb || {})[n] || { m: 1, q: "", alt: [], ann: [] }, m = fb.m || 1;
    const okN = arr.filter(x => x.ok).length, frac = okN / arr.length;
    const g = frac === 1 ? m : Math.max(0, Math.min(m - 0.5, halfFloor(m * frac)));
    got += g; tot += m; if (frac < 1) all = false; r.marks[n] = g;
    const user = userBlock(r.codes[fi], +n), typed = stripComments(user, lang) !== stripComments(userBlock(e.files[fi].skeleton, +n), lang), kind = frac === 1 ? "full" : okN > 0 ? "part" : "none";
    const shown = user.split("\n").slice(0, 14).join("\n") + (user.split("\n").length > 14 ? "\n…" : "");
    const right = arr.filter(x => x.ok).map(x => esc(x.label)), miss = arr.filter(x => !x.ok);
    let fbh = "", model = "";
    if (kind === "full") {
      fbh = `<b>Correct ✔ ${fmtM(g)}/${fmtM(m)}.</b> Every key element the memo looks for is there.<div class="alt"><b>ALTERNATIVE (another valid way):</b> ${(fb.alt || []).map(a => esc(a).replace(/`([^`]+)`/g, "<code>$1</code>")).join("<br>")}</div>`;
      model = `<details><summary>Show the model answer anyway</summary>${modelTable({ ann: fb.ann }, lang)}</details>`;
    } else if (!typed) {
      fbh = `<b>${fmtM(g)}/${fmtM(m)}.</b> You haven't typed anything for this TODO yet. Have a go first (a 💡 Hint is available): the model answer unlocks once you've tried.`;
    } else if (kind === "part") {
      fbh = `<b>Partly there: ${fmtM(g)}/${fmtM(m)}.</b>${g === 0 ? " (Close, but each mark needs the whole piece.)" : ""}<br><b>Right:</b> ${right.map(x => "✓ " + x).join(" · ")}<br><b>Missing:</b> ${miss.map(x => "✗ " + esc(x.label)).join(" · ")}<ul class="why">${miss.slice(0, 5).map(x => `<li><b>${esc(x.label)}</b>: ${esc(whyOf(x.label))}.</li>`).join("")}</ul>`;
      model = `<details open><summary>Model answer</summary>${modelTable({ ann: fb.ann }, lang)}</details>`;
    } else {
      fbh = `<b>${fmtM(g)}/${fmtM(m)}.</b> Nothing you typed matches what this TODO needs yet.<br><b>The gap:</b> the memo looks for ${miss.slice(0, 5).map(x => "<code>" + esc(x.label) + "</code>").join(", ")}.<br><b>Key idea:</b> ${esc(fb.q)}`;
      model = `<details open><summary>Model answer</summary>${modelTable({ ann: fb.ann }, lang)}</details>`;
    }
    html += `<div class="fbk ${kind}"><div class="fbh">TODO ${n} · <b>${fmtM(g)}/${fmtM(m)}</b> ${kind === "full" ? "✅" : kind === "part" ? "🟡" : "🔴"}</div>
      <div class="fbr"><span>QUESTION</span><div>${esc(fb.q)}</div></div>
      <div class="fbr"><span>YOUR ANSWER</span><pre>${esc(shown) || "(empty)"}</pre></div>
      <div class="fbr"><span>FEEDBACK</span><div>${fbh}</div></div>
      ${model ? `<div class="fbr"><span>${kind === "full" ? "MODEL ANSWER" : "MODEL ANSWER"}</span><div>${model}</div></div>` : ""}</div>`;
  }
  html = `<h3>Instant feedback · <span class="tot">${fmtM(got)}/${fmtM(tot)}</span></h3>` + html +
    (all ? `<div class="fb ok">All key elements found (${fmtM(got)}/${fmtM(tot)}). ${cur && cur.flow ? "Now interpret it below, then move on." : "Open the model answer and self-mark honestly."}</div>` : `<div class="fb info">${fmtM(got)}/${fmtM(tot)} so far. Fix the missing pieces and press Check again.</div>`);
  return { html, got, tot, all };
}

/* ---------- Flow step: interpret it ---------- */
const STOP = new Set("about after again also because before being between could does doing each from have into just more most only other over same should some that their them then there these they this those through under very what when where which while will with would your".split(" "));
const kw = s => [...new Set((s.toLowerCase().match(/[a-z0-9_]{4,}/g) || []).filter(w => !STOP.has(w)).map(w => w.slice(0, 6)))];
const ideasOf = t => String(t).split(/(?<=[.!?])\s+(?=[A-Z0-9`'(])/).map(x => x.trim()).filter(x => x.length > 3).slice(0, 6);
function interpWire() {
  const { e, r } = cur, box = $("#interp"); if (!box) return;
  const ideas = ideasOf(e.im);
  const draw = () => {
    if (!(r.checks || r.revealed)) { box.innerHTML = `<div class="card muted">🔒 <b>Interpret it</b> unlocks after your first ✔ Check.</div>`; return; }
    const imd = r.imark || null;
    const keep = $("#itext") ? $("#itext").value : (r.itext || "");
    let h = `<div class="card"><h3>Interpret it</h3><p>${esc(e.ip)}</p>
      <textarea id="itext" class="code" style="min-height:90px" placeholder="Type what appears on screen / what happens / why, in your own words">${esc(keep)}</textarea>
      <div class="row"><button id="iMark">Mark my interpretation</button></div><div id="iout"></div></div>`;
    box.innerHTML = h;
    const out = () => {
      const txt = $("#itext").value, words = new Set(kw(txt)); let hit = ideas.map((idea, k) => { const ks = kw(idea), n = ks.filter(w => words.has(w)).length; return ks.length ? n / ks.length >= 0.5 : false; });
      if (r.imanual) hit = hit.map((x, k) => (k in r.imanual) ? r.imanual[k] : x);
      const okN = hit.filter(Boolean).length, frac = ideas.length ? okN / ideas.length : 0, M = 2;
      const g = frac === 1 ? M : Math.max(0, Math.min(M - 0.5, halfFloor(M * frac))), kind = frac === 1 ? "full" : okN ? "part" : "none";
      r.imark = g; r.itext = txt; if (kind === "full" && !r.ixp) { r.ixp = 1; addXP(10); } save();
      const miss = ideas.map((x, k) => [x, k]).filter(([x, k]) => !hit[k]);
      const whyI = k => k === 0 ? "this is the visible result: the first mark is for what the user actually sees" : k === ideas.length - 1 ? "this is the 'why': the memo gives a separate mark for the reason, not only the result" : "this step links the result to its cause: without it your explanation has a gap";
      let fbh;
      if (kind === "full") fbh = `<b>Correct ✔ ${fmtM(g)}/${M}.</b> You covered every idea.<div class="alt"><b>ALTERNATIVE (same ideas, another order):</b> ${esc(ideas.slice().reverse().join(" "))}</div>`;
      else if (!txt.trim()) fbh = `<b>0/${M}.</b> Type your interpretation first: the model answer unlocks once you've tried.`;
      else if (kind === "part") fbh = `<b>Partly there: ${fmtM(g)}/${M}.</b><br><b>Right:</b> ${ideas.map((x, k) => hit[k] ? "✓ " + esc(x.slice(0, 70)) + "…" : "").filter(Boolean).join(" · ")}<br><b>Missing:</b><ul class="why">${miss.map(([x, k]) => `<li>${esc(x.slice(0, 90))}…: ${whyI(k)}.</li>`).join("")}</ul>`;
      else fbh = `<b>${fmtM(g)}/${M}.</b> Your answer doesn't hit the key ideas yet.<br><b>The gap:</b> the question wants the on-screen result and the reason behind it.<br><b>Key idea:</b> ${esc(ideas[0])}`;
      const show = kind !== "full" && txt.trim();
      $("#iout").innerHTML = `<div class="fbk ${kind}"><div class="fbh">Interpretation · <b>${fmtM(g)}/${M}</b></div>
        <div class="fbr"><span>QUESTION</span><div>${esc(e.ip)}</div></div><div class="fbr"><span>YOUR ANSWER</span><pre>${esc(txt) || "(empty)"}</pre></div>
        <div class="fbr"><span>FEEDBACK</span><div>${fbh}</div></div>
        ${txt.trim() ? `<div class="fbr"><span>MODEL ANSWER</span><div><details ${show ? "open" : ""}><summary>${kind === "full" ? "Show the model answer anyway" : "Model answer"}</summary><p>${esc(e.im)}</p></details></div></div>` : ""}
        ${txt.trim() ? `<div class="fbr"><span>SELF-CHECK</span><div class="small">Did the marker miss something you did say? Tick it:${ideas.map((x, k) => `<label style="display:block"><input type="checkbox" data-k="${k}" ${hit[k] ? "checked" : ""}> ${esc(x.slice(0, 100))}${x.length > 100 ? "…" : ""}</label>`).join("")}</div></div>` : ""}</div>`;
      document.querySelectorAll("#iout input[data-k]").forEach(cb => cb.onchange = () => { r.imanual = r.imanual || {}; r.imanual[cb.dataset.k] = cb.checked; out(); });
      const done = r.lastAll && g >= 1.5; if (done && !r.done) { r.done = true; S.streak = (S.streak || 0) + 1; addXP(25); nav(); }
    };
    $("#iMark").onclick = out; if (r.itext) out();
  };
  draw(); $("#bCheck").addEventListener("click", draw);
  const bs = $("#bShow"); bs && bs.addEventListener("click", () => setTimeout(draw, 50));
}

/* ---------- Flow index ---------- */
ROUTES.flow = () => {
  const F = D.flow, done = F.filter(s => exDone(s.id)).length, first = F.find(s => !exDone(s.id)) || F[0];
  let h = `<h2>🌊 Flow mode</h2><div class="note">Walk the lecturer's own questions <b>in order</b>: the 2026 CA test, the ReTEST, the sample tests, the Semester 1 test, the study-guide end-of-unit exercises, then your Smart Pantry code. Each step: <b>// TODO</b> Java/XML skeleton (CA style) → ✔ Check (instant marks) → <b>Interpret it</b> (what appears on screen / what happens / why) → next. Strictly P1-P5 + Fragments, SharedPreferences, bottom navigation (light review). Every step cites its source.${D.include_memo ? "" : " (Memo-sourced steps are left out of this build.)"}</div>
  <div class="prog"><i style="width:${Math.round(100 * done / F.length)}%"></i></div><p>${done}/${F.length} steps done · <a class="btn" href="#/f/${first.id}">${done ? "Resume" : "Start"} at step ${first.n}</a></p>`;
  for (const g of D.groups) {
    const list = F.filter(s => s.group === g); if (!list.length) continue;
    h += `<h3>${esc(g)} <small class="muted">· ${list.length} step${list.length > 1 ? "s" : ""}</small></h3>` + list.map(s => { const r = S.ex[s.id] || {};
      return `<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/f/${s.id}"><b>${r.done ? "✅" : r.checks ? "🟡" : "▫️"} ${s.n}. ${esc(s.title)}</b> <span class="lvl ${s.sec === "LR" ? "easy" : "medium"}">${esc(s.sec)}</span> · ${s.marks} marks${r.lastMarks ? ` · last check ${esc(r.lastMarks)}` : ""}<div class="src">${esc(s.source.slice(0, 150))}</div></a>`; }).join("");
  }
  return [h, null];
};

/* ---------- lesson videos, reels ---------- */
function lessonVideosHTML(sid) {
  let h = "";
  D.local_videos.forEach((v, idx) => {
    const chs = (v.chapters || []).filter(c => !sid || c.ptr === sid);
    if (sid && !chs.length) return;
    h += `<div class="card vcard"><b>${esc(v.title)}</b>
      <video controls preload="none" playsinline style="width:100%;border-radius:10px;margin-top:6px;background:#000" src="${esc(v.file)}">${v.vtt ? `<track kind="subtitles" src="${esc(v.vtt)}" srclang="en" label="English" default>` : ""}</video>
      <div class="vmiss note" style="display:none">This video file isn't in the hosted copy (it is large). It's in <b>mad700_lab_videos.zip</b>: unzip it next to index.html so the <code>videos/</code> folder sits beside it.</div>
      ${chs.length ? `<div class="chap"><b>Chapters${sid ? " for " + esc(ptrName(sid)) : ""}:</b> ${chs.map(c => `<button class="sec sm" data-vt="${c.t}" data-vi="${idx}">${fmtT(c.t)} ${esc(c.label)}</button>`).join(" ")}</div>` : ""}</div>`;
  });
  return h || `<div class="note">No lesson video for this pointer yet.</div>`;
}
function vidWire() {
  document.querySelectorAll(".vcard video").forEach(v => v.addEventListener("error", () => { const m = v.parentNode.querySelector(".vmiss"); if (m) m.style.display = ""; }, true));
  document.querySelectorAll("[data-vt]").forEach(b => b.onclick = () => { const v = b.closest(".vcard").querySelector("video"); const go = () => { v.currentTime = +b.dataset.vt; v.play().catch(() => {}); }; if (v.readyState < 1) { v.addEventListener("loadedmetadata", go, { once: true }); v.load(); } else go(); });
}
const today = () => new Date().toISOString().slice(0, 10);
function reelCard(v) {
  return `<article class="reel" data-id="${esc(v.id)}"><div class="rthumb" data-id="${esc(v.id)}"><img loading="lazy" alt="" src="https://img.youtube.com/vi/${esc(v.id)}/mqdefault.jpg" onerror="this.style.display='none'"><button class="play" aria-label="Play">▶</button></div>
    <div class="rmeta"><b>${esc(v.title)}</b><div class="src">${esc(v.chan)} · ${esc(v.len)}${v.ptrs.length ? " · " + v.ptrs.map(ptrName).join(", ") : ""}</div><div class="src">${esc(v.note)}</div>
    <div class="row"><a class="btn sec sm" href="${esc(v.url)}" target="_blank" rel="noopener">Open on YouTube ↗</a></div></div></article>`;
}
function reelsHTML(sid) {
  const list = D.reels.filter(v => !sid || v.ptrs.includes(sid));
  if (!list.length) return `<div class="note">No verified reel for this pointer.</div>`;
  return `<div class="reelnote">Distraction-locked: plays inline (no suggestions), a nudge after 8 a day. Short and ≤ 11 min each. Watch 2-3, then do a TODO.</div><div class="feed ${sid ? "small" : ""}">${list.map(reelCard).join("")}</div><div class="nudge" style="display:none"></div>`;
}
function reelWire() {
  const nudge = () => { const n = (S.reels || {})[today()] || 0; document.querySelectorAll(".nudge").forEach(x => { if (n >= 8) { x.style.display = ""; x.innerHTML = `⛔ ${n} reels today. That's enough scrolling: <a class="btn" href="#/flow">go do the next Flow step</a>`; } }); document.querySelectorAll(".rcount").forEach(x => x.textContent = n); };
  nudge();
  document.querySelectorAll(".rthumb").forEach(t => t.onclick = () => {
    const n = (S.reels || {})[today()] || 0;
    if (n >= 8 && !t.dataset.ok) { if (confirm("You've watched 8 reels today. OK = go and do a TODO instead, Cancel = watch anyway.")) { location.hash = "#/flow"; return; } t.dataset.ok = 1; }
    S.reels = S.reels || {}; S.reels[today()] = n + 1; save(); nudge();
    t.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.dataset.id)}?rel=0&modestbranding=1&playsinline=1&autoplay=1" title="reel" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  });
}
ROUTES.reels = p => {
  const sid = p[1] || "";
  const chips = ["", ...D.secs.map(s => s.id)].map(id => `<a class="btn sm ${id === sid ? "" : "sec"}" href="#/reels${id ? "/" + id : ""}">${id ? esc(ptrName(id)) : "All"}</a>`).join(" ");
  return [`<h2>📱 Reels feed</h2><div class="row">${chips}</div><p class="muted">Watched today: <b class="rcount">0</b>/8 · only links verified to exist (YouTube). No TikTok / Instagram / Facebook clip could be verified, so none are listed.</p>${reelsHTML(sid || null)}
    <h3>Read, don't watch</h3><ul>${D.docs.map(d => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a></li>`).join("")}</ul>`, reelWire];
};

/* ---------- pointer map ---------- */
function pointerSection(sid) {
  const x = secById[sid], m = D.pmap[sid] || { sg: [], slides: [], papers: [] };
  const steps = D.flow.filter(s => s.sec === sid), ex = D.ex.filter(e => e.sec === sid), fills = D.fills.filter(f => f.sec === sid), reels = D.reels.filter(v => v.ptrs.includes(sid));
  const li = a => a.length ? `<ul>${a.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : "<p class='muted'>none</p>";
  return `<section class="pmap" id="map-${sid}"><h3>${esc(x.title)}</h3><p class="muted">${esc(x.pointer)}</p>
  <div class="grid2"><div class="card"><b>Study guide pages</b>${li(m.sg)}</div><div class="card"><b>Lecturer slides</b>${li(m.slides)}</div></div>
  <div class="card"><b>CA / past-paper questions</b>${li(m.papers)}<b>Flow steps (${steps.length})</b>${steps.length ? `<ul>${steps.map(s => `<li><a href="#/f/${s.id}">${esc(s.group)} · ${esc(s.title)}</a> (${s.marks} marks)</li>`).join("")}</ul>` : "<p class='muted'>none for this pointer (practice sets below)</p>"}
    <b>More // TODO sets:</b> <a href="#/s/${sid}/code">${ex.length} sets (easy/medium/hard)</a> · <b>Quiz</b> <a href="#/quiz/${sid}">${D.quiz.filter(q => q.sec === sid).length} questions</a> · <b>Keycards</b> <a href="#/cards/${sid}">${D.cards.filter(c => c.sec === sid).length}</a></div>
  <div class="card"><b>My lesson videos + chapter timestamps</b>${lessonVideosHTML(sid)}</div>
  <div class="card"><b>Reels (${reels.length})</b><ul>${reels.map(v => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a> <span class="src">${esc(v.len)} · ${esc(v.chan)}</span></li>`).join("")}</ul><a class="btn sm sec" href="#/reels/${sid}">Open as feed</a></div>
  <div class="card"><b>Fill-ins (${fills.length}, practice only: the exam uses // TODO)</b> <a class="btn sm sec" href="#/fill/${sid}">Practise</a></div></section>`;
}
ROUTES.map = () => [`<h2>🗺 Pointer map</h2><div class="note">One section per exam pointer: where it lives in the study guide and slides, which CA / past-paper questions test it, the Flow steps, your lesson video with chapter timestamps, reels and fill-ins. ${D.secs.map(s => `<a href="#map-${s.id}" onclick="document.getElementById('map-${s.id}').scrollIntoView();return false">${esc(s.id)}</a>`).join(" · ")}</div>${D.secs.map(s => pointerSection(s.id)).join("")}`, vidWire];

/* ---------- fill-in-the-blanks (practice only) ---------- */
const nrm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
ROUTES.fill = p => {
  const sid = p[1] || "", list = D.fills.filter(f => !sid || f.sec === sid);
  const chips = ["", ...D.secs.map(s => s.id)].map(id => `<a class="btn sm ${id === sid ? "" : "sec"}" href="#/fill${id ? "/" + id : ""}">${id ? esc(id) : "All"}</a>`).join(" ");
  const item = f => { const parts = f.text.split("___"), sv = (S.fill || {})[f.id] || {};
    return `<div class="card fill" data-id="${f.id}"><div class="fillt">${parts.map((t, k) => esc(t) + (k < f.ans.length ? `<input data-k="${k}" size="${Math.max(6, (f.ans[k].split("|")[0].length) + 2)}" value="${esc(((sv.a || [])[k]) || "")}" autocapitalize="off" autocomplete="off" spellcheck="false">` : "")).join("")}</div>
      <div class="row"><button class="sm fchk">✔ Check</button><span class="src">${esc(f.sec)} · ${esc(f.source)}</span></div><div class="fout"></div></div>`; };
  return [`<h2>✏️ Fill-ins <small class="muted">(${list.length})</small></h2><div class="note"><b>Practice only:</b> the exam uses <b>// TODO</b> code, not fill-in-the-blanks. These just drill the exact keywords the memo marks. Real practice for the paper is Flow mode.</div><div class="row">${chips}</div>${list.map(item).join("")}`, () => {
    document.querySelectorAll(".fill").forEach(card => {
      const f = D.fills.find(x => x.id === card.dataset.id), draw = () => {
        const ins = [...card.querySelectorAll("input")], vals = ins.map(i => i.value), ok = vals.map((v, k) => f.ans[k].split("|").map(nrm).includes(nrm(v)));
        S.fill = S.fill || {}; S.fill[f.id] = { a: vals, got: ok.filter(Boolean).length, n: ok.length, t: Date.now() }; save();
        const g = ok.filter(Boolean).length, n = ok.length, kind = g === n ? "full" : g ? "part" : "none", typed = vals.some(v => v.trim());
        const modelTxt = f.text.split("___").map((t, k) => t + (k < n ? `[${f.ans[k].split("|")[0]}]` : "")).join("");
        let fbh;
        if (kind === "full") fbh = `<b>Correct ✔ ${g}/${n}.</b><div class="alt"><b>ALTERNATIVE:</b> ${esc(f.alt || "No other wording is accepted for these exact keywords: they are what the memo checks.")}</div>`;
        else if (!typed) fbh = `<b>0/${n}.</b> Fill at least one blank first, then check.`;
        else if (kind === "part") fbh = `<b>Partly there: ${g}/${n}.</b><br><b>Right:</b> ${ok.map((o, k) => o ? "✓ blank " + (k + 1) : "").filter(Boolean).join(", ")}<br><b>Missing:</b> ${ok.map((o, k) => o ? "" : "✗ blank " + (k + 1)).filter(Boolean).join(", ")}<br><b>Why it matters:</b> ${esc(f.why)}`;
        else fbh = `<b>0/${n}.</b> None of the blanks match.<br><b>Key idea:</b> ${esc(f.why)}`;
        card.querySelector(".fout").innerHTML = `<div class="fbk ${kind}"><div class="fbr"><span>QUESTION</span><div>${esc(f.text.replace(/___/g, "____"))}</div></div><div class="fbr"><span>YOUR ANSWER</span><div>${vals.map(v => `<code>${esc(v) || "(blank)"}</code>`).join(" ")}</div></div><div class="fbr"><span>FEEDBACK (${g}/${n})</span><div>${fbh}</div></div>${kind !== "full" && typed ? `<div class="fbr"><span>MODEL ANSWER</span><div><code>${esc(modelTxt)}</code></div></div>` : ""}</div>`;
      };
      card.querySelector(".fchk").onclick = draw;
    });
  }];
};

/* ---------- printable cheatsheet ---------- */
ROUTES.cheat = () => [`<div class="noprint"><h2>🧾 Cheatsheet</h2><div class="row"><button id="bPrint">🖨 Print / save as PDF</button><span class="muted">Each block is tagged [pointer · study guide page · paper question].</span></div></div>
  <div class="csheet">${D.secs.map(s => `<h3>${esc(s.title)}</h3><div class="csgrid">${D.cheats.filter(c => c.sec === s.id).map(c => `<div class="cs"><div class="cstag">${esc(c.tag)}</div><b>${esc(c.title)}</b><pre class="cscode">${esc(c.code)}</pre></div>`).join("")}</div>`).join("")}
  <h3>Exam-morning keyword card</h3><div class="card">${D.home.keywords}</div></div>`, () => { $("#bPrint").onclick = () => window.print(); }];

/* ---------- shared typed-answer rubric (quiz shorts, mock shorts, any other prose) ---------- */
const UNITS = new Set("dp sp px em dip id ui xml sql".split(" "));
function kwA(s) {
  const out = [];
  for (const w of String(s).toLowerCase().match(/[a-z0-9_]{2,}/g) || []) {
    if (STOP.has(w) && !UNITS.has(w)) continue;
    if (w.length < 4 && !UNITS.has(w)) continue;
    const k = w.length >= 6 ? w.slice(0, 6) : w;
    if (!out.includes(k)) out.push(k);
  }
  return out;
}
function ideaHit(user, idea) {
  const u = String(user || "");
  const words = new Set(kwA(u));
  const must = idea.must || [];
  const mustHit = must.filter(t => { try { return new RegExp("\\b" + t.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "\\b", "i").test(u); } catch (e) { return u.toLowerCase().includes(String(t).toLowerCase()); } });
  const keys = idea.keys && idea.keys.length ? idea.keys : kwA(idea.text);
  const keyHit = keys.filter(k => words.has((k.length >= 6 ? k.slice(0, 6) : k).toLowerCase()) || u.toLowerCase().includes(String(k).toLowerCase()));
  if (must.length) {
    const primary = must[0];
    const primaryHit = mustHit.some(t => String(t).toLowerCase() === String(primary).toLowerCase());
    if (!primaryHit) return false;
    if (mustHit.length < Math.ceil(must.length * 0.5)) return false;
    return true;
  }
  if (keys.length && keyHit.length / keys.length >= 0.5) return true;
  return false;
}
function markTyped(opts) {
  /* opts: { user, ideas, marks, question, alt, modelHtml, manual } -> { html, got, tot, kind, hits } */
  const ideas = opts.ideas || [], M = opts.marks || ideas.length || 1;
  const user = String(opts.user || ""), typed = user.trim().length > 0;
  let hits = ideas.map(idea => ideaHit(user, idea));
  if (opts.manual) hits = hits.map((h, i) => (i in opts.manual) ? opts.manual[i] : h);
  const okN = hits.filter(Boolean).length, frac = ideas.length ? okN / ideas.length : (typed ? 1 : 0);
  const kind = !typed ? "none" : (frac >= 0.999 ? "full" : okN ? "part" : "none");
  const g = !typed ? 0 : (kind === "full" ? M : Math.max(0, Math.min(M - 0.5, halfFloor(M * frac))));
  const miss = ideas.map((x, i) => [x, i]).filter(([x, i]) => !hits[i]);
  const right = ideas.map((x, i) => hits[i] ? x : null).filter(Boolean);
  let fbh = "";
  if (kind === "full") fbh = `<b>Correct ✔ ${fmtM(g)}/${fmtM(M)}.</b> You covered every idea the mark scheme looks for.<div class="alt"><b>ALTERNATIVE (another valid wording):</b> ${esc(opts.alt || "You can make the same points in a different order or with equivalent wording.")}</div>`;
  else if (!typed) fbh = `<b>0/${fmtM(M)}.</b> You haven't typed an answer yet. Have a go first: the model answer unlocks once you've tried.`;
  else if (kind === "part") fbh = `<b>Partly there: ${fmtM(g)}/${fmtM(M)}.</b><br><b>Right:</b> ${right.map(x => "✓ " + esc((x.text || x).slice(0, 80)) + ((x.text || x).length > 80 ? "…" : "")).join(" · ")}<br><b>Missing:</b><ul class="why">${miss.map(([x]) => `<li><b>${esc((x.text || x).slice(0, 90))}${(x.text || x).length > 90 ? "…" : ""}</b>: ${esc(x.why || "this is a separate mark-scheme point; without it the answer is incomplete")}.</li>`).join("")}</ul>`;
  else fbh = `<b>${fmtM(g)}/${fmtM(M)}.</b> Your answer doesn't hit the key ideas yet.<br><b>The gap:</b> ${esc((ideas[0] && (ideas[0].text || ideas[0]) || "the mark scheme's main point").toString().slice(0, 160))}…<br><b>Key idea:</b> ${esc((ideas[0] && (ideas[0].text || ideas[0]) || "").toString().slice(0, 200))}`;
  const showModel = typed && (kind !== "full");
  const modelBlock = typed ? `<div class="fbr"><span>MODEL ANSWER</span><div>${kind === "full" ? `<details><summary>Show the model answer anyway</summary>${opts.modelHtml || `<p>${esc(ideas.map(x => x.text || x).join(" "))}</p>`}</details>` : `<details open><summary>Model answer</summary>${opts.modelHtml || `<p>${esc(ideas.map(x => x.text || x).join(" "))}</p>`}</details>`}</div></div>` : "";
  const self = (typed && ideas.length) ? `<div class="fbr"><span>SELF-CHECK</span><div class="small">Did the marker miss something you did say? Tick it:${ideas.map((x, i) => `<label style="display:block"><input type="checkbox" data-idea="${i}" ${hits[i] ? "checked" : ""}> ${esc((x.text || x).slice(0, 110))}${(x.text || x).length > 110 ? "…" : ""}</label>`).join("")}</div></div>` : "";
  const html = `<div class="fbk ${kind}"><div class="fbh">Short answer · <b>${fmtM(g)}/${fmtM(M)}</b> ${kind === "full" ? "✅" : kind === "part" ? "🟡" : "🔴"}</div>
    <div class="fbr"><span>QUESTION</span><div>${opts.question || ""}</div></div>
    <div class="fbr"><span>YOUR ANSWER</span><pre>${esc(user) || "(empty)"}</pre></div>
    <div class="fbr"><span>FEEDBACK</span><div>${fbh}</div></div>
    ${modelBlock}${self}</div>`;
  return { html, got: g, tot: M, kind, hits };
}

function markMCQ(opts) {
  const ok = opts.ok, M = opts.marks || 1, g = ok ? M : 0, kind = ok ? "full" : "none";
  const fbh = ok
    ? `<b>Correct ✔ ${fmtM(g)}/${fmtM(M)}.</b><div class="alt"><b>ALTERNATIVE (another way to remember it):</b> ${esc(opts.alt || "Name the idea in your own words in a short-answer paper; the letter is only for this MCQ.")}</div>`
    : `<b>0/${fmtM(M)}.</b> That option isn't the one the memo marks.<br><b>The gap:</b> you picked ${esc(opts.picked || "a different option")}.<br><b>Key idea:</b> the correct option is <b>${esc(opts.correct)}</b>.`;
  const html = `<div class="fbk ${kind}"><div class="fbh">MCQ · <b>${fmtM(g)}/${fmtM(M)}</b> ${ok ? "✅" : "🔴"}</div>
    <div class="fbr"><span>QUESTION</span><div>${opts.question || ""}</div></div>
    <div class="fbr"><span>YOUR ANSWER</span><div>${esc(opts.picked || "(no choice)")}</div></div>
    <div class="fbr"><span>FEEDBACK</span><div>${fbh}</div></div>
    <div class="fbr"><span>MODEL ANSWER</span><div>${ok ? `<details><summary>Show the model answer anyway</summary>${opts.modelHtml || ""}</details>` : `<details open><summary>Model answer</summary>${opts.modelHtml || ""}</details>`}</div></div></div>`;
  return { html, got: g, tot: M, kind };
}

/* replace quiz + mock pages so short (and MCQ / mock typed) answers use the same rubric */
quizPage = function (sid) {
  const one = qById[sid];
  if (one) {
    if (!QZ || QZ.sid !== sid) QZ = { sid, list: [one], i: 0, right: 0, missed: [] };
  } else if (!QZ || QZ.sid !== sid) quizStart(sid || "ALL");
  const z = QZ;
  if (z.i >= z.list.length) {
    return `<h2>Quiz done: ${z.right}/${z.list.length} full marks</h2><div class="card"><h3>CATCH-UP</h3>${z.missed.length ? "<ul>" + z.missed.map(q => `<li>${esc(q.title)} <span class="src">(${esc(q.source)})</span>${(S.quiz[q.id] && S.quiz[q.id].got != null) ? ` · last ${fmtM(S.quiz[q.id].got)}/${fmtM(S.quiz[q.id].tot || q.marks || 1)}` : ""}</li>`).join("") + "</ul>" : "<p>Nothing missed. 🔥</p>"}</div>
      <div class="row"><button id="qAgain">Again</button><a class="btn sec" href="${one ? "#/quiz/" + (one.sec) : (sid === "ALL" ? "#/" : "#/s/" + sid + "/code")}">Go code</a></div>`;
  }
  const q = z.list[z.i], rec = S.quiz[q.id] || {};
  const body = q.kind === "mcq" ? q.choices.map((c, k) => `<button class="choice" data-k="${k}">${"ABCDE"[k]}. ${c}</button>`).join("")
    : `<textarea class="tx" id="qa" placeholder="Answer like the paper: definition + how it works + example / code">${esc(rec.text || "")}</textarea><button id="qMark">✔ Mark my answer</button>`;
  return `<p class="muted">${esc(one ? "Practice question" : (sid === "ALL" ? "Mixed" : (secById[sid] || {}).short || sid))} · question ${z.i + 1} of ${z.list.length}</p><div class="prog"><i style="width:${100 * z.i / z.list.length}%"></i></div>
    <div class="card"><h3>${esc(q.title)}${q.marks ? ` <small class="muted">(${q.marks} marks)</small>` : ""}</h3>${q.stem}${body}<div id="qfb"></div></div><p class="src"><b>Source:</b> ${esc(q.source)}</p>`;
};
quizWire = function (sid) {
  const z = QZ; if ($("#qAgain")) { $("#qAgain").onclick = () => { QZ = null; quizStart(qById[sid] ? sid : (sid || "ALL")); render(); }; return; }
  const q = z.list[z.i], next = `<div class="row"><button id="qNext">Next →</button></div>`;
  z.seen = z.seen || {};
  const rec = (ok, got, tot, extra) => {
    S.quiz[q.id] = Object.assign({ ok, got, tot, t: Date.now() }, extra || {});
    if (!z.seen[q.id]) {
      z.seen[q.id] = true;
      if (ok) { z.right++; S.streak = (S.streak || 0) + 1; addXP(5); }
      else { z.missed.push(q); if ((got || 0) > 0) addXP(2); else { S.streak = 0; save(); } }
    } else {
      const i = z.missed.findIndex(x => x.id === q.id);
      if (ok && i >= 0) { z.missed.splice(i, 1); z.right++; }
      save();
    }
  };
  const wireNext = () => { const b = $("#qNext"); if (b) b.onclick = () => { z.i++; render(); }; };
  const model = q.answer_html || "";
  const stem = q.stem || esc(q.title);
  if (q.kind === "mcq") document.querySelectorAll(".choice").forEach(b => b.onclick = () => {
    const k = +b.dataset.k, ok = k === q.answer;
    document.querySelectorAll(".choice").forEach(x => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add("ok"); });
    if (!ok) b.classList.add("no");
    const r = markMCQ({ ok, marks: q.marks || 1, question: stem, picked: "ABCDE"[k] + ". " + stripHTML(q.choices[k]), correct: "ABCDE"[q.answer] + ". " + stripHTML(q.choices[q.answer]), alt: q.alt, modelHtml: model });
    rec(ok, r.got, r.tot, { kind: "mcq", picked: k });
    $("#qfb").innerHTML = r.html + next; wireNext();
  });
  else {
    const run = (manual) => {
      const text = ($("#qa") && $("#qa").value) || "";
      const r = markTyped({ user: text, ideas: q.ideas || [], marks: q.marks || 1, question: stem, alt: q.alt, modelHtml: model, manual });
      rec(r.kind === "full", r.got, r.tot, { kind: "short", text, hits: r.hits });
      $("#qfb").innerHTML = r.html + (text.trim() ? next : "");
      wireNext();
      document.querySelectorAll("#qfb input[data-idea]").forEach(cb => cb.onchange = () => {
        const man = {}; document.querySelectorAll("#qfb input[data-idea]").forEach(x => man[+x.dataset.idea] = x.checked);
        S.quiz[q.id].manual = man; run(man);
      });
    };
    $("#qMark").onclick = () => run(S.quiz[q.id] && S.quiz[q.id].manual);
    if (S.quiz[q.id] && S.quiz[q.id].text && S.quiz[q.id].got != null) {
      // re-show last feedback without scoring again
      const hold = z.seen[q.id]; z.seen[q.id] = true; run(S.quiz[q.id].manual); z.seen[q.id] = hold || true;
    }
  }
};

function mockItemFeedback(it, key, a, m) {
  if (it.k === "q") {
    const q = qById[it.id];
    if (q.kind === "mcq") {
      const picked = a != null ? "ABCDE"[a] + ". " + stripHTML(q.choices[a]) : "(no choice)";
      const r = markMCQ({ ok: a === q.answer, marks: it.marks, question: q.stem, picked, correct: "ABCDE"[q.answer] + ". " + stripHTML(q.choices[q.answer]), alt: q.alt, modelHtml: q.answer_html });
      return r;
    }
    const r = markTyped({ user: a || "", ideas: q.ideas || [], marks: it.marks, question: q.stem, alt: q.alt, modelHtml: q.answer_html, manual: (m.manual || {})[key] });
    return r;
  }
  const e = exById[it.id];
  const codes = Array.isArray(a) ? a : e.files.map(f => f.skeleton);
  const res = runChecks(e, codes);
  const rFake = { codes, marks: {} };
  const out = feedbackAll(e, rFake, res);
  const scale = it.marks && out.tot ? (it.marks / out.tot) : 1;
  return { html: out.html, got: Math.round(out.got * scale * 2) / 2, tot: it.marks, kind: out.all ? "full" : (out.got > 0 ? "part" : "none") };
}

const _mockPage = mockPage, _mockWire = mockWire;
mockPage = function () {
  const html = _mockPage();
  return html;
};
mockWire = function () {
  _mockWire();
  const M = D.mock, m = S.mock;
  if (!m || !m.done) return;
  // auto-mark every item once finished, and inject the rubric under each item
  m.marks = m.marks || {}; m.auto = m.auto || {}; m.manual = m.manual || {};
  document.querySelectorAll(".mockitem").forEach((el, idx) => {
    // find the item by walking sections in order
  });
  let n = 0;
  for (const s of M.sections) {
    s.items.forEach((it, k) => {
      const key = s.id + k, a = m.answers[key];
      const r = mockItemFeedback(it, key, a, m);
      if (m.auto[key] == null) { m.marks[key] = r.got; m.auto[key] = r.got; }
      const box = elFeedbackSlot(n);
      n++;
      if (box) {
        el.querySelectorAll(":scope > details.card").forEach(d => d.remove());
        box.innerHTML = r.html + `<p class="muted">Auto-mark: <b>${fmtM(r.got)}/${fmtM(r.tot)}</b>${m.marks[key] != r.got ? ` · adjusted to ${fmtM(m.marks[key])}` : ""}</p>`;
        box.querySelectorAll("input[data-idea]").forEach(cb => cb.onchange = () => {
          m.manual[key] = m.manual[key] || {};
          box.querySelectorAll("input[data-idea]").forEach(x => m.manual[key][+x.dataset.idea] = x.checked);
          const r2 = mockItemFeedback(it, key, m.answers[key], m);
          m.marks[key] = r2.got; m.auto[key] = r2.got; m.t = Date.now(); save(); render();
        });
      }
    });
  }
  m.t = Date.now(); save();
  const tot = Object.values(m.marks || {}).reduce((x, y) => x + (+y || 0), 0);
  const sum = document.querySelector("b"); // fallback; we add a total banner
  const banner = document.createElement("div"); banner.className = "note"; banner.innerHTML = `<b>Instant mark: ${fmtM(tot)} / 100</b> (auto-marked with the same rubric as the quiz; you can still type a mark in the box to adjust the export).`;
  const h2 = document.querySelector("#main h2"); if (h2 && !document.getElementById("mockAuto")) { banner.id = "mockAuto"; h2.after(banner); }
};

function elFeedbackSlot(n) {
  const items = document.querySelectorAll(".mockitem");
  const el = items[n]; if (!el) return null;
  let slot = el.querySelector(".mockfb");
  if (!slot) { slot = document.createElement("div"); slot.className = "mockfb"; el.appendChild(slot); }
  return slot;
}

/* exercise self-mark: the Check rubric is the mark; auto-done when all TODOs are full */
const _showModel = showModel;
showModel = function () {
  _showModel();
  const wrap = $("#selfmark"); if (!wrap || !cur) return;
  const { e, r } = cur;
  if (r.lastAll && !r.done && !cur.flow) { r.done = true; addXP(r.peeked ? 10 : 25); S.streak = (S.streak || 0) + 1; save(); nav(); }
  if (r.lastMarks) wrap.innerHTML = `<div class="card"><h3>Your mark</h3><p>Instant feedback (from ✔ Check): <b>${esc(r.lastMarks)}</b>. ${r.done ? "✅ Marked done." : "Fix the missing pieces and press Check again."}</p></div>`;
};

const _exWire = exWire;
exWire = function () {
  _exWire();
  const btn = $("#bCheck");
  if (!btn || !cur) return;
  btn.addEventListener("click", () => {
    const { e, r } = cur;
    if (r.lastAll && !r.done && !cur.flow) { r.done = true; addXP(r.peeked ? 10 : 25); S.streak = (S.streak || 0) + 1; save(); nav(); }
    const wrap = $("#selfmark");
    if (wrap && r.lastMarks) wrap.innerHTML = `<div class="card"><h3>Your mark</h3><p>Instant feedback (from ✔ Check): <b>${esc(r.lastMarks)}</b>. ${r.done ? "✅ Marked done." : "Fix the missing pieces and press Check again."}</p></div>`;
  });
};


/* ---------- router ---------- */
function render() {
  const p = (location.hash || "#/").slice(2).split("/");
  nav(); chips();
  let html, wire = null;
  if (!p[0]) html = home();
  else if (p[0] === "plan") html = plan();
  else if (p[0] === "s") html = secPage(p[1], p[2]);
  else if (ROUTES[p[0]]) { const o = ROUTES[p[0]](p); html = o[0]; wire = o[1]; }
  else if (p[0] === "f") { html = exPage(p[1], true); wire = fById[p[1]] ? exWire : null; }
  else if (p[0] === "ex") { html = exPage(p[1]); wire = exById[p[1]] ? exWire : null; }
  else if (p[0] === "quiz") { html = quizPage(p[1] || "ALL"); wire = () => quizWire(p[1] || "ALL"); }
  else if (p[0] === "cards") { html = cardsPage(p[1] || "ALL"); wire = cardsWire; }
  else if (p[0] === "videos") { html = "<h2>My lesson videos</h2>" + lessonVideosHTML(null); wire = vidWire; }
  else if (p[0] === "mock") { html = mockPage(); wire = mockWire; }
  else if (p[0] === "settings") { html = settingsPage(); wire = settingsWire; }
  else html = home();
  main.innerHTML = `<div style="max-width:1000px;margin:0 auto;padding:10px 14px 60px">${html}</div>`;
  if (wire) wire(); else if (p[0] === "s" && (p[2] === "videos" || p[2] === "map")) { vidWire(); reelWire(); }
  document.body.dataset.ready = "1";
}
render();
})();
