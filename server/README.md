# Kodeo — Backend démo (QR dynamiques + Stripe simulé)

Backend **Express** qui fait tourner la démo de l'offre Pro :

- **QR codes dynamiques** : `/r/:id` redirige (302) vers une URL cible **modifiable après impression**.
- **Statistiques de scan** : chaque scan est logué (date, appareil, pays approximatif — jamais l'IP brute), agrégé sur 7 jours. Réservé au plan Pro (gating démontré côté serveur, HTTP 402 si gratuit).
- **Checkout Stripe SIMULÉ** : page `/demo-checkout` qui reproduit l'UX de Stripe Checkout et passe le compte en Pro. **Aucune clé Stripe, aucun débit réel.**

> ⚠️ **Démo** : stockage **en mémoire** (réinitialisé à chaque redémarrage du service). Les points d'intégration Stripe réels sont marqués `TODO STRIPE` dans `index.js`.

## Lancer en local

```bash
cd server
npm install
npm start        # http://localhost:3000
```

## Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/health` | ping |
| GET | `/api/account` | plan courant (`free`/`pro`) |
| GET | `/api/qr` | liste des QR dynamiques de la session |
| POST | `/api/qr` | crée un QR dynamique (`{label, target_url}`) |
| PATCH | `/api/qr/:id` | change la destination (cœur du dynamique) |
| DELETE | `/api/qr/:id` | supprime |
| GET | `/api/qr/:id/stats` | stats (402 si plan gratuit) |
| POST | `/api/checkout` | démarre le checkout démo |
| POST | `/api/checkout/confirm` | valide le « paiement » démo → Pro |
| GET | `/r/:id` | **redirection dynamique** + log du scan |
| GET | `/demo-checkout` | page de paiement simulée |

La session est identifiée par l'en-tête `X-Demo-Session` (généré et stocké côté client dans `localStorage`).

## Déploiement (Render — Web Service)

- Root Directory : `server`
- Build Command : `npm install`
- Start Command : `node index.js`
- Render fournit `PORT` et `RENDER_EXTERNAL_URL` automatiquement.

## Vers la production

1. Remplacer le store mémoire par **Postgres** (le compte Render a déjà `cvfacile-db`).
2. Brancher **Stripe** (mode test d'abord) aux emplacements `TODO STRIPE` : `checkout.sessions.create` + webhook `checkout.session.completed`.
3. Ajouter une authentification (email magic link) pour rattacher les QR à un vrai compte.
