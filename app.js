import * as C from "./config.js";

const DEMO = !C.firebaseConfig.apiKey;
const $ = (id) => document.getElementById(id);
const S = {
  store: null, uid: null, admin: false, ev: { ...C.EVENT_DEFAULTS }, evSaved: false,
  rsvps: new Map(), confs: new Map(), items: [], drinks: [], votes: new Map(), photos: [],
  loaded: {}, plan: null, gal: 0, guestFilter: "todos", itemFilter: "todos", editing: false
};

/* ================= utilidades ================= */
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
const money = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR");
let tT;
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tT); tT = setTimeout(() => t.classList.remove("show"), 2600); }
async function copy(text, ok) {
  try { await navigator.clipboard.writeText(text); toast(ok); }
  catch {
    const ta = el("textarea", { style: "position:fixed;opacity:0" }); ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand("copy"); toast(ok); } catch { toast("Não deu para copiar. Segure o texto para copiar."); }
    ta.remove();
  }
}
const pal = ["#F2522E", "#0E6B5C", "#C7871A", "#6B4FB8", "#2F7FC1", "#B8436A", "#3E8E3A"];
const colorFor = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return pal[h % pal.length]; };
const initials = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const svgCheck = () => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.innerHTML = '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'; return s; };

function confetti() {
  if (reduced) return;
  const c = $("confetti"), x = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
  const cols = ["#F2522E", "#FFC43D", "#0E6B5C", "#4CC2AC", "#FF8FB1"];
  const ps = Array.from({ length: 110 }, () => ({ x: innerWidth / 2, y: innerHeight * .6, vx: (Math.random() - .5) * 13, vy: -Math.random() * 15 - 5, r: Math.random() * 6 + 4, c: cols[Math.random() * 5 | 0], a: Math.random() * 6, s: (Math.random() - .5) * .4 }));
  let f = 0; (function t() { x.clearRect(0, 0, c.width, c.height); for (const p of ps) { p.vy += .45; p.x += p.vx; p.y += p.vy; p.a += p.s; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); } if (++f < 100) requestAnimationFrame(t); else x.clearRect(0, 0, c.width, c.height); })();
}
function fail(e) {
  console.error(e);
  const c = e && e.code;
  if (c === "permission-denied") toast("Sem permissão para isso.");
  else if (c === "taken") toast("Alguém acabou de escolher esse item.");
  else if (c === "unavailable") toast("Sem internet. Tente de novo.");
  else toast("Não deu certo. Tente de novo.");
}

/* ================= banco de dados ================= */
async function firebaseStore() {
  const b = "https://www.gstatic.com/firebasejs/10.12.2/";
  const [{ initializeApp }, fs, au] = await Promise.all([import(b + "firebase-app.js"), import(b + "firebase-firestore.js"), import(b + "firebase-auth.js")]);
  const app = initializeApp(C.firebaseConfig);
  const db = fs.getFirestore(app), auth = au.getAuth(app);
  const ref = (p) => fs.doc(db, ...p.split("/"));
  const st = {
    uid: null, email: null,
    onAuth(cb) {
      au.onAuthStateChanged(auth, (u) => {
        if (!u) { au.signInAnonymously(auth).catch((e) => { fail(e); cb(null); }); return; }
        st.uid = u.uid; st.email = u.email || null; cb(u);
      });
    },
    isAdmin: () => !!st.email && !!C.ADMIN_EMAIL && st.email.toLowerCase() === C.ADMIN_EMAIL.toLowerCase(),
    onDoc: (p, cb) => fs.onSnapshot(ref(p), (s) => cb(s.exists() ? s.data() : null), fail),
    onCol: (n, cb) => fs.onSnapshot(fs.collection(db, n), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), fail),
    set: (p, d) => fs.setDoc(ref(p), d),
    update: (p, d) => fs.updateDoc(ref(p), d),
    del: (p) => fs.deleteDoc(ref(p)),
    add: (n, d) => fs.addDoc(fs.collection(db, n), d),
    claim: (id, name) => fs.runTransaction(db, async (tx) => {
      const r = ref("items/" + id), s = await tx.get(r);
      if (!s.exists() || s.data().claimedBy) throw { code: "taken" };
      tx.update(r, { claimedBy: st.uid, claimedName: name, claimedAt: Date.now() });
    }),
    login: (e, p) => au.signInWithEmailAndPassword(auth, e, p),
    logout: () => au.signOut(auth)
  };
  return st;
}

function demoStore() {
  let data = null;
  try { data = JSON.parse(ls.get("festa-demo")); } catch {}
  if (!data) {
    data = { event: {}, items: {}, drinks: {}, rsvps: {}, confirmations: {}, votes: {}, photos: {} };
    C.DEFAULT_ITEMS.forEach((l, i) => data.items["i" + i] = { label: l, order: i, claimedBy: null });
    C.DEFAULT_DRINKS.forEach((l, i) => data.drinks["d" + i] = { label: l, order: i });
  }
  let uid = ls.get("festa-demo-uid");
  if (!uid) { uid = "demo-" + Math.random().toString(36).slice(2, 10); ls.set("festa-demo-uid", uid); }
  const L = new Set();
  const save = () => { ls.set("festa-demo", JSON.stringify(data)); L.forEach((f) => f()); };
  const sp = (p) => p.split("/");
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let authCb = null;
  const st = {
    uid, email: ls.get("festa-demo-admin") ? "organizador@demo" : null,
    onAuth(cb) { authCb = cb; setTimeout(() => cb({ uid }), 0); },
    isAdmin: () => !!st.email,
    onDoc(p, cb) { const [c, id] = sp(p); const f = () => cb(data[c]?.[id] ? clone(data[c][id]) : null); L.add(f); f(); return () => L.delete(f); },
    onCol(n, cb) { const f = () => cb(Object.entries(data[n] || {}).map(([id, v]) => ({ id, ...clone(v) }))); L.add(f); f(); return () => L.delete(f); },
    async set(p, d) { const [c, id] = sp(p); (data[c] ??= {})[id] = clone(d); save(); },
    async update(p, d) { const [c, id] = sp(p); if (!data[c]?.[id]) throw { code: "not-found" }; Object.assign(data[c][id], clone(d)); save(); },
    async del(p) { const [c, id] = sp(p); if (data[c]) delete data[c][id]; save(); },
    async add(n, d) { const id = Math.random().toString(36).slice(2, 10); (data[n] ??= {})[id] = clone(d); save(); return { id }; },
    async claim(id, name) { const it = data.items[id]; if (!it || it.claimedBy) throw { code: "taken" }; Object.assign(it, { claimedBy: uid, claimedName: name, claimedAt: Date.now() }); save(); },
    async login(e, p) { if (!e || !p) throw { code: "auth/invalid-credential" }; st.email = "organizador@demo"; ls.set("festa-demo-admin", "1"); authCb?.({ uid }); },
    async logout() { st.email = null; ls.set("festa-demo-admin", ""); authCb?.({ uid }); }
  };
  return st;
}

/* ================= navegação ================= */
const TABS = ["inicio", "presenca", "levar", "bebidas", "org"];
function route() {
  let t = location.hash.replace("#", "");
  if (!TABS.includes(t)) t = "inicio";
  for (const x of TABS) $("s-" + x).hidden = x !== t;
  document.querySelectorAll(".nav a").forEach((a) => { if (a.dataset.tab === t) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  scrollTo({ top: 0 });
  render(t);
}
const go = (t) => { if (location.hash === "#" + t) route(); else location.hash = t; };
addEventListener("hashchange", route);
const current = () => { const t = location.hash.replace("#", ""); return TABS.includes(t) ? t : "inicio"; };
function render(t = current()) {
  ({ inicio: rInicio, presenca: rPresenca, levar: rLevar, bebidas: rBebidas, org: rOrg })[t]();
  header();
}

/* ================= dados derivados ================= */
const ev = () => S.ev;
const label = (p) => Number(p) === 50 ? (ev().label50 || "Festa + bebidas") : (ev().label25 || "Só a festa");
function myState() {
  const r = S.rsvps.get(S.uid);
  if (!r) return "none";
  if (S.confs.get(S.uid)?.confirmed) return "ok";
  return r.paid ? "paid" : "unpaid";
}
const myName = () => S.rsvps.get(S.uid)?.name || ls.get("festa-name") || "";
function dateText() {
  const e = ev(); if (!e.date) return "A definir";
  const d = new Date(e.date + "T12:00:00");
  let s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  if (e.date2 && e.date2 !== e.date) {
    const d2 = new Date(e.date2 + "T12:00:00");
    const w = (x) => x.toLocaleDateString("pt-BR", { weekday: "long" }).split("-")[0];
    const m = (x) => x.toLocaleDateString("pt-BR", { month: "long" });
    s = `${w(d)} e ${w(d2)}, ${d.getDate()}${m(d) === m(d2) ? "" : " de " + m(d)} e ${d2.getDate()} de ${m(d2)}`;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const shortDate = () => { const e = ev(); if (!e.date) return "Data a definir"; const d = new Date(e.date + "T12:00:00"); const a = d.getDate(); const b = e.date2 ? new Date(e.date2 + "T12:00:00").getDate() : null; const m = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""); return (b && b !== a ? a + " e " + b : a) + " " + m + (e.time ? " · " + e.time : ""); };
const fullAddr = () => [ev().address, ev().city].filter(Boolean).join(", ");
function header() {
  $("topTitle").textContent = ev().title || "Festa na Casa";
  $("topSub").textContent = shortDate();
  document.title = ev().title || "Festa na Casa";
  $("navDot").hidden = !(myState() === "none" || myState() === "unpaid");
  $("navOrg").hidden = !S.admin;
}

/* ================= INÍCIO ================= */
function gallery() {
  const ph = [...S.photos].sort((a, b) => (a.order || 0) - (b.order || 0));
  const g = el("div", { class: "gallery" });
  if (!ph.length) {
    const e = el("div", { class: "gal-empty" }); e.innerHTML = '<div><svg viewBox="0 0 72 72" fill="none"><path d="M10 34 36 12l26 22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 30v28h36V30" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><rect x="31" y="42" width="10" height="16" rx="2" fill="currentColor"/></svg><b style="color:var(--ink)">Fotos da casa em breve</b></div>';
    g.append(e); return g;
  }
  if (S.gal >= ph.length) S.gal = 0;
  const track = el("div", { class: "track", style: `transform:translateX(-${S.gal * 100}%)` }, ph.map((p, i) => el("img", { src: p.data, alt: "Foto " + (i + 1) + " da casa", loading: i ? "lazy" : null })));
  const dots = el("div", { class: "gal-dots" }, ph.map((_, i) => el("i", { class: i === S.gal ? "on" : "" })));
  const count = el("span", { class: "gal-count", text: `${S.gal + 1}/${ph.length}` });
  g.append(track);
  if (ph.length > 1) {
    g.append(dots, count);
    const show = (i) => { S.gal = (i + ph.length) % ph.length; track.style.transform = `translateX(-${S.gal * 100}%)`; [...dots.children].forEach((d, k) => d.className = k === S.gal ? "on" : ""); count.textContent = `${S.gal + 1}/${ph.length}`; };
    let x0 = null;
    g.addEventListener("touchstart", (e) => x0 = e.touches[0].clientX, { passive: true });
    g.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) show(S.gal + (dx < 0 ? 1 : -1)); });
    g.addEventListener("click", (e) => { const r = g.getBoundingClientRect(); show(S.gal + (e.clientX - r.left > r.width / 2 ? 1 : -1)); });
  }
  return g;
}
function countdownEl() {
  const e = ev(); if (!e.date) return null;
  const start = new Date(e.date + "T" + (e.time || "00:00") + ":00");
  const end = e.date2 ? new Date(e.date2 + "T23:59:00") : new Date(+start + 12 * 36e5);
  const wrap = el("div", { class: "countdown", id: "cd" });
  const tick = () => {
    if (!wrap.isConnected) return clearInterval(iv);
    const ms = start - Date.now(); wrap.textContent = "";
    if (ms <= 0) { wrap.style.display = "block"; wrap.append(el("span", { class: "pill p-sun", text: Date.now() < +end ? "🎉 A festa está rolando!" : "Essa festa já aconteceu" })); return; }
    for (const [v, l] of [[Math.floor(ms / 864e5), "dias"], [Math.floor(ms / 36e5) % 24, "horas"], [Math.floor(ms / 6e4) % 60, "min"], [Math.floor(ms / 1e3) % 60, "seg"]])
      wrap.append(el("div", { class: "cd" }, el("b", { text: String(v).padStart(2, "0") }), el("span", { text: l })));
  };
  const iv = setInterval(tick, 1000); tick();
  return wrap;
}
function calendarUrl() {
  const e = ev(); if (!e.date) return null;
  const s = e.date.replaceAll("-", "") + "T" + (e.time || "12:00").replace(":", "") + "00";
  const f = (e.date2 || e.date).replaceAll("-", "") + "T230000";
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.title || "Festa") + "&dates=" + s + "/" + f + "&ctz=America/Sao_Paulo&location=" + encodeURIComponent(fullAddr()) + "&details=" + encodeURIComponent(location.href.split("#")[0]);
}
function invite() {
  const url = location.href.split("#")[0];
  const text = `🎉 ${ev().title || "Festa na Casa"} – ${dateText()}${ev().time ? " às " + ev().time : ""}\nConfirme sua presença, escolha o que vai levar e vote nas bebidas:\n${url}`;
  if (navigator.share) { navigator.share({ title: ev().title, text, url }).catch(() => {}); return; }
  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
}
let installEvt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (current() === "inicio") render(); });
function installCard() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone || ls.get("festa-install-off")) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const card = el("div", { class: "card install" },
    el("div", { class: "row" }, el("b", { class: "grow", text: "📲 Instale o app no celular" }), el("button", { class: "link", type: "button", onclick: () => { ls.set("festa-install-off", "1"); card.remove(); } }, "Fechar")));
  if (installEvt) card.append(el("button", { class: "btn btn-teal btn-block", type: "button", onclick: async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; card.remove(); } }, "Instalar agora"));
  else if (ios) card.append(el("ol", {}, el("li", {}, "Toque em ", el("b", { text: "Compartilhar" }), " (quadrado com seta) no Safari"), el("li", {}, "Escolha ", el("b", { text: "Adicionar à Tela de Início" }))));
  else card.append(el("ol", {}, el("li", {}, "Toque no menu ", el("b", { text: "⋮" }), " do navegador"), el("li", {}, "Escolha ", el("b", { text: "Instalar app" }), " ou ", el("b", { text: "Adicionar à tela inicial" }))));
  return card;
}
function rInicio() {
  const s = $("s-inicio"); s.textContent = "";
  const t = (ev().title || "Festa na Casa").trim().split(" ");
  const title = el("h1", { class: "hero-title" }, t.length > 1 ? [t.slice(0, -1).join(" ") + " ", el("em", { text: t.at(-1) })] : t[0]);
  const st = myState();
  const stMap = {
    none: ["🎟️", "var(--coral)", "var(--on-coral)", "Confirme sua presença", "Escolha R$ 25 ou R$ 50 e pague por PIX"],
    unpaid: ["💸", "var(--warn-soft)", "var(--warn)", "Falta fazer o PIX", money(S.rsvps.get(S.uid)?.plan) + " · toque para ver a chave"],
    paid: ["⏳", "var(--warn-soft)", "var(--warn)", "PIX em conferência", "O organizador vai confirmar"],
    ok: ["✓", "var(--ok-soft)", "var(--ok)", "Você está confirmado!", "Agora escolha o que vai levar"]
  }[st];
  const its = S.items, taken = its.filter((i) => i.claimedBy).length;
  const mine = its.filter((i) => i.claimedBy === S.uid).length;
  const voters = [...S.votes.values()].filter((v) => v.picks?.length).length;
  const confN = [...S.rsvps.keys()].filter((k) => S.confs.get(k)?.confirmed).length;
  const cal = calendarUrl();
  s.append(
    gallery(),
    el("div", { class: "screen-head" }, el("span", { class: "eyebrow", text: "Você está convidado" }), title, el("p", { class: "muted", text: ev().desc || "" })),
    el("button", { class: "status-card", type: "button", onclick: () => go(st === "ok" ? "levar" : "presenca") },
      el("span", { class: "ico", style: `background:${stMap[1]};color:${stMap[2]}`, text: stMap[0] }),
      el("span", { class: "grow", style: "flex:1;min-width:0" }, el("b", { style: "display:block", text: stMap[3] }), el("span", { class: "note", text: stMap[4] })),
      el("span", { class: "chev", text: "›" })),
    countdownEl(),
    el("div", { class: "facts" },
      el("div", { class: "fact wide" }, el("span", { class: "eyebrow", text: "Quando" }), el("div", { class: "v", text: dateText() })),
      el("div", { class: "fact" }, el("span", { class: "eyebrow", text: "A partir de" }), el("div", { class: "v mono", text: ev().time || "--:--" })),
      el("div", { class: "fact" }, el("span", { class: "eyebrow", text: "Confirmados" }), el("div", { class: "v mono", text: String(confN) })),
      el("div", { class: "fact wide" }, el("span", { class: "eyebrow", text: "Onde" }), el("div", { class: "v", text: fullAddr() || "Endereço a definir" }),
        fullAddr() ? el("div", { class: "btns", style: "margin-top:10px" },
          el("a", { class: "btn btn-teal btn-sm", href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(fullAddr()), target: "_blank", rel: "noopener" }, "📍 Abrir no mapa"),
          el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => copy(fullAddr(), "Endereço copiado") }, "Copiar endereço")) : null)),
    el("div", { class: "mini" },
      el("button", { type: "button", onclick: () => go("levar") }, el("b", { text: `${taken}/${its.length}` }), el("span", { text: mine ? `itens · você leva ${mine}` : "itens escolhidos" })),
      el("button", { type: "button", onclick: () => go("bebidas") }, el("b", { text: String(voters) }), el("span", { text: "votaram nas bebidas" })),
      el("button", { type: "button", onclick: () => go("presenca") }, el("b", { text: String(S.rsvps.size) }), el("span", { text: "na lista" }))),
    el("div", { class: "btns" },
      el("button", { class: "btn btn-wa", type: "button", onclick: invite }, "Convidar amigos"),
      cal ? el("a", { class: "btn btn-ghost", href: cal, target: "_blank", rel: "noopener" }, "📅 Agenda") : el("span")),
    installCard(),
    !S.admin ? el("div", { style: "text-align:center" }, el("button", { class: "link", type: "button", onclick: () => go("org") }, "Sou o organizador")) : null
  );
}

/* ================= PRESENÇA ================= */
function stepsEl(n) {
  return el("div", { style: "display:flex;flex-direction:column;gap:6px" },
    el("div", { class: "steps" }, [0, 1, 2].map((i) => el("div", { class: i <= n ? "on" : "" }))),
    el("div", { class: "step-lbl" }, el("span", { text: "1. Seus dados" }), el("span", { text: "2. PIX" }), el("span", { text: "3. Confirmado" })));
}
function rPresenca() {
  const s = $("s-presenca"); s.textContent = "";
  s.append(el("div", { class: "screen-head" }, el("span", { class: "eyebrow", text: "Presença" }), el("h1", { text: "Confirme que você vai" })));
  const st = myState(), r = S.rsvps.get(S.uid);
  const card = el("div", { class: "card" });
  if (!S.uid) card.append(el("p", { class: "muted", text: "Conectando…" }));
  else if (st === "none") {
    card.append(stepsEl(0));
    const name = el("input", { class: "input", id: "rsvpName", maxlength: "50", placeholder: "Nome e sobrenome", autocomplete: "name", enterkeyhint: "done" });
    name.value = ls.get("festa-name") || "";
    const plans = el("div", { class: "plans", role: "radiogroup", "aria-label": "Valor" });
    const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "submit" }, "Continuar para o PIX");
    const sync = () => btn.disabled = !(name.value.trim().length >= 2 && S.plan);
    for (const v of [25, 50]) {
      const b = el("button", { type: "button", class: "plan", role: "radio", "aria-checked": String(S.plan === v) },
        el("span", { class: "tick", text: S.plan === v ? "✓" : "" }), el("span", { class: "amt" }, el("small", { text: "R$ " }), String(v)), el("span", { class: "lbl", text: label(v) }));
      b.onclick = () => { S.plan = v; plans.querySelectorAll(".plan").forEach((p, i) => { const on = [25, 50][i] === v; p.setAttribute("aria-checked", on); p.querySelector(".tick").textContent = on ? "✓" : ""; }); sync(); };
      plans.append(b);
    }
    name.oninput = sync;
    const f = el("form", { style: "display:flex;flex-direction:column;gap:14px" },
      el("div", { class: "field" }, el("label", { for: "rsvpName", text: "Seu nome" }), name),
      el("div", { class: "field" }, el("label", { text: "Escolha o valor" }), plans), btn);
    f.onsubmit = async (e) => {
      e.preventDefault(); if (btn.disabled) return;
      btn.disabled = true; btn.textContent = "Salvando…";
      const nm = name.value.trim().slice(0, 50); ls.set("festa-name", nm);
      try { await S.store.set("rsvps/" + S.uid, { name: nm, plan: S.plan, paid: false, createdAt: Date.now() }); }
      catch (err) { fail(err); btn.disabled = false; btn.textContent = "Continuar para o PIX"; }
    };
    card.append(f); sync();
  } else if (st === "unpaid") {
    const key = ev().pixKey;
    card.append(stepsEl(1),
      el("p", {}, "Oi, ", el("b", { text: firstName(r.name) }), "! Faça o PIX e depois toque em ", el("b", { text: "Já fiz o PIX" }), "."),
      el("div", { class: "row" }, el("div", { class: "grow" }, el("span", { class: "eyebrow", text: "Valor" }), el("div", { class: "amount-big", text: money(r.plan) })), el("span", { class: "pill p-mute", text: label(r.plan) })),
      key ? el("div", { class: "pix" },
        el("span", { class: "eyebrow", text: "Chave PIX" + (ev().pixName ? " · " + ev().pixName : "") }),
        el("code", { text: key }),
        el("button", { class: "btn btn-teal btn-block", type: "button", onclick: () => copy(key, "Chave PIX copiada") }, "Copiar chave PIX"),
        el("span", { class: "note", text: "Abra o app do seu banco, escolha PIX, cole a chave e pague " + money(r.plan) + "." }))
        : el("div", { class: "empty", text: "A chave PIX ainda não foi cadastrada. Volte daqui a pouco." }),
      el("button", { class: "btn btn-primary btn-lg btn-block", type: "button", disabled: !key, onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = "Enviando…";
        try { await S.store.update("rsvps/" + S.uid, { paid: true, paidAt: Date.now() }); confetti(); toast("Avisamos o organizador!"); }
        catch (err) { fail(err); b.disabled = false; b.textContent = "Já fiz o PIX"; }
      } }, "Já fiz o PIX"),
      cancelBtn("Mudar valor ou desistir"));
  } else if (st === "paid") {
    card.append(stepsEl(1),
      el("div", { class: "big-status" }, el("span", { class: "ico", style: "background:var(--warn-soft);color:var(--warn)", text: "⏳" }),
        el("h2", { text: "PIX em conferência" }), el("p", { class: "muted", text: `Você informou o PIX de ${money(r.plan)}. Assim que o organizador conferir, sua presença fica confirmada aqui.` })),
      el("button", { class: "btn btn-ghost btn-block", type: "button", onclick: () => go("levar") }, "Enquanto isso, escolha o que levar"),
      cancelBtn("Cancelar presença"));
  } else {
    card.append(stepsEl(2),
      el("div", { class: "big-status" }, el("span", { class: "ico", style: "background:var(--ok-soft);color:var(--ok)", text: "✓" }),
        el("h2", { text: `Tudo certo, ${firstName(r.name)}!` }), el("p", { class: "muted", text: "Sua presença está confirmada." })),
      el("div", { class: "ticket" }, el("div", {}, el("span", { style: "font-size:.75rem;opacity:.7", text: "INGRESSO" }), el("b", { style: "display:block", text: r.name })), el("div", { style: "text-align:right" }, el("b", { class: "mono", text: money(r.plan) }), el("div", { style: "font-size:.75rem;opacity:.7", text: label(r.plan) }))),
      el("div", { class: "btns" }, el("button", { class: "btn btn-teal", type: "button", onclick: () => go("levar") }, "O que levar"), el("button", { class: "btn btn-ghost", type: "button", onclick: () => go("bebidas") }, "Votar")));
  }
  s.append(card, guestCard());
}
function cancelBtn(txt) {
  const b = el("button", { class: "link", type: "button", style: "align-self:center" }, txt);
  b.onclick = async () => {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Toque de novo para confirmar"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = txt; } }, 4000); return; }
    try { await S.store.del("rsvps/" + S.uid); S.plan = null; toast("Presença removida"); } catch (e) { fail(e); }
  };
  return b;
}
function guestList() {
  return [...S.rsvps.entries()].map(([id, r]) => ({ id, ...r, ok: !!S.confs.get(id)?.confirmed }))
    .sort((a, b) => (b.ok - a.ok) || (b.paid - a.paid) || String(a.name).localeCompare(String(b.name), "pt-BR"));
}
function guestCard(adminMode = false) {
  const all = guestList();
  const conf = all.filter((g) => g.ok), paid = all.filter((g) => !g.ok && g.paid), unpaid = all.filter((g) => !g.ok && !g.paid);
  const filt = adminMode ? S.guestFilter : "todos";
  const show = filt === "pagar" ? paid : filt === "ok" ? conf : all;
  const card = el("div", { class: "card" },
    el("div", { class: "row" }, el("h2", { class: "grow", text: adminMode ? "Pagamentos" : "Quem vai" }), el("span", { class: "pill p-mute mono", text: all.length + " na lista" })),
    el("div", { class: "stats" },
      el("div", { class: "stat" }, el("b", { text: String(conf.length) }), el("span", { text: "confirmados" })),
      el("div", { class: "stat" }, el("b", { text: String(paid.length + unpaid.length) }), el("span", { text: "pendentes" })),
      el("div", { class: "stat" }, el("b", { text: money(conf.reduce((s, g) => s + (Number(g.plan) || 0), 0)) }), el("span", { text: "recebido" }))));
  if (adminMode) {
    const seg = el("div", { class: "seg" });
    for (const [k, t] of [["pagar", `Conferir · ${paid.length}`], ["ok", `Pagos · ${conf.length}`], ["todos", "Todos"]])
      seg.append(el("button", { type: "button", "aria-pressed": String(filt === k), onclick: () => { S.guestFilter = k; render(); } }, t));
    card.append(seg);
  }
  const ul = el("ul", { class: "list" });
  if (!show.length) ul.append(el("li", { class: "empty", text: adminMode && filt === "pagar" ? "Nenhum PIX esperando conferência." : "Ninguém na lista ainda. Seja o primeiro!" }));
  for (const g of show) {
    const pill = g.ok ? el("span", { class: "pill p-ok", text: "Confirmado" }) : g.paid ? el("span", { class: "pill p-warn", text: "PIX informado" }) : el("span", { class: "pill p-mute", text: "Falta pagar" });
    const acts = el("div", { style: "display:flex;flex-direction:column;align-items:flex-end;gap:6px" }, pill);
    if (adminMode) {
      if (!g.ok) acts.append(el("button", { class: "btn btn-teal btn-sm", type: "button", onclick: () => setConf(g.id, true) }, "Confirmar"));
      else acts.append(el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => setConf(g.id, false) }, "Desfazer"));
    }
    ul.append(el("li", { class: "li" },
      el("span", { class: "avatar", style: "background:" + colorFor(g.id), text: initials(g.name) }),
      el("span", { class: "nm" }, String(g.name || "Sem nome") + (g.id === S.uid ? " (você)" : ""), el("small", { text: money(g.plan) + " · " + label(g.plan) })), acts));
  }
  card.append(ul);
  return card;
}
async function setConf(id, on) {
  try {
    if (on) { await S.store.set("confirmations/" + id, { confirmed: true, at: Date.now() }); confetti(); toast("Presença confirmada"); }
    else { await S.store.del("confirmations/" + id); toast("Confirmação desfeita"); }
  } catch (e) { fail(e); }
}

/* ================= O QUE LEVAR ================= */
function rLevar() {
  const s = $("s-levar"); s.textContent = "";
  const its = [...S.items].sort((a, b) => (a.order || 0) - (b.order || 0));
  const taken = its.filter((i) => i.claimedBy).length, mine = its.filter((i) => i.claimedBy === S.uid);
  s.append(el("div", { class: "screen-head" }, el("span", { class: "eyebrow", text: "Lista" }), el("h1", { text: "O que você vai levar?" }), el("p", { class: "muted", text: "Toque no quadrado do item. Toque de novo para desmarcar." })));
  const top = el("div", { class: "card" },
    el("div", { class: "row" }, el("b", { class: "grow", text: taken === its.length && its.length ? "Lista completa! 🎉" : `${its.length - taken} itens ainda sem dono` }), el("span", { class: "mono", text: `${taken}/${its.length}` })),
    el("div", { class: "progress" }, el("i", { style: `width:${its.length ? Math.round(taken / its.length * 100) : 0}%` })),
    mine.length ? el("p", { class: "note" }, "Você leva: ", el("b", { style: "color:var(--ink)", text: mine.map((m) => m.label).join(", ") })) : null);
  const filter = el("div", { class: "filter" });
  for (const [k, t] of [["todos", "Todos"], ["livres", "Sem dono"], ["meus", "Os meus"]])
    filter.append(el("button", { class: "chip", type: "button", "aria-pressed": String(S.itemFilter === k), onclick: () => { S.itemFilter = k; render(); } }, t));
  const list = el("div", { class: "items" });
  const vis = its.filter((i) => S.itemFilter === "livres" ? !i.claimedBy : S.itemFilter === "meus" ? i.claimedBy === S.uid : true);
  if (!S.loaded.items) list.append(el("div", { class: "empty", text: "Carregando a lista…" }));
  else if (!its.length) list.append(el("div", { class: "empty", text: "O organizador ainda não montou a lista." }));
  else if (!vis.length) list.append(el("div", { class: "empty", text: S.itemFilter === "meus" ? "Você ainda não escolheu nada." : "Todos os itens já têm dono." }));
  for (const it of vis) {
    const isMine = it.claimedBy === S.uid, other = it.claimedBy && !isMine;
    const sub = isMine ? "Você vai levar" : other ? (firstName(it.claimedName) || "Alguém") + " vai levar" : "Ninguém pegou ainda";
    list.append(el("button", { type: "button", class: "item" + (isMine ? " mine" : "") + (other ? " taken" : ""), "aria-pressed": String(!!it.claimedBy), disabled: other || null, onclick: () => toggleItem(it) },
      el("span", { class: "box" }, svgCheck()), el("span", { class: "txt" }, el("b", { text: it.label }), el("small", { text: sub }))));
  }
  s.append(top, filter, list);
}
async function toggleItem(it) {
  if (!S.uid) return;
  const nm = myName();
  if (!nm) { toast("Primeiro coloque seu nome em Presença"); go("presenca"); return; }
  try {
    if (it.claimedBy === S.uid) { await S.store.update("items/" + it.id, { claimedBy: null, claimedName: null, claimedAt: null }); toast("Item liberado"); }
    else if (!it.claimedBy) { await S.store.claim(it.id, nm); confetti(); toast("Anotado: você leva " + it.label); }
  } catch (e) { fail(e); }
}

/* ================= BEBIDAS ================= */
function rBebidas() {
  const s = $("s-bebidas"); s.textContent = "";
  const ds = [...S.drinks].sort((a, b) => (a.order || 0) - (b.order || 0));
  const counts = new Map(ds.map((d) => [d.id, 0]));
  for (const v of S.votes.values()) for (const p of v.picks || []) if (counts.has(p)) counts.set(p, counts.get(p) + 1);
  const voters = [...S.votes.values()].filter((v) => v.picks?.length).length;
  const max = Math.max(0, ...counts.values());
  const my = new Set(S.votes.get(S.uid)?.picks || []);
  s.append(el("div", { class: "screen-head" }, el("span", { class: "eyebrow", text: "Votação" }), el("h1", { text: "Quais bebidas não podem faltar?" })));
  const info = el("div", { class: "card" },
    el("div", { class: "row" }, el("div", { class: "grow" }, el("b", { text: `Seus votos: ${my.size} de 3` }), el("p", { class: "note", text: voters + (voters === 1 ? " pessoa votou" : " pessoas votaram") + " · resultado ao vivo" })),
      el("div", { class: "picks" }, [0, 1, 2].map((i) => el("i", { class: i < my.size ? "on" : "" })))));
  const list = el("div", { class: "drinks" });
  if (!S.loaded.drinks) list.append(el("div", { class: "empty", text: "Carregando opções…" }));
  else if (!ds.length) list.append(el("div", { class: "empty", text: "O organizador ainda não colocou opções." }));
  for (const d of ds) {
    const c = counts.get(d.id), pct = voters ? Math.round(c / voters * 100) : 0, on = my.has(d.id);
    list.append(el("button", { type: "button", class: "drink", "aria-pressed": String(on), onclick: () => vote(d.id) },
      el("span", { class: "bar", style: `width:${pct}%` }), el("span", { class: "vbox", text: on ? "✓" : "" }),
      el("span", { class: "dn" }, d.label, c > 0 && c === max ? el("span", { class: "crown", text: "Top" }) : null),
      el("span", { class: "cnt", text: `${c} · ${pct}%` })));
  }
  s.append(info, list);
}
let voting = false;
async function vote(id) {
  if (!S.uid || voting) return;
  const p = new Set(S.votes.get(S.uid)?.picks || []);
  if (p.has(id)) p.delete(id); else { if (p.size >= 3) return toast("Máximo de 3. Desmarque uma para trocar."); p.add(id); }
  voting = true;
  try { await S.store.set("votes/" + S.uid, { picks: [...p], at: Date.now() }); } catch (e) { fail(e); } finally { voting = false; }
}

/* ================= ORGANIZADOR ================= */
function rOrg() {
  const s = $("s-org"); s.textContent = "";
  if (!S.admin) {
    const email = el("input", { class: "input", id: "admEmail", type: "email", autocomplete: "username", placeholder: "seu@email.com" });
    const pass = el("input", { class: "input", id: "admPass", type: "password", autocomplete: "current-password", placeholder: "Senha" });
    const btn = el("button", { class: "btn btn-primary btn-lg btn-block", type: "submit" }, "Entrar");
    const f = el("form", { class: "card" },
      el("h2", { text: "Entrar como organizador" }),
      el("p", { class: "note", text: DEMO ? "Modo demonstração: qualquer e-mail e senha funcionam." : "Use o e-mail e a senha cadastrados no Firebase." }),
      el("div", { class: "field" }, el("label", { for: "admEmail", text: "E-mail" }), email),
      el("div", { class: "field" }, el("label", { for: "admPass", text: "Senha" }), pass), btn);
    f.onsubmit = async (e) => {
      e.preventDefault(); btn.disabled = true; btn.textContent = "Entrando…";
      try { await S.store.login(email.value.trim(), pass.value); toast("Bem-vindo, organizador!"); }
      catch (err) { console.error(err); toast("E-mail ou senha incorretos"); btn.disabled = false; btn.textContent = "Entrar"; }
    };
    s.append(el("div", { class: "screen-head" }, el("span", { class: "eyebrow", text: "Organizador" }), el("h1", { text: "Área do organizador" })), f,
      el("button", { class: "link", type: "button", style: "align-self:center", onclick: () => go("inicio") }, "Voltar para a festa"));
    return;
  }
  const pend = guestList().filter((g) => !g.ok && g.paid).length;
  s.append(el("div", { class: "screen-head" }, el("span", { class: "eyebrow", text: "Organizador" }), el("h1", { text: "Painel da festa" }),
    pend ? el("p", {}, el("span", { class: "pill p-warn", text: `${pend} PIX para conferir` })) : el("p", { class: "muted", text: "Tudo em dia por aqui." })));
  if (!S.evSaved) s.append(el("div", { class: "banner", text: "As informações da festa ainda não foram salvas no banco. Confira e toque em Salvar em \"Informações da festa\"." }));
  s.append(guestCard(true), evForm(), photoSec(), listAdmin("items", "Itens para levar", C.DEFAULT_ITEMS, 60), listAdmin("drinks", "Opções de bebida", C.DEFAULT_DRINKS, 40),
    el("button", { class: "btn btn-ghost btn-block", type: "button", onclick: async () => { await S.store.logout(); go("inicio"); toast("Você saiu do modo organizador"); } }, "Sair do modo organizador"));
}
const FIELDS = [["title", "Nome da festa", "text", 60, 1], ["desc", "Recado para os convidados", "text", 160, 1], ["date", "Primeiro dia", "date"], ["date2", "Último dia", "date"], ["time", "Horário", "time"], ["city", "Cidade", "text", 60],
  ["address", "Endereço", "text", 160, 1], ["pixKey", "Chave PIX", "text", 100, 1], ["pixName", "Nome de quem recebe o PIX", "text", 60, 1], ["label25", "O que inclui R$ 25", "text", 40], ["label50", "O que inclui R$ 50", "text", 40]];
function evForm() {
  const d = el("details", { class: "card adm-sec", open: !S.evSaved || null });
  const f = el("form", { class: "adm-body" });
  const inputs = {};
  const grid = el("div", { class: "two" });
  for (const [k, lbl, type, max, wide] of FIELDS) {
    const i = el("input", { class: "input", id: "f-" + k, type, maxlength: max || null });
    i.value = S.ev[k] || ""; i.oninput = () => S.editing = true; inputs[k] = i;
    grid.append(el("div", { class: "field", style: wide ? "grid-column:1/-1" : null }, el("label", { for: "f-" + k, text: lbl }), i));
  }
  const btn = el("button", { class: "btn btn-primary btn-block", type: "submit" }, "Salvar informações");
  f.append(grid, btn);
  f.onsubmit = async (e) => {
    e.preventDefault(); btn.disabled = true;
    const data = {}; for (const k in inputs) data[k] = inputs[k].value.trim();
    try { await S.store.set("event/info", data); S.editing = false; toast("Informações salvas"); } catch (err) { fail(err); }
    btn.disabled = false;
  };
  d.append(el("summary", {}, "Informações da festa"), f);
  return d;
}
function compress(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight; const m = 1400; if (w > m || h > m) { const k = m / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
      let q = .78, out = c.toDataURL("image/jpeg", q);
      while (out.length > 700000 && q > .35) { q -= .1; out = c.toDataURL("image/jpeg", q); }
      out.length > 900000 ? rej(new Error("grande")) : res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    img.src = url;
  });
}
function photoSec() {
  const ph = [...S.photos].sort((a, b) => (a.order || 0) - (b.order || 0));
  const d = el("details", { class: "card adm-sec" });
  const input = el("input", { type: "file", accept: "image/*", multiple: true, hidden: true, id: "photoIn" });
  const note = el("p", { class: "note", text: `${ph.length} de 10 fotos. A primeira aparece primeiro.` });
  input.onchange = async () => {
    const files = [...input.files].slice(0, 10 - ph.length); input.value = "";
    let n = 0, base = Date.now();
    for (const f of files) {
      note.textContent = `Enviando ${n + 1} de ${files.length}…`;
      try { const data = await compress(f); await S.store.add("photos", { data, order: base + n }); n++; } catch (e) { fail(e); }
    }
    toast(n + " foto(s) adicionada(s)");
  };
  const grid = el("div", { class: "photos-adm" },
    ph.map((p, i) => el("figure", {}, el("img", { src: p.data, alt: "Foto " + (i + 1) }), el("button", { type: "button", "aria-label": "Remover foto", onclick: async () => { try { await S.store.del("photos/" + p.id); toast("Foto removida"); } catch (e) { fail(e); } } }, "×"))),
    ph.length < 10 ? el("label", { class: "up-tile", for: "photoIn" }, "＋ Adicionar fotos") : null);
  d.append(el("summary", {}, `Fotos da casa (${ph.length})`), el("div", { class: "adm-body" }, grid, input, note));
  return d;
}
function listAdmin(col, title, defaults, max) {
  const arr = [...(col === "items" ? S.items : S.drinks)].sort((a, b) => (a.order || 0) - (b.order || 0));
  const d = el("details", { class: "card adm-sec" });
  const ul = el("ul", { class: "list" });
  for (const it of arr) ul.append(el("li", { class: "li" },
    el("span", { class: "nm" }, it.label, col === "items" && it.claimedBy ? el("small", { text: "Com " + (it.claimedName || "alguém") }) : null),
    col === "items" && it.claimedBy ? el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => S.store.update("items/" + it.id, { claimedBy: null, claimedName: null, claimedAt: null }).catch(fail) }, "Liberar") : null,
    el("button", { class: "btn btn-danger btn-sm", type: "button", "aria-label": "Remover " + it.label, onclick: () => S.store.del(col + "/" + it.id).catch(fail) }, "Remover")));
  const inp = el("input", { class: "input", placeholder: col === "items" ? "Novo item" : "Nova bebida", maxlength: String(max), "aria-label": "Novo" });
  const f = el("form", { class: "add-row" }, inp, el("button", { class: "btn btn-teal", type: "submit" }, "Adicionar"));
  f.onsubmit = async (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; try { await S.store.add(col, col === "items" ? { label: v.slice(0, max), order: Date.now(), claimedBy: null, claimedName: null } : { label: v.slice(0, max), order: Date.now() }); inp.value = ""; } catch (err) { fail(err); } };
  const body = el("div", { class: "adm-body" });
  if (!arr.length) body.append(el("button", { class: "btn btn-primary", type: "button", onclick: async () => {
    try { let i = 0; for (const l of defaults) await S.store.add(col, col === "items" ? { label: l, order: i++, claimedBy: null, claimedName: null } : { label: l, order: i++ }); toast("Lista criada"); } catch (e) { fail(e); }
  } }, "Criar lista sugerida (" + defaults.length + ")"));
  body.append(ul, f);
  d.append(el("summary", {}, `${title} (${arr.length})`), body);
  return d;
}

/* ================= início ================= */
let rT = null;
const soon = () => { clearTimeout(rT); rT = setTimeout(() => { const t = current(); if (t === "org" && S.editing) { header(); return; } render(t); }, 30); };

async function start() {
  $("demoTag").hidden = !DEMO;
  try { S.store = DEMO ? demoStore() : await firebaseStore(); }
  catch (e) { console.error(e); $("boot").textContent = "Não foi possível conectar. Verifique a internet e recarregue."; return; }
  let subscribed = false;
  S.store.onAuth((u) => {
    S.uid = u ? S.store.uid : null; S.admin = S.store.isAdmin();
    if (!subscribed && u) {
      subscribed = true;
      S.store.onDoc("event/info", (d) => { S.evSaved = !!d; S.ev = { ...C.EVENT_DEFAULTS, ...(d || {}) }; soon(); });
      S.store.onCol("rsvps", (a) => { S.rsvps = new Map(a.map((x) => [x.id, x])); soon(); });
      S.store.onCol("confirmations", (a) => { S.confs = new Map(a.map((x) => [x.id, x])); soon(); });
      S.store.onCol("items", (a) => { S.loaded.items = true; S.items = a; soon(); });
      S.store.onCol("drinks", (a) => { S.loaded.drinks = true; S.drinks = a; soon(); });
      S.store.onCol("votes", (a) => { S.votes = new Map(a.map((x) => [x.id, x])); soon(); });
      S.store.onCol("photos", (a) => { S.photos = a; soon(); });
    }
    $("boot").hidden = true;
    route();
  });
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
start();
