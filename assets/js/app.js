/* Kodeo — générateur de QR codes (client-side, sans backend)
   Dépend de qrcode-generator (assets/js/qrcode.js) exposé en global `qrcode`. */
(function () {
  "use strict";

  var state = {
    type: "url",
    fg: "#12141c",
    bg: "#ffffff",
    ecl: "M",       // L, M, Q, H
    margin: 2,      // en modules
    size: 1000,     // px export
    logo: null      // Image element
  };

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var canvas = $("#qr-canvas");
  var ctx = canvas.getContext("2d");

  /* -------- Construction du contenu selon le type -------- */
  function esc(v) { return (v || "").trim(); }
  // Échappe les caractères spéciaux du format WIFI/MECARD
  function escWifi(v) { return (v || "").replace(/([\\;,:"])/g, "\\$1"); }

  function buildContent() {
    switch (state.type) {
      case "url": {
        var u = esc($("#f-url").value);
        if (!u) return "";
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^(mailto|tel):/i.test(u)) u = "https://" + u;
        return u;
      }
      case "text":
        return esc($("#f-text").value);
      case "wifi": {
        var ssid = escWifi(esc($("#f-wifi-ssid").value));
        if (!ssid) return "";
        var pass = escWifi(esc($("#f-wifi-pass").value));
        var enc = $("#f-wifi-enc").value; // WPA / WEP / nopass
        var hidden = $("#f-wifi-hidden").checked ? "true" : "false";
        if (enc === "nopass") return "WIFI:T:nopass;S:" + ssid + ";;";
        return "WIFI:T:" + enc + ";S:" + ssid + ";P:" + pass + ";H:" + hidden + ";;";
      }
      case "vcard": {
        var fn = esc($("#f-vc-first").value), ln = esc($("#f-vc-last").value);
        if (!fn && !ln) return "";
        var lines = ["BEGIN:VCARD", "VERSION:3.0"];
        lines.push("N:" + ln + ";" + fn + ";;;");
        lines.push("FN:" + (fn + " " + ln).trim());
        var org = esc($("#f-vc-org").value); if (org) lines.push("ORG:" + org);
        var title = esc($("#f-vc-title").value); if (title) lines.push("TITLE:" + title);
        var tel = esc($("#f-vc-tel").value); if (tel) lines.push("TEL;TYPE=CELL:" + tel);
        var email = esc($("#f-vc-email").value); if (email) lines.push("EMAIL:" + email);
        var url = esc($("#f-vc-url").value); if (url) lines.push("URL:" + url);
        lines.push("END:VCARD");
        return lines.join("\n");
      }
      case "email": {
        var addr = esc($("#f-em-to").value);
        if (!addr) return "";
        var subj = encodeURIComponent(esc($("#f-em-subject").value));
        var body = encodeURIComponent(esc($("#f-em-body").value));
        var q = [];
        if (subj) q.push("subject=" + subj);
        if (body) q.push("body=" + body);
        return "mailto:" + addr + (q.length ? "?" + q.join("&") : "");
      }
      case "sms": {
        var num = esc($("#f-sms-num").value);
        if (!num) return "";
        var msg = esc($("#f-sms-msg").value);
        return "SMSTO:" + num + (msg ? ":" + msg : "");
      }
      case "tel": {
        var t = esc($("#f-tel-num").value);
        return t ? "tel:" + t : "";
      }
      default:
        return "";
    }
  }

  /* -------- Génération de la matrice QR -------- */
  function makeMatrix(content) {
    // typeNumber 0 = auto-détection de la version
    var qr = qrcode(0, state.ecl);
    qr.addData(content);
    qr.make();
    var count = qr.getModuleCount();
    var m = [];
    for (var r = 0; r < count; r++) {
      m[r] = [];
      for (var c = 0; c < count; c++) m[r][c] = qr.isDark(r, c);
    }
    return m;
  }

  /* -------- Rendu canvas (PNG) -------- */
  function drawCanvas(matrix, px) {
    var count = matrix.length;
    var margin = state.margin;
    var total = count + margin * 2;
    var cell = Math.floor(px / total);
    var dim = cell * total;
    canvas.width = dim;
    canvas.height = dim;

    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = state.fg;
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (matrix[r][c]) {
          ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
    }

    if (state.logo) {
      var logoRatio = 0.22;
      var lw = Math.round(dim * logoRatio);
      var lx = Math.round((dim - lw) / 2);
      // fond blanc arrondi derrière le logo pour préserver la lisibilité
      var pad = Math.round(lw * 0.12);
      ctx.fillStyle = state.bg;
      roundRect(ctx, lx - pad, lx - pad, lw + pad * 2, lw + pad * 2, Math.round(lw * 0.14));
      ctx.fill();
      ctx.drawImage(state.logo, lx, lx, lw, lw);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* -------- Génération SVG (export vectoriel) -------- */
  function buildSVG(matrix) {
    var count = matrix.length;
    var margin = state.margin;
    var total = count + margin * 2;
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="' + total + '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges">');
    parts.push('<rect width="' + total + '" height="' + total + '" fill="' + state.bg + '"/>');
    var d = "";
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (matrix[r][c]) d += "M" + (c + margin) + "," + (r + margin) + "h1v1h-1z";
      }
    }
    parts.push('<path d="' + d + '" fill="' + state.fg + '"/>');
    parts.push("</svg>");
    return parts.join("");
  }

  /* -------- Pipeline complet -------- */
  var lastMatrix = null;
  var hasContent = false;

  function render() {
    var content = buildContent();
    var dlBtns = $$("[data-dl]");
    if (!content) {
      hasContent = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 1000; canvas.height = 1000;
      ctx.fillStyle = "#f6f7fb"; ctx.fillRect(0, 0, 1000, 1000);
      dlBtns.forEach(function (b) { b.disabled = true; b.style.opacity = .5; });
      $("#preview-note").textContent = "Remplissez le formulaire pour générer votre QR code.";
      return;
    }
    try {
      lastMatrix = makeMatrix(content);
      drawCanvas(lastMatrix, 1000);
      hasContent = true;
      dlBtns.forEach(function (b) { b.disabled = false; b.style.opacity = 1; });
      $("#preview-note").textContent = "Astuce : testez le scan avec votre téléphone avant d'imprimer.";
    } catch (e) {
      hasContent = false;
      $("#preview-note").textContent = "Contenu trop long pour un QR code. Raccourcissez le texte.";
      dlBtns.forEach(function (b) { b.disabled = true; b.style.opacity = .5; });
    }
  }

  /* -------- Téléchargements -------- */
  function download(filename, href) {
    var a = document.createElement("a");
    a.href = href; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function downloadPNG(size) {
    if (!hasContent || !lastMatrix) return;
    // redessine à la taille d'export choisie
    drawCanvas(lastMatrix, size);
    var url = canvas.toDataURL("image/png");
    drawCanvas(lastMatrix, 1000); // remet l'aperçu
    download("qrcode-kodeo.png", url);
  }

  function downloadSVG() {
    if (!hasContent || !lastMatrix) return;
    var svg = buildSVG(lastMatrix);
    var blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    download("qrcode-kodeo.svg", url);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* -------- UI : onglets de type -------- */
  function selectType(type) {
    state.type = type;
    $$(".type-tab").forEach(function (t) { t.classList.toggle("active", t.dataset.type === type); });
    $$(".type-form").forEach(function (f) { f.hidden = f.dataset.form !== type; });
    render();
  }

  /* -------- Init -------- */
  function init() {
    $$(".type-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { selectType(tab.dataset.type); });
    });

    // Tous les champs déclenchent un rendu live
    $$("#qr-form input, #qr-form textarea, #qr-form select").forEach(function (el) {
      var ev = (el.type === "color" || el.type === "range" || el.tagName === "SELECT" || el.type === "checkbox") ? "input" : "input";
      el.addEventListener(ev, render);
    });

    // Options d'apparence
    $("#opt-fg").addEventListener("input", function (e) { state.fg = e.target.value; $("#opt-fg-val").textContent = e.target.value.toUpperCase(); render(); });
    $("#opt-bg").addEventListener("input", function (e) { state.bg = e.target.value; $("#opt-bg-val").textContent = e.target.value.toUpperCase(); render(); });
    $("#opt-ecl").addEventListener("change", function (e) { state.ecl = e.target.value; render(); });
    $("#opt-margin").addEventListener("input", function (e) { state.margin = parseInt(e.target.value, 10); $("#opt-margin-out").value = e.target.value; render(); });

    // Logo
    var logoInput = $("#opt-logo");
    var logoDrop = $("#logo-drop");
    logoDrop.addEventListener("click", function () { logoInput.click(); });
    logoInput.addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          state.logo = img;
          logoDrop.classList.add("has-logo");
          logoDrop.textContent = "✓ Logo ajouté — cliquez pour changer";
          $("#logo-remove").hidden = false;
          render();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    var logoRemove = $("#logo-remove");
    logoRemove.addEventListener("click", function (e) {
      e.stopPropagation();
      state.logo = null; logoInput.value = "";
      logoDrop.classList.remove("has-logo");
      logoDrop.textContent = "Cliquez pour ajouter un logo au centre";
      logoRemove.hidden = true;
      render();
    });

    // Téléchargements
    $("#dl-png").addEventListener("click", function () { downloadPNG(1000); });
    $("#dl-png-hd").addEventListener("click", function () { downloadPNG(2000); });
    $("#dl-svg").addEventListener("click", downloadSVG);

    // Menu mobile
    var toggle = $(".nav-toggle");
    if (toggle) toggle.addEventListener("click", function () { $(".nav").classList.toggle("open"); });

    // Pré-sélection du type via ?type= (pages de niche)
    var params = new URLSearchParams(location.search);
    var pre = params.get("type");
    var valid = ["url", "text", "wifi", "vcard", "email", "sms", "tel"];
    selectType(valid.indexOf(pre) >= 0 ? pre : "url");

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
