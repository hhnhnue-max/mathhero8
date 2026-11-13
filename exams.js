// MATH HERO 8 - Đấu trường đề thi: GV úp Word -> tự nhận diện -> công bố; HS thi có giờ, tự chấm
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const { db, esc, errText } = window.MH, L = window.MHL, $ = (id) => document.getElementById(id), st = () => window.MH.state();
const KINDS = ["Giữa kỳ I", "Cuối kỳ I", "Giữa kỳ II", "Cuối kỳ II", "Ôn tập chương", "Khác"], INP = "border rounded-lg px-2 py-1.5 text-sm";
const f = (n) => (Math.round(n * 100) / 100).toLocaleString("vi-VN"), maxOf = (e) => (e.mcq?.length ? 3 : 0) + (e.tf?.length ? 4 : 0) + 0.5 * (e.sa?.length || 0);
const sum = (e) => `${e.mcq?.length || 0} trắc nghiệm · ${e.tf?.length || 0} đúng–sai · ${e.sa?.length || 0} trả lời ngắn · tối đa ${f(maxOf(e))} điểm`;
const guess = (t) => (/giữa/i.test(t) ? (/II|2/.test(t) ? KINDS[2] : KINDS[0]) : /cuối|học kì|học kỳ/i.test(t) ? (/II|2/.test(t) ? KINDS[3] : KINDS[1]) : /chương/i.test(t) ? KINDS[4] : KINDS[5]);
const nice = (t) => t.replace(/^\s*ĐỀ\s*/i, "Đề ").replace(/\s+/g, " ").trim().toLowerCase().replace(/^đề/, "Đề").replace(/(^|[:\s])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

// ================= HỌC SINH =================
let EX = [], uid0, unsub;
const myRes = (e) => st().prof.res?.["e_" + e.id];
const examCard = (e) => { const r = myRes(e);
  return `<div class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2"><div class="flex items-start justify-between gap-2"><div class="font-extrabold text-sm">${esc(e.title)}</div><span class="text-[10px] font-extrabold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 whitespace-nowrap">${esc(e.kind || "Đề thi")}</span></div>
   <div class="text-[11px] text-slate-500">${sum(e)}</div><div class="text-[11px] text-slate-500">${e.minutes ? "⏱ " + e.minutes + " phút" : "Không giới hạn thời gian"} · nhận x2 XP</div>
   <div class="flex items-center justify-between mt-1"><span class="text-xs font-black text-brand-700">${r ? "Đã nộp: " + f(r.sc.tot) + "/" + f(r.sc.maxTot) : ""}</span><button data-ex="${e.id}" class="bg-brand-600 text-white text-xs font-bold rounded-xl px-3 py-1.5">${r ? "Xem lại / Làm lại" : "Vào thi"}</button></div></div>`; };
function renderStudent() {
  const side = $("exam-side"), me = st().me;
  if (side) side.innerHTML = !me ? `<p class="px-3 text-[11px] text-slate-400">Đăng nhập để xem đề thi.</p>` : (EX.slice(0, 4).map((e) => { const r = myRes(e);
    return `<button data-ex="${e.id}" class="w-full text-left p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 to-brand-500/10 border border-amber-200 flex items-center gap-3"><div class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0"><i class="fa-solid fa-file-pen"></i></div><div class="flex-1 min-w-0"><h4 class="font-extrabold text-slate-900 text-xs truncate">${esc(e.title)}</h4><p class="text-[10px] text-slate-500 font-semibold">${e.minutes ? e.minutes + " phút" : "Không giới hạn"}${r ? " • " + f(r.sc.tot) + "/" + f(r.sc.maxTot) + "đ" : ""}</p></div></button>`; }).join("") || `<p class="px-3 text-[11px] text-slate-400">Cô chưa đăng đề nào.</p>`) + (EX.length > 4 ? `<button id="ex-all" class="w-full text-xs font-extrabold text-brand-700 py-2">Xem tất cả ${EX.length} đề →</button>` : "");
  const v = $("exams-view"); if (v && !v.classList.contains("hidden")) v.innerHTML = `<div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700"><i class="fa-solid fa-trophy text-amber-500 mr-2"></i>Đấu trường đề thi</h2><button onclick="goHome()" class="text-sm font-bold text-slate-500">Trang chủ</button></div>
    <div class="grid sm:grid-cols-2 gap-3">${EX.map(examCard).join("") || `<p class="text-sm text-slate-500">Cô chưa đăng đề thi nào.</p>`}</div>`;
}
const openList = () => { if (!st().me) return window.MH.openAuth("login"); L.openView("exams-view"); renderStudent(); };
document.addEventListener("click", (e) => { const b = e.target.closest("[data-ex]"); if (b && !b.closest("#t-body")) { const ex = EX.find((x) => x.id === b.dataset.ex); if (ex) L.openExam(ex); } if (e.target.closest("#ex-all")) openList(); });
window.addEventListener("mh-exams", openList);
const sync = () => { const u = st().me?.uid || null; if (u !== uid0) { uid0 = u; unsub?.(); EX = []; if (u) unsub = onSnapshot(query(collection(db, "exams"), where("published", "==", true)), (s) => { EX = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt); renderStudent(); }, () => {}); } renderStudent(); };
window.addEventListener("mh-auth", sync); sync();

// ================= GIÁO VIÊN =================
export function teacherExams(root) {
  let DOCS = [], PREV = null, mode = "list", off = () => {};
  const msg = (t, bad) => { const m = $("ex-msg"); if (m) { m.className = "text-xs font-bold min-h-[1rem] " + (bad ? "text-red-600" : "text-green-700"); m.textContent = t; } };
  function paint() {
    if (mode !== "list") return;
    root.innerHTML = `<div class="bg-white border border-brand-200 rounded-2xl p-4 space-y-2 mb-4"><div class="font-extrabold text-sm text-brand-700">1. Úp file Word có đáp án (.docx)</div>
      <p class="text-xs text-slate-500">Web tự nhận diện câu hỏi và đáp án. Một file có thể chứa nhiều đề (mỗi đề bắt đầu bằng dòng "ĐỀ ..."). Xem mẫu soạn đề trong file <b>De-mau.docx</b>.</p>
      <input id="ex-file" type="file" accept=".docx" class="text-xs"><p id="ex-msg" class="text-xs font-bold min-h-[1rem]"></p><div id="ex-prev"></div></div>
     <div class="font-extrabold text-sm text-slate-700 mb-2">2. Các đề đã có (${DOCS.length})</div><div class="space-y-2">${DOCS.map((e) => `<div class="bg-white border border-slate-200 rounded-2xl p-3"><div class="flex flex-wrap items-center gap-2"><b class="text-sm flex-1 min-w-[200px]">${esc(e.title)}</b>
       <span class="text-[10px] font-extrabold rounded-full px-2 py-0.5 ${e.published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}">${e.published ? "Đã công bố" : "Nháp"}</span><span class="text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">${esc(e.kind || "")}</span></div>
       <div class="text-[11px] text-slate-500 my-1">${sum(e)} · ${e.minutes ? e.minutes + " phút" : "không giới hạn giờ"}</div>
       <div class="flex flex-wrap gap-1.5 text-xs">${[["edit", "Sửa câu hỏi"], ["pub", e.published ? "Gỡ xuống" : "Công bố"], ["info", "Sửa tên/thời gian"], ["score", "Xem điểm"], ["del", "Xoá"]].map(([a, t]) => `<button data-a="${a}" data-id="${e.id}" class="border rounded-lg px-2 py-1 ${a === "pub" && !e.published ? "bg-brand-600 text-white border-brand-600 font-bold" : ""} ${a === "del" ? "text-red-600" : ""}">${t}</button>`).join("")}</div></div>`).join("") || `<p class="text-sm text-slate-500">Chưa có đề nào.</p>`}</div>`;
    $("ex-file").onchange = read; if (PREV) preview();
  }
  async function read(ev) {
    const file = ev.target.files[0]; if (!file) return; msg("Đang đọc file...");
    try { const m = await import("./docparse.js?v=1"); PREV = m.parseBlocks(await m.docxToBlocks(file), file.name.replace(/\.docx$/i, "")); }
    catch (e) { return msg("Lỗi đọc file: " + e.message, 1); }
    if (!PREV.length) return msg("Không nhận ra câu hỏi nào. Mỗi câu cần bắt đầu bằng \"Câu 1.\", \"Câu 2.\"... (xem file De-mau.docx).", 1);
    msg(`Đã nhận ${PREV.length} đề. Hãy kiểm tra bên dưới rồi bấm Lưu.`); preview();
  }
  function preview() {
    $("ex-prev").innerHTML = PREV.map((e, i) => { const t = nice(e.title);
      return `<div class="border rounded-xl p-3 mt-2"><label class="flex items-center gap-2 text-sm font-bold"><input type="checkbox" data-i="${i}" class="pk" checked> <input data-f="title" data-i="${i}" value="${esc(t)}" class="${INP} flex-1"></label>
       <div class="flex flex-wrap items-center gap-2 mt-2 text-xs"><select data-f="kind" data-i="${i}" class="${INP}">${KINDS.map((k) => `<option ${k === guess(e.title) ? "selected" : ""}>${k}</option>`).join("")}</select>
        <label>Thời gian <input data-f="min" data-i="${i}" type="number" min="0" value="${/cuối/i.test(e.title) ? 90 : 45}" class="${INP} w-16"> phút (0 = không giới hạn)</label></div>
       <div class="text-xs text-slate-600 mt-1">${sum(e)}</div>
       ${e.warnings.length ? `<div class="mt-2 text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-red-700"><b>⚠️ ${e.warnings.length} chỗ cần kiểm tra:</b><ul class="list-disc pl-4">${e.warnings.slice(0, 8).map((w) => `<li>${esc(w)}</li>`).join("")}${e.warnings.length > 8 ? "<li>...</li>" : ""}</ul><div>Cô vẫn lưu được, rồi bấm "Sửa câu hỏi" để chỉnh.</div></div>` : `<div class="mt-2 text-xs text-green-700 font-bold">✓ Nhận đủ đáp án</div>`}
       <details class="mt-2 text-xs"><summary class="cursor-pointer font-bold text-brand-700">Xem lại đáp án web đã nhận</summary><div class="mt-1 space-y-0.5 max-h-56 overflow-y-auto">
        ${e.mcq.map((q, k) => `<div>TN ${k + 1}: ${esc(q.q.slice(0, 60))} → <b>${"ABCD"[q.ans]}</b></div>`).join("")}${e.tf.map((q, k) => `<div>Đ–S ${k + 1}: ${esc(q.q.slice(0, 50))} → <b>${q.items.map((x) => (x.ans ? "Đ" : "S")).join(" ")}</b></div>`).join("")}${e.sa.map((q, k) => `<div>TLN ${k + 1}: ${esc(q.q.slice(0, 50))} → <b>${esc(q.ans)}</b></div>`).join("")}</div></details></div>`; }).join("")
      + `<button id="ex-save" class="mt-3 bg-brand-600 text-white font-extrabold rounded-xl px-4 py-2 text-sm">Lưu các đề đã chọn (chưa công bố)</button>`;
    $("ex-save").onclick = async () => { let n = 0;
      for (const [i, e] of PREV.entries()) { const q = (s) => document.querySelector(`[data-f="${s}"][data-i="${i}"]`); if (!document.querySelector(`.pk[data-i="${i}"]`).checked) continue;
        const o = JSON.parse(JSON.stringify({ title: q("title").value.trim() || "Đề thi", kind: q("kind").value, minutes: Math.max(0, +q("min").value || 0), mcq: e.mcq, tf: e.tf, sa: e.sa, published: false, createdAt: Date.now() + i, updatedAt: Date.now() }));
        try { await addDoc(collection(db, "exams"), o); n++; } catch (x) { return msg(errText(x), 1); } }
      PREV = null; paint(); msg(`Đã lưu ${n} đề nháp. Bấm "Sửa câu hỏi" để kiểm tra, rồi "Công bố" cho học sinh.`); };
  }
  function scores(e) {
    mode = "score"; off(); const key = "e_" + e.id;
    root.innerHTML = `<div class="flex items-center gap-3 mb-3"><button id="sc-back" class="text-sm font-bold text-brand-600">← Về danh sách đề</button><b class="text-sm">Điểm: ${esc(e.title)}</b><button id="sc-csv" class="ml-auto bg-brand-600 text-white text-xs font-bold rounded-xl px-3 py-1.5">Xuất Excel (CSV)</button></div><div class="overflow-x-auto bg-white border rounded-2xl"><table class="w-full text-xs"><thead class="bg-slate-50 text-slate-500"><tr><th class="p-2 text-left">Họ và tên</th><th class="p-2">Lớp</th><th class="p-2 text-left">Trường</th><th class="p-2">Phần I</th><th class="p-2">Phần II</th><th class="p-2">Phần III</th><th class="p-2">Tổng</th><th class="p-2">Nộp lúc</th></tr></thead><tbody id="sc-rows"></tbody></table></div>`;
    let rows = []; $("sc-back").onclick = () => { off(); mode = "list"; listen(); };
    off = onSnapshot(collection(db, "users"), (s) => { rows = s.docs.map((d) => d.data()).filter((u) => u.res?.[key]).sort((a, b) => b.res[key].sc.tot - a.res[key].sc.tot);
      $("sc-rows").innerHTML = rows.map((u) => { const r = u.res[key]; return `<tr class="border-t"><td class="p-2 font-bold">${esc(u.name)}</td><td class="p-2 text-center">${esc(u.cls)}</td><td class="p-2">${esc(u.school)}</td>${r.sc.p.map((x, k) => `<td class="p-2 text-center">${f(x)}/${f(r.sc.max[k])}</td>`).join("")}<td class="p-2 text-center font-black text-brand-700">${f(r.sc.tot)}/${f(r.sc.maxTot)}</td><td class="p-2 text-center">${new Date(r.at).toLocaleString("vi-VN")}</td></tr>`; }).join("") || `<tr><td colspan="8" class="p-3 text-slate-500">Chưa có học sinh nào nộp bài.</td></tr>`; });
    $("sc-csv").onclick = () => { const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + "Họ và tên,Lớp,Trường,Phần I,Phần II,Phần III,Tổng,Tối đa\n" + rows.map((u) => { const r = u.res[key]; return [u.name, u.cls, u.school, ...r.sc.p, r.sc.tot, r.sc.maxTot].map(q).join(","); }).join("\n")], { type: "text/csv" })); a.download = "diem-" + e.title + ".csv"; a.click(); };
  }
  const handle = async (ev) => { const b = ev.target.closest("[data-a]"); if (!b) return; const e = DOCS.find((x) => x.id === b.dataset.id), a = b.dataset.a; if (!e) return;
    if (a === "pub") updateDoc(doc(db, "exams", e.id), { published: !e.published });
    else if (a === "del") { if (confirm(`Xoá đề "${e.title}"? (Điểm HS đã nộp vẫn còn trong hồ sơ các em.)`)) deleteDoc(doc(db, "exams", e.id)); }
    else if (a === "info") { const t = prompt("Tên đề:", e.title); if (t == null) return; const m = prompt("Thời gian làm bài (phút, 0 = không giới hạn):", e.minutes ?? 45); if (m == null) return; const k = prompt("Loại đề: " + KINDS.join(" / "), e.kind || "Khác"); updateDoc(doc(db, "exams", e.id), { title: t.trim() || e.title, minutes: Math.max(0, +m || 0), kind: KINDS.includes(k) ? k : e.kind || "Khác" }); }
    else if (a === "score") scores(e);
    else if (a === "edit") { mode = "edit"; const m = await import("./editor.js?v=2"); m.mount(root, { CH: [], norm: L.norm, db, esc, exam: { id: e.id, title: e.title, back: () => { root.onclick = handle; root.oninput = root.onchange = null; mode = "list"; paint(); } } }); } };
  root.onclick = handle;
  function listen() { off = onSnapshot(collection(db, "exams"), (s) => { DOCS = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt); paint(); },
    (err) => { paint(); root.insertAdjacentHTML("afterbegin", `<div class="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 mb-3"><b>Chưa đọc được dữ liệu đề thi (${esc(err.code || err.message)}).</b><br>Cô kiểm tra: đã dán <b>firestore.rules mới</b> vào Firebase → Firestore → Rules và bấm <b>Publish</b> chưa? Sau đó tải lại trang (Cmd+Shift+R).</div>`); }); }
  paint(); listen(); return () => off();
}
