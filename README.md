# Wake Up Barber

Booking site + barber dashboard, deployed on Vercel.

## Vercel project

- Team: `adrevnview1`
- Project: `wake-up-barber`
- Dashboard: https://vercel.com/adrevnview1/wake-up-barber

## Local setup

```bash
npm install
npx vercel link --yes --scope adrevnview1 --project wake-up-barber
npx vercel env pull .env.local --yes
npx vercel dev
```

## Storage (required for shared bookings)

Bookings sync through Upstash Redis (Vercel KV).

1. In the Vercel project: **Storage** → create/connect **Upstash Redis**
2. Ensure env vars are present (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or Upstash equivalents)
3. Optional but recommended: set `SESSION_SECRET` to a long random string (used to sign admin cookies)
4. Redeploy so production/preview pick up the bindings

Without Redis, the public site still loads, but bookings will not persist.

## Security model

- Public clients call `GET /api/public/bootstrap` (no PII / no PIN) and `POST /api/bookings` (validated + atomic slot lock)
- Barber login is `POST /api/admin/login` with a 4–6 digit PIN; server hashes the PIN (scrypt) and sets an HttpOnly session cookie
- Admin reads/writes go through `GET|PUT /api/admin/state` and require that session
- Legacy `/api/data/:key` is retired (`410`)

Default PIN on first boot is `1234` — change it immediately in **Dashboard → Settings**.

## Routes

- Public site: `/`
- Barber login: footer → **Barber login**
- Public API: `/api/public/bootstrap`, `/api/bookings`
- Admin API: `/api/admin/login`, `/api/admin/logout`, `/api/admin/session`, `/api/admin/state`
