// MATH HERO 8 - Bước 2: đăng ký/đăng nhập email + hồ sơ (tên, lớp, avatar) + game GV
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, collection, addDoc, deleteDoc, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dice = (style, seed) => `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
const okAvatar = (a) => (typeof a === "string" && (a.startsWith("https://api.dicebear.com/") || a.startsWith("data:image/jpeg;base64,")) ? a : dice("bottts", "HocSinhVTS"));
const ERR = {
  "auth/invalid-credential": "Sai email hoặc mật khẩu.", "auth/wrong-password": "Sai mật khẩu.", "auth/user-not-found": "Email này chưa đăng ký.",
  "auth/email-already-in-use": "Email này đã đăng ký rồi, hãy chuyển sang thẻ Đăng nhập.", "auth/weak-password": "Mật khẩu cần ít nhất 6 ký tự.",
  "auth/invalid-email": "Email không hợp lệ.", "auth/missing-password": "Hãy nhập mật khẩu.", "auth/operation-not-allowed": "Chưa bật Email/Password trong Firebase Authentication.",
  "auth/unauthorized-domain": "Tên miền web chưa được thêm vào Authorized domains trong Firebase.", "auth/network-request-failed": "Mất kết nối mạng.",
  "auth/too-many-requests": "Thử quá nhiều lần, hãy đợi vài phút.", "permission-denied": "Firestore chưa cho phép ghi: kiểm tra lại Rules.",
};
const TEACHER_EMAIL = "hhn.hnue@gmail.com";
const errText = (e) => ERR[e.code] || `${e.code || "Lỗi"}: ${e.message}`;

let me = null, prof = {}, profExists = false, role = "student", mode = "login", lastXP = null, saveTimer, tmpAvatar = null;
let unsubUser, unsubGames, unsubStu, unsubLB, lbSig = "";

// ---------- Giao diện ----------
const AV = [["bottts", "Rocket"], ["bottts", "Nova"], ["bottts", "Pixel"], ["adventurer", "Mai"], ["adventurer", "Nam"], ["adventurer", "Lan"],
  ["fun-emoji", "Sun"], ["fun-emoji", "Star"], ["fun-emoji", "Moon"], ["avataaars", "An"], ["avataaars", "Binh"], ["avataaars", "Chi"]];
document.body.insertAdjacentHTML("beforeend", `
<div id="auth-modal" class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/70 p-4">
 <div class="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
  <div class="flex bg-slate-100 rounded-2xl p-1 mb-4 text-sm font-extrabold">
   <button id="t-login" class="flex-1 rounded-xl py-2">Đăng nhập</button><button id="t-signup" class="flex-1 rounded-xl py-2">Đăng ký</button></div>
  <div id="f-signup" class="space-y-2 mb-2 hidden">
   <input id="a-name" placeholder="Họ và tên của em" class="w-full border rounded-xl px-3 py-2 text-sm">
   <input id="a-cls" placeholder="Lớp (vd: 8A1)" class="w-full border rounded-xl px-3 py-2 text-sm">
   <input id="a-school" placeholder="Trường (vd: THCS Võ Thị Sáu)" class="w-full border rounded-xl px-3 py-2 text-sm"></div>
  <input id="a-email" type="email" autocomplete="email" placeholder="Email" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
  <input id="a-pass" type="password" autocomplete="current-password" placeholder="Mật khẩu (ít nhất 6 ký tự)" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
  <p id="a-msg" class="text-xs text-red-600 font-bold min-h-[1rem] mb-2"></p>
  <button id="a-go" class="w-full bg-brand-600 text-white font-extrabold rounded-xl py-2.5 text-sm">Đăng nhập</button>
  <div class="flex justify-between mt-3 text-xs"><button id="a-reset" class="text-slate-500 underline">Quên mật khẩu?</button><button id="a-close" class="text-slate-500">Đóng</button></div>
 </div></div>
<div id="prof-modal" class="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/70 p-4">
 <div class="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
  <h3 class="font-extrabold text-lg text-brand-700 mb-3">Hồ sơ của em</h3>
  <div class="flex items-center gap-3 mb-3"><img id="p-prev" class="w-16 h-16 rounded-full bg-slate-100 border"><div class="text-xs text-slate-500" id="p-email"></div></div>
  <input id="p-name" placeholder="Họ và tên" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
  <input id="p-cls" placeholder="Lớp" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
  <input id="p-school" placeholder="Trường" class="w-full border rounded-xl px-3 py-2 text-sm mb-3">
  <div class="text-xs font-extrabold text-slate-600 mb-1">Chọn ảnh đại diện</div>
  <div id="p-grid" class="grid grid-cols-6 gap-2 mb-2"></div>
  <label class="text-xs font-bold text-brand-700 cursor-pointer underline">Hoặc tải ảnh của em lên<input id="p-file" type="file" accept="image/*" class="hidden"></label>
  <p id="p-msg" class="text-xs font-bold min-h-[1rem] my-2"></p>
  <div class="flex gap-2"><button id="p-save" class="flex-1 bg-brand-600 text-white font-extrabold rounded-xl py-2 text-sm">Lưu</button>
   <button id="p-out" class="bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Đăng xuất</button>
   <button id="p-close" class="bg-slate-100 font-bold rounded-xl px-4 py-2 text-sm">Đóng</button></div>
 </div></div>
`);

const hdrImg = document.querySelector('header img[alt="Avatar"]'), av = hdrImg.parentElement;
av.insertAdjacentHTML("beforebegin", `<span id="who" class="hidden sm:block text-xs font-extrabold text-white max-w-[140px] truncate"></span>`);
$("user-xp-top").parentElement.insertAdjacentHTML("afterend", `<button id="btn-auth" class="text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-brand-900 px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap">Đăng nhập</button>`);
const side = $("sidebar").querySelector(".space-y-6");
side.insertAdjacentHTML("afterbegin", `<button id="btn-auth2" class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-brand-600 text-white font-extrabold text-sm"><i class="fa-solid fa-user"></i> <span id="btn-auth2-t">Đăng nhập bằng email</span></button>`);
av.style.cursor = "pointer";

const show = (id, on) => { $(id).classList.toggle("hidden", !on); $(id).classList.toggle("flex", on); };
const sidebarOpen = () => !$("sidebar").classList.contains("-translate-x-full");
const setMode = (m) => {
  mode = m; $("f-signup").classList.toggle("hidden", m !== "signup"); $("a-msg").textContent = "";
  $("a-go").textContent = m === "signup" ? "Tạo tài khoản" : "Đăng nhập";
  $("a-pass").autocomplete = m === "signup" ? "new-password" : "current-password";
  $("t-login").className = "flex-1 rounded-xl py-2 " + (m === "login" ? "bg-white shadow text-brand-700" : "text-slate-500");
  $("t-signup").className = "flex-1 rounded-xl py-2 " + (m === "signup" ? "bg-white shadow text-brand-700" : "text-slate-500");
};
const openAuth = (m = "login") => { if (sidebarOpen()) toggleSidebar(); setMode(m); show("auth-modal", true); };
const openProfile = () => {
  if (sidebarOpen()) toggleSidebar();
  tmpAvatar = okAvatar(prof.avatar); $("p-prev").src = tmpAvatar; $("p-name").value = prof.name || ""; $("p-cls").value = prof.cls || ""; $("p-school").value = prof.school || "";
  $("p-email").textContent = me.email; $("p-msg").textContent = ""; show("prof-modal", true);
};
const entry = () => (me ? openProfile() : openAuth("login"));
$("btn-auth").onclick = $("btn-auth2").onclick = av.onclick = entry;
$("t-login").onclick = () => setMode("login"); $("t-signup").onclick = () => setMode("signup");
$("a-close").onclick = () => show("auth-modal", false); $("p-close").onclick = () => show("prof-modal", false);
$("p-out").onclick = () => { show("prof-modal", false); signOut(auth); };
$("p-grid").innerHTML = AV.map(([s, k]) => `<img data-a="${dice(s, k)}" src="${dice(s, k)}" class="w-12 h-12 rounded-full bg-slate-100 border-2 border-transparent cursor-pointer hover:border-brand-500">`).join("");
$("p-grid").onclick = (e) => { if (e.target.dataset.a) { tmpAvatar = e.target.dataset.a; $("p-prev").src = tmpAvatar; } };
$("p-file").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 128; const m = Math.min(img.width, img.height);
    c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 128, 128); tmpAvatar = c.toDataURL("image/jpeg", 0.8); $("p-prev").src = tmpAvatar; };
  img.src = URL.createObjectURL(f);
};
$("p-save").onclick = async () => {
  const name = $("p-name").value.trim().slice(0, 60); if (!name) { $("p-msg").className = "text-xs font-bold text-red-600"; return ($("p-msg").textContent = "Em hãy nhập họ tên."); }
  const data = { name, cls: $("p-cls").value.trim().slice(0, 20), school: $("p-school").value.trim().slice(0, 80), avatar: tmpAvatar };
  try {
    if (profExists) await updateDoc(doc(db, "users", me.uid), data);
    else await setDoc(doc(db, "users", me.uid), { ...data, email: me.email, role: "student", xp: lastXP ?? 1250 });
    show("prof-modal", false);
  } catch (e) { $("p-msg").className = "text-xs font-bold text-red-600"; $("p-msg").textContent = errText(e); }
};

// ---------- Đăng ký / đăng nhập ----------
$("a-go").onclick = async () => {
  const email = $("a-email").value.trim(), pass = $("a-pass").value, msg = $("a-msg"), btn = $("a-go");
  msg.className = "text-xs font-bold min-h-[1rem] mb-2 text-red-600"; msg.textContent = "";
  if (!email || !pass) return (msg.textContent = "Hãy nhập email và mật khẩu.");
  const name = $("a-name").value.trim().slice(0, 60);
  if (mode === "signup" && (!name || !$("a-cls").value.trim() || !$("a-school").value.trim())) return (msg.textContent = "Hãy nhập đủ họ tên, lớp và trường của em.");
  btn.disabled = true; const old = btn.textContent; btn.textContent = "Đang xử lý...";
  try {
    if (mode === "signup") {
      const c = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, "users", c.user.uid), { name, cls: $("a-cls").value.trim().slice(0, 20), school: $("a-school").value.trim().slice(0, 80), email: c.user.email, role: email.toLowerCase() === TEACHER_EMAIL ? "teacher" : "student", xp: 1250, avatar: dice("bottts", name) });
    } else await signInWithEmailAndPassword(auth, email, pass);
    show("auth-modal", false);
  } catch (e) { msg.textContent = errText(e); }
  btn.disabled = false; btn.textContent = old;
};
$("a-reset").onclick = () => {
  const m = $("a-msg"), email = $("a-email").value.trim();
  if (!email) { m.className = "text-xs font-bold text-red-600"; return (m.textContent = "Nhập email trước, rồi bấm Quên mật khẩu."); }
  sendPasswordResetEmail(auth, email).then(() => { m.className = "text-xs font-bold text-green-700"; m.textContent = "Đã gửi email đặt lại mật khẩu (kiểm tra cả thư rác)."; })
    .catch((e) => { m.className = "text-xs font-bold text-red-600"; m.textContent = errText(e); });
};

// ---------- XP trực tuyến ----------
const setXP = (n) => { lastXP = n; try { userXP = n; } catch (e) {} $("user-xp-top").innerText = `${n.toLocaleString()} XP`; };
new MutationObserver(() => {
  if (!me) return;
  const n = parseInt($("user-xp-top").innerText.replace(/\D/g, ""), 10);
  if (isNaN(n) || n === lastXP) return;
  lastXP = n; clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { updateDoc(doc(db, "users", me.uid), { xp: n }).catch(() => {}); syncLB(); }, 800);
}).observe($("user-xp-top"), { childList: true, characterData: true, subtree: true });

// ---------- Bảng xếp hạng thật ----------
function syncLB() {
  if (!me || role === "teacher" || !prof.name) return;
  const d = { name: prof.name, cls: prof.cls || "", school: prof.school || "", avatar: okAvatar(prof.avatar), xp: lastXP ?? prof.xp ?? 0 };
  const sig = JSON.stringify(d); if (sig === lbSig) return; lbSig = sig;
  setDoc(doc(db, "leaderboard", me.uid), { ...d, updatedAt: Date.now() }).catch(() => (lbSig = ""));
}
function listenLB() {
  unsubLB?.();
  unsubLB = onSnapshot(query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(10)), (s) => {
    const sty = ["bg-amber-50/60 border border-amber-200", "bg-slate-50 border border-slate-200", "bg-orange-50/60 border border-orange-200"], dot = ["bg-amber-400 text-white", "bg-slate-300 text-slate-700", "bg-orange-300 text-white"];
    $("lb-list").innerHTML = s.docs.map((d, i) => { const u = d.data(), self = me && d.id === me.uid;
      return `<div class="flex items-center justify-between p-3 rounded-2xl ${self ? "bg-brand-50 border-2 border-brand-500" : sty[i] || "bg-white border border-slate-200"}">
       <div class="flex items-center gap-3"><span class="w-7 h-7 rounded-full ${self ? "bg-brand-600 text-white" : dot[i] || "bg-slate-100 text-slate-600"} font-black text-xs flex items-center justify-center">${i + 1}</span>
       <img src="${esc(okAvatar(u.avatar))}" class="w-8 h-8 rounded-full bg-slate-100"><div><h4 class="font-extrabold text-slate-800 text-xs">${esc(u.name)}${self ? " (em)" : ""}</h4>
       <p class="text-[10px] text-slate-500">${u.cls ? "Lớp " + esc(u.cls) + " • " : ""}${u.school ? esc(u.school) + " • " : ""}${(u.xp || 0).toLocaleString()} XP</p></div></div>
       <span class="text-xs font-black text-slate-500">${i < 3 ? "Top " + (i + 1) : "Hạng " + (i + 1)}</span></div>`; }).join("") || `<p class="text-xs text-slate-500">Chưa có bạn nào trên bảng. Hãy làm bài để lên hạng nhé!</p>`;
  }, () => ($("lb-list").innerHTML = `<p class="text-xs text-red-600">Chưa tải được bảng xếp hạng (kiểm tra Rules).</p>`));
}

// ---------- Hiển thị hồ sơ ----------
function render() {
  hdrImg.src = okAvatar(prof.avatar);
  $("who").textContent = prof.name ? `${prof.name}${prof.cls ? " · " + prof.cls : ""}` : "";
  $("who").classList.toggle("hidden", !prof.name); $("who").classList.toggle("sm:block", !!prof.name);
  window.dispatchEvent(new Event("mh-auth"));
}
onAuthStateChanged(auth, (u) => {
  me = u; unsubUser?.(); unsubGames?.(); unsubStu?.(); unsubLB?.(); lbSig = "";
  $("btn-auth").classList.toggle("hidden", !!u);
  $("btn-auth2-t").textContent = u ? "Hồ sơ của em" : "Đăng nhập bằng email";
  if (!u) { prof = {}; profExists = false; role = "student"; lastXP = null; render(); $("lb-list").innerHTML = `<p class="text-xs text-slate-500">Đăng nhập để xem bảng xếp hạng.</p>`; return; }
  unsubUser = onSnapshot(doc(db, "users", u.uid), (s) => {
    profExists = s.exists(); prof = s.data() || {}; role = prof.role || "student";
    if (prof.xp != null && prof.xp !== lastXP) setXP(prof.xp);
    render(); syncLB();
    if (profExists && !prof.name) openProfile();
  });
  listenLB();
});

window.MH = { db, auth, esc, okAvatar, errText, openAuth, state: () => ({ me, prof, role }), addXP: (n) => setXP((lastXP ?? prof.xp ?? 0) + n) };
import("./learn.js?v=1");
