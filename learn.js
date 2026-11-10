// MATH HERO 8 - Chương học (trắc nghiệm / đúng-sai / trả lời ngắn / game) + khu quản lý của giáo viên
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
const { db, auth, esc, errText } = window.MH;
const $ = (id) => document.getElementById(id);
const st = () => window.MH.state();
const VIEWS = ["dashboard-view", "quiz-view", "chapter-view", "teacher-view"];
const openView = (id) => { if (!$("sidebar").classList.contains("-translate-x-full")) toggleSidebar(); VIEWS.forEach((v) => $(v).classList.toggle("hidden", v !== id)); scrollTo(0, 0); };
const GROUPS = [["MẠCH ĐẠI SỐ", "fa-square-root-variable", [1, 2, 6, 7]], ["MẠCH HÌNH HỌC", "fa-shapes", [3, 4, 9, 10]], ["THỐNG KÊ & XÁC SUẤT", "fa-chart-column", [5, 8]]];
const TABS = [["mcq", "Trắc nghiệm"], ["tf", "Đúng – Sai"], ["sa", "Trả lời ngắn"], ["game", "Game tương tác"]];
const INP = "w-full border rounded-xl px-3 py-2 text-sm";
let CH = [], cur = { id: 1, tab: "mcq" }, done = new Set(), GAMES = {}, unsubG, unsubT, tTab = "hs";

document.querySelector("main").insertAdjacentHTML("beforeend", `<section id="chapter-view" class="hidden space-y-4"></section><section id="teacher-view" class="hidden space-y-4"></section>`);
document.body.insertAdjacentHTML("beforeend", `<div id="game-modal" class="fixed inset-0 z-[70] hidden flex-col bg-slate-900"><div class="flex items-center justify-between p-3 bg-brand-700 text-white"><span id="game-title" class="font-extrabold text-sm"></span><button id="game-close" class="bg-white/20 rounded-xl px-3 py-1 text-sm font-bold">Đóng ✕</button></div><iframe id="game-frame" sandbox="allow-scripts allow-forms allow-popups allow-pointer-lock" class="flex-1 w-full bg-white"></iframe></div>`);
$("sidebar").querySelector(".space-y-6").insertAdjacentHTML("afterbegin", `<button id="btn-teacher" class="hidden w-full items-center gap-3 px-4 py-3 rounded-2xl bg-amber-400 text-brand-900 font-extrabold text-sm"><i class="fa-solid fa-chalkboard-user"></i> Quản lý của cô</button>`);
const playGame = (title, html) => { $("game-title").textContent = title; $("game-frame").srcdoc = html; $("game-modal").classList.replace("hidden", "flex"); };
$("game-close").onclick = () => { $("game-modal").classList.replace("flex", "hidden"); $("game-frame").srcdoc = ""; };

// ---------- Menu chương ----------
const loadQ = () => (loadQ.p ||= fetch("./questions.json?v=1").then((r) => r.json()).then((j) => (CH = j.chapters)));
loadQ().then(() => {
  $("chap-list").innerHTML = GROUPS.map(([t, ic, ids]) => `<div class="mb-3"><div class="px-3 py-2 text-xs font-extrabold text-brand-700 bg-rose-50/80 rounded-xl mb-1"><i class="fa-solid ${ic} mr-1"></i>${t}</div>
    <div class="space-y-1 pl-2">${ids.map((i) => `<button data-ch="${i}" class="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl">Chương ${i}: ${esc(CH[i - 1].title)}</button>`).join("")}</div></div>`).join("");
  $("chap-list").onclick = (e) => { const b = e.target.closest("[data-ch]"); if (b) openChapter(+b.dataset.ch); };
});
async function openChapter(id) {
  if (!st().me) { if (!$("sidebar").classList.contains("-translate-x-full")) toggleSidebar(); return window.MH.openAuth("login"); }
  await loadQ(); cur = { id, tab: "mcq" }; done = new Set(st().prof.done || []); openView("chapter-view"); renderChapter();
}

// ---------- Màn hình một chương ----------
function renderChapter() {
  unsubG?.(); const ch = CH[cur.id - 1]; const body = { mcq: mcqHTML, tf: tfHTML, sa: saHTML, game: () => `<div id="game-list" class="grid sm:grid-cols-2 gap-3"></div>` }[cur.tab](ch);
  $("chapter-view").innerHTML = `<div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700">Chương ${ch.id}: ${esc(ch.title)}</h2><button onclick="goHome()" class="text-sm font-bold text-slate-500"><i class="fa-solid fa-house mr-1"></i>Trang chủ</button></div>
   <div class="flex gap-2 flex-wrap">${TABS.map(([k, l]) => `<button data-act="tab" data-t="${k}" class="px-4 py-2 rounded-xl text-sm font-extrabold ${k === cur.tab ? "bg-brand-600 text-white" : "bg-white border border-slate-200 text-slate-600"}">${l}</button>`).join("")}</div>
   <div class="flex items-center justify-between"><span id="prog" class="text-xs font-bold text-slate-500"></span>${cur.tab !== "game" ? `<button data-act="redo" class="text-xs font-bold text-brand-600">Làm lại</button>` : ""}</div>
   <div class="space-y-3">${body}</div>`;
  prog(); if (cur.tab === "game") listenGames(ch.id);
}
const prog = () => { const el = $("prog"), ch = CH[cur.id - 1], p = { mcq: "m", tf: "t", sa: "s" }[cur.tab]; if (!el || !p) return;
  const tot = { mcq: ch.mcq.length, tf: ch.tf.length * 4, sa: ch.sa.length }[cur.tab];
  el.textContent = `Đã trả lời đúng (có XP): ${[...done].filter((k) => k.startsWith(`c${cur.id}${p}`)).length}/${tot}`; };
const card = (inner, id) => `<div ${id ? `id="${id}"` : ""} class="bg-white border border-slate-200 rounded-2xl p-4">${inner}</div>`;
const mcqHTML = (ch) => ch.mcq.map((q) => card(`<div class="font-bold text-sm mb-2">Câu ${q.n}. ${esc(q.q)} <span class="text-[10px] text-slate-400">${q.lvl}</span></div>
  <div class="grid sm:grid-cols-2 gap-2">${q.opts.map((o, i) => `<button data-act="mc" data-n="${q.n}" data-i="${i}" class="text-left border border-slate-200 rounded-xl px-3 py-2 text-sm hover:bg-slate-50">${"ABCD"[i]}. ${esc(o)}</button>`).join("")}</div><div class="fb text-xs mt-2"></div>`, `q-m${q.n}`)).join("");
const tfHTML = (ch) => ch.tf.map((q) => card(`<div class="font-bold text-sm mb-2">Câu ${q.n}. ${esc(q.q)}</div>${q.items.map((it, j) => `<div id="q-t${q.n}${j}" class="border-t py-2"><div class="text-sm">${"abcd"[j]}) ${esc(it.t)}</div>
  <div class="flex gap-2 mt-1"><button data-act="tf" data-n="${q.n}" data-j="${j}" data-v="1" class="border rounded-xl px-4 py-1 text-xs font-bold">Đúng</button><button data-act="tf" data-n="${q.n}" data-j="${j}" data-v="0" class="border rounded-xl px-4 py-1 text-xs font-bold">Sai</button></div><div class="fb text-xs mt-1"></div></div>`).join("")}`)).join("");
const saHTML = (ch) => ch.sa.map((q) => card(`<div class="font-bold text-sm mb-2">Câu ${q.n}. ${esc(q.q)}</div><div class="flex gap-2"><input id="sa-${q.n}" placeholder="Đáp số (vd: 2,5 hoặc 1/2)" class="${INP} max-w-[200px]"><button data-act="sa" data-n="${q.n}" class="bg-brand-600 text-white font-bold rounded-xl px-4 text-sm">Kiểm tra</button></div><div class="fb text-xs mt-2"></div>`, `q-s${q.n}`)).join("");

function reward(key, xp, ok) {
  if (!ok || done.has(key)) return ""; done.add(key); window.MH.addXP(xp);
  updateDoc(doc(db, "users", st().me.uid), { done: arrayUnion(key) }).catch(() => {}); prog(); return ` <b class="text-amber-600">+${xp} XP</b>`;
}
const mark = (b, good) => b.classList.add(...(good ? ["bg-green-100", "border-green-500"] : ["bg-red-100", "border-red-500"]));
const num = (s) => { s = String(s).replace(/[−–]/g, "-").replace(/\s/g, "").replace(",", "."); const m = s.match(/^(-?[\d.]+)\/([\d.]+)$/); return m ? +m[1] / +m[2] : Number(s); };
const same = (a, b) => { const x = num(a), y = num(b); return isFinite(x) && isFinite(y) ? Math.abs(x - y) < 1e-9 : String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); };

$("chapter-view").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act, ch = CH[cur.id - 1], n = +b.dataset.n;
  if (a === "tab") { cur.tab = b.dataset.t; renderChapter(); }
  else if (a === "redo") renderChapter();
  else if (a === "mc") { const q = ch.mcq.find((x) => x.n === n), box = $(`q-m${n}`), i = +b.dataset.i; if (box.dataset.d) return; box.dataset.d = 1;
    const ok = i === q.ans; box.querySelectorAll("button").forEach((x, k) => { x.disabled = true; if (k === q.ans) mark(x, 1); else if (k === i) mark(x, 0); });
    const got = reward(`c${ch.id}m${n}`, 10, ok);
    box.querySelector(".fb").innerHTML = (ok ? "✅ Chính xác!" : `❌ Chưa đúng. Đáp án: <b>${"ABCD"[q.ans]}</b>`) + got + (q.exp ? `<div class="text-slate-600 mt-1">${esc(q.exp)}</div>` : ""); }
  else if (a === "tf") { const q = ch.tf.find((x) => x.n === n), j = +b.dataset.j, it = q.items[j], box = $(`q-t${n}${j}`); if (box.dataset.d) return; box.dataset.d = 1;
    const ok = (b.dataset.v === "1") === it.ans; box.querySelectorAll("button").forEach((x) => { x.disabled = true; }); mark(b, ok);
    const got = reward(`c${ch.id}t${n}${"abcd"[j]}`, 5, ok);
    box.querySelector(".fb").innerHTML = (ok ? "✅ Đúng rồi!" : `❌ Chưa đúng. Ý này là <b>${it.ans ? "Đúng" : "Sai"}</b>.`) + got + (it.exp ? `<div class="text-slate-600 mt-1">${esc(it.exp)}</div>` : ""); }
  else if (a === "sa") { const q = ch.sa.find((x) => x.n === n), box = $(`q-s${n}`), inp = $(`sa-${n}`); if (box.dataset.d || !inp.value.trim()) return; box.dataset.d = 1; inp.disabled = b.disabled = true;
    const ok = same(inp.value, q.ans), got = reward(`c${ch.id}s${n}`, 20, ok);
    box.querySelector(".fb").innerHTML = (ok ? "✅ Chính xác!" : `❌ Chưa đúng. Đáp số: <b>${esc(q.ans)}</b>`) + got + (q.exp ? `<div class="text-slate-600 mt-1">${esc(q.exp)}</div>` : ""); }
  else if (a === "play") { const g = GAMES[b.dataset.id]; if (g.kind === "link") open(g.url, "_blank", "noopener"); else playGame(g.title, g.html); }
});
$("chapter-view").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id?.startsWith("sa-")) $("q-s" + e.target.id.slice(3)).querySelector("[data-act=sa]").click(); });
function listenGames(id) {
  unsubG = onSnapshot(query(collection(db, "games"), where("ch", "==", id)), (s) => {
    const list = $("game-list"); if (!list) return; GAMES = {}; s.docs.forEach((d) => (GAMES[d.id] = d.data()));
    list.innerHTML = s.docs.map((d) => `<div class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2"><div class="font-bold text-sm">🎮 ${esc(d.data().title)}</div><button data-act="play" data-id="${d.id}" class="bg-brand-600 text-white text-xs font-bold rounded-xl px-3 py-2 self-start">Chơi ngay</button></div>`).join("") || `<p class="text-sm text-slate-500">Cô chưa đăng game cho chương này.</p>`;
  });
}

// ---------- Khu quản lý của giáo viên ----------
const dl = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv" })); a.download = name; a.click(); };
function renderTeacher() {
  unsubT?.(); if (st().role !== "teacher") return;
  $("teacher-view").innerHTML = `<div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700"><i class="fa-solid fa-chalkboard-user mr-2"></i>Quản lý của cô</h2><button onclick="goHome()" class="text-sm font-bold text-slate-500">Trang chủ</button></div>
   <div class="flex gap-2">${[["hs", "Tài khoản học sinh"], ["gm", "Game theo chương"]].map(([k, l]) => `<button data-t="${k}" class="px-4 py-2 rounded-xl text-sm font-extrabold ${k === tTab ? "bg-brand-600 text-white" : "bg-white border border-slate-200 text-slate-600"}">${l}</button>`).join("")}</div><div id="t-body"></div>`;
  $("teacher-view").querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { tTab = b.dataset.t; renderTeacher(); }));
  tTab === "hs" ? teacherStudents() : teacherGames();
}
function teacherStudents() {
  $("t-body").innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 mb-3">🔒 Mật khẩu của HS được Firebase mã hoá nên <b>không ai xem được</b> (kể cả cô). Khi em quên mật khẩu, bấm <b>Gửi mail đặt lại</b>: em nhận email và tự đặt mật khẩu mới.</div>
   <div class="flex gap-2 mb-2"><input id="t-q" placeholder="Tìm theo tên, lớp, trường, email..." class="${INP}"><button id="t-csv" class="bg-brand-600 text-white font-bold rounded-xl px-4 text-sm whitespace-nowrap">Xuất Excel (CSV)</button></div>
   <div class="overflow-x-auto bg-white border border-slate-200 rounded-2xl"><table class="w-full text-xs"><thead class="bg-slate-50 text-slate-500"><tr><th class="p-2 text-left">Họ và tên</th><th class="p-2">Lớp</th><th class="p-2 text-left">Trường</th><th class="p-2 text-left">Email</th><th class="p-2">XP</th><th class="p-2">Đã làm</th><th class="p-2"></th></tr></thead><tbody id="t-rows"></tbody></table></div>`;
  let rows = [], draw = () => { const f = $("t-q").value.toLowerCase();
    $("t-rows").innerHTML = rows.filter((u) => [u.name, u.cls, u.school, u.email].join(" ").toLowerCase().includes(f)).map((u) => `<tr class="border-t"><td class="p-2 font-bold"><img src="${esc(window.MH.okAvatar(u.avatar))}" class="w-6 h-6 rounded-full inline mr-1">${esc(u.name)}</td><td class="p-2 text-center">${esc(u.cls)}</td><td class="p-2">${esc(u.school)}</td><td class="p-2">${esc(u.email)}</td><td class="p-2 text-center font-bold">${u.xp || 0}</td><td class="p-2 text-center">${(u.done || []).length}</td><td class="p-2"><button data-mail="${esc(u.email)}" class="border rounded-lg px-2 py-1 whitespace-nowrap">Gửi mail đặt lại</button></td></tr>`).join("") || `<tr><td class="p-3 text-slate-500" colspan="7">Chưa có học sinh nào.</td></tr>`; };
  unsubT = onSnapshot(collection(db, "users"), (s) => { rows = s.docs.map((d) => d.data()).filter((u) => u.role !== "teacher").sort((a, b) => (a.cls || "").localeCompare(b.cls || "") || (a.name || "").localeCompare(b.name || "")); draw(); });
  $("t-q").oninput = draw;
  $("t-rows").onclick = (e) => { const m = e.target.dataset.mail; if (m) sendPasswordResetEmail(auth, m).then(() => alert("Đã gửi email đặt lại mật khẩu tới " + m)).catch((x) => alert(errText(x))); };
  $("t-csv").onclick = () => dl("hoc-sinh-math-hero-8.csv", "Họ và tên,Lớp,Trường,Email,XP\n" + rows.map((u) => [u.name, u.cls, u.school, u.email, u.xp || 0].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"));
}
function teacherGames() {
  $("t-body").innerHTML = `<div class="bg-white border border-brand-200 rounded-2xl p-4 space-y-2 mb-3"><div class="font-extrabold text-sm text-brand-700">Thêm game tương tác</div>
   <select id="tg-ch" class="${INP}">${CH.map((c) => `<option value="${c.id}">Chương ${c.id}: ${esc(c.title)}</option>`).join("")}</select>
   <input id="tg-title" placeholder="Tên game" class="${INP}">
   <label class="block text-xs font-bold text-slate-600">Cách 1: chọn file game .html <input id="tg-file" type="file" accept=".html,.htm" class="block mt-1 text-xs"></label>
   <div class="text-xs text-slate-500">hoặc Cách 2: dán link game (https://...)</div><input id="tg-url" placeholder="https://..." class="${INP}">
   <p id="tg-msg" class="text-xs font-bold text-red-600 min-h-[1rem]"></p><button id="tg-add" class="bg-brand-600 text-white font-bold rounded-xl px-4 py-2 text-sm">Đăng game</button></div><div id="tg-list" class="space-y-2"></div>`;
  $("tg-add").onclick = async () => {
    const m = $("tg-msg"), title = $("tg-title").value.trim(), url = $("tg-url").value.trim(), f = $("tg-file").files[0]; m.textContent = "";
    if (!title) return (m.textContent = "Nhập tên game."); let data = { ch: +$("tg-ch").value, title, createdAt: Date.now() };
    if (f) { const html = await f.text(); if (new Blob([html]).size > 900000) return (m.textContent = "File quá lớn (tối đa ~900KB). Hãy dùng Cách 2 (link)."); data = { ...data, kind: "html", html }; }
    else if (/^https:\/\//.test(url)) data = { ...data, kind: "link", url }; else return (m.textContent = "Chọn file .html hoặc dán link bắt đầu bằng https://");
    try { await addDoc(collection(db, "games"), data); ["tg-title", "tg-url", "tg-file"].forEach((i) => ($(i).value = "")); m.className = "text-xs font-bold text-green-700"; m.textContent = "Đã đăng. HS thấy ngay trong chương."; } catch (e) { m.className = "text-xs font-bold text-red-600"; m.textContent = errText(e); }
  };
  unsubT = onSnapshot(collection(db, "games"), (s) => {
    GAMES = {}; s.docs.forEach((d) => (GAMES[d.id] = d.data()));
    $("tg-list").innerHTML = s.docs.sort((a, b) => a.data().ch - b.data().ch || a.data().createdAt - b.data().createdAt).map((d) => { const g = d.data(); return `<div class="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2 text-sm"><span class="text-[10px] font-extrabold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5">Chương ${g.ch}</span><span class="flex-1 font-bold">${esc(g.title)} <i class="text-slate-400 text-xs">${g.kind === "html" ? "HTML" : "Link"}</i></span><button data-p="${d.id}" class="text-xs border rounded-lg px-2 py-1">Xem thử</button><button data-d="${d.id}" class="text-xs border rounded-lg px-2 py-1 text-red-600">Xoá</button></div>`; }).join("") || `<p class="text-sm text-slate-500">Chưa có game nào.</p>`;
  });
  $("tg-list").onclick = (e) => { const p = e.target.dataset.p, d = e.target.dataset.d; if (p) { const g = GAMES[p]; g.kind === "link" ? open(g.url, "_blank", "noopener") : playGame(g.title, g.html); } if (d && confirm("Xoá game này?")) deleteDoc(doc(db, "games", d)); };
}
$("btn-teacher").onclick = async () => { await loadQ(); openView("teacher-view"); renderTeacher(); };
window.addEventListener("mh-auth", () => {
  const { me, role, prof } = st(); $("btn-teacher").classList.toggle("hidden", role !== "teacher"); $("btn-teacher").classList.toggle("flex", role === "teacher");
  (prof.done || []).forEach((k) => done.add(k));
  if (!me) { unsubG?.(); unsubT?.(); if (!$("chapter-view").classList.contains("hidden") || !$("teacher-view").classList.contains("hidden")) goHome(); }
});
window.dispatchEvent(new Event("mh-auth"));
