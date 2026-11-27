// MATH HERO - Tạo tài khoản hàng loạt cho học sinh chưa có email (tên đăng nhập + mật khẩu do cô cấp)
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const { esc } = window.MH, $ = (id) => document.getElementById(id), SCHOOL = "THCS Võ Thị Sáu", DOMAIN = window.MH.hsDomain || "hs.example.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const dice = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
const loadXLSX = () => (window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = () => no(new Error("Không tải được thư viện đọc Excel (kiểm tra mạng).")); document.head.appendChild(s); }));
function csvRows(text) { const rows = []; let row = [], cur = "", q = false; text = text.replace(/^\ufeff/, "");
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === "," || c === ";") { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; } else cur += c; }
  if (cur || row.length) { row.push(cur); rows.push(row); } return rows; }
export function parseTable(rows) {   // tìm dòng tiêu đề có "Tên đăng nhập" và "Mật khẩu"
  const hi = rows.findIndex((r) => r.some((c) => norm(c) === "ten dang nhap") && r.some((c) => norm(c) === "mat khau")); if (hi < 0) throw new Error('Không thấy cột "Tên đăng nhập" và "Mật khẩu". Cô dùng file tai-khoan-hs-8A3-8A4.xlsx tôi đã gửi nhé.');
  const h = rows[hi].map(norm), col = (k) => h.findIndex((x) => x === k), iu = col("ten dang nhap"), ip = col("mat khau"), ic = col("lop"), inm = col("ho va ten"), out = [], bad = [];
  rows.slice(hi + 1).forEach((r, k) => { const user = String(r[iu] ?? "").trim().toLowerCase(), pass = String(r[ip] ?? "").trim(), name = String(r[inm] ?? "").trim(), cls = String(r[ic] ?? "").trim(); if (!user && !pass && !name) return;
    if (!/^[a-z0-9]{3,24}$/.test(user)) bad.push(`Dòng ${hi + k + 2}: tên đăng nhập "${user}" không hợp lệ (chỉ chữ thường không dấu và số).`); else if (pass.length < 6) bad.push(`Dòng ${hi + k + 2}: mật khẩu cần ít nhất 6 ký tự.`); else if (!name) bad.push(`Dòng ${hi + k + 2}: thiếu họ tên.`); else out.push({ user, pass, name, cls }); });
  const dup = out.map((x) => x.user).filter((u, i, a) => a.indexOf(u) !== i); if (dup.length) bad.push("Tên đăng nhập bị trùng: " + [...new Set(dup)].join(", ")); return { rows: out, bad }; }

export function teacherAccounts(root) {
  let ROWS = [], stop = false;
  root.innerHTML = `<div class="bg-white border border-brand-200 rounded-2xl p-4 space-y-3"><div class="font-extrabold text-sm text-brand-700">Tạo tài khoản cho học sinh chưa có email</div>
    <p class="text-xs text-slate-600">Dùng file <b>tai-khoan-hs-8A3-8A4.xlsx</b> (hoặc .csv) có các cột <b>Lớp · Họ và tên · Tên đăng nhập · Mật khẩu</b>. File chỉ được đọc ngay trên máy cô, <b>mật khẩu không được lưu lên mạng</b> (chỉ gửi cho Firebase để tạo tài khoản và được mã hoá).</p>
    <input id="ac-file" type="file" accept=".xlsx,.csv" class="text-xs"><div id="ac-prev"></div><p id="ac-msg" class="text-xs font-bold min-h-[1rem]"></p><div id="ac-log" class="text-xs max-h-60 overflow-y-auto space-y-0.5"></div></div>
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 mt-3"><b>Học sinh đăng nhập thế nào?</b> Ở ô "Email hoặc tên đăng nhập" gõ tên đăng nhập (vd: <b>an8a3</b>) và mật khẩu cô cấp. Các em nên đổi mật khẩu trong Hồ sơ. Nếu cô chạy lại bước tạo, những tài khoản đã có sẽ được bỏ qua, nên chạy lại bao nhiêu lần cũng an toàn.</div>`;
  const msg = (t, bad) => { const m = $("ac-msg"); m.className = "text-xs font-bold min-h-[1rem] " + (bad ? "text-red-600" : "text-green-700"); m.textContent = t; };
  $("ac-file").onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return; msg("Đang đọc file..."); $("ac-log").innerHTML = "";
    try { let table;
      if (/\.csv$/i.test(f.name)) table = csvRows(await f.text());
      else { await loadXLSX(); const wb = window.XLSX.read(await f.arrayBuffer()); table = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }); }
      const { rows, bad } = parseTable(table); ROWS = rows;
      if (bad.length) $("ac-log").innerHTML = bad.map((b) => `<div class="text-red-600">⚠️ ${esc(b)}</div>`).join("");
      if (!rows.length) return msg("Không có dòng hợp lệ nào.", 1);
      const by = {}; rows.forEach((r) => (by[r.cls || "?"] = (by[r.cls || "?"] || 0) + 1));
      $("ac-prev").innerHTML = `<div class="text-xs text-slate-700">Đã đọc <b>${rows.length}</b> học sinh (${Object.entries(by).map(([k, v]) => `${esc(k)}: ${v}`).join(", ")}).</div>
        <div class="overflow-x-auto mt-2 border rounded-xl"><table class="w-full text-xs"><thead class="bg-slate-50 text-slate-500"><tr><th class="p-1.5 text-left">Họ và tên</th><th class="p-1.5">Lớp</th><th class="p-1.5">Tên đăng nhập</th><th class="p-1.5">Mật khẩu</th></tr></thead><tbody>${rows.slice(0, 5).map((r) => `<tr class="border-t"><td class="p-1.5">${esc(r.name)}</td><td class="p-1.5 text-center">${esc(r.cls)}</td><td class="p-1.5 text-center font-bold">${esc(r.user)}</td><td class="p-1.5 text-center">••••••</td></tr>`).join("")}</tbody></table></div>
        <div class="flex gap-2 mt-3"><button id="ac-go" class="bg-brand-600 text-white font-extrabold rounded-xl px-4 py-2 text-sm">Tạo ${rows.length} tài khoản</button><button id="ac-stop" class="hidden bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Tạm dừng</button></div>`;
      msg(bad.length ? "Có dòng chưa hợp lệ (xem phía dưới). Cô sửa file hoặc vẫn tạo các dòng hợp lệ." : "File hợp lệ. Bấm Tạo tài khoản.", !!bad.length); $("ac-go").onclick = run; $("ac-stop").onclick = () => (stop = true);
    } catch (e) { msg("Lỗi đọc file: " + e.message, 1); }
  };
  async function run() {
    stop = false; $("ac-go").disabled = true; $("ac-stop").classList.remove("hidden"); const log = (t, c) => { const d = document.createElement("div"); d.className = c; d.textContent = t; $("ac-log").appendChild(d); $("ac-log").scrollTop = 1e9; };
    const app2 = initializeApp(firebaseConfig, "creator-" + Date.now()), a2 = getAuth(app2), d2 = getFirestore(app2); let ok = 0, skip = 0, fail = 0, i = 0;
    for (const r of ROWS) { if (stop) { log("⏸ Đã tạm dừng. Bấm Tạo lại để tiếp tục (tài khoản đã tạo sẽ được bỏ qua).", "text-amber-700 font-bold"); break; }
      msg(`Đang tạo ${++i}/${ROWS.length}: ${r.name}...`); const email = `${r.user}@${DOMAIN}`;
      try { const c = await createUserWithEmailAndPassword(a2, email, r.pass);
        await setDoc(doc(d2, "users", c.user.uid), { name: r.name, cls: r.cls, school: SCHOOL, email, username: r.user, role: "student", xp: 1250, avatar: dice(r.name) }); await signOut(a2); ok++; log(`✅ ${r.name} (${r.user})`, "text-green-700"); }
      catch (e) { try { await signOut(a2); } catch (x) {}
        if (e.code === "auth/email-already-in-use") { skip++; log(`⏭ ${r.name} (${r.user}): đã có tài khoản, bỏ qua`, "text-slate-500"); }
        else { fail++; log(`❌ ${r.name} (${r.user}): ${e.code || e.message}`, "text-red-600");
          if (e.code === "auth/too-many-requests") { log("Firebase tạm giới hạn số lần tạo. Cô đợi khoảng 15–30 phút rồi bấm Tạo lại (tài khoản đã tạo sẽ được bỏ qua).", "text-red-600 font-bold"); break; }
          if (e.code === "auth/invalid-email" || e.code === "auth/operation-not-allowed") { log("Firebase không nhận kiểu tên đăng nhập này. Cô chụp màn hình gửi tôi để chỉnh.", "text-red-600 font-bold"); break; } } }
      await sleep(450); }
    try { await deleteApp(app2); } catch (e) {} $("ac-go").disabled = false; $("ac-stop").classList.add("hidden");
    msg(`Xong: tạo mới ${ok}, đã có sẵn ${skip}, lỗi ${fail}.`, fail > 0);
  }
  return () => {};
}
