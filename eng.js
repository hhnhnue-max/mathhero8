// MATH HERO - Học Toán bằng tiếng Anh: Chương → Bài → (Từ vựng · Tự kiểm tra · Bài tập). Theo dõi % hoàn thành từng phần.
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const { db, esc, errText } = window.MH, L = window.MHL, $ = (id) => document.getElementById(id), st = () => window.MH.state(), INP = "border rounded-lg px-2 py-1.5 text-sm";
const f = (n) => (Math.round(n * 100) / 100).toLocaleString("vi-VN"), shuf = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let CHS = [], LES = [], ORIG = {}, OV = {}, WB = {}, WBW = 950, S = { no: null, tab: "vocab" }, Q = null, Q0 = { scope: "lesson", mode: 1 }, rate = 0.85, stopAll = false, unsubX = null, EXS = {}, LOC = { evk: {}, ep: {} };

// ---------- Nạp dữ liệu ----------
async function load() {
  if (!CHS.length) { CHS = (await (await fetch("./vocab.json?v=1")).json()).chapters; LES = CHS.flatMap((c) => c.lessons.map((l) => ({ ...l, chap: c.id }))); LES.forEach((l) => (ORIG[l.no] = JSON.parse(JSON.stringify(l.words)))); }
  if (!Object.keys(WB).length) { try { const j = await (await fetch("./workbook.json?v=1")).json(); WB = j.lessons; WBW = j.w; } catch (e) { WB = {}; } }
  try { OV = {}; (await getDocs(collection(db, "engvocab"))).forEach((d) => (OV[+d.id] = d.data().words)); } catch (e) {}
  LES.forEach((l) => (l.words = OV[l.no] || ORIG[l.no]));
}
const lessonSelect = (id, cur) => `<select id="${id}" class="${INP} w-full font-bold">${CHS.map((c) => `<optgroup label="Chapter ${c.id}: ${esc(c.en)} – ${esc(c.vi)}">${c.lessons.map((l) => `<option value="${l.no}" ${l.no === cur ? "selected" : ""}>Lesson ${l.no}. ${esc(l.title)}</option>`).join("")}</optgroup>`).join("")}</select>`;
const lesson = () => LES.find((x) => x.no === S.no) || LES[0];

// ---------- Tiến độ học ----------
const getKn = (no) => new Set(LOC.evk[no] ?? st().prof.evk?.[no] ?? []), getEp = (no) => new Set(LOC.ep[no] ?? st().prof.ep?.[no] ?? []);
function prog(l) {
  const kn = getKn(l.no), nw = l.words.length, k = l.words.filter((w) => kn.has(w.en)).length, q = st().prof.vq?.[l.no]?.best || 0, wb = WB[l.no], nt = wb ? wb.ex.length + wb.ws.length : 0;
  const e = Math.min(nt, [...getEp(l.no)].filter((x) => /^[ex]\d+$/.test(x)).length), v = nw ? Math.round((100 * k) / nw) : 0, x = nt ? Math.round((100 * e) / nt) : 0;
  return { k, nw, q, e, nt, v, x, tot: Math.round((v + q + x) / 3) };
}
const tone = (p) => (p >= 100 ? "bg-green-50 border-green-400" : p > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200");
const bar = (p, c = "bg-brand-500") => `<div class="h-2 rounded-full bg-slate-200/70 overflow-hidden"><div class="h-full ${p >= 100 ? "bg-green-500" : c}" style="width:${p}%"></div></div>`;

// ---------- Phát âm ----------
const canSpeak = "speechSynthesis" in window; if (canSpeak) speechSynthesis.getVoices();
function speak(text, r, onend) {
  if (!canSpeak) return alert("Thiết bị này chưa hỗ trợ phát âm. Em thử dùng Chrome hoặc Safari nhé.");
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/\(.*?\)/g, " ").replace(/\s*\/\s*/g, ", ")); u.lang = "en-US"; u.rate = r || rate;
  const v = speechSynthesis.getVoices(); u.voice = v.find((x) => /en[-_]US/i.test(x.lang)) || v.find((x) => /^en/i.test(x.lang)) || null; if (onend) u.onend = onend; speechSynthesis.speak(u);
}
function playAll(ws) { stopAll = false; let i = 0; const next = () => { if (stopAll || i >= ws.length) return ($("pa") && ($("pa").textContent = "🔊 Nghe cả bài")); const w = ws[i++]; speak(w.en, rate, () => setTimeout(next, 700)); }; if ($("pa")) $("pa").textContent = "⏹ Dừng"; next(); }

// ---------- Lối vào ----------
$("btn-notes").insertAdjacentHTML("afterend", `<button id="btn-eng" class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-brand-50 text-brand-800 font-extrabold text-sm border border-brand-200"><i class="fa-solid fa-language"></i> Học Toán bằng tiếng Anh</button>`);
$("dash-games").insertAdjacentHTML("beforebegin", `<div class="bg-gradient-to-r from-brand-600 to-brand-600 text-white rounded-3xl p-5 flex flex-wrap items-center justify-between gap-3"><div><div class="font-black text-lg">🔤 Học Toán bằng tiếng Anh</div><div class="text-xs opacity-90">Từ vựng có phiên âm và phát âm · tự kiểm tra · bài tập tiếng Anh</div></div><button id="dash-eng" class="bg-white text-brand-700 font-extrabold text-sm rounded-xl px-4 py-2">Vào học →</button></div>`);
async function openEng(back) {
  if (!st().me) { if (!$("sidebar").classList.contains("-translate-x-full")) toggleSidebar(); return window.MH.openAuth("login"); }
  try { await load(); } catch (e) { return alert("Chưa tải được dữ liệu từ vựng (vocab.json). Cô kiểm tra file đã được tải lên GitHub chưa."); }
  LOC = { evk: {}, ep: {} }; L.openView("eng-view"); if (back && S.no) { S.tab = "ex"; lessonView(); } else { S.no = null; homeView(); }
}
$("btn-eng").onclick = $("dash-eng").onclick = () => openEng(); window.addEventListener("mh-eng-back", () => openEng(true));
const head = `<div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700">🔤 Học Toán bằng tiếng Anh</h2><button onclick="goHome()" class="text-sm font-bold text-slate-500">Trang chủ</button></div>`;
const reset = () => { if (canSpeak) speechSynthesis.cancel(); stopAll = true; unsubX?.(); unsubX = null; };

// ---------- Màn hình 1: các chương, mỗi chương một ô ngang chứa các bài ----------
function homeView() {
  reset(); S.no = null; Q = null; const ps = {}; LES.forEach((l) => (ps[l.no] = prog(l))); const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0), all = avg(LES.map((l) => ps[l.no].tot));
  $("eng-view").innerHTML = head + `<div class="bg-gradient-to-br from-brand-700 to-brand-600 text-white rounded-3xl p-5"><div class="text-xs font-bold opacity-80">Em đã hoàn thành</div><div class="text-3xl font-black">${all}%</div><div class="h-2 rounded-full bg-white/25 overflow-hidden mt-2"><div class="h-full bg-yellow-300" style="width:${all}%"></div></div>
    <div class="text-[11px] opacity-90 mt-2">Mỗi bài tính trung bình 3 phần: 📖 từ vựng đã thuộc · ✅ điểm tự kiểm tra tốt nhất · ✏️ bài tập đã làm</div></div>`
   + CHS.map((c) => { const cp = avg(c.lessons.map((l) => ps[l.no].tot));
    return `<div class="bg-white border border-slate-200 rounded-3xl p-4"><div class="flex items-center justify-between gap-3"><div class="min-w-0"><div class="text-[11px] font-extrabold text-brand-700">CHAPTER ${c.id}</div><div class="font-extrabold text-slate-900">${esc(c.en)} <span class="text-slate-500 font-bold text-sm">· ${esc(c.vi)}</span></div></div><div class="text-2xl font-black ${cp >= 100 ? "text-green-600" : "text-brand-700"}">${cp}%</div></div>
     <div class="mt-2">${bar(cp)}</div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">${c.lessons.map((l) => { const p = ps[l.no];
       return `<button data-les="${l.no}" class="text-left rounded-2xl border p-3 hover:shadow ${tone(p.tot)}"><div class="flex items-start justify-between gap-2"><span class="text-xs font-extrabold text-slate-800">Lesson ${l.no}. ${esc(l.title)}</span><span class="font-black text-sm ${p.tot >= 100 ? "text-green-600" : "text-brand-700"}">${p.tot}%</span></div>
        <div class="mt-1.5">${bar(p.tot)}</div><div class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-bold text-slate-600"><span>📖 ${p.k}/${p.nw} từ</span><span>✅ ${p.q}%</span><span>✏️ ${p.e}/${p.nt} bài</span></div></button>`; }).join("")}</div></div>`; }).join("");
}

// ---------- Màn hình 2: một bài (3 mục) ----------
function lessonView() {
  reset(); const l = lesson(), i = LES.findIndex((x) => x.no === l.no), prev = LES[i - 1], next = LES[i + 1], c = CHS.find((x) => x.id === l.chap);
  $("eng-view").innerHTML = `<div class="flex items-center justify-between gap-2"><button data-home="1" class="text-sm font-bold text-brand-700">← Danh sách chương</button><button onclick="goHome()" class="text-sm font-bold text-slate-500">Trang chủ</button></div>
   <div><div class="text-[11px] font-extrabold text-brand-700">CHAPTER ${c.id} · ${esc(c.en)}</div><h2 class="font-extrabold text-xl text-slate-900">Lesson ${l.no}. ${esc(l.title)}</h2></div>
   <div id="en-tabs" class="grid grid-cols-3 gap-2">${tabCards()}</div><div id="eng-body" class="space-y-3"></div>
   <div class="flex justify-between pt-2">${prev ? `<button data-nav="${prev.no}" class="text-xs font-bold text-brand-700 border rounded-xl px-3 py-2 bg-white">← Lesson ${prev.no}</button>` : "<span></span>"}${next ? `<button data-nav="${next.no}" class="text-xs font-bold text-brand-700 border rounded-xl px-3 py-2 bg-white">Lesson ${next.no} →</button>` : ""}</div>`;
  ({ vocab: vocabTab, quiz: quizTab, ex: exTab })[S.tab]();
}
function tabCards() {
  const p = prog(lesson()), T = [["vocab", "📖", "Từ vựng", `${p.k}/${p.nw} từ đã thuộc`, p.v], ["quiz", "✅", "Tự kiểm tra", `Tốt nhất: ${p.q}%`, p.q], ["ex", "✏️", "Bài tập", `${p.e}/${p.nt} bài đã làm`, p.x]];
  return T.map(([k, ic, t, sub, pc]) => `<button data-t="${k}" class="rounded-2xl border-2 p-3 text-left ${k === S.tab ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}"><div class="text-lg">${ic}</div><div class="text-xs font-extrabold text-slate-900">${t}</div><div class="text-[10px] font-bold text-slate-500 mb-1.5">${sub}</div>${bar(pc)}</button>`).join("");
}
const refresh = () => { if ($("en-tabs")) $("en-tabs").innerHTML = tabCards(); };

// ---- Mục 1: Từ vựng
function vocabTab() {
  const l = lesson(); $("eng-body").innerHTML = `<div class="flex flex-wrap items-center gap-2"><input id="en-q" placeholder="Tìm từ..." class="${INP} flex-1 min-w-[130px]">${[["0.6", "Chậm"], ["0.85", "Vừa"], ["1", "Nhanh"]].map(([r, t]) => `<button data-rate="${r}" class="text-xs font-bold rounded-xl px-3 py-2 border ${rate === +r ? "bg-brand-600 text-white border-brand-600" : "bg-white"}">${t}</button>`).join("")}<button id="pa" class="bg-brand-600 text-white text-xs font-bold rounded-xl px-3 py-2">🔊 Nghe cả bài</button></div>
   <p class="text-xs text-slate-500">Bấm 🔊 để nghe. Bấm <b>✓ Đã thuộc</b> khi em đã nhớ từ đó để theo dõi tiến độ.${canSpeak ? "" : " (Thiết bị này chưa hỗ trợ phát âm.)"}</p><div id="en-list" class="grid md:grid-cols-2 gap-3"></div>`; drawVocab("");
}
function drawVocab(q) {
  const l = lesson(), kn = getKn(l.no), ws = l.words.map((w, i) => ({ w, i })).filter(({ w }) => (w.en + " " + w.vi).toLowerCase().includes(q.toLowerCase()));
  $("en-list").innerHTML = ws.map(({ w, i }) => `<div class="bg-white border ${kn.has(w.en) ? "border-green-400" : "border-slate-200"} rounded-2xl p-3 flex gap-3"><button data-sp="${i}" class="w-11 h-11 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-lg shrink-0">🔊</button>
    <div class="flex-1 min-w-0"><div class="font-extrabold text-slate-900">${esc(w.en)}</div><div class="text-xs text-slate-500">${esc(w.ipa)}</div><div class="text-sm font-bold text-brand-700">${esc(w.vi)}</div>
    ${w.ex ? `<div class="text-xs text-slate-600 mt-1 flex gap-1.5 items-start"><button data-spx="${i}" class="shrink-0">🔈</button><i>${esc(w.ex)}</i></div>` : ""}
    <button data-kn="${i}" class="mt-2 text-[11px] font-bold rounded-lg px-2.5 py-1 border ${kn.has(w.en) ? "bg-green-100 border-green-400 text-green-700" : "bg-white text-slate-600"}">${kn.has(w.en) ? "✓ Đã thuộc" : "Đánh dấu đã thuộc"}</button></div></div>`).join("") || `<p class="text-sm text-slate-500">Không tìm thấy từ nào.</p>`;
}
function toggleKnown(i) {
  const l = lesson(), w = l.words[i], s = getKn(l.no), on = !s.has(w.en); on ? s.add(w.en) : s.delete(w.en); LOC.evk[l.no] = [...s];
  updateDoc(doc(db, "users", st().me.uid), { [`evk.${l.no}`]: on ? arrayUnion(w.en) : arrayRemove(w.en) }).catch(() => {}); drawVocab($("en-q")?.value || ""); refresh();
}

// ---- Mục 2: Tự kiểm tra
const normE = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
function quizTab() { Q ? quizStep() : quizSetup(); }
function quizSetup() {
  const sc = [["lesson", "Bài này"], ["chap", "Cả chương"], ["all", "Tất cả các bài"]], md = [[1, "Thấy từ tiếng Anh → chọn nghĩa tiếng Việt"], [2, "Thấy nghĩa tiếng Việt → chọn từ tiếng Anh"], ...(canSpeak ? [[3, "Nghe phát âm → chọn từ tiếng Anh"]] : []), [4, "Thấy nghĩa tiếng Việt → gõ từ tiếng Anh"]], on = (a) => (a ? "bg-brand-600 text-white border-brand-600" : "bg-white");
  $("eng-body").innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"><div class="font-extrabold text-sm text-brand-700">Chọn cách kiểm tra (10 câu)</div>
   <div><div class="text-xs font-bold text-slate-600 mb-1">Phạm vi</div><div class="flex flex-wrap gap-2">${sc.map(([k, t]) => `<button data-sc="${k}" class="text-xs font-bold rounded-xl px-3 py-2 border ${on(Q0.scope === k)}">${t}</button>`).join("")}</div></div>
   <div><div class="text-xs font-bold text-slate-600 mb-1">Hình thức</div><div class="grid gap-2">${md.map(([k, t]) => `<button data-md="${k}" class="text-left text-xs font-bold rounded-xl px-3 py-2 border ${on(Q0.mode === k)}">${k}. ${t}</button>`).join("")}</div></div>
   <button data-act="qstart" class="bg-brand-600 text-white font-extrabold rounded-xl px-5 py-2 text-sm">Bắt đầu</button></div><p class="text-[11px] text-slate-500">Đạt từ 80% ở chế độ “Bài này” lần đầu được +20 XP.</p>`;
}
function quizStart(scope, mode) {
  const l = lesson(), all = [], seen = new Set(); LES.forEach((x) => x.words.forEach((w) => { if (!seen.has(w.en)) { seen.add(w.en); all.push(w); } }));
  const p = scope === "all" ? all : scope === "chap" ? LES.filter((x) => x.chap === l.chap).flatMap((x) => x.words) : l.words, uniq = [...new Map(p.map((w) => [w.en, w])).values()];
  Q = { scope, mode, i: 0, score: 0, wrong: [], done: false, items: shuf(uniq).slice(0, 10).map((w) => ({ w, opts: shuf([w, ...shuf(all.filter((x) => x.en !== w.en && x.vi !== w.vi)).slice(0, 3)]) })) }; quizStep();
}
function quizStep() {
  if (Q.i >= Q.items.length) return quizResult(); const { w, opts } = Q.items[Q.i], m = Q.mode; Q.done = false;
  const hd = m === 1 ? `<div class="text-3xl font-black">${esc(w.en)}</div><div class="text-sm text-slate-500">${esc(w.ipa)}</div><button data-say="1" class="mt-1 text-sm">🔊 Nghe</button>` : m === 3 ? `<button data-say="1" class="bg-brand-600 text-white rounded-full w-16 h-16 text-3xl">🔊</button><div class="text-xs text-slate-500 mt-1">Nghe và chọn từ đúng</div>` : `<div class="text-2xl font-black">${esc(w.vi)}</div>`;
  const body = m === 4 ? `<div class="flex gap-2 mt-3"><input id="qz-in" autocomplete="off" autocapitalize="off" placeholder="Gõ từ tiếng Anh..." class="${INP} flex-1"><button data-act="qcheck" class="bg-brand-600 text-white font-bold rounded-xl px-4 text-sm">Kiểm tra</button></div>`
    : `<div class="grid sm:grid-cols-2 gap-2 mt-3">${opts.map((o, k) => `<button data-opt="${k}" class="text-left border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold hover:bg-slate-50">${esc(m === 1 ? o.vi : o.en)}</button>`).join("")}</div>`;
  $("eng-body").innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-4"><div class="flex justify-between text-xs font-bold text-slate-500 mb-3"><span>Câu ${Q.i + 1}/${Q.items.length}</span><span>Đúng: ${Q.score}</span></div><div class="text-center">${hd}</div>${body}<div id="qz-fb" class="mt-3 text-sm"></div></div>`;
  if (m === 3 && canSpeak) setTimeout(() => speak(w.en), 250); if (m === 4) $("qz-in").focus();
}
function quizAnswer(ok, picked) {
  if (Q.done) return; Q.done = true; const { w } = Q.items[Q.i]; if (ok) Q.score++; else Q.wrong.push(w);
  if (picked != null) document.querySelectorAll("[data-opt]").forEach((b) => { const o = Q.items[Q.i].opts[+b.dataset.opt], right = Q.mode === 1 ? o.vi === w.vi : o.en === w.en; b.disabled = true; if (right) b.classList.add("bg-green-100", "border-green-500"); else if (+b.dataset.opt === picked) b.classList.add("bg-red-100", "border-red-500"); });
  $("qz-fb").innerHTML = `<div class="font-bold ${ok ? "text-green-700" : "text-red-600"}">${ok ? "✅ Chính xác!" : "❌ Chưa đúng"}</div><div class="text-slate-700"><b>${esc(w.en)}</b> ${esc(w.ipa)} = ${esc(w.vi)}</div><button data-act="qnext" class="mt-2 bg-brand-600 text-white font-bold rounded-xl px-4 py-1.5 text-sm">${Q.i + 1 >= Q.items.length ? "Xem kết quả" : "Câu tiếp →"}</button>`;
  if (canSpeak) speak(w.en); const inp = $("qz-in"); if (inp) inp.disabled = true;
}
async function quizResult() {
  const n = Q.items.length, pct = Math.round((100 * Q.score) / n), l = lesson(); let note = "";
  if (Q.scope === "lesson") { const b = st().prof.vq?.[l.no], upd = {}; if (!b || pct > b.best) upd[`vq.${l.no}`] = { best: pct, at: Date.now() };
    const key = "v" + l.no; if (pct >= 80 && !(st().prof.done || []).includes(key)) { upd.done = arrayUnion(key); window.MH.addXP(20); note = " · <b class='text-yellow-300'>+20 XP</b>"; }
    if (Object.keys(upd).length) updateDoc(doc(db, "users", st().me.uid), upd).catch(() => {}); }
  $("eng-body").innerHTML = `<div class="bg-gradient-to-br from-brand-700 to-brand-600 text-white rounded-3xl p-5 text-center"><div class="text-xs font-bold opacity-80">Kết quả</div><div class="text-4xl font-black">${Q.score}/${n} <span class="text-lg">(${pct}%)</span></div><div class="text-sm mt-1">${pct >= 80 ? "Giỏi lắm! 🎉" : pct >= 50 ? "Khá tốt, em ôn thêm nhé!" : "Em hãy xem lại từ vựng rồi thử lại nhé!"}${note}</div></div>
   ${Q.wrong.length ? `<div class="bg-white border border-slate-200 rounded-2xl p-4"><div class="font-extrabold text-sm mb-2">Từ cần ôn lại</div>${Q.wrong.map((w) => `<div class="flex items-center gap-2 border-t py-1.5 text-sm"><button data-sayw="${esc(w.en)}">🔊</button><b>${esc(w.en)}</b> <span class="text-slate-500 text-xs">${esc(w.ipa)}</span> <span class="ml-auto text-brand-700 font-bold">${esc(w.vi)}</span></div>`).join("")}</div>` : ""}
   <div class="flex gap-2"><button data-act="qagain" class="bg-brand-600 text-white font-bold rounded-xl px-4 py-2 text-sm">Làm lại</button><button data-act="qreset" class="bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Đổi cách kiểm tra</button></div>`;
  refresh();
}

// ---- Mục 3: Bài tập (ví dụ có lời giải · bài luyện tập · đáp án · bài chấm điểm do cô đăng)
const blk = (m, r) => { const den = m.h - r[1], p = den > 0 ? ((r[0] / den) * 100).toFixed(4) : 0;
  return `<div class="rounded-xl bg-white border border-slate-200" style="padding-top:${((r[1] / WBW) * 100).toFixed(3)}%;background-image:url('${m.img}?v=1');background-repeat:no-repeat;background-size:100% auto;background-position:0 ${p}%"></div>`; };
function exTab() {
  const l = lesson(), m = WB[l.no], ep = getEp(l.no), n = l.no; let h = "";
  if (m) {
    h += `<h3 class="font-extrabold text-slate-800">📘 Ví dụ có lời giải tham khảo (${m.ex.length})</h3>` + m.ex.map((e, k) => `<div class="bg-white border border-slate-200 rounded-2xl p-3 space-y-2"><div class="flex items-center justify-between"><b class="text-sm">Example ${k + 1}</b>${ep.has("e" + (k + 1)) ? `<span class="text-[11px] font-bold text-green-700">✓ Đã xem lời giải</span>` : ""}</div>${blk(m, e.p)}
      ${e.s ? `<button data-sol="${k}" class="text-xs font-bold rounded-xl px-3 py-1.5 bg-brand-600 text-white">👁 Xem lời giải tham khảo</button><div id="sol-${k}" class="hidden">${blk(m, e.s)}</div>` : ""}</div>`).join("");
    h += `<h3 class="font-extrabold text-slate-800 mt-2">✏️ Bài luyện tập (${m.ws.length})</h3><p class="text-xs text-slate-500">Em làm vào vở, xong thì bấm “Em đã làm xong” để tính tiến độ.</p>` + m.ws.map((r, k) => { const d = ep.has("x" + (k + 1));
      return `<div class="bg-white border ${d ? "border-green-400" : "border-slate-200"} rounded-2xl p-3 space-y-2"><b class="text-sm">Exercise ${k + 1}</b>${blk(m, r)}<button data-done="${k + 1}" class="text-xs font-bold rounded-xl px-3 py-1.5 border ${d ? "bg-green-100 border-green-400 text-green-700" : "bg-white"}">${d ? "✓ Em đã làm xong" : "Em đã làm xong"}</button></div>`; }).join("");
    h += m.key ? `<div class="bg-white border border-amber-300 rounded-2xl p-3 space-y-2"><b class="text-sm">🔑 Đáp án các bài luyện tập</b><div><button data-key="1" class="text-xs font-bold rounded-xl px-3 py-1.5 bg-amber-500 text-white">Xem đáp án tham khảo</button></div><div id="key-box" class="hidden">${blk(m, m.key)}</div></div>` : `<p class="text-xs text-slate-500">Bài này chưa có đáp án trong tài liệu.</p>`;
  } else h += `<p class="text-sm text-slate-500">Chưa có ví dụ và bài luyện tập cho bài này.</p>`;
  h += `<h3 class="font-extrabold text-slate-800 mt-2">📝 Bài tập chấm điểm (do cô đăng)</h3><div id="ex-list" class="grid sm:grid-cols-2 gap-3"><p class="text-sm text-slate-500">Đang tải...</p></div>`;
  $("eng-body").innerHTML = h;
  unsubX = onSnapshot(query(collection(db, "engex"), where("lesson", "==", n), where("published", "==", true)), (s) => {
    EXS = {}; const arr = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt); arr.forEach((x) => (EXS[x.id] = x)); const res = st().prof.res || {}, box = $("ex-list"); if (!box || S.no !== n) return;
    box.innerHTML = arr.map((x, k) => { const r = res["x_" + x.id]; return `<div class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2"><div class="font-bold text-sm">${k + 1}. ${esc(x.title)}</div><div class="text-[11px] text-slate-500">${x.mcq?.length || 0} multiple choice · ${x.tf?.length || 0} true/false · ${x.sa?.length || 0} short answer</div>
      <div class="flex items-center justify-between mt-1"><span class="text-xs font-black text-brand-700">${r ? "Đã nộp: " + f(r.sc.tot) + "/" + f(r.sc.maxTot) : "Chưa làm"}</span><button data-xex="${x.id}" class="bg-brand-600 text-white text-xs font-bold rounded-xl px-3 py-1.5">${r ? "Xem lại / Làm lại" : "Làm bài"}</button></div></div>`; }).join("") || `<p class="text-sm text-slate-500 col-span-full">Cô chưa đăng bài chấm điểm cho bài này.</p>`; },
    () => { const b = $("ex-list"); if (b) b.innerHTML = `<p class="text-sm text-red-600">Chưa tải được bài tập (cô cần dán Rules mới trên Firebase).</p>`; });
}
function markEx(key, on) {
  const n = S.no, s = getEp(n); on ? s.add(key) : s.delete(key); LOC.ep[n] = [...s];
  updateDoc(doc(db, "users", st().me.uid), { [`ep.${n}`]: on ? arrayUnion(key) : arrayRemove(key) }).catch(() => {}); refresh();
}

// ---------- Sự kiện ----------
$("eng-view").addEventListener("input", (e) => { if (e.target.id === "en-q") drawVocab(e.target.value); });
$("eng-view").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "qz-in") document.querySelector("[data-act=qcheck]")?.click(); });
$("eng-view").addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return; const d = t.dataset;
  if (d.les) { S.no = +d.les; S.tab = "vocab"; Q = null; lessonView(); scrollTo(0, 0); }
  else if (d.home) { homeView(); scrollTo(0, 0); } else if (d.nav) { S.no = +d.nav; Q = null; lessonView(); scrollTo(0, 0); }
  else if (d.t) { S.tab = d.t; Q = null; lessonView(); }
  else if (d.rate) { rate = +d.rate; vocabTab(); }
  else if (d.sp != null) speak(lesson().words[+d.sp].en); else if (d.spx != null) speak(lesson().words[+d.spx].ex); else if (d.sayw) speak(d.sayw);
  else if (d.kn != null) toggleKnown(+d.kn);
  else if (t.id === "pa") { if (t.textContent.includes("Dừng")) { stopAll = true; if (canSpeak) speechSynthesis.cancel(); t.textContent = "🔊 Nghe cả bài"; } else playAll(lesson().words); }
  else if (d.sc) { Q0.scope = d.sc; quizSetup(); } else if (d.md) { Q0.mode = +d.md; quizSetup(); }
  else if (d.act === "qstart") quizStart(Q0.scope, Q0.mode)
  else if (d.say) speak(Q.items[Q.i].w.en)
  else if (d.opt != null && Q && !Q.done) { const { w, opts } = Q.items[Q.i], o = opts[+d.opt]; quizAnswer(Q.mode === 1 ? o.vi === w.vi : o.en === w.en, +d.opt); }
  else if (d.act === "qcheck" && Q && !Q.done) { const w = Q.items[Q.i].w, v = normE($("qz-in").value); if (!v) return; quizAnswer(w.en.split("/").some((x) => normE(x) === v)); }
  else if (d.act === "qnext") { Q.i++; quizStep(); } else if (d.act === "qagain") quizStart(Q.scope, Q.mode); else if (d.act === "qreset") { Q = null; quizSetup(); }
  else if (d.sol != null) { const box = $("sol-" + d.sol), show = box.classList.contains("hidden"); box.classList.toggle("hidden", !show); t.textContent = show ? "🙈 Ẩn lời giải" : "👁 Xem lời giải tham khảo"; if (show) markEx("e" + (+d.sol + 1), true); }
  else if (d.done) { const on = !getEp(S.no).has("x" + d.done); markEx("x" + d.done, on); t.textContent = on ? "✓ Em đã làm xong" : "Em đã làm xong";
    t.className = "text-xs font-bold rounded-xl px-3 py-1.5 border " + (on ? "bg-green-100 border-green-400 text-green-700" : "bg-white"); const cd = t.closest(".rounded-2xl"); cd.classList.toggle("border-green-400", on); cd.classList.toggle("border-slate-200", !on); }
  else if (d.key) { const box = $("key-box"), show = box.classList.contains("hidden"); box.classList.toggle("hidden", !show); t.textContent = show ? "Ẩn đáp án" : "Xem đáp án tham khảo"; }
  else if (d.xex) L.openEnglish(EXS[d.xex]);
});

const maxOf = (e) => (e.mcq?.length ? 3 : 0) + (e.tf?.length ? 4 : 0) + 0.5 * (e.sa?.length || 0);
const sum = (e) => `${e.mcq?.length || 0} trắc nghiệm · ${e.tf?.length || 0} đúng–sai · ${e.sa?.length || 0} trả lời ngắn · tối đa ${f(maxOf(e))} điểm`;
const nice = (t) => t.replace(/\s+/g, " ").trim().toLowerCase().replace(/(^|[:\s])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

function exerciseTeacher(root, CH) {
  let DOCS = [], PREV = null, mode = "list", off = () => {}, err = "", ch = 1, hint = "";
  const msg = (t, bad) => { const m = $("ls-msg"); if (m) { m.className = "text-xs font-bold min-h-[1rem] " + (bad ? "text-red-600" : "text-green-700"); m.textContent = t; } };
  function paint() {
    if (mode !== "list") return; const list = DOCS.filter((d) => d.lesson === ch).sort((a, b) => a.createdAt - b.createdAt);
    root.innerHTML = (err ? `<div class="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-red-700 font-bold mb-3">${esc(err)}</div>` : "") +
     `<div class="mb-3"><select id="ls-ch" class="${INP} w-full max-w-md font-bold">${CH.map((c) => `<option value="${c.id}" ${c.id === ch ? "selected" : ""}>Lesson ${c.id}. ${esc(c.title)} (${DOCS.filter((d) => d.lesson === c.id).length} bài)</option>`).join("")}</select></div>
      <div class="bg-white border border-brand-200 rounded-2xl p-4 space-y-2 mb-4"><div class="font-extrabold text-sm text-brand-700">Thêm bài tập tiếng Anh cho Lesson ${ch}</div>
       <input id="ls-name" placeholder="Tên bài (vd: Exercise 1. Monomials)" value="${esc(hint)}" class="${INP} w-full">
       <p class="text-xs text-slate-500">Úp file Word có đáp án: web tự nhận diện 3 thể thức (trắc nghiệm, đúng–sai, trả lời ngắn). Xem mẫu trong file <b>De-mau.docx</b>.</p>
       <input id="ls-file" type="file" accept=".docx" class="text-xs"><p id="ls-msg" class="text-xs font-bold min-h-[1rem]"></p><div id="ls-prev"></div></div>
      <div class="font-extrabold text-sm text-slate-700 mb-2">Bài tập của Lesson ${ch}</div><div class="space-y-2">${list.map((e) => `<div class="bg-white border border-slate-200 rounded-2xl p-3"><div class="flex flex-wrap items-center gap-2"><b class="text-sm flex-1 min-w-[200px]">${esc(e.title)}</b>
        <span class="text-[10px] font-extrabold rounded-full px-2 py-0.5 ${e.published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}">${e.published ? "Đã công bố" : "Nháp"}</span></div><div class="text-[11px] text-slate-500 my-1">${sum(e)}</div>
        <div class="flex flex-wrap gap-1.5 text-xs">${[["edit", "Sửa câu hỏi"], ["pub", e.published ? "Gỡ xuống" : "Công bố"], ["name", "Đổi tên / chuyển bài"], ["score", "Xem điểm"], ["del", "Xoá"]].map(([a, t]) => `<button data-a="${a}" data-id="${e.id}" class="border rounded-lg px-2 py-1 ${a === "pub" && !e.published ? "bg-brand-600 text-white border-brand-600 font-bold" : ""} ${a === "del" ? "text-red-600" : ""}">${t}</button>`).join("")}</div></div>`).join("") || `<p class="text-sm text-slate-500">Bài này chưa có bài tập nào.</p>`}</div>`;
    $("ls-file").onchange = read; if (PREV) preview();
  }
  async function read(ev) {
    const file = ev.target.files[0]; if (!file) return; hint = $("ls-name").value.trim(); msg("Đang đọc file...");
    try { const m = await import("./docparse.js?v=1"); PREV = m.parseBlocks(await m.docxToBlocks(file), hint || file.name.replace(/\.docx$/i, "")); }
    catch (e) { return msg("Lỗi đọc file: " + e.message, 1); }
    if (!PREV.length) return msg('Không nhận ra câu hỏi nào. Mỗi câu cần bắt đầu bằng "Câu 1.", "Câu 2."... (xem De-mau.docx).', 1);
    msg(`Đã nhận ${PREV.length} bài. Hãy kiểm tra bên dưới rồi bấm Lưu.`); preview();
  }
  function preview() {
    $("ls-prev").innerHTML = PREV.map((e, i) => `<div class="border rounded-xl p-3 mt-2"><label class="flex items-center gap-2 text-sm font-bold"><input type="checkbox" class="pk" data-i="${i}" checked> <input data-t="${i}" value="${esc(PREV.length === 1 && hint ? hint : nice(e.title))}" class="${INP} flex-1"></label><div class="text-xs text-slate-600 mt-1">${sum(e)}</div>
      ${e.warnings.length ? `<div class="mt-2 text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-red-700"><b>⚠️ ${e.warnings.length} chỗ cần kiểm tra:</b><ul class="list-disc pl-4">${e.warnings.slice(0, 8).map((w) => `<li>${esc(w)}</li>`).join("")}</ul><div>Cô vẫn lưu được, rồi bấm "Sửa câu hỏi" để chỉnh.</div></div>` : `<div class="mt-2 text-xs text-green-700 font-bold">✓ Nhận đủ đáp án</div>`}
      <details class="mt-2 text-xs"><summary class="cursor-pointer font-bold text-brand-700">Xem lại đáp án web đã nhận</summary><div class="mt-1 space-y-0.5 max-h-56 overflow-y-auto">${e.mcq.map((q, k) => `<div>TN ${k + 1}: ${esc(q.q.slice(0, 60))} → <b>${"ABCD"[q.ans]}</b></div>`).join("")}${e.tf.map((q, k) => `<div>Đ–S ${k + 1}: ${esc(q.q.slice(0, 50))} → <b>${q.items.map((x) => (x.ans ? "Đ" : "S")).join(" ")}</b></div>`).join("")}${e.sa.map((q, k) => `<div>TLN ${k + 1}: ${esc(q.q.slice(0, 50))} → <b>${esc(q.ans)}</b></div>`).join("")}</div></details></div>`).join("")
      + `<button id="ls-save" class="mt-3 bg-brand-600 text-white font-extrabold rounded-xl px-4 py-2 text-sm">Lưu vào Lesson ${ch} (chưa công bố)</button>`;
    $("ls-save").onclick = async () => { let n = 0;
      for (const [i, e] of PREV.entries()) { if (!document.querySelector(`.pk[data-i="${i}"]`).checked) continue;
        const o = JSON.parse(JSON.stringify({ lesson: ch, title: document.querySelector(`[data-t="${i}"]`).value.trim() || "Bài tập", mcq: e.mcq, tf: e.tf, sa: e.sa, published: false, createdAt: Date.now() + i, updatedAt: Date.now() }));
        try { await addDoc(collection(db, "engex"), o); n++; } catch (x) { return msg(errText(x), 1); } }
      PREV = null; hint = ""; paint(); msg(`Đã lưu ${n} bài (nháp). Bấm "Sửa câu hỏi" để kiểm tra, rồi "Công bố" cho học sinh.`); };
  }
  function scores(e) {
    mode = "score"; off(); const key = "x_" + e.id;
    root.innerHTML = `<div class="flex items-center gap-3 mb-3"><button id="sc-back" class="text-sm font-bold text-brand-600">← Về danh sách bài</button><b class="text-sm">Điểm: ${esc(e.title)}</b><button id="sc-csv" class="ml-auto bg-brand-600 text-white text-xs font-bold rounded-xl px-3 py-1.5">Xuất Excel (CSV)</button></div><div class="overflow-x-auto bg-white border rounded-2xl"><table class="w-full text-xs"><thead class="bg-slate-50 text-slate-500"><tr><th class="p-2 text-left">Họ và tên</th><th class="p-2">Lớp</th><th class="p-2 text-left">Trường</th><th class="p-2">Phần I</th><th class="p-2">Phần II</th><th class="p-2">Phần III</th><th class="p-2">Tổng</th><th class="p-2">Nộp lúc</th></tr></thead><tbody id="sc-rows"></tbody></table></div>`;
    let rows = []; $("sc-back").onclick = () => { off(); mode = "list"; listen(); };
    off = onSnapshot(collection(db, "users"), (s) => { rows = s.docs.map((d) => d.data()).filter((u) => u.res?.[key]).sort((a, b) => b.res[key].sc.tot - a.res[key].sc.tot);
      $("sc-rows").innerHTML = rows.map((u) => { const r = u.res[key]; return `<tr class="border-t"><td class="p-2 font-bold">${esc(u.name)}</td><td class="p-2 text-center">${esc(u.cls)}</td><td class="p-2">${esc(u.school)}</td>${r.sc.p.map((x, k) => `<td class="p-2 text-center">${f(x)}/${f(r.sc.max[k])}</td>`).join("")}<td class="p-2 text-center font-black text-brand-700">${f(r.sc.tot)}/${f(r.sc.maxTot)}</td><td class="p-2 text-center">${new Date(r.at).toLocaleString("vi-VN")}</td></tr>`; }).join("") || `<tr><td colspan="8" class="p-3 text-slate-500">Chưa có học sinh nào nộp bài.</td></tr>`; });
    $("sc-csv").onclick = () => { const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + "Họ và tên,Lớp,Trường,Phần I,Phần II,Phần III,Tổng,Tối đa\n" + rows.map((u) => { const r = u.res[key]; return [u.name, u.cls, u.school, ...r.sc.p, r.sc.tot, r.sc.maxTot].map(q).join(","); }).join("\n")], { type: "text/csv" })); a.download = "diem-" + e.title + ".csv"; a.click(); };
  }
  const handle = async (ev) => { const b = ev.target.closest("[data-a]"); if (!b) return; const e = DOCS.find((x) => x.id === b.dataset.id), a = b.dataset.a; if (!e) return;
    if (a === "pub") updateDoc(doc(db, "engex", e.id), { published: !e.published });
    else if (a === "del") { if (confirm(`Xoá bài "${e.title}"? (Điểm HS đã nộp vẫn còn trong hồ sơ các em.)`)) deleteDoc(doc(db, "engex", e.id)); }
    else if (a === "name") { const t = prompt("Tên bài:", e.title); if (t == null) return; const c = prompt("Thuộc Lesson số (1-39):", e.lesson); if (c == null) return; updateDoc(doc(db, "engex", e.id), { title: t.trim() || e.title, lesson: Math.min(39, Math.max(1, +c || e.lesson)) }); }
    else if (a === "score") scores(e);
    else if (a === "edit") { mode = "edit"; const m = await import("./editor.js?v=3"); m.mount(root, { CH: [], norm: L.norm, db, esc, exam: { id: e.id, col: "engex", title: e.title, back: () => { root.onclick = handle; root.oninput = root.onchange = null; root.onchange = chg; mode = "list"; paint(); } } }); } };
  const chg = (e) => { if (e.target.id === "ls-ch") { ch = +e.target.value; PREV = null; paint(); } };
  function listen() { off = onSnapshot(collection(db, "engex"), (s) => { DOCS = s.docs.map((d) => ({ id: d.id, ...d.data() })); err = ""; paint(); },
    (e) => { err = e.code === "permission-denied" ? "Chưa có quyền: cô hãy vào Firebase → Firestore → Rules, dán nội dung firestore.rules mới rồi bấm Publish." : "Lỗi: " + (e.code || e.message); paint(); }); }
  root.onclick = handle; root.onchange = chg; paint(); listen(); return () => off();
}

// ---------- Giáo viên: từ vựng + bài tập tiếng Anh ----------
function vocabEditor(root) {
  let no = LES[0].no; const text = (ws) => ws.map((w) => [w.en, w.ipa, w.vi, w.ex || ""].join(" | ")).join("\n");
  const paint = (msg = "", bad) => { const l = LES.find((x) => x.no === no);
    root.innerHTML = lessonSelect("ve-l", no) + `<p class="text-xs text-slate-500 my-2">Mỗi dòng một từ: <b>tiếng Anh | /phiên âm/ | nghĩa tiếng Việt | câu ví dụ (không bắt buộc)</b>. Cô sửa, thêm hoặc xoá dòng rồi bấm Lưu, học sinh thấy ngay.</p>
     <textarea id="ve-t" rows="14" class="${INP} w-full font-mono text-xs">${esc(text(l.words))}</textarea><div class="flex flex-wrap gap-2 mt-2 items-center"><button id="ve-save" class="bg-brand-600 text-white font-bold rounded-xl px-4 py-2 text-sm">Lưu</button><button id="ve-reset" class="bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Khôi phục bản gốc</button><span class="text-xs font-bold ${bad ? "text-red-600" : "text-green-700"}">${esc(msg)}</span></div>`; };
  root.onchange = (e) => { if (e.target.id === "ve-l") { no = +e.target.value; paint(); } };
  root.onclick = async (e) => {
    if (e.target.id === "ve-save") { const words = $("ve-t").value.split("\n").map((r) => r.split("|").map((x) => x.trim())).filter((r) => r[0] && r[2]).map((r) => ({ en: r[0], ipa: r[1] || "", vi: r[2], ex: r[3] || "" }));
      try { await setDoc(doc(db, "engvocab", String(no)), { words, updatedAt: Date.now() }); LES.find((x) => x.no === no).words = words; paint("✅ Đã lưu " + words.length + " từ."); } catch (x) { paint(errText(x), 1); } }
    if (e.target.id === "ve-reset" && confirm("Quay về bản gốc từ tài liệu của Bộ? (Phần cô đã sửa của bài này sẽ mất.)")) { try { await deleteDoc(doc(db, "engvocab", String(no))); LES.find((x) => x.no === no).words = JSON.parse(JSON.stringify(ORIG[no])); paint("Đã khôi phục bản gốc."); } catch (x) { paint(errText(x), 1); } } };
  paint(); return () => {};
}
export function teacherEnglish(root) {
  let sub = "vocab", off = () => {};
  const paint = () => { root.innerHTML = `<div class="flex gap-2 mb-3">${[["vocab", "Từ vựng"], ["ex", "Bài tập tiếng Anh"]].map(([k, t]) => `<button data-sub="${k}" class="px-4 py-2 rounded-xl text-sm font-extrabold ${k === sub ? "bg-brand-600 text-white" : "bg-white border border-slate-200 text-slate-600"}">${t}</button>`).join("")}</div><div id="en-body"></div>`;
    root.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => { off(); sub = b.dataset.sub; paint(); }));
    off = sub === "vocab" ? vocabEditor($("en-body")) : exerciseTeacher($("en-body"), LES.map((l) => ({ id: l.no, title: l.title }))); };
  load().then(paint).catch(() => (root.innerHTML = `<p class="text-sm text-red-600 font-bold">Chưa tải được vocab.json. Cô kiểm tra file đã được tải lên GitHub chưa.</p>`)); return () => off();
}
