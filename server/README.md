# Kodeo — Backend (Phase 2 : QR codes dynamiques)

> ⚠️ Cette partie n'est **pas** encore active. C'est le plan et le squelette de l'offre
> Pro payante. Elle nécessite un hébergement dynamique (Vercel/Netlify Functions,
> Cloudflare Workers…) et une base de données — donc **pas** GitHub Pages seul.

## Le principe (là où est l'argent)

Un QR **dynamique** n'encode pas l'URL finale, mais une URL de redirection que **nous**
contrôlons :

```
QR imprimé  →  https://kodeo.app/r/aB3xK9  →  (redirection)  →  URL cible du client
```

Deux avantages qui justifient l'abonnement :

1. **Modifiable après impression** — le client change la destination sans réimprimer.
2. **Statistiques de scan** — on logge chaque scan (date, ville via IP, appareil).

## Modèle de données minimal

Collection `qrcodes` :

| champ         | type      | description                                  |
|---------------|-----------|----------------------------------------------|
| `id`          | string    | slug court dans l'URL (`/r/:id`)             |
| `owner`       | string    | id utilisateur (Stripe customer)             |
| `target_url`  | string    | destination actuelle (modifiable)            |
| `label`       | string    | nom donné par le client                      |
| `created_at`  | datetime  |                                              |
| `active`      | bool      | désactivable                                 |

Collection `scans` :

| champ       | type     | description                    |
|-------------|----------|--------------------------------|
| `qr_id`     | string   | référence vers `qrcodes.id`    |
| `ts`        | datetime | horodatage du scan             |
| `country`   | string   | dérivé de l'IP (pas d'IP brute stockée) |
| `city`      | string   |                                |
| `device`    | string   | mobile / desktop (user-agent)  |

> RGPD : ne pas stocker l'IP brute, seulement le pays/la ville dérivés.

## Endpoints

- `GET  /r/:id`            → logge le scan puis redirige (302) vers `target_url`
- `POST /api/qr`           → crée un QR dynamique (auth requise)
- `PATCH /api/qr/:id`      → change la destination
- `GET  /api/qr/:id/stats` → statistiques de scan
- `POST /api/stripe/webhook` → active/désactive l'abonnement Pro

## Stack suggérée (simple, solo)

- **Hébergement** : Vercel (functions) ou Cloudflare Workers + KV/D1
- **Base** : Postgres (Supabase/Neon) ou Cloudflare D1/KV
- **Paiement** : Stripe Checkout + webhook (abonnement 9 €/mois)
- **Auth** : lien magique par email ou Supabase Auth

## Roadmap MVP payant

1. `GET /r/:id` + table `qrcodes` (redirection dynamique) ← cœur du produit
2. Auth + `POST /api/qr` depuis le générateur (bouton « rendre dynamique »)
3. Logging des scans + page de statistiques
4. Stripe Checkout + gating de la fonctionnalité dynamique

`redirect.example.js` montre le squelette de la redirection.
