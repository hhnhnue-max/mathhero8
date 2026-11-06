// MATH HERO 8 - Bước 1: đăng nhập email + lưu XP + game GV + quản trị
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = (id) => document.getElementById(id);
let me = null, role = "student", unsubGames = null, saveTimer;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- UI ----------
document.body.insertAdjacentHTML("beforeend", `
<div id="auth-modal" class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/70 p-4">
 <div class="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
  <h3 class="font-extrabold text-lg text-brand-700 mb-1">Đăng nhập Math Hero 8</h3>
  <p class="text-xs text-slate-500 mb-4">Dùng email để lưu XP và tiến trình của em.</p>
  <input id="a-name" placeholder="Họ tên + lớp (khi đăng ký)" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
  <input id="a-email" type="email" placeholder="Email" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
  <input id="a-pass" type="password" placeholder="Mật khẩu (≥ 6 ký tự)" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
  <p id="a-msg" class="text-xs text-brand-600 min-h-[1rem] mb-2"></p>
  <div class="flex gap-2">
   <button id="a-login" class="flex-1 bg-brand-600 text-white font-bold rounded-xl py-2 text-sm">Đăng nhập</button>
   <button id="a-signup" class="flex-1 bg-slate-100 font-bold rounded-xl py-2 text-sm">Đăng ký</button>
  </div>
  <div class="flex justify-between mt-3 text-xs"><button id="a-reset" class="text-slate-500 underline">Quên mật khẩu</button><button id="a-close" class="text-slate-500">Đóng</button></div>
 </div></div>
<div id="games-view" class="hidden max-w-4xl mx-auto w-full p-4 space-y-4">
 <div class="flex items-center justify-between"><h2 class="font-extrabold text-xl text-brand-700"><i class="fa-solid fa-gamepad mr-2"></i>Game ôn tập</h2>
  <button id="g-back" class="text-sm font-bold text-slate-500"><i class="fa-solid fa-arrow-left mr-1"></i>Trang chủ</button></div>
 <div id="admin-box" class="hidden bg-white border border-brand-200 rounded-2xl p-4 space-y-2">
  <div class="font-extrabold text-sm text-brand-700"><i class="fa-solid fa-chalkboard-user mr-1"></i>Khu vực giáo viên: thêm game</div>
  <input id="g-title" placeholder="Tên game" class="w-full border rounded-xl px-3 py-2 text-sm">
  <input id="g-chapter" placeholder="Chương (vd: Chương 1)" class="w-full border rounded-xl px-3 py-2 text-sm">
  <input id="g-url" placeholder="Link game (https://...)" class="w-full border rounded-xl px-3 py-2 text-sm">
  <button id="g-add" class="bg-brand-600 text-white font-bold rounded-xl px-4 py-2 text-sm">Đăng game</button>
  <div class="pt-3 font-extrabold text-sm text-brand-700">Học sinh &amp; XP</div>
  <div id="g-students" class="text-xs max-h-48 overflow-y-auto"></div>
 </div>
 <div id="g-list" class="grid sm:grid-cols-2 gap-3"></div>
</div>`);

$("user-xp-top").parentElement.insertAdjacentHTML("afterend", `<button id="btn-auth" class="text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-brand-900 px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap">Đăng nhập</button>`);
$("sidebar").querySelector(".space-y-6").insertAdjacentHTML("afterbegin",
 `<button id="btn-auth2" class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-brand-600 text-white font-extrabold text-sm"><i class="fa-solid fa-user"></i> <span id="btn-auth2-t">Đăng nhập bằng email</span></button>`);
$("sidebar").querySelector(".space-y-6").insertAdjacentHTML("afterbegin",
 `<button id="btn-games" class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 text-amber-700 font-extrabold text-sm border border-amber-200"><i class="fa-solid fa-gamepad"></i> Game ôn tập của cô</button>`);

const modal = (on) => { $("auth-modal").classList.toggle("hidden", !on); $("auth-modal").classList.toggle("flex", on); };
const view = (games) => { ["dashboard-view", "quiz-view"].forEach((i) => $(i).classList.add("hidden")); $("games-view").classList.toggle("hidden", !games); };
$("a-close").onclick = () => modal(false);
$("g-back").onclick = () => { $("games-view").classList.add("hidden"); showSection("dashboard"); };
$("btn-games").onclick = () => { toggleSidebar(); if (!me) return modal(true); view(true); };
$("btn-auth").onclick = $("btn-auth2").onclick = () => { if (me) signOut(auth); else { if (!$("sidebar").classList.contains("-translate-x-full")) toggleSidebar(); modal(true); } };

const authErr = (e) => ({ "auth/invalid-credential": "Sai email hoặc mật khẩu.", "auth/email-already-in-use": "Email này đã đăng ký.", "auth/weak-password": "Mật khẩu quá ngắn.", "auth/invalid-email": "Email không hợp lệ." }[e.code] || e.message);
$("a-login").onclick = () => signInWithEmailAndPassword(auth, $("a-email").value.trim(), $("a-pass").value).then(() => modal(false)).catch((e) => ($("a-msg").textContent = authErr(e)));
$("a-signup").onclick = async () => {
  try {
    const c = await createUserWithEmailAndPassword(auth, $("a-email").value.trim(), $("a-pass").value);
    await setDoc(doc(db, "users", c.user.uid), { name: $("a-name").value.trim() || "Học sinh", email: c.user.email, role: "student", xp: 1250 });
    modal(false);
  } catch (e) { $("a-msg").textContent = authErr(e); }
};
$("a-reset").onclick = () => sendPasswordResetEmail(auth, $("a-email").value.trim()).then(() => ($("a-msg").textContent = "Đã gửi email đặt lại mật khẩu.")).catch((e) => ($("a-msg").textContent = authErr(e)));

// ---------- XP online ----------
const setXP = (n) => { try { userXP = n; } catch (e) {} $("user-xp-top").innerText = `${n.toLocaleString()} XP`; };
new MutationObserver(() => {
  if (!me) return;
  const n = parseInt($("user-xp-top").innerText.replace(/\D/g, ""), 10);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => updateDoc(doc(db, "users", me.uid), { xp: n }).catch(() => {}), 800);
}).observe($("user-xp-top"), { childList: true, characterData: true, subtree: true });

// ---------- Games ----------
function listenGames() {
  unsubGames?.();
  unsubGames = onSnapshot(query(collection(db, "games"), orderBy("createdAt", "desc")), (snap) => {
    $("g-list").innerHTML = snap.docs.map((d) => { const g = d.data(); return `
     <div class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
      <span class="text-[10px] font-extrabold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 self-start">${esc(g.chapter)}</span>
      <div class="font-bold text-sm">${esc(g.title)}</div>
      <div class="flex gap-2 mt-auto">
       <a href="${esc(g.url)}" target="_blank" rel="noopener" class="bg-brand-600 text-white text-xs font-bold rounded-xl px-3 py-2">Chơi ngay</a>
       ${role === "teacher" ? `<button data-del="${d.id}" class="text-xs text-slate-500 border rounded-xl px-3 py-2">Xoá</button>` : ""}
      </div></div>`; }).join("") || `<p class="text-sm text-slate-500">Cô chưa đăng game nào.</p>`;
    $("g-list").querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => confirm("Xoá game này?") && deleteDoc(doc(db, "games", b.dataset.del))));
  });
}
$("g-add").onclick = async () => {
  const t = $("g-title").value.trim(), c = $("g-chapter").value.trim(), u = $("g-url").value.trim();
  if (!t || !/^https:\/\//.test(u)) return alert("Nhập tên game và link bắt đầu bằng https://");
  await addDoc(collection(db, "games"), { title: t, chapter: c || "Chung", url: u, createdAt: Date.now() });
  ["g-title", "g-chapter", "g-url"].forEach((i) => ($(i).value = ""));
};

function listenStudents() {
  onSnapshot(query(collection(db, "users"), orderBy("xp", "desc")), (s) => {
    $("g-students").innerHTML = s.docs.filter((d) => d.data().role !== "teacher").map((d, i) => `<div class="flex justify-between border-b py-1"><span>${i + 1}. ${esc(d.data().name)}</span><b>${(d.data().xp || 0).toLocaleString()} XP</b></div>`).join("");
  });
}

// ---------- Auth state ----------
onAuthStateChanged(auth, async (u) => {
  me = u; $("btn-auth").textContent = u ? "Đăng xuất" : "Đăng nhập"; $("btn-auth2-t").textContent = u ? "Đăng xuất (" + (u.email || "") + ")" : "Đăng nhập bằng email";
  if (!u) { unsubGames?.(); role = "student"; $("admin-box").classList.add("hidden"); return; }
  const snap = await getDoc(doc(db, "users", u.uid));
  const d = snap.exists() ? snap.data() : {};
  role = d.role || "student"; setXP(d.xp ?? 1250);
  if (role === "teacher") { $("admin-box").classList.remove("hidden"); listenStudents(); }
  listenGames();
});
