/* Kodeo — backend DÉMO
 * -------------------------------------------------------------
 * Démontre l'offre Pro : QR codes DYNAMIQUES (URL modifiable après
 * impression + statistiques de scan) et un checkout Stripe SIMULÉ.
 *
 * ⚠️ Stockage EN MÉMOIRE : les données sont réinitialisées à chaque
 * redémarrage du service. En production, remplacer `store` par une base
 * (ex. Postgres — le compte Render a déjà `cvfacile-db`).
 *
 * ⚠️ Le paiement est SIMULÉ (aucune clé Stripe, aucun débit réel). Le
 * flux reproduit l'UX de Stripe Checkout pour la démo. Les points
 * d'intégration Stripe réels sont marqués « TODO STRIPE ».
 * ------------------------------------------------------------- */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());                       // démo : CORS ouvert (pas de cookies, session via en-tête)
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PRICE_EUR = 9;

/* ---- URL publique de CE service (pour construire les liens /r/:id) ---- */
function baseUrl(req) {
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  return proto + "://" + req.headers.host;
}

/* ---- Store en mémoire ---- */
// sessions: Map<sessionId, { plan: "free"|"pro" }>
// qrcodes:  Map<qrId, { id, session, label, target_url, created_at, scans: [{ts, device, country}] }>
const sessions = new Map();
const qrcodes = new Map();

function getSession(id) {
  if (!id) return null;
  if (!sessions.has(id)) sessions.set(id, { plan: "free" });
  return sessions.get(id);
}
function sessionId(req) {
  return (req.headers["x-demo-session"] || req.query.session || "").toString().slice(0, 64) || null;
}
function shortId(n = 6) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ---- Génère des scans synthétiques pour que la démo de stats soit parlante ---- */
function seedScans() {
  const devices = ["mobile", "mobile", "mobile", "desktop"]; // majorité mobile
  const countries = ["France", "France", "France", "Belgique", "Suisse", "Canada"];
  const n = 18 + Math.floor(Math.random() * 45);
  const scans = [];
  for (let i = 0; i < n; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const ts = Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000);
    scans.push({
      ts,
      device: devices[Math.floor(Math.random() * devices.length)],
      country: countries[Math.floor(Math.random() * countries.length)]
    });
  }
  return scans.sort((a, b) => a.ts - b.ts);
}

/* ================= ROUTES API ================= */

app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Compte démo (plan courant)
app.get("/api/account", (req, res) => {
  const s = getSession(sessionId(req));
  if (!s) return res.status(400).json({ error: "session manquante" });
  res.json({ plan: s.plan, price_eur: PRICE_EUR });
});

// Liste des QR dynamiques de la session
app.get("/api/qr", (req, res) => {
  const sid = sessionId(req);
  if (!sid) return res.status(400).json({ error: "session manquante" });
  const list = [...qrcodes.values()]
    .filter((q) => q.session === sid)
    .map((q) => publicQr(q, req))
    .sort((a, b) => b.created_at - a.created_at);
  res.json({ items: list });
});

// Création d'un QR dynamique
app.post("/api/qr", (req, res) => {
  const sid = sessionId(req);
  if (!sid) return res.status(400).json({ error: "session manquante" });
  const s = getSession(sid);

  let { label, target_url } = req.body || {};
  target_url = normalizeUrl(target_url);
  if (!target_url) return res.status(400).json({ error: "URL cible invalide" });
  label = (label || "Mon QR dynamique").toString().slice(0, 80);

  // Démo : le plan gratuit est limité à 2 QR dynamiques pour illustrer le gating
  const count = [...qrcodes.values()].filter((q) => q.session === sid).length;
  if (s.plan === "free" && count >= 2) {
    return res.status(402).json({ error: "limite_gratuite", message: "Le plan gratuit est limité à 2 QR dynamiques. Passez à Pro pour un volume illimité." });
  }

  let id;
  do { id = shortId(); } while (qrcodes.has(id));
  const qr = { id, session: sid, label, target_url, created_at: Date.now(), scans: seedScans() };
  qrcodes.set(id, qr);
  res.status(201).json(publicQr(qr, req));
});

// Modifier la destination (LE cœur du QR dynamique)
app.patch("/api/qr/:id", (req, res) => {
  const sid = sessionId(req);
  const qr = qrcodes.get(req.params.id);
  if (!qr || qr.session !== sid) return res.status(404).json({ error: "introuvable" });
  const target = normalizeUrl((req.body || {}).target_url);
  if (!target) return res.status(400).json({ error: "URL cible invalide" });
  qr.target_url = target;
  res.json(publicQr(qr, req));
});

app.delete("/api/qr/:id", (req, res) => {
  const sid = sessionId(req);
  const qr = qrcodes.get(req.params.id);
  if (!qr || qr.session !== sid) return res.status(404).json({ error: "introuvable" });
  qrcodes.delete(req.params.id);
  res.json({ ok: true });
});

// Statistiques de scan — RÉSERVÉ au plan Pro (gating démontré côté serveur)
app.get("/api/qr/:id/stats", (req, res) => {
  const sid = sessionId(req);
  const s = getSession(sid);
  const qr = qrcodes.get(req.params.id);
  if (!qr || qr.session !== sid) return res.status(404).json({ error: "introuvable" });
  if (s.plan !== "pro") return res.status(402).json({ error: "pro_requis", message: "Les statistiques sont réservées au plan Pro." });
  res.json(computeStats(qr));
});

/* ---- Checkout Stripe SIMULÉ ---- */
// Démarre une "session de paiement" démo → renvoie l'URL de la page de checkout simulée.
app.post("/api/checkout", (req, res) => {
  const sid = sessionId(req);
  if (!sid) return res.status(400).json({ error: "session manquante" });
  const ret = encodeURIComponent((req.body && req.body.return_url) || "");
  // TODO STRIPE : ici, créer une vraie session Stripe Checkout (mode test) :
  //   const session = await stripe.checkout.sessions.create({ mode:"subscription", line_items:[...], success_url, cancel_url });
  //   return res.json({ checkout_url: session.url });
  const url = baseUrl(req) + "/demo-checkout?session=" + encodeURIComponent(sid) + "&return_url=" + ret;
  res.json({ checkout_url: url, demo: true });
});

// Confirme le "paiement" démo → passe le compte en Pro.
app.post("/api/checkout/confirm", (req, res) => {
  const sid = sessionId(req);
  const s = getSession(sid);
  if (!s) return res.status(400).json({ error: "session manquante" });
  // TODO STRIPE : en réel, ceci serait déclenché par le webhook `checkout.session.completed`.
  s.plan = "pro";
  res.json({ ok: true, plan: "pro" });
});

// (démo) revenir en plan gratuit, pratique pour re-tester
app.post("/api/checkout/reset", (req, res) => {
  const s = getSession(sessionId(req));
  if (s) s.plan = "free";
  res.json({ ok: true, plan: "free" });
});

/* ================= REDIRECTION DYNAMIQUE ================= */
app.get("/r/:id", (req, res) => {
  const qr = qrcodes.get(req.params.id);
  if (!qr) {
    return res.status(404).type("html").send(notFoundPage());
  }
  // Log du scan (RGPD : pas d'IP brute stockée, on ne garde que device + pays approximatif)
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const device = /mobile|android|iphone|ipad|ipod/.test(ua) ? "mobile" : "desktop";
  const country = req.headers["x-vercel-ip-country"] || req.headers["cf-ipcountry"] || "—";
  qr.scans.push({ ts: Date.now(), device, country });
  res.redirect(302, qr.target_url);
});

/* ================= PAGE DE CHECKOUT SIMULÉE ================= */
app.get("/demo-checkout", (req, res) => {
  const session = (req.query.session || "").toString();
  const ret = (req.query.return_url || "").toString();
  res.type("html").send(checkoutPage(session, ret, baseUrl(req)));
});

app.get("/", (req, res) => {
  res.type("html").send(
    "<h1>Kodeo API (démo)</h1><p>Backend des QR codes dynamiques + checkout simulé.</p>" +
    "<p>Endpoints : <code>/health</code>, <code>/api/qr</code>, <code>/r/:id</code>, <code>/demo-checkout</code>.</p>"
  );
});

/* ================= HELPERS ================= */
function normalizeUrl(u) {
  u = (u || "").toString().trim();
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "https://" + u;
  try { new URL(u); return u; } catch (e) { return null; }
}

function publicQr(qr, req) {
  return {
    id: qr.id,
    label: qr.label,
    target_url: qr.target_url,
    created_at: qr.created_at,
    redirect_url: baseUrl(req) + "/r/" + qr.id,
    scan_count: qr.scans.length
  };
}

function computeStats(qr) {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("fr-FR", { weekday: "short" }), count: 0 });
  }
  const devices = {};
  const countries = {};
  qr.scans.forEach((sc) => {
    const key = new Date(sc.ts).toISOString().slice(0, 10);
    const day = days.find((x) => x.key === key);
    if (day) day.count++;
    devices[sc.device] = (devices[sc.device] || 0) + 1;
    countries[sc.country] = (countries[sc.country] || 0) + 1;
  });
  return { total: qr.scans.length, days, devices, countries };
}

function notFoundPage() {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR code introuvable</title>
  <style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f6f7fb;color:#12141c;text-align:center}a{color:#4f46e5}</style></head>
  <body><div><h1>QR code introuvable</h1><p>Ce QR code dynamique n'existe pas ou a été supprimé.</p><p><a href="/">Kodeo</a></p></div></body></html>`;
}

function checkoutPage(session, ret, base) {
  const safeRet = ret.replace(/"/g, "&quot;");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Paiement — Kodeo Pro (démo)</title>
  <style>
    :root{--indigo:#635bff}
    *{box-sizing:border-box} body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;background:#f6f9fc;color:#1a1f36}
    .bar{background:#fff8e1;color:#7a5b00;text-align:center;padding:10px;font-size:14px;font-weight:600;border-bottom:1px solid #f2d98a}
    .wrap{max-width:420px;margin:40px auto;padding:0 20px}
    .card{background:#fff;border-radius:14px;box-shadow:0 15px 35px rgba(60,66,87,.12),0 5px 15px rgba(0,0,0,.06);padding:30px}
    h1{font-size:20px;margin:0 0 4px} .muted{color:#697386;font-size:14px;margin:0 0 20px}
    .amount{font-size:34px;font-weight:800;margin:6px 0 20px}
    label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px}
    input{width:100%;padding:12px;border:1px solid #e0e6ef;border-radius:8px;font-size:15px;background:#fff}
    .row{display:flex;gap:12px} .row>div{flex:1}
    .pay{width:100%;margin-top:22px;background:var(--indigo);color:#fff;border:0;padding:14px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer}
    .pay:hover{background:#5249e6} .pay:disabled{opacity:.6;cursor:default}
    .powered{text-align:center;color:#8792a2;font-size:12px;margin-top:18px}
    .cancel{display:block;text-align:center;margin-top:14px;color:#697386;font-size:14px}
  </style></head>
  <body>
    <div class="bar">⚠️ Mode DÉMO — aucun paiement réel n'est effectué</div>
    <div class="wrap">
      <div class="card">
        <h1>Kodeo Pro</h1>
        <p class="muted">Abonnement mensuel · résiliable à tout moment</p>
        <div class="amount">9,00 € <span style="font-size:15px;font-weight:600;color:#697386">/ mois</span></div>
        <form id="pay-form">
          <label>Email</label>
          <input type="email" value="demo@kodeo.app" readonly>
          <label>Informations de carte</label>
          <input id="card" placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242">
          <div class="row">
            <div><label>Expiration</label><input value="12 / 34" placeholder="MM / AA"></div>
            <div><label>CVC</label><input value="123" placeholder="CVC"></div>
          </div>
          <button class="pay" id="pay-btn" type="submit">Payer 9,00 € (démo)</button>
        </form>
        <a class="cancel" href="${safeRet || '/'}">Annuler et revenir</a>
        <p class="powered">Interface de démonstration inspirée de Stripe Checkout.<br>Aucune donnée bancaire n'est transmise.</p>
      </div>
    </div>
    <script>
      var RET = ${JSON.stringify(ret || "")};
      var SESSION = ${JSON.stringify(session)};
      document.getElementById("pay-form").addEventListener("submit", function(e){
        e.preventDefault();
        var btn = document.getElementById("pay-btn");
        btn.disabled = true; btn.textContent = "Traitement…";
        fetch("/api/checkout/confirm", {
          method:"POST", headers:{"Content-Type":"application/json","X-Demo-Session":SESSION},
          body: JSON.stringify({ session: SESSION })
        }).then(function(r){ return r.json(); }).then(function(){
          btn.textContent = "✓ Paiement accepté";
          setTimeout(function(){
            var url = RET || "/";
            url += (url.indexOf("?")>=0 ? "&" : "?") + "upgraded=1";
            window.location.href = url;
          }, 700);
        }).catch(function(){ btn.disabled=false; btn.textContent="Réessayer"; });
      });
    </script>
  </body></html>`;
}

app.listen(PORT, () => console.log("Kodeo API (démo) sur le port " + PORT));
