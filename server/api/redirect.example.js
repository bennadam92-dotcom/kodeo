// Kodeo — squelette de la redirection d'un QR code dynamique.
// Exemple type "Vercel / Netlify function". À adapter à votre hébergeur + base de données.
// Ce fichier est un MODÈLE : il n'est pas branché sur une vraie base pour l'instant.

// Pseudo-couche d'accès aux données — à remplacer par Supabase/Neon/D1, etc.
async function getQrById(id) {
  // TODO: SELECT id, target_url, active FROM qrcodes WHERE id = $1
  return null;
}

async function logScan(qrId, req) {
  // On dérive un minimum d'infos, sans stocker l'IP brute (RGPD).
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const device = /mobile|android|iphone|ipad/.test(ua) ? "mobile" : "desktop";
  // country/city : via un service de géo-IP côté edge (ex. req.geo sur Vercel/Cloudflare)
  const geo = req.geo || {};
  // TODO: INSERT INTO scans (qr_id, ts, country, city, device) VALUES (...)
  void [qrId, device, geo];
}

// Handler générique. Sur Vercel: export default (req, res) => ...
export default async function handler(req, res) {
  const id = (req.query && req.query.id) || "";
  const qr = await getQrById(id);

  if (!qr || !qr.active) {
    res.statusCode = 404;
    res.end("QR code introuvable ou désactivé.");
    return;
  }

  // On ne bloque pas la redirection sur le logging.
  logScan(id, req).catch(() => {});

  res.statusCode = 302;
  res.setHeader("Location", qr.target_url);
  res.end();
}
