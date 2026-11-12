// MATH HERO 8 - Đọc file Word (.docx) và tự nhận diện đề: trắc nghiệm / đúng-sai / trả lời ngắn + đáp án
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main", M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻", "−": "⁻", n: "ⁿ", "(": "⁽", ")": "⁾", "=": "⁼" };
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋", "(": "₍", ")": "₎" };
const map = (s, t, mark) => (s && [...s].every((c) => t[c]) ? [...s].map((c) => t[c]).join("") : s ? mark + (s.length > 1 ? `(${s})` : s) : "");
const par = (s) => (/^[\w.,]+$/.test(s) ? s : `(${s})`);

// ---------- 1. Đọc .docx thành các khối (đoạn văn / bảng) ----------
const loadJSZip = () => (window.JSZip ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = ok; s.onerror = () => no(new Error("Không tải được thư viện đọc file Word (kiểm tra mạng).")); document.head.appendChild(s); }));
const kid = (n, name) => [...n.children].find((c) => c.localName === name) || { children: [], textContent: "" };
function omml(n) {
  let s = "";
  for (const c of n.children || []) {
    const l = c.localName;
    if (l === "r") s += [...c.getElementsByTagNameNS(M, "t")].map((t) => t.textContent).join("");
    else if (l === "f") s += par(omml(kid(c, "num"))) + "/" + par(omml(kid(c, "den")));
    else if (l === "sSup") s += omml(kid(c, "e")) + map(omml(kid(c, "sup")), SUP, "^");
    else if (l === "sSub") s += omml(kid(c, "e")) + map(omml(kid(c, "sub")), SUB, "_");
    else if (l === "rad") s += "√" + par(omml(kid(c, "e")));
    else if (l === "d") s += "(" + [...c.children].filter((x) => x.localName === "e").map(omml).join(", ") + ")";
    else if (!/Pr$/.test(l)) s += omml(c);
  }
  return s;
}
function para(p) {
  let text = "", fl = "";
  const add = (s, f) => { text += s; fl += f.repeat(s.length); };
  const walk = (node) => {
    for (const c of node.children) {
      const l = c.localName;
      if (l === "r") {
        const pr = kid(c, "rPr"), u = [...pr.children].some((x) => (x.localName === "u" && x.getAttributeNS(W, "val") !== "none") || x.localName === "highlight" || (x.localName === "color" && /^(FF0000|C00000|E00000|FF0000)$/i.test(x.getAttributeNS(W, "val") || ""))), va = [...pr.children].find((x) => x.localName === "vertAlign")?.getAttributeNS(W, "val");
        let t = "";
        for (const x of c.children) { if (x.localName === "t") t += x.textContent; else if (x.localName === "tab") t += "\t"; else if (x.localName === "br") t += "\n"; }
        add(va === "superscript" ? map(t, SUP, "^") : va === "subscript" ? map(t, SUB, "_") : t, u ? "u" : "-");
      } else if (l === "oMath" || l === "oMathPara") add(omml(c), "-");
      else if (["hyperlink", "ins", "smartTag", "fldSimple", "sdt", "sdtContent"].includes(l)) walk(c);
    }
  };
  walk(p); return { text, fl };
}
export async function docxToBlocks(file) {
  await loadJSZip();
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer()), f = zip.file("word/document.xml");
  if (!f) throw new Error("File không phải .docx hợp lệ (hãy lưu lại ở dạng Word .docx).");
  const doc = new DOMParser().parseFromString(await f.async("string"), "application/xml"), blocks = [];
  const each = (parent) => { for (const el of parent.children) {
    if (el.localName === "p") { const r = para(el); if (r.text.trim()) blocks.push({ t: "p", ...r }); }
    else if (el.localName === "tbl") blocks.push({ t: "tbl", rows: [...el.getElementsByTagNameNS(W, "tr")].map((tr) => [...tr.children].filter((c) => c.localName === "tc").map((tc) => [...tc.getElementsByTagNameNS(W, "p")].map((p) => para(p).text).join(" ").trim())) });
    else if (el.localName === "sdt") each(kid(el, "sdtContent")); } };
  each(doc.getElementsByTagNameNS(W, "body")[0]); return blocks;
}

// ---------- 2. Nhận diện đề từ các khối ----------
const NUM_Q = /^\s*(?:Câu|Bài)\s*(\d+)\s*[.:)]?\s*/i, SEC = /^\s*PHẦN\s+(I{1,3}|[123])\b/i, EXAM_HEAD = /^\s*ĐỀ\s*(?:KIỂM\s*TRA|THI|SỐ|ÔN|LUYỆN)/;
const ANS_HEAD = /^\s*(ĐÁP ÁN|BẢNG ĐÁP ÁN|HƯỚNG DẪN|LỜI GIẢI)/, INLINE_ANS = /^\s*(?:Đáp\s*án|ĐA|Đ\/A|Đáp\s*số)\s*[:.\-–]?\s*(.*)$/i, INLINE_EXP = /^\s*(?:Lời\s*giải|Giải\s*thích|Hướng\s*dẫn|HD)\s*[:.\-–]\s*(.*)$/i;
const RANGE = /^\s*(?:đến|tới|[–-])\s*(?:câu\s*)?\d+/i;
const PART = { I: "mcq", II: "tf", III: "sa", 1: "mcq", 2: "tf", 3: "sa" }, isT = (s) => /^(Đúng|Đ|T|True)$/i.test(s);
const TFTAIL = /\s*[(\[]\s*(Đúng|Sai|Đ|S)\s*[)\]]\s*$/i;

function splitMarkers(text, fl, letters) {
  const up = letters === letters.toUpperCase(), re = new RegExp(`(^|[\\s\\u00a0])([${letters}])\\s*([.)])\\s*`, "g"), cand = []; let m;
  while ((m = re.exec(text))) { const at = m.index + m[1].length, prev = text.slice(Math.max(0, at - 2), at); cand.push({ l: m[2], p: m[3], at, end: re.lastIndex, line: at === 0 || /(\n|\t|\s\s)$/.test(prev) }); re.lastIndex = at + 1; }
  const pick = (ok) => { const f = []; let want = 0; for (const c of cand) if (c.l === letters[want] && ok(c)) { f.push(c); want++; } return f; };
  let f = pick((c) => c.line);
  if (f.length < 2) { f = pick((c) => (up ? true : c.p === ")")); if (f.length < letters.length) f = []; }
  if (f.length < 2) return { head: text.trim(), items: [] };
  const items = f.map((x, k) => { const end = f[k + 1] ? f[k + 1].at : text.length, t = text.slice(x.end, end), seg = fl.slice(x.end, end);
    return { text: t.trim(), u: fl[x.at] === "u" || (seg.length > 2 && [...seg].filter((c) => c === "u").length / seg.length > 0.6) }; });
  return { head: text.slice(0, f[0].at).trim(), items };
}
const tfTokens = (s) => { const out = [], re = /([a-d])\s*[)\.\-:–]?\s*(Đúng|Sai|Đ|S|T|F)(?![\p{L}\d])/giu; let m; while ((m = re.exec(s))) out["abcd".indexOf(m[1].toLowerCase())] = isT(m[2]);
  if (out.filter((x) => x != null).length) return out; const t = s.trim().split(/[\s,;\-–\/]+/); return t.length === 4 && t.every((x) => /^(Đúng|Sai|Đ|S|T|F)$/i.test(x)) ? t.map(isT) : []; };

function parseOne(blocks, title) {
  const ai = blocks.findIndex((b) => b.t === "p" && ANS_HEAD.test(b.text) && !/[:：]\s*\S{1,30}$/.test(b.text.trim().replace(ANS_HEAD, "").length ? b.text : "")), qb = (ai < 0 ? blocks : blocks.slice(0, ai)).filter((b) => b.t === "p"), zb = ai < 0 ? [] : blocks.slice(ai).filter((b) => b.t === "p");
  // --- câu hỏi ---
  const raw = []; let cur = null, part = null;
  for (const b of qb) { const t = b.text, sec = t.match(SEC); if (sec && !NUM_Q.test(t)) { part = PART[sec[1].toUpperCase()]; cur = null; continue; }
    const m = t.match(NUM_Q); if (m && !RANGE.test(t.slice(m[0].length))) { cur = { n: +m[1], part, lines: [{ text: t.slice(m[0].length), fl: b.fl.slice(m[0].length) }] }; raw.push(cur); } else if (cur) cur.lines.push({ text: t, fl: b.fl }); }
  const qs = raw.map((q) => { let inline = null, exp = "";
    q.lines.forEach((l) => { const m = l.text.match(/^(.*[.?!:])\s+(?:Đáp\s*án|Đáp\s*số)\s*[:\-]\s*(\S.{0,40})$/i); if (m) { l.fl = l.fl.slice(0, m[1].length); l.text = m[1]; inline = m[2].trim(); } });
    const lines = q.lines.filter((l) => { const a = l.text.match(INLINE_ANS), e = l.text.match(INLINE_EXP); if (a) { inline = a[1].trim(); return false; } if (e) { exp = e[1].trim(); return false; } return true; });
    const text = lines.map((l) => l.text).join("\n"), fl = lines.map((l) => l.fl).join("-"), o = splitMarkers(text, fl, "ABCD");
    if (o.items.length >= 2) { const opts = o.items.slice(0, 4).map((x) => x.text.replace(/^\*\s*/, "")), us = o.items.slice(0, 4).map((x, i) => x.u || /^\*/.test(x.text) ? i : -1).filter((i) => i >= 0);
      let ans = null; const L = inline && inline.match(/(?<![\p{L}\d])([A-D])(?![\p{L}\d])/iu); if (L) ans = "ABCD".indexOf(L[1].toUpperCase()); else if (us.length === 1) ans = us[0];
      return { type: "mcq", n: q.n, q: o.head.replace(/\s+/g, " "), opts, ans, exp, miss: opts.length < 4 ? `chỉ nhận được ${opts.length} phương án` : "" }; }
    const t = splitMarkers(text, fl, "abcd");
    if (t.items.length >= 2) { const items = t.items.slice(0, 4).map((x) => { const m = x.text.match(TFTAIL); return { t: x.text.replace(TFTAIL, "").trim(), ans: m ? isT(m[1]) : null, exp: "" }; });
      if (inline) tfTokens(inline).forEach((v, j) => { if (items[j] && v != null) items[j].ans = v; });
      return { type: "tf", n: q.n, q: t.head.replace(/\s+/g, " "), items, exp }; }
    return { type: "sa", n: q.n, q: text.replace(/\s+/g, " ").trim(), ans: inline ? inline.replace(/[.;]$/, "") : null, exp }; });
  // --- bảng đáp án ---
  const A = { mcq: {}, tf: {}, sa: {}, em: {}, et: {}, es: {} };
  for (const b of blocks.filter((x) => x.t === "tbl")) { const rows = b.rows;
    if (rows.length >= 2 && /^câu\b/i.test(rows[0][0]) && /^đáp\s*án/i.test(rows[1][0])) { rows[0].forEach((c, i) => { const n = parseInt(c), L = (rows[1][i] || "").match(/[A-D]/i); if (i && n && L) A.mcq[n] = "ABCD".indexOf(L[0].toUpperCase()); }); continue; }
    for (const r of rows) { const n = (r[0] || "").match(/(\d+)/)?.[1]; if (!n) continue; const rest = r.slice(1), tk = rest.map((c) => c.match(/^\s*(Đúng|Sai|Đ|S)(?![\p{L}])/iu));
      if (tk.filter(Boolean).length >= 2) A.tf[n] = tk.map((m) => (m ? isT(m[1]) : null)); else if (rest[0] && /^[A-D]$/i.test(rest[0].trim())) A.mcq[n] = "ABCD".indexOf(rest[0].trim().toUpperCase()); } }
  // --- đáp án dạng dòng chữ sau mục ĐÁP ÁN ---
  const types = (n) => [...new Set(qs.filter((q) => q.n === n).map((q) => q.type))]; let zp = null;
  for (const b of zb.slice(1)) { const t = b.text.trim(), sec = t.match(SEC); if (sec && !NUM_Q.test(t)) { zp = PART[sec[1].toUpperCase()]; continue; }
    if (/^(?:\s*(?:Câu\s*)?\d+\s*[.\-:)]?\s*[A-D]\s*[,;]?){2,}$/.test(t)) { for (const m of t.matchAll(/(?:Câu\s*)?(\d+)\s*[.\-:)]?\s*([A-D])/g)) A.mcq[+m[1]] = "ABCD".indexOf(m[2]); continue; }
    const z = t.match(/^\s*(?:Câu|Bài)\s*(\d+)\s*([a-d])?\s*(?:\(([^)]*)\))?\s*(?:[–\-]\s*(Đúng|Sai))?\s*[:.\-–]?\s*(.*)$/i); if (!z) continue;
    const n = +z[1], letter = z[2], verdict = z[4], rest = z[5].trim(), tp = types(n);
    const ty = zp || (letter ? "tf" : /^(?:Đáp\s*số|ĐS|Kết\s*quả)/i.test(rest) ? "sa" : tfTokens(rest).filter((x) => x != null).length >= 2 ? "tf" : /^(?:Đáp\s*án\s*)?(?:là\s*)?[A-D](?![\p{L}\d])/u.test(rest) ? "mcq" : tp.length === 1 ? tp[0] : "mcq");
    if (ty === "mcq") { const m = rest.match(/^(?:Đáp\s*án\s*)?(?:là\s*)?([A-D])(?![\p{L}\d])[.,:]?\s*(.*)$/u); if (m) { A.mcq[n] ??= "ABCD".indexOf(m[1]); A.em[n] = m[2]; } else A.em[n] = rest; }
    else if (ty === "tf") { if (letter) { const j = "abcd".indexOf(letter.toLowerCase()); (A.tf[n] ||= [])[j] ??= verdict ? verdict === "Đúng" : null; A.et[n + letter.toLowerCase()] = rest; } else { const tk = tfTokens(rest); if (tk.length) A.tf[n] = tk; } }
    else { const m = rest.match(/^(?:Đáp\s*số|Đáp\s*án|ĐS|Kết\s*quả)\s*[:\-]?\s*(.*)$/i), body = m ? m[1] : rest.length <= 20 ? rest : ""; if (body) { const cut = body.search(/\.\s|$/); A.sa[n] = body.slice(0, cut).split("=").pop().trim(); A.es[n] = body.slice(cut + 1).trim(); } else A.es[n] = rest; } }
  // --- ghép đáp án vào câu hỏi, lập cảnh báo ---
  const out = { title, mcq: [], tf: [], sa: [], warnings: [] }, w = (m) => out.warnings.push(m), nm = { mcq: "Trắc nghiệm", tf: "Đúng–Sai", sa: "Trả lời ngắn" };
  for (const q of qs) { const lab = `${nm[q.type]} câu ${q.n}`;
    if (q.type === "mcq") { const ans = q.ans ?? A.mcq[q.n]; if (ans == null) w(`${lab}: chưa tìm thấy đáp án`); if (q.miss) w(`${lab}: ${q.miss}`); if (!q.q) w(`${lab}: không đọc được nội dung câu hỏi`);
      out.mcq.push({ q: q.q, opts: q.opts, ans: ans ?? 0, exp: q.exp || A.em[q.n] || "" }); }
    else if (q.type === "tf") { const tk = A.tf[q.n] || []; q.items.forEach((it, j) => { if (it.ans == null) it.ans = tk[j] ?? null; if (it.ans == null) { w(`${lab}, ý ${"abcd"[j]}: chưa có đáp án Đúng/Sai`); it.ans = true; } it.exp = A.et[q.n + "abcd"[j]] || ""; });
      if (q.items.length < 4) w(`${lab}: chỉ nhận được ${q.items.length} ý`); out.tf.push({ q: q.q, items: q.items, exp: q.exp }); }
    else { const ans = q.ans ?? A.sa[q.n]; if (ans == null || ans === "") w(`${lab}: chưa tìm thấy đáp số`); if (!q.q) w(`${lab}: không đọc được nội dung`); out.sa.push({ q: q.q, ans: ans ?? "", exp: q.exp || A.es[q.n] || "" }); } }
  return out;
}
export function parseBlocks(blocks, fallbackTitle = "Đề thi") {
  const heads = []; blocks.forEach((b, i) => { if (b.t === "p" && EXAM_HEAD.test(b.text) && b.text.length < 140) heads.push(i); });
  const segs = heads.length ? heads.map((h, k) => ({ title: blocks[h].text.trim(), blocks: blocks.slice(h + 1, heads[k + 1] ?? blocks.length) })) : [{ title: fallbackTitle, blocks }];
  return segs.map((s) => parseOne(s.blocks, s.title)).filter((e) => e.mcq.length + e.tf.length + e.sa.length > 0);
}
