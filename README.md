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
3. Redeploy so production/preview pick up the bindings

Without Redis, the site still loads, but bookings will not persist across devices.

## Routes

- Public site: `/`
- Barber login: footer → **Barber login** (default PIN `1234`)
- Storage API: `/api/data/:key`
