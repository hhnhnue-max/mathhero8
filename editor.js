// MATH HERO 8 - Soạn câu hỏi cho giáo viên: sửa / thêm / xoá -> Lưu nháp -> Công bố cho HS
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const IN = "w-full border rounded-lg px-2 py-1.5 text-sm", clone = (o) => JSON.parse(JSON.stringify(o));
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export async function mount(root, { CH, norm, db, esc }) {
  let id = 1, d = null, msg = "", pubAt = null;
  const take = (x) => ({ mcq: x.mcq, tf: x.tf, sa: x.sa });
  async function load(i, orig) {
    id = i; msg = "Đang tải..."; paint();
    const [dr, pb] = await Promise.all([getDoc(doc(db, "qdraft", String(i))), getDoc(doc(db, "qpub", String(i)))]);
    pubAt = pb.exists() ? pb.data().updatedAt : null;
    let base = CH[i - 1];
    if (orig) base = (await (await fetch("./questions.json?v=1")).json()).chapters[i - 1];
    else if (dr.exists()) base = dr.data(); else if (pb.exists()) base = pb.data();
    d = norm(clone(take(base))); msg = orig ? "Đã nạp bản gốc từ file Word (chưa lưu)." : dr.exists() ? "Đang mở bản nháp đã lưu." : ""; paint();
  }
  const check = () => {
    for (const [k, q] of d.mcq.entries()) if (!q.q.trim() || q.opts.some((o) => !o.trim())) return `Trắc nghiệm câu ${k + 1}: cần đủ đề và 4 đáp án.`;
    for (const [k, q] of d.tf.entries()) if (!q.q.trim() || q.items.some((x) => !x.t.trim())) return `Đúng–Sai câu ${k + 1}: cần đủ đề và 4 ý.`;
    for (const [k, q] of d.sa.entries()) if (!q.q.trim() || !String(q.ans).trim()) return `Trả lời ngắn câu ${k + 1}: cần đề và đáp số.`;
    return "";
  };
  const pack = () => { const o = clone(d); o.mcq.forEach((q, i) => (q.n = i + 1)); o.tf.forEach((q, i) => (q.n = i + 1)); o.sa.forEach((q, i) => (q.n = i + 1)); return { ...o, updatedAt: Date.now() }; };
  async function save(publish) {
    const bad = check(); if (bad) { msg = "⚠️ " + bad; return paint(); }
    if (publish && !confirm("Công bố bộ câu hỏi Chương " + id + " cho tất cả học sinh?")) return;
    try { const p = pack(); await setDoc(doc(db, "qdraft", String(id)), p); if (publish) { await setDoc(doc(db, "qpub", String(id)), p); pubAt = p.updatedAt; } msg = publish ? "✅ Đã công bố. HS mở chương sẽ thấy bộ câu hỏi mới." : "💾 Đã lưu nháp (HS chưa thấy)."; }
    catch (e) { msg = "Lỗi: " + (e.code || e.message); } paint();
  }
  const ta = (p, v, rows = 2) => `<textarea data-p="${p}" rows="${rows}" class="${IN}">${esc(v ?? "")}</textarea>`;
  const del = (p) => `<button data-del="${p}" class="text-xs text-red-600 border rounded-lg px-2 py-1">Xoá câu</button>`;
  function paint() {
    const y = scrollY; if (!d) return;
    root.innerHTML = `<div class="flex flex-wrap items-center gap-2 mb-3"><select id="ed-ch" class="${IN} max-w-xs">${CH.map((c) => `<option value="${c.id}" ${c.id === id ? "selected" : ""}>Chương ${c.id}: ${esc(c.title)}</option>`).join("")}</select>
     <button id="ed-orig" class="text-xs border rounded-lg px-2 py-1.5">Nạp lại bản gốc (Word)</button>
     <span class="text-xs text-slate-500">${pubAt ? "Đã công bố: " + new Date(pubAt).toLocaleString("vi-VN") : "Đang dùng bộ câu hỏi gốc từ file Word"}</span></div>
     <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 mb-3">Sửa xong bấm <b>Lưu nháp</b> (HS chưa thấy) hoặc <b>Công bố</b> (HS thấy ngay). Xoá/sửa câu không làm mất XP HS đã nhận.</div>
     <h3 class="font-extrabold text-brand-700 mb-2">I. Trắc nghiệm (${d.mcq.length} câu)</h3><div class="space-y-3 mb-2">${d.mcq.map((q, i) => `<div class="bg-white border rounded-2xl p-3 space-y-1.5"><div class="flex justify-between"><b class="text-sm">Câu ${i + 1}</b>${del("mcq." + i)}</div>${ta(`mcq.${i}.q`, q.q)}
      ${q.opts.map((o, k) => `<div class="flex items-center gap-2"><label class="text-xs font-bold whitespace-nowrap"><input type="radio" name="r${q.id}" data-p="mcq.${i}.ans" value="${k}" ${q.ans === k ? "checked" : ""}> ${"ABCD"[k]} đúng</label><input data-p="mcq.${i}.opts.${k}" value="${esc(o)}" class="${IN}"></div>`).join("")}
      <input data-p="mcq.${i}.exp" value="${esc(q.exp || "")}" placeholder="Lời giải (không bắt buộc)" class="${IN}"></div>`).join("")}</div><button data-add="mcq" class="text-sm font-bold text-brand-600 mb-5">+ Thêm câu trắc nghiệm</button>
     <h3 class="font-extrabold text-brand-700 mb-2">II. Đúng – Sai (${d.tf.length} câu, mỗi câu 4 ý)</h3><div class="space-y-3 mb-2">${d.tf.map((q, i) => `<div class="bg-white border rounded-2xl p-3 space-y-1.5"><div class="flex justify-between"><b class="text-sm">Câu ${i + 1}</b>${del("tf." + i)}</div>${ta(`tf.${i}.q`, q.q)}
      ${q.items.map((it, k) => `<div class="grid grid-cols-[1fr_auto] gap-2"><input data-p="tf.${i}.items.${k}.t" value="${esc(it.t)}" placeholder="Ý ${"abcd"[k]})" class="${IN}"><select data-p="tf.${i}.items.${k}.ans" data-bool="1" class="border rounded-lg text-sm"><option value="1" ${it.ans ? "selected" : ""}>Đúng</option><option value="0" ${!it.ans ? "selected" : ""}>Sai</option></select><input data-p="tf.${i}.items.${k}.exp" value="${esc(it.exp || "")}" placeholder="Giải thích ý ${"abcd"[k]} (không bắt buộc)" class="${IN} col-span-2"></div>`).join("")}</div>`).join("")}</div><button data-add="tf" class="text-sm font-bold text-brand-600 mb-5">+ Thêm câu Đúng–Sai</button>
     <h3 class="font-extrabold text-brand-700 mb-2">III. Trả lời ngắn (${d.sa.length} câu)</h3><div class="space-y-3 mb-2">${d.sa.map((q, i) => `<div class="bg-white border rounded-2xl p-3 space-y-1.5"><div class="flex justify-between"><b class="text-sm">Câu ${i + 1}</b>${del("sa." + i)}</div>${ta(`sa.${i}.q`, q.q)}
      <input data-p="sa.${i}.ans" value="${esc(q.ans)}" placeholder="Đáp số (vd: 2,5 hoặc 1/2)" class="${IN} max-w-[220px]"><input data-p="sa.${i}.exp" value="${esc(q.exp || "")}" placeholder="Lời giải (không bắt buộc)" class="${IN}"></div>`).join("")}</div><button data-add="sa" class="text-sm font-bold text-brand-600">+ Thêm câu trả lời ngắn</button>
     <div class="sticky bottom-0 bg-white/95 border-t mt-4 p-3 flex flex-wrap items-center gap-2"><button id="ed-save" class="bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Lưu nháp</button><button id="ed-pub" class="bg-brand-600 text-white font-extrabold rounded-xl px-4 py-2 text-sm">Công bố cho học sinh</button><span class="text-xs font-bold">${esc(msg)}</span></div>`;
    scrollTo(0, y);
  }
  root.onchange = (e) => { if (e.target.id === "ed-ch") return load(+e.target.value); };
  root.oninput = root.onchange2 = (e) => { const el = e.target, p = el.dataset.p; if (!p || el.type === "radio" && !el.checked) return;
    const k = p.split("."), last = k.pop(), obj = k.reduce((o, x) => o[x], d); obj[last] = el.type === "radio" ? +el.value : el.dataset.bool ? el.value === "1" : el.value; };
  root.addEventListener("change", (e) => { if (e.target.dataset.p) root.oninput(e); });
  root.onclick = (e) => { const t = e.target, a = t.dataset.add, r = t.dataset.del;
    if (a) { d[a].push(a === "mcq" ? { id: uid("m"), q: "", opts: ["", "", "", ""], ans: 0, exp: "" } : a === "tf" ? { id: uid("t"), q: "", items: [0, 1, 2, 3].map(() => ({ t: "", ans: true, exp: "" })) } : { id: uid("s"), q: "", ans: "", exp: "" }); paint(); }
    if (r && confirm("Xoá câu này?")) { const [k, i] = r.split("."); d[k].splice(+i, 1); paint(); }
    if (t.id === "ed-save") save(false); if (t.id === "ed-pub") save(true);
    if (t.id === "ed-orig" && confirm("Nạp lại bản gốc từ file Word? Phần đang sửa trên màn hình sẽ mất (bản nháp đã lưu vẫn còn cho đến khi cô lưu lại).")) load(id, true); };
  await load(1);
}
