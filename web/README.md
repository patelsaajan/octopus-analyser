# Octopus Analyser web app

A dashboard for one household's Octopus Energy account: electricity and gas usage, grid export, and how the current tariff compares with the alternatives.

It is a React and Vite app with a small backend that proxies `/graphql` to the Octopus API. The backend holds the Octopus API key, so the key never reaches the browser, and it only forwards read queries, so the dashboard cannot be used to change the account.

Each deployment serves a single Octopus account. To use it for your own household, deploy your own copy.

## Running locally

You need Node 22 or later and pnpm.

```sh
cp .env.example .env   # then fill in your API key and account number
pnpm install
pnpm dev
```

`.env` is gitignored. Create an API key on the [API access page](https://octopus.energy/dashboard/new/accounts/personal-details/api-access) of your Octopus dashboard; the account number is on your bill and dashboard.

In development the Vite plugin in `server/octopus-proxy.ts` stands in for the production Worker.

## Deploying

The app deploys to Cloudflare Workers on a custom domain: static assets plus a small Worker (`worker/index.ts`). The domain's zone must be on the same Cloudflare account.

```sh
pnpm exec wrangler login   # once
pnpm run deploy            # `pnpm deploy` is a different, built-in pnpm command
```

`scripts/deploy.sh` copies `wrangler.example.jsonc` to the gitignored `wrangler.jsonc` on first run (asking for the domain, which is kept out of git), prompts for the Octopus API key and account number, builds, and uploads both values as Worker secrets with the deploy. Leave a prompt blank to keep the stored secret. Extra arguments go to Wrangler, e.g. `pnpm run deploy --dry-run`.

## Required: put Cloudflare Access in front of it

**The app has no login of its own. Until you do this step, anyone who finds the URL can see your household's energy data and account details.**

Protect the domain with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/) (part of Zero Trust, free for small teams):

1. In the Cloudflare dashboard, open Zero Trust, then Access, then Applications, and add a self-hosted application.
2. Set its hostname to the exact domain you deployed to, with no path, so that `/graphql` is covered as well as the pages.
3. Add an Allow policy listing the email addresses of the people who may use it.

Then check it worked: open the site in a private browser window. You must see the Cloudflare Access login, not the dashboard.

Ideally create the Access application before the first deploy, so the site is never reachable without it.

Things to know:

- **Everyone on the allow list sees everything.** That includes the account holder's name, email, phone number and balance on the Settings page, and half-hourly usage, which shows when the home is occupied. Only add people you would trust with that.
- **Keep the Worker on the custom domain only.** `wrangler.example.jsonc` turns off the `workers.dev` address and preview URLs, because those would bypass Access. Leave them off.
- **Turn on two-factor authentication for your Cloudflare account.** Anyone who gets into it can remove Access or redeploy the Worker.

## Other safeguards

- `public/_headers` sends a Content-Security-Policy that lets the page load scripts only from itself and connect only to itself and `api.octopus.energy`. If you add a third-party script, font or API, it needs adding there too.
- `robots.txt`, a robots meta tag and an `X-Robots-Tag` header keep the site out of search results. These are a courtesy to crawlers, not access control.
- If you think the API key has leaked, regenerate it on the Octopus API access page (the old one stops working immediately) and run `pnpm run deploy` again with the new one.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server with the Octopus proxy |
| `pnpm build` | Typecheck and build to `dist/` |
| `pnpm typecheck` | Typecheck only |
| `pnpm lint` | ESLint |
| `pnpm run deploy` | Build and deploy to Cloudflare Workers |
