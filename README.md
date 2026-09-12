# Kodeo — Générateur de QR codes

Générateur de QR codes gratuit, rapide et sans filigrane. Site statique (HTML/CSS/JS vanilla), pensé pour un lancement **Google Ads** : chaque page de niche = une campagne.

**Stratégie de monétisation :** le générateur statique gratuit sert d'aimant Google Ads (mots-clés à forte intention : « qr code menu restaurant », « qr code wifi », « générateur qr code gratuit »). La monétisation vient de la publicité (AdSense) et de l'offre **Pro** (QR codes *dynamiques* + statistiques de scan — voir `server/`).

## Structure

```
kodeo/
├── index.html                 # Landing principale + générateur (client-side)
├── qr-menu-restaurant.html    # Landing de niche (campagne « menu restaurant »)
├── assets/
│   ├── css/style.css
│   ├── js/app.js              # Logique du générateur (notre code)
│   ├── js/qrcode.js           # Lib QR embarquée (qrcode-generator, MIT)
│   └── img/
├── server/                    # Phase 2 : QR dynamiques (backend, non statique)
├── robots.txt
└── ads.txt                    # Google AdSense
```

## Ce qui fonctionne (Phase 1 — 100 % statique, déployable tout de suite)

- Génération de QR codes **entièrement côté client** (aucune donnée envoyée)
- Types : **lien, texte, WiFi, vCard (carte de visite), email, SMS, téléphone**
- Personnalisation : couleurs, marge, correction d'erreur, **logo au centre**
- Export **PNG**, **PNG HD (2000 px)** et **SVG vectoriel** (impression)
- Aperçu en direct, responsive, pré-sélection du type via `?type=` (pages de niche)
- Emplacements AdSense + balises SEO/JSON-LD prêts

## Phase 2 — QR codes dynamiques (offre Pro payante)

C'est la vraie valeur récurrente. **Nécessite un backend** (donc pas GitHub Pages seul).
Voir [`server/README.md`](server/README.md) pour le plan : table `qr_id → url`, route de
redirection `/r/:id` qui logge le scan, tableau de bord, et paiement Stripe.

## Développement local

Aucune dépendance à installer. Ouvrez `index.html`, ou servez le dossier :

```bash
python -m http.server 8080
# puis http://localhost:8080
```

## Déploiement

Site statique → **GitHub Pages**, Netlify ou Cloudflare Pages.

### GitHub Pages
Repo → *Settings* → *Pages* → Source : branche `main`, dossier `/root`.

## Avant de mettre en production (checklist)

- [ ] Vérifier le nom de marque / domaine (`kodeo.app` est un placeholder)
- [ ] Remplacer `ca-pub-XXXX` dans `index.html` et `ads.txt` par l'ID AdSense réel
- [ ] Rédiger les pages Mentions légales / Confidentialité / Contact
- [ ] Ajouter une image `og:image` dans `assets/img/`
- [ ] Créer d'autres landings de niche (avis Google, WiFi, carte de visite…)

## Licence

Code du projet : privé / propriétaire.
Lib embarquée `qrcode.js` : © Kazuhiko Arase, licence MIT.
