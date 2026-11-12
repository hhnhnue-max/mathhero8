// MATH HERO 8 - Chương học (trắc nghiệm / đúng-sai / trả lời ngắn / game) + khu quản lý của giáo viên
import { collection, query, where, onSnapshot, addDoc, getDoc, getDocs, setDoc, deleteField, orderBy, limit, deleteDoc, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
const { db, auth, esc, errText } = window.MH;
const $ = (id) => document.getElementById(id);
const st = () => window.MH.state();
const VIEWS = ["dashboard-view", "quiz-view", "chapter-view", "teacher-view", "progress-view", "notes-view"];
const openView = (id) => { if (!$("sidebar").classList.contains("-translate-x-full")) toggleSidebar(); VIEWS.forEach((v) => $(v).classList.toggle("hidden", v !== id)); scrollTo(0, 0); };
const GROUPS = [["MẠCH ĐẠI SỐ", "fa-square-root-variable", [1, 2, 6, 7]], ["MẠCH HÌNH HỌC", "fa-shapes", [3, 4, 9, 10]], ["THỐNG KÊ & XÁC SUẤT", "fa-chart-column", [5, 8]]];
const TABS = [["mcq", "Trắc nghiệm"], ["tf", "Đúng – Sai"], ["sa", "Trả lời ngắn"], ["game", "Game tương tác"]];
const INP = "w-full border rounded-xl px-3 py-2 text-sm";
let CH = [], cur = { id: 1, tab: "mcq" }, done = new Set(), GAMES = {}, unsubG, unsubT, tTab = "hs";

document.querySelector("main").insertAdjacentHTML("beforeend", `<section id="chapter-view" class="hidden space-y-4"></section><section id="teacher-view" class="hidden space-y-4"></section><section id="progress-view" class="hidden space-y-4"></section><section id="notes-view" class="hidden space-y-4"></section>`);
document.body.insertAdjacentHTML("beforeend", `<div id="game-modal" class="fixed inset-0 z-[70] hidden flex-col bg-slate-900"><div class="flex items-center justify-between p-3 bg-brand-700 text-white"><span id="game-title" class="font-extrabold text-sm"></span><button id="game-close" class="bg-white/20 rounded-xl px-3 py-1 text-sm font-bold">Đóng ✕</button></div><iframe id="game-frame" sandbox="allow-scripts allow-forms allow-popups allow-pointer-lock" class="flex-1 w-full bg-white"></iframe></div>`);
$("btn-auth2").insertAdjacentHTML("afterend", `<button id="btn-notes" class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 text-amber-800 font-extrabold text-sm border border-amber-200"><i class="fa-solid fa-clipboard-list"></i> Dặn dò của cô</button>`);
$("sidebar").querySelector(".space-y-6").insertAdjacentHTML("afterbegin", `<button id="btn-teacher" class="hidden w-full items-center gap-3 px-4 py-3 rounded-2xl bg-amber-400 text-brand-900 font-extrabold text-sm"><i class="fa-solid fa-chalkboard-user"></i> Quản lý của cô</button>`);
const playGame = (title, html) => { $("game-title").textContent = title; $("game-frame").srcdoc = html; $("game-modal").classList.replace("hidden", "flex"); };
$("game-close").onclick = () => { $("game-modal").classList.replace("flex", "hidden"); $("game-frame").srcdoc = ""; };

// ---------- Menu chương ----------
const norm = (c) => { c.mcq.forEach((q, i) => (q.id ||= `m${i + 1}`)); c.tf.forEach((q, i) => (q.id ||= `t${i + 1}`)); c.sa.forEach((q, i) => (q.id ||= `s${i + 1}`)); return c; };
const loadQ = () => (loadQ.p ||= fetch("./questions.json?v=1").then((r) => r.json()).then((j) => (CH = j.chapters.map(norm))));
loadQ().then(() => {
  $("chap-list").innerHTML = GROUPS.map(([t, ic, ids]) => `<div class="mb-3"><div class="px-3 py-2 text-xs font-extrabold text-brand-700 bg-rose-50/80 rounded-xl mb-1"><i class="fa-solid ${ic} mr-1"></i>${t}</div>
    <div class="space-y-1 pl-2">${ids.map((i) => `<button data-ch="${i}" class="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl">Chương ${i}: ${esc(CH[i - 1].title)}</button>`).join("")}</div></div>`).join("");
  $("chap-list").onclick = (e) => { const b = e.target.closest("[data-ch]"); if (b) openChapter(+b.dataset.ch); };
});
async function openChapter(id) {
  if (!st().me) { if (!$("sidebar").classList.contains("-translate-x-full")) toggleSidebar(); return window.MH.openAuth("login"); }
  await loadQ();
  try { const p = await getDoc(doc(db, "qpub", String(id))); if (p.exists()) CH[id - 1] = norm({ ...CH[id - 1], ...p.data(), id }); } catch (e) {}
  cur = { id, tab: "mcq" }; done = new Set(st().prof.done || []); initState(); openView("chapter-view"); renderChapter();
  const now = Date.now(); updateDoc(doc(db, "users", st().me.uid), { lastCh: id, lastAt: now, [`seen.${id}`]: now }).catch(() => {});
}

// ---------- Màn hình một chương: làm bài -> Nộp bài -> chấm điểm ----------
const TFP = [0, 0.1, 0.25, 0.5, 1];  // đúng 0/1/2/3/4 ý (với câu 1 điểm)
let DRAFT = {}, RES = null, A = { m: {}, t: {}, s: {} }, gain = 0;
const emptyA = () => ({ m: {}, t: {}, s: {} });
const f = (n) => (Math.round(n * 100) / 100).toLocaleString("vi-VN");
const num = (s) => { s = String(s).replace(/[−–]/g, "-").replace(/\s/g, "").replace(",", "."); const m = s.match(/^(-?[\d.]+)\/([\d.]+)$/); return m ? +m[1] / +m[2] : Number(s); };
const same = (a, b) => { if (!String(a).trim()) return false; const x = num(a), y = num(b); return isFinite(x) && isFinite(y) ? Math.abs(x - y) < 1e-9 : String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); };
function initState() { const r = st().prof.res?.[cur.id]; gain = 0; if (r) { RES = r; A = { m: r.a?.m || {}, t: r.a?.t || {}, s: r.a?.s || {} }; } else { RES = null; A = DRAFT[cur.id] ||= emptyA(); } }
const maxOf = (ch) => [ch.mcq.length ? 3 : 0, ch.tf.length ? 4 : 0, 0.5 * ch.sa.length];
const wM = (ch) => (ch.mcq.length ? 3 / ch.mcq.length : 0), wT = (ch) => (ch.tf.length ? 4 / ch.tf.length : 0);
const tfRight = (q) => q.items.filter((it, j) => (A.t[q.id] || [])[j] === it.ans).length;
function grade(ch) {
  const p = [0, 0, 0], keys = [];
  ch.mcq.forEach((q) => { if (A.m[q.id] === q.ans) { p[0] += wM(ch); keys.push([`c${ch.id}${q.id}`, 10]); } });
  ch.tf.forEach((q) => { const v = A.t[q.id] || []; q.items.forEach((it, j) => { if (v[j] === it.ans) keys.push([`c${ch.id}${q.id}${"abcd"[j]}`, 5]); }); p[1] += wT(ch) * TFP[Math.min(tfRight(q), 4)]; });
  ch.sa.forEach((q) => { if (same(A.s[q.id] ?? "", q.ans)) { p[2] += 0.5; keys.push([`c${ch.id}${q.id}`, 20]); } });
  const max = maxOf(ch), r = (x) => Math.round(x * 100) / 100;
  return { keys, sc: { p: p.map(r), max: max.map(r), tot: r(p[0] + p[1] + p[2]), maxTot: r(max[0] + max[1] + max[2]) } };
}
const counts = (ch) => ({ mcq: { a: ch.mcq.filter((q) => A.m[q.id] != null).length, n: ch.mcq.length },
  tf: { a: ch.tf.reduce((s, q) => s + (A.t[q.id] || []).filter((v) => v != null).length, 0), n: ch.tf.reduce((s, q) => s + q.items.length, 0) },
  sa: { a: ch.sa.filter((q) => String(A.s[q.id] ?? "").trim()).length, n: ch.sa.length } });
const tabsHTML = (ch) => { const c = counts(ch); return TABS.map(([k, l]) => `<button data-act="tab" data-t="${k}" class="px-4 py-2 rounded-xl text-sm font-extrabold ${k === cur.tab ? "bg-brand-600 text-white" : "bg-white border border-slate-200 text-slate-600"}">${l}${k !== "game" && !RES ? ` <span class="text-[10px] opacity-80">${c[k].a}/${c[k].n}</span>` : ""}</button>`).join(""); };
const barHTML = (ch) => { if (cur.tab === "game") return ""; if (RES) return `<span class="text-xs text-slate-500">Kết quả đã được lưu.</span><button data-act="redo" class="bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Làm lại (xoá kết quả cũ)</button>`;
  const c = counts(ch), a = c.mcq.a + c.tf.a + c.sa.a, n = c.mcq.n + c.tf.n + c.sa.n;
  return `<span class="text-xs font-bold text-slate-600">Đã trả lời ${a}/${n}</span><button data-act="submit" class="bg-brand-600 text-white font-extrabold rounded-xl px-5 py-2 text-sm">Nộp bài</button>`; };
const refreshBar = () => { const ch = CH[cur.id - 1]; $("tabs").innerHTML = tabsHTML(ch); if ($("bar")) $("bar").innerHTML = barHTML(ch); };
const resultHTML = () => { const r = RES.sc, nm = ["Phần I · Trắc nghiệm", "Phần II · Đúng – Sai", "Phần III · Trả lời ngắn"];
  return `<div class="bg-gradient-to-br from-brand-700 to-brand-600 text-white rounded-3xl p-5"><div class="text-xs font-bold opacity-80">Kết quả đã nộp ${new Date(RES.at).toLocaleString("vi-VN")}${gain ? ` · <span class="text-yellow-300">+${gain} XP</span>` : ""}</div>
   <div class="text-3xl font-black">${f(r.tot)} / ${f(r.maxTot)} điểm</div><div class="grid grid-cols-3 gap-2 mt-3 text-center text-[11px]">${nm.map((t, k) => `<div class="bg-white/15 rounded-xl p-2"><div class="opacity-80">${t}</div><div class="font-black text-base">${f(r.p[k])}/${f(r.max[k])}</div></div>`).join("")}</div></div>`; };
function renderChapter() {
  unsubG?.(); const ch = CH[cur.id - 1], body = { mcq: mcqHTML, tf: tfHTML, sa: saHTML, game: () => `<div id="game-list" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>` }[cur.tab](ch), bar = barHTML(ch);
  $("chapter-view").innerHTML = `<div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700">Chương ${ch.id}: ${esc(ch.title)}</h2><button onclick="goHome()" class="text-sm font-bold text-slate-500"><i class="fa-solid fa-house mr-1"></i>Trang chủ</button></div>
   <div id="tabs" class="flex gap-2 flex-wrap">${tabsHTML(ch)}</div>${RES && cur.tab !== "game" ? resultHTML() : ""}<div class="space-y-3">${body}</div>
   ${bar ? `<div id="bar" class="sticky bottom-0 bg-white/95 border-t p-3 flex items-center justify-between rounded-t-2xl">${bar}</div>` : ""}`;
  if (cur.tab === "game") listenGames(ch.id);
}
const card = (inner, id) => `<div ${id ? `id="${id}"` : ""} class="bg-white border border-slate-200 rounded-2xl p-4">${inner}</div>`;
const EMPTY = `<p class="text-sm text-slate-500">Chương này chưa có câu hỏi dạng này.</p>`;
const optCls = (sel, right, wrong, sm) => "border rounded-xl " + (sm ? "px-4 py-1 text-xs font-bold " : "text-left px-3 py-2 text-sm ") + (right ? "bg-green-100 border-green-500" : wrong ? "bg-red-100 border-red-500" : sel ? "bg-blue-50 border-blue-500 text-blue-800 font-bold ring-2 ring-blue-200" : "border-slate-200 hover:bg-slate-50");
const note = (ok, pts, exp) => `<div class="text-xs mt-2">${ok ? "✅ Đúng" : "❌ Chưa đúng"} <b class="text-brand-700">(+${f(pts)} điểm)</b>${exp ? `<div class="text-slate-600 mt-1">${esc(exp)}</div>` : ""}</div>`;
const mcqHTML = (ch) => ch.mcq.map((q, k) => { const sel = A.m[q.id]; return card(`<div class="font-bold text-sm mb-2">Câu ${k + 1}. ${esc(q.q)}</div>
  <div class="grid sm:grid-cols-2 gap-2">${q.opts.map((o, i) => `<button data-act="mc" data-id="${q.id}" data-i="${i}" ${RES ? "disabled" : ""} class="${optCls(sel === i, RES && i === q.ans, RES && sel === i && i !== q.ans)}">${"ABCD"[i]}. ${esc(o)}</button>`).join("")}</div>
  ${RES ? (sel == null ? `<div class="text-xs mt-2">⚪ Chưa trả lời. Đáp án đúng: <b>${"ABCD"[q.ans]}</b>${q.exp ? `<div class="text-slate-600 mt-1">${esc(q.exp)}</div>` : ""}</div>` : note(sel === q.ans, sel === q.ans ? wM(ch) : 0, q.exp)) : ""}`, `q-${q.id}`); }).join("") || EMPTY;
const tfHTML = (ch) => ch.tf.map((q, k) => { const v = A.t[q.id] || [];
  return card(`<div class="font-bold text-sm mb-2">Câu ${k + 1}. ${esc(q.q)}</div>${q.items.map((it, j) => `<div id="q-${q.id}-${j}" class="border-t py-2"><div class="text-sm">${"abcd"[j]}) ${esc(it.t)}</div>
   <div class="flex gap-2 mt-1">${[1, 0].map((x) => { const val = !!x; return `<button data-act="tf" data-id="${q.id}" data-j="${j}" data-v="${x}" ${RES ? "disabled" : ""} class="${optCls(v[j] === val, RES && it.ans === val, RES && v[j] === val && it.ans !== val, 1)}">${x ? "Đúng" : "Sai"}</button>`; }).join("")}</div>
   ${RES && it.exp ? `<div class="text-xs text-slate-600 mt-1">${esc(it.exp)}</div>` : ""}</div>`).join("")}
   ${RES ? `<div class="text-xs mt-2 font-bold text-brand-700">Đúng ${tfRight(q)}/${q.items.length} ý → +${f(wT(ch) * TFP[Math.min(tfRight(q), 4)])} điểm</div>` : ""}`); }).join("") || EMPTY;
const saHTML = (ch) => ch.sa.map((q, k) => { const v = A.s[q.id] ?? "", ok = RES && same(v, q.ans);
  return card(`<div class="font-bold text-sm mb-2">Câu ${k + 1}. ${esc(q.q)}</div><input data-act="sain" data-id="${q.id}" value="${esc(v)}" ${RES ? "disabled" : ""} placeholder="Đáp số (vd: 2,5 hoặc 1/2)" class="${INP} max-w-[220px] ${RES ? (ok ? "bg-green-50" : "bg-red-50") : ""}">
   ${RES ? `<div class="text-xs mt-2">${ok ? "✅ Đúng" : `❌ Chưa đúng. Đáp số: <b>${esc(q.ans)}</b>`} <b class="text-brand-700">(+${f(ok ? 0.5 : 0)} điểm)</b>${q.exp ? `<div class="text-slate-600 mt-1">${esc(q.exp)}</div>` : ""}</div>` : ""}`); }).join("") || EMPTY;

async function submit() {
  const ch = CH[cur.id - 1], c = counts(ch), left = c.mcq.n - c.mcq.a + c.tf.n - c.tf.a + c.sa.n - c.sa.a;
  if (left && !confirm(`Còn ${left} câu/ý chưa trả lời. Em vẫn muốn nộp bài?`)) return;
  const g = grade(ch), now = Date.now(), fresh = g.keys.filter(([k]) => !done.has(k)); fresh.forEach(([k]) => done.add(k));
  RES = JSON.parse(JSON.stringify({ a: A, sc: g.sc, at: now })); DRAFT[ch.id] = null;
  const upd = { [`res.${ch.id}`]: RES, lastCh: ch.id, lastAt: now, [`seen.${ch.id}`]: now }; if (fresh.length) upd.done = arrayUnion(...fresh.map((x) => x[0]));
  try { await updateDoc(doc(db, "users", st().me.uid), upd); } catch (e) { alert("Chưa lưu được kết quả lên hệ thống: " + errText(e)); }
  gain = fresh.reduce((s, x) => s + x[1], 0); if (gain) window.MH.addXP(gain);
  cur.tab = "mcq"; renderChapter(); scrollTo(0, 0);
}
async function redo() {
  if (!confirm("Làm lại sẽ XOÁ kết quả đã lưu của chương này. Em muốn làm lại?")) return;
  RES = null; gain = 0; A = DRAFT[cur.id] = emptyA(); cur.tab = "mcq"; renderChapter(); scrollTo(0, 0);
  try { await updateDoc(doc(db, "users", st().me.uid), { [`res.${cur.id}`]: deleteField() }); } catch (e) {}
}
$("chapter-view").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act, ch = CH[cur.id - 1], qid = b.dataset.id;
  if (a === "tab") { cur.tab = b.dataset.t; renderChapter(); }
  else if (a === "submit") submit(); else if (a === "redo") redo();
  else if (a === "mc" && !RES) { A.m[qid] = +b.dataset.i; $(`q-${qid}`).querySelectorAll("button").forEach((x, k) => (x.className = optCls(k === A.m[qid]))); refreshBar(); }
  else if (a === "tf" && !RES) { const q = ch.tf.find((x) => x.id === qid), j = +b.dataset.j; (A.t[qid] ||= q.items.map(() => null))[j] = b.dataset.v === "1";
    $(`q-${qid}-${j}`).querySelectorAll("button").forEach((x) => (x.className = optCls(A.t[qid][j] === (x.dataset.v === "1"), 0, 0, 1))); refreshBar(); }
  else if (a === "play") playOf(GAMES[qid], qid);
});
$("chapter-view").addEventListener("input", (e) => { if (e.target.dataset.act === "sain" && !RES) { A.s[e.target.dataset.id] = e.target.value; refreshBar(); } });
const thumb = (g) => (typeof g.thumb === "string" && g.thumb.startsWith("data:image/jpeg;base64,") ? `<img src="${g.thumb}" class="w-full h-full object-cover">` : `<span class="text-5xl">🎮</span>`);
function listenGames(id) {
  unsubG = onSnapshot(query(collection(db, "games"), where("ch", "==", id)), (s) => {
    const list = $("game-list"); if (!list) return; GAMES = {}; s.docs.forEach((d) => (GAMES[d.id] = d.data()));
    list.innerHTML = s.docs.map((d) => `<button data-act="play" data-id="${d.id}" class="text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition"><div class="aspect-video bg-gradient-to-br from-brand-100 to-amber-100 flex items-center justify-center">${thumb(d.data())}</div><div class="p-3 font-bold text-sm">🎮 ${esc(d.data().title)}</div></button>`).join("") || `<p class="text-sm text-slate-500">Cô chưa đăng game cho chương này.</p>`;
  });
}

// ---------- Khu quản lý của giáo viên ----------
const dl = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv" })); a.download = name; a.click(); };
function renderTeacher() {
  unsubT?.(); if (st().role !== "teacher") return;
  $("teacher-view").innerHTML = `<div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700"><i class="fa-solid fa-chalkboard-user mr-2"></i>Quản lý của cô</h2><button onclick="goHome()" class="text-sm font-bold text-slate-500">Trang chủ</button></div>
   <div class="flex gap-2">${[["hs", "Tài khoản học sinh"], ["qb", "Ngân hàng câu hỏi"], ["gm", "Game theo chương"]].map(([k, l]) => `<button data-t="${k}" class="px-4 py-2 rounded-xl text-sm font-extrabold ${k === tTab ? "bg-brand-600 text-white" : "bg-white border border-slate-200 text-slate-600"}">${l}</button>`).join("")}</div><div id="t-body"></div>`;
  $("teacher-view").querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { tTab = b.dataset.t; renderTeacher(); }));
  if (tTab === "hs") teacherStudents(); else if (tTab === "gm") teacherGames(); else import("./editor.js?v=1").then((m) => m.mount($("t-body"), { CH, norm, db, esc }));
}
function teacherStudents() {
  $("t-body").innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 mb-3">🔒 Mật khẩu của HS được Firebase mã hoá nên <b>không ai xem được</b> (kể cả cô). Khi em quên mật khẩu, bấm <b>Gửi mail đặt lại</b>: em nhận email và tự đặt mật khẩu mới.</div>
   <div class="flex gap-2 mb-2"><input id="t-q" placeholder="Tìm theo tên, lớp, trường, email..." class="${INP}"><button id="t-csv" class="bg-brand-600 text-white font-bold rounded-xl px-4 text-sm whitespace-nowrap">Xuất Excel (CSV)</button></div>
   <div class="overflow-x-auto bg-white border border-slate-200 rounded-2xl"><table class="w-full text-xs"><thead class="bg-slate-50 text-slate-500"><tr><th class="p-2 text-left">Họ và tên</th><th class="p-2">Lớp</th><th class="p-2 text-left">Trường</th><th class="p-2 text-left">Email</th><th class="p-2">XP</th><th class="p-2">Đã làm</th><th class="p-2">Bài đã nộp</th><th class="p-2"></th></tr></thead><tbody id="t-rows"></tbody></table></div>`;
  let rows = [], draw = () => { const f = $("t-q").value.toLowerCase();
    $("t-rows").innerHTML = rows.filter((u) => [u.name, u.cls, u.school, u.email].join(" ").toLowerCase().includes(f)).map((u) => `<tr class="border-t"><td class="p-2 font-bold"><img src="${esc(window.MH.okAvatar(u.avatar))}" class="w-6 h-6 rounded-full inline mr-1">${esc(u.name)}</td><td class="p-2 text-center">${esc(u.cls)}</td><td class="p-2">${esc(u.school)}</td><td class="p-2">${esc(u.email)}</td><td class="p-2 text-center font-bold">${u.xp || 0}</td><td class="p-2 text-center">${(u.done || []).length}</td><td class="p-2 text-center">${(() => { const r = Object.values(u.res || {}); return r.length ? r.length + " bài · TB " + f((r.reduce((a, x) => a + (x.sc.maxTot ? (x.sc.tot / x.sc.maxTot) * 10 : 0), 0)) / r.length) + "/10" : "—"; })()}</td><td class="p-2"><button data-mail="${esc(u.email)}" class="border rounded-lg px-2 py-1 whitespace-nowrap">Gửi mail đặt lại</button></td></tr>`).join("") || `<tr><td class="p-3 text-slate-500" colspan="8">Chưa có học sinh nào.</td></tr>`; };
  unsubT = onSnapshot(collection(db, "users"), (s) => { rows = s.docs.map((d) => d.data()).filter((u) => u.role !== "teacher" && (u.email || "").toLowerCase() !== "hhn.hnue@gmail.com").sort((a, b) => (a.cls || "").localeCompare(b.cls || "") || (a.name || "").localeCompare(b.name || "")); draw(); });
  $("t-q").oninput = draw;
  $("t-rows").onclick = (e) => { const m = e.target.dataset.mail; if (m) sendPasswordResetEmail(auth, m).then(() => alert("Đã gửi yêu cầu tới " + m + ". Nhắc em kiểm tra cả mục Thư rác (Spam); thư có thể đến chậm vài phút.")).catch((x) => alert(errText(x))); };
  $("t-csv").onclick = () => dl("hoc-sinh-math-hero-8.csv", "Họ và tên,Lớp,Trường,Email,XP\n" + rows.map((u) => [u.name, u.cls, u.school, u.email, u.xp || 0].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"));
}
const thumbOf = (f) => new Promise((ok) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = 480; c.height = 270; const r = Math.max(480 / img.width, 270 / img.height), w = img.width * r, h = img.height * r;
  c.getContext("2d").drawImage(img, (480 - w) / 2, (270 - h) / 2, w, h); ok(c.toDataURL("image/jpeg", 0.7)); }; img.src = URL.createObjectURL(f); });
function teacherGames() {
  let editG = null, newThumb = null;
  $("t-body").innerHTML = `<div class="bg-white border border-brand-200 rounded-2xl p-4 space-y-2 mb-3"><div id="tg-head" class="font-extrabold text-sm text-brand-700">Thêm game tương tác</div>
   <select id="tg-ch" class="${INP}">${CH.map((c) => `<option value="${c.id}">Chương ${c.id}: ${esc(c.title)}</option>`).join("")}</select>
   <input id="tg-title" placeholder="Tên game" class="${INP}">
   <input id="tg-url" placeholder="Dán link game (https://...)" class="${INP}">
   <label class="block text-xs font-bold text-slate-600">Ảnh minh hoạ: HS bấm vào ảnh này để vào game <input id="tg-img" type="file" accept="image/*" class="block mt-1 text-xs"></label><img id="tg-prev" class="hidden w-48 rounded-xl border">
   <label class="block text-xs font-bold text-slate-600">Hoặc tải file game .html (nếu không có link) <input id="tg-file" type="file" accept=".html,.htm" class="block mt-1 text-xs"></label>
   <p id="tg-msg" class="text-xs font-bold text-red-600 min-h-[1rem]"></p><div class="flex gap-2"><button id="tg-add" class="bg-brand-600 text-white font-bold rounded-xl px-4 py-2 text-sm">Đăng game</button><button id="tg-cancel" class="hidden bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Huỷ sửa</button></div></div><div id="tg-list" class="space-y-2"></div>`;
  const reset = () => { editG = null; newThumb = null; ["tg-title", "tg-url", "tg-file", "tg-img"].forEach((i) => ($(i).value = "")); $("tg-prev").classList.add("hidden"); $("tg-head").textContent = "Thêm game tương tác"; $("tg-add").textContent = "Đăng game"; $("tg-cancel").classList.add("hidden"); };
  $("tg-cancel").onclick = reset;
  $("tg-img").onchange = async (e) => { if (!e.target.files[0]) return; newThumb = await thumbOf(e.target.files[0]); $("tg-prev").src = newThumb; $("tg-prev").classList.remove("hidden"); };
  $("tg-add").onclick = async () => {
    const m = $("tg-msg"), title = $("tg-title").value.trim(), url = $("tg-url").value.trim(), f = $("tg-file").files[0]; m.className = "text-xs font-bold text-red-600"; m.textContent = "";
    if (!title) return (m.textContent = "Nhập tên game."); const data = { ch: +$("tg-ch").value, title }; if (newThumb) data.thumb = newThumb;
    let html = null; if (f) { html = await f.text(); if (new Blob([html]).size > 950000) return (m.textContent = "File quá lớn (tối đa ~900KB). Hãy dùng link."); Object.assign(data, { kind: "html" }); }
    else if (/^https:\/\//.test(url)) Object.assign(data, { kind: "link", url }); else if (!editG) return (m.textContent = "Dán link bắt đầu bằng https:// hoặc chọn file .html.");
    else if (url) return (m.textContent = "Link phải bắt đầu bằng https://");
    try { let gid = editG; if (editG) await updateDoc(doc(db, "games", editG), data); else gid = (await addDoc(collection(db, "games"), { ...data, createdAt: Date.now() })).id;
      if (html != null) await setDoc(doc(db, "gamehtml", gid), { html });
      reset(); m.className = "text-xs font-bold text-green-700"; m.textContent = "Đã lưu. HS thấy ngay trong chương."; } catch (e) { m.textContent = errText(e); }
  };
  unsubT = onSnapshot(collection(db, "games"), (s) => {
    GAMES = {}; s.docs.forEach((d) => (GAMES[d.id] = d.data()));
    $("tg-list").innerHTML = s.docs.sort((a, b) => a.data().ch - b.data().ch || a.data().createdAt - b.data().createdAt).map((d) => { const g = d.data(); return `<div class="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 text-sm"><div class="w-24 aspect-video rounded-lg overflow-hidden bg-brand-50 flex items-center justify-center shrink-0">${thumb(g)}</div><div class="flex-1 min-w-0"><span class="text-[10px] font-extrabold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5">Chương ${g.ch}</span><div class="font-bold truncate">${esc(g.title)} <i class="text-slate-400 text-xs">${g.kind === "html" ? "HTML" : "Link"}</i></div></div><button data-p="${d.id}" class="text-xs border rounded-lg px-2 py-1">Xem thử</button><button data-e="${d.id}" class="text-xs border rounded-lg px-2 py-1">Sửa</button><button data-d="${d.id}" class="text-xs border rounded-lg px-2 py-1 text-red-600">Xoá</button></div>`; }).join("") || `<p class="text-sm text-slate-500">Chưa có game nào.</p>`;
  });
  $("tg-list").onclick = (e) => { const p = e.target.dataset.p, d = e.target.dataset.d, ed = e.target.dataset.e;
    if (p) playOf(GAMES[p], p);
    if (d && confirm("Xoá game này?")) { deleteDoc(doc(db, "games", d)); deleteDoc(doc(db, "gamehtml", d)).catch(() => {}); }
    if (ed) { const g = GAMES[ed]; reset(); editG = ed; $("tg-ch").value = g.ch; $("tg-title").value = g.title; $("tg-url").value = g.kind === "link" ? g.url : ""; $("tg-head").textContent = "Sửa game (chọn ảnh/link/file mới nếu muốn đổi)"; $("tg-add").textContent = "Lưu thay đổi"; $("tg-cancel").classList.remove("hidden"); scrollTo(0, 0); } };
}
$("btn-teacher").onclick = async () => { await loadQ(); openView("teacher-view"); renderTeacher(); };


// ---------- Mở game (HTML lưu riêng để trang chủ tải nhẹ) ----------
async function playOf(g, id) {
  if (g.kind === "link") return open(g.url, "_blank", "noopener");
  let html = g.html; if (!html) { try { html = (await getDoc(doc(db, "gamehtml", id))).data().html; } catch (e) { return alert("Chưa tải được game, em thử lại nhé."); } }
  playGame(g.title, html);
}
// ---------- Game ngoài trang chủ ----------
let dgUid, unsubD, DG = {};
function dashGames() {
  unsubD?.(); const box = $("dash-games-list");
  if (!st().me) { box.innerHTML = `<button id="dg-login" class="col-span-full bg-white border border-dashed border-brand-300 rounded-2xl p-5 text-sm font-bold text-brand-700">Đăng nhập để xem và chơi các game cô đã đăng →</button>`; return; }
  unsubD = onSnapshot(query(collection(db, "games"), orderBy("createdAt", "desc"), limit(8)), (s) => {
    DG = {}; s.docs.forEach((d) => (DG[d.id] = d.data()));
    box.innerHTML = s.docs.map((d) => `<button data-dg="${d.id}" class="text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition"><div class="aspect-video bg-gradient-to-br from-brand-100 to-amber-100 flex items-center justify-center">${thumb(d.data())}</div><div class="p-3"><div class="text-[10px] font-extrabold text-brand-600">Chương ${d.data().ch}</div><div class="font-bold text-sm">${esc(d.data().title)}</div></div></button>`).join("") || `<p class="text-sm text-slate-500 col-span-full">Cô chưa đăng game nào.</p>`;
  }, () => (box.innerHTML = `<p class="text-sm text-slate-500 col-span-full">Chưa tải được game.</p>`));
}
$("dash-games-list").onclick = (e) => { if (e.target.closest("#dg-login")) return window.MH.openAuth("login"); const b = e.target.closest("[data-dg]"); if (b) playOf(DG[b.dataset.dg], b.dataset.dg); };

// ---------- Dặn dò của cô ----------
let NOTES = [], editN = null;
const fmt = (t) => new Date(t).toLocaleDateString("vi-VN");
function renderNoteCard() { const n = NOTES[0];
  $("note-title").textContent = n?.title || "Dặn dò của Cô Hải"; $("note-date").textContent = n ? fmt(n.createdAt) : "";
  $("note-text").textContent = n ? (n.text.length > 320 ? n.text.slice(0, 320) + "…" : n.text) : "Cô chưa có dặn dò mới. Các em ôn tập chăm chỉ nhé!"; }
function renderNotes() {
  const T = st().role === "teacher", keep = !editN && $("nt-text") ? { t: $("nt-title").value, x: $("nt-text").value } : null, en = editN && NOTES.find((n) => n.id === editN);
  $("notes-view").innerHTML = `<div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700"><i class="fa-solid fa-clipboard-list mr-2"></i>Dặn dò của cô</h2><button onclick="goHome()" class="text-sm font-bold text-slate-500">Trang chủ</button></div>
   ${T ? `<div class="bg-white border border-brand-200 rounded-2xl p-4 space-y-2"><div class="font-extrabold text-sm text-brand-700">${en ? "Sửa dặn dò" : "Soạn dặn dò mới (BTVN, nhắc nhở...)"}</div>
    <input id="nt-title" placeholder="Tiêu đề (vd: BTVN ngày 12/11)" value="${esc(en ? en.title : keep?.t || "")}" class="${INP}"><textarea id="nt-text" rows="5" placeholder="Nội dung dặn dò..." class="${INP}">${esc(en ? en.text : keep?.x || "")}</textarea>
    <p id="nt-msg" class="text-xs font-bold text-red-600 min-h-[1rem]"></p><div class="flex gap-2"><button id="nt-save" class="bg-brand-600 text-white font-bold rounded-xl px-4 py-2 text-sm">${en ? "Lưu thay đổi" : "Đăng dặn dò"}</button>${en ? `<button id="nt-cancel" class="bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Huỷ sửa</button>` : ""}</div></div>` : ""}
   <div class="space-y-3">${NOTES.map((n) => `<div class="bg-white border border-slate-200 rounded-2xl p-4"><div class="flex items-start justify-between gap-2"><div><div class="text-[11px] text-slate-400 font-bold">${fmt(n.createdAt)}</div><div class="font-extrabold text-brand-700">${esc(n.title || "Dặn dò")}</div></div>
    ${T ? `<div class="flex gap-1"><button data-ne="${n.id}" class="text-xs border rounded-lg px-2 py-1">Sửa</button><button data-nd="${n.id}" class="text-xs border rounded-lg px-2 py-1 text-red-600">Xoá</button></div>` : ""}</div><p class="text-sm mt-2 whitespace-pre-line">${esc(n.text)}</p></div>`).join("") || `<p class="text-sm text-slate-500">Cô chưa đăng dặn dò nào.</p>`}</div>`;
}
$("notes-view").addEventListener("click", async (e) => {
  const t = e.target, id = t.id, ne = t.dataset.ne, nd = t.dataset.nd;
  if (id === "nt-save") { const title = $("nt-title").value.trim(), text = $("nt-text").value.trim(); if (!text) return ($("nt-msg").textContent = "Nhập nội dung dặn dò.");
    try { if (editN) await updateDoc(doc(db, "notes", editN), { title, text, updatedAt: Date.now() }); else await addDoc(collection(db, "notes"), { title, text, createdAt: Date.now() }); editN = null; renderNotes(); } catch (x) { $("nt-msg").textContent = errText(x); } }
  if (id === "nt-cancel") { editN = null; renderNotes(); }
  if (ne) { editN = ne; renderNotes(); scrollTo(0, 0); }
  if (nd && confirm("Xoá dặn dò này?")) deleteDoc(doc(db, "notes", nd));
});
onSnapshot(query(collection(db, "notes"), orderBy("createdAt", "desc")), (s) => { NOTES = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderNoteCard(); if (!$("notes-view").classList.contains("hidden")) renderNotes(); }, () => {});
const openNotes = () => { editN = null; openView("notes-view"); renderNotes(); };
$("btn-notes").onclick = openNotes; window.addEventListener("mh-notes", openNotes);

// ---------- Bài học của em (tiến độ) ----------
const validKeys = (c) => ({ m: c.mcq.map((q) => `c${c.id}${q.id}`), t: c.tf.flatMap((q) => [..."abcd"].map((l) => `c${c.id}${q.id}${l}`)), s: c.sa.map((q) => `c${c.id}${q.id}`) });
const bar = (p, cls = "bg-brand-500") => `<div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full ${cls}" style="width:${p}%"></div></div>`;
async function openProgress() {
  if (!st().me) return window.MH.openAuth("login");
  await loadQ(); openView("progress-view"); $("progress-view").innerHTML = `<p class="text-sm text-slate-500">Đang tải bài học của em...</p>`;
  try { (await getDocs(collection(db, "qpub"))).forEach((p) => { const id = +p.id; CH[id - 1] = norm({ ...CH[id - 1], ...p.data(), id }); }); } catch (e) {}
  const { prof } = st(), dn = new Set(prof.done || []), seen = prof.seen || {};
  const rows = CH.map((c) => { const v = validKeys(c), n = { m: v.m.filter((k) => dn.has(k)).length, t: v.t.filter((k) => dn.has(k)).length, s: v.s.filter((k) => dn.has(k)).length };
    const t = { m: v.m.length, t: v.t.length, s: v.s.length }, sum = n.m + n.t + n.s, all = t.m + t.t + t.s; return { c, n, t, sum, all, pct: all ? Math.round((100 * sum) / all) : 0, at: seen[c.id] || 0, res: (prof.res || {})[c.id] }; });
  const tot = rows.reduce((a, r) => a + r.sum, 0), allQ = rows.reduce((a, r) => a + r.all, 0), pctAll = allQ ? Math.round((100 * tot) / allQ) : 0;
  const cardP = (r) => `<div class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2"><div class="flex items-start justify-between gap-2"><div class="font-bold text-sm">Chương ${r.c.id}: ${esc(r.c.title)}</div><span class="text-xs font-black ${r.pct === 100 ? "text-green-600" : "text-brand-600"}">${r.pct}%</span></div>${bar(r.pct, r.pct === 100 ? "bg-green-500" : "bg-brand-500")}
    <div class="text-[11px] text-slate-500">Trắc nghiệm ${r.n.m}/${r.t.m} · Đúng–Sai ${r.n.t}/${r.t.t} · Trả lời ngắn ${r.n.s}/${r.t.s}</div>
    ${r.res ? `<div class="text-[11px] font-bold text-brand-700">Điểm đã nộp: ${f(r.res.sc.tot)}/${f(r.res.sc.maxTot)}</div>` : ""}<div class="flex items-center justify-between"><span class="text-[10px] text-slate-400">${r.at ? "Lần cuối: " + new Date(r.at).toLocaleDateString("vi-VN") : ""}</span><button data-go="${r.c.id}" class="bg-brand-600 text-white text-xs font-bold rounded-xl px-3 py-1.5">${r.pct === 100 ? "Ôn lại" : r.at || r.pct ? "Tiếp tục" : "Bắt đầu"}</button></div></div>`;
  const doing = rows.filter((r) => r.pct < 100 && (r.pct > 0 || r.at)).sort((a, b) => b.at - a.at), fin = rows.filter((r) => r.pct === 100), fresh = rows.filter((r) => r.pct === 0 && !r.at);
  const sec = (t, a) => (a.length ? `<h3 class="font-extrabold text-slate-700 mt-2">${t} (${a.length})</h3><div class="grid sm:grid-cols-2 gap-3">${a.map(cardP).join("")}</div>` : "");
  const last = rows[(prof.lastCh || 0) - 1];
  $("progress-view").innerHTML = `<div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700"><i class="fa-solid fa-book-open mr-2"></i>Bài học của em</h2><button onclick="goHome()" class="text-sm font-bold text-slate-500">Trang chủ</button></div>
   <div class="bg-gradient-to-br from-brand-700 to-brand-600 text-white rounded-3xl p-5"><div class="text-xs font-bold opacity-80">Hoàn thành chung</div><div class="text-3xl font-black">${pctAll}%</div><div class="h-2 rounded-full bg-white/25 overflow-hidden mt-2"><div class="h-full bg-yellow-300" style="width:${pctAll}%"></div></div>
   ${last ? `<div class="mt-3 text-sm">Em đang học gần đây: <b>Chương ${last.c.id}: ${esc(last.c.title)}</b> (${last.pct}%)</div><button data-go="${last.c.id}" class="mt-2 bg-white text-brand-700 font-extrabold text-sm rounded-xl px-4 py-2">Tiếp tục học →</button>` : `<div class="mt-3 text-sm">Em chưa bắt đầu chương nào. Chọn một chương bên dưới nhé!</div>`}</div>
   <div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"><div class="font-extrabold text-sm text-slate-700">Hoàn thành theo chủ đề</div>${GROUPS.map(([t, , ids]) => { const g = rows.filter((r) => ids.includes(r.c.id)), a = g.reduce((x, r) => x + r.sum, 0), b = g.reduce((x, r) => x + r.all, 0), p = b ? Math.round((100 * a) / b) : 0;
     return `<div><div class="flex justify-between text-xs font-bold mb-1"><span>${t}</span><span class="text-brand-600">${p}%</span></div>${bar(p)}</div>`; }).join("")}</div>
   ${sec("Đang làm dở", doing)}${sec("Đã hoàn thành", fin)}${sec("Chưa bắt đầu", fresh)}`;
}
$("progress-view").addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) openChapter(+b.dataset.go); });
window.addEventListener("mh-progress", openProgress);
window.addEventListener("mh-auth", () => {
  const { me, role, prof } = st(); $("btn-teacher").classList.toggle("hidden", role !== "teacher"); $("btn-teacher").classList.toggle("flex", role === "teacher");
  (prof.done || []).forEach((k) => done.add(k));
  const uidNow = me?.uid || null; if (uidNow !== dgUid) { dgUid = uidNow; dashGames(); }
  if (!me) { unsubG?.(); unsubT?.(); if (VIEWS.slice(2).some((v) => !$(v).classList.contains("hidden"))) goHome(); }
});
window.dispatchEvent(new Event("mh-auth"));
