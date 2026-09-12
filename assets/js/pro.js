/* Kodeo — dashboard démo de l'offre Pro (QR dynamiques + stats + upgrade Stripe simulé).
   Parle au backend Express (server/). Dépend de qrcode.js (global `qrcode`). */
(function () {
  "use strict";

  // URL du backend démo (Render). Mise à jour après déploiement du service.
  var API_BASE = "https://kodeo-api.onrender.com";

  var $ = function (s, c) { return (c || document).querySelector(s); };

  // Session démo persistée localement
  var SESSION = localStorage.getItem("kodeo_demo_session");
  if (!SESSION) {
    SESSION = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("kodeo_demo_session", SESSION);
  }

  var state = { plan: "free", items: [], openStats: null };

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "Content-Type": "application/json", "X-Demo-Session": SESSION }, opts.headers || {});
    return fetch(API_BASE + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        return { ok: r.ok, status: r.status, body: body };
      });
    });
  }

  /* ---------- QR rendering (réutilise qrcode-generator) ---------- */
  function drawQr(canvas, text, px) {
    px = px || 220;
    try {
      var qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      var count = qr.getModuleCount();
      var margin = 2, total = count + margin * 2;
      var cell = Math.floor(px / total), dim = cell * total;
      canvas.width = dim; canvas.height = dim;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, dim, dim);
      ctx.fillStyle = "#12141c";
      for (var r = 0; r < count; r++)
        for (var c = 0; c < count; c++)
          if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    } catch (e) { /* contenu trop long : on ignore */ }
  }

  /* ---------- Rendu ---------- */
  function renderPlan() {
    var pill = $("#plan-pill");
    if (state.plan === "pro") {
      pill.className = "plan-pill pro"; pill.textContent = "Plan Pro ✓";
      $("#upgrade-cta").hidden = true;
      $("#reset-plan").hidden = false;
    } else {
      pill.className = "plan-pill free"; pill.textContent = "Plan Gratuit";
      $("#upgrade-cta").hidden = false;
      $("#reset-plan").hidden = true;
    }
  }

  function renderList() {
    var ul = $("#qr-list");
    ul.innerHTML = "";
    if (!state.items.length) {
      ul.innerHTML = '<li style="justify-content:center;color:var(--text-soft)">Aucun QR dynamique pour l\'instant. Créez-en un ci-dessus 👆</li>';
      return;
    }
    state.items.forEach(function (q) {
      var li = document.createElement("li");
      li.style.flexDirection = "column";
      li.style.alignItems = "stretch";
      li.innerHTML =
        '<div style="display:flex;gap:14px;align-items:center">' +
          '<canvas class="mini-qr" width="120" height="120" style="width:80px;height:80px;border:1px solid var(--border);border-radius:8px"></canvas>' +
          '<div style="flex:1;min-width:0">' +
            '<strong>' + escapeHtml(q.label) + '</strong>' +
            '<div class="meta">➡ ' + escapeHtml(q.target_url) + '</div>' +
            '<div class="meta">🔗 ' + escapeHtml(q.redirect_url) + '</div>' +
            '<div class="meta">' + q.scan_count + ' scan(s)</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
          '<button class="btn btn-ghost" data-act="edit" style="padding:7px 12px;font-size:13px">✏️ Changer la destination</button>' +
          '<button class="btn btn-ghost" data-act="stats" style="padding:7px 12px;font-size:13px">📊 Statistiques</button>' +
          '<a class="btn btn-ghost" href="' + q.redirect_url + '" target="_blank" rel="noopener" style="padding:7px 12px;font-size:13px">↗ Tester</a>' +
          '<button class="btn btn-ghost" data-act="del" style="padding:7px 12px;font-size:13px;color:#c0392b">🗑</button>' +
        '</div>' +
        '<div class="stats-panel" hidden style="margin-top:12px"></div>';
      var canvas = li.querySelector(".mini-qr");
      drawQr(canvas, q.redirect_url, 120);
      li.querySelector('[data-act="edit"]').addEventListener("click", function () { editTarget(q); });
      li.querySelector('[data-act="stats"]').addEventListener("click", function () { toggleStats(q, li); });
      li.querySelector('[data-act="del"]').addEventListener("click", function () { delQr(q); });
      ul.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* ---------- Actions ---------- */
  function refresh() {
    return Promise.all([
      api("/api/account"),
      api("/api/qr")
    ]).then(function (res) {
      if (res[0].ok) state.plan = res[0].body.plan;
      if (res[1].ok) state.items = res[1].body.items || [];
      renderPlan();
      renderList();
    });
  }

  function createQr() {
    var label = $("#f-label").value.trim();
    var url = $("#f-target").value.trim();
    var msg = $("#create-msg");
    msg.textContent = "";
    if (!url) { msg.textContent = "Entrez une URL de destination."; return; }
    var btn = $("#btn-create"); btn.disabled = true; btn.textContent = "Création…";
    api("/api/qr", { method: "POST", body: JSON.stringify({ label: label, target_url: url }) }).then(function (r) {
      btn.disabled = false; btn.textContent = "Créer le QR dynamique";
      if (!r.ok) { msg.textContent = r.body.message || "Erreur lors de la création."; return; }
      $("#f-label").value = ""; $("#f-target").value = "";
      refresh();
    });
  }

  function editTarget(q) {
    var url = prompt("Nouvelle destination pour « " + q.label + " » :\n(le QR imprimé reste identique, seule la redirection change)", q.target_url);
    if (url === null) return;
    api("/api/qr/" + q.id, { method: "PATCH", body: JSON.stringify({ target_url: url.trim() }) }).then(function (r) {
      if (!r.ok) { alert(r.body.error || "URL invalide"); return; }
      refresh();
    });
  }

  function delQr(q) {
    if (!confirm("Supprimer « " + q.label + " » ?")) return;
    api("/api/qr/" + q.id, { method: "DELETE" }).then(refresh);
  }

  function toggleStats(q, li) {
    var panel = li.querySelector(".stats-panel");
    if (!panel.hidden) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.innerHTML = '<div style="color:var(--text-soft);font-size:14px">Chargement…</div>';
    api("/api/qr/" + q.id + "/stats").then(function (r) {
      if (r.status === 402) { panel.innerHTML = lockedStats(); panel.querySelector("[data-up]").addEventListener("click", startUpgrade); return; }
      if (!r.ok) { panel.innerHTML = '<div style="color:#c0392b">Erreur.</div>'; return; }
      panel.innerHTML = renderStats(r.body);
    });
  }

  function lockedStats() {
    return '<div style="background:var(--bg-soft);border:1px dashed var(--border);border-radius:10px;padding:18px;text-align:center">' +
      '<div style="font-size:24px">🔒</div>' +
      '<p style="margin:6px 0 12px;font-weight:600">Les statistiques de scan sont réservées au plan Pro.</p>' +
      '<button class="btn btn-primary" data-up style="padding:9px 16px">Passer à Pro (démo) — 9 €/mois</button></div>';
  }

  function renderStats(s) {
    var max = Math.max(1, Math.max.apply(null, s.days.map(function (d) { return d.count; })));
    var bars = s.days.map(function (d) {
      var h = Math.round((d.count / max) * 90);
      return '<div style="flex:1;text-align:center">' +
        '<div style="height:90px;display:flex;align-items:flex-end;justify-content:center">' +
          '<div title="' + d.count + ' scans" style="width:60%;height:' + h + 'px;background:linear-gradient(180deg,var(--primary),var(--accent));border-radius:4px 4px 0 0;min-height:3px"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-soft);margin-top:4px">' + d.label + '</div>' +
        '<div style="font-size:12px;font-weight:700">' + d.count + '</div></div>';
    }).join("");
    var dev = Object.keys(s.devices).map(function (k) { return k + " : " + s.devices[k]; }).join(" · ");
    var ctr = Object.keys(s.countries).map(function (k) { return k + " (" + s.countries[k] + ")"; }).join(" · ");
    return '<div style="background:var(--bg-soft);border-radius:10px;padding:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">' +
        '<strong>' + s.total + ' scans</strong><span style="font-size:12px;color:var(--text-soft)">7 derniers jours</span></div>' +
      '<div style="display:flex;gap:6px;align-items:flex-end">' + bars + '</div>' +
      '<div style="font-size:13px;color:var(--text-soft);margin-top:12px">📱 ' + dev + '</div>' +
      '<div style="font-size:13px;color:var(--text-soft);margin-top:4px">🌍 ' + ctr + '</div></div>';
  }

  /* ---------- Upgrade (Stripe simulé) ---------- */
  function startUpgrade() {
    api("/api/checkout", { method: "POST", body: JSON.stringify({ return_url: location.href.split("?")[0] }) }).then(function (r) {
      if (r.ok && r.body.checkout_url) window.location.href = r.body.checkout_url;
      else alert("Impossible de démarrer le checkout démo.");
    });
  }

  function resetPlan() {
    api("/api/checkout/reset", { method: "POST" }).then(refresh);
  }

  /* ---------- Init ---------- */
  function init() {
    var toggle = document.querySelector(".nav-toggle");
    if (toggle) toggle.addEventListener("click", function () { document.querySelector(".nav").classList.toggle("open"); });

    $("#btn-create").addEventListener("click", createQr);
    $("#upgrade-cta").addEventListener("click", startUpgrade);
    $("#reset-plan").addEventListener("click", resetPlan);

    // Retour depuis le checkout démo
    if (new URLSearchParams(location.search).get("upgraded") === "1") {
      history.replaceState({}, "", location.pathname);
      $("#upgraded-banner").hidden = false;
    }

    // Vérifie que le backend répond
    api("/health").then(function (r) {
      if (!r.ok) $("#api-warn").hidden = false;
    }).catch(function () { $("#api-warn").hidden = false; });

    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
