# Octopus Analyser

A private dashboard for one household's Octopus Energy account. It shows electricity import, grid export and gas usage from the smart meters, and works out what the same usage would have cost or earned on other Octopus plans.

## Motivation

Recently my parents installed solar and a battery energy storage system (BESS) on their house. The system is the following:

- 6.6kW solar system
- 16.6kWh battery storage (16kWh of usable storage)
- Octopus import and export tariff
- Hypervolt 3 EV charger

The system was designed around their peak winter usage of 20kWh/day. On those peak winter days we expect around 3 to 4kWh of solar plus the 16kWh of battery storage.

The question I wanted to investigate is which Octopus export tariff is more profitable for the house. There are two suitable Octopus plans:

1. Outgoing Octopus: "Variable tariff currently paying a flat rate of 12p/kWh. Export whenever suits you and know you're always getting a good price."
2. Octopus Flux: "An import and export tariff. Schedule your home battery to get the best rates for consuming and selling your energy during peak periods."

A summary of the export rates:

| Plan     | 7pm to 4pm | 4pm to 7pm |
| -------- | ---------- | ---------- |
| Outgoing | 12p/kWh    | 12p/kWh    |
| Flux     | 9p/kWh     | 16p/kWh    |

The house is currently on the Flux plan, and the system has been set up to do the following:

1. During the night, on the cheap import rate (11:30pm to 5:30am), the BESS charges itself to 100%. At the cheap rate on 13/11/2026 of 8p/kWh, a full charge costs £1.28.
2. During the day the battery discharges as the house needs, and any spare solar tops the BESS back up.
3. If the BESS is full and the solar is generating more than the house needs, the surplus is exported to the grid.
4. 4pm to 7pm is the peak export window on Flux, when the export rate is higher. So between 6pm and 7pm the system exports until the battery hits 50%, which should leave enough in reserve until the cheap night rate.

The idea is simple: use the Octopus developer API to build a visual dashboard of the house's usage, and see whether the current plan is the best one to be on.

## What it does

The app has three pages:

- **Usage** (`/`): half-hourly grid import and export from the smart meter, plus gas, for a chosen day, week, month or year. Figures can be shown in kWh or in pounds at the account's own tariff rates. Charts show usage across the period and folded onto a 24-hour axis, to show when energy tends to flow.
- **Plan analysis** (`/overview`): what the period cost or earned on the current plan, next to what it would have on other plans, each priced at the rates that plan actually had at the time. There is a section each for electricity import, electricity export and gas. You can also add custom plans, with your own rates for each part of the day and a standing charge, to test a plan Octopus doesn't list.
- **Settings** (`/settings`): the account details, the current import, export and gas tariffs with their rates and times, and display preferences (combined or separate import and export charts, plan comparison as cards or a table).

Display preferences and custom plans are saved in the browser's local storage.

## How it works

- **Frontend:** React 19 and Vite 8 with TypeScript, React Router, Tailwind v4, shadcn components on Base UI, Recharts for the charts and Zustand for settings.
- **Account data:** the Octopus GraphQL API, for meter readings, the account's tariffs and account details. The browser never talks to it directly. It posts to `/graphql` on a small backend, which holds the API key, fills in the account number and only forwards read queries, so the dashboard cannot be used to change the account.
- **Other plans' rates:** Octopus's public REST API, which needs no login, called straight from the browser.
- **Hosting:** Cloudflare Workers on a custom domain, with Cloudflare Access (Zero Trust) in front so only people on an approved list can open it.

Each deployment serves a single Octopus account.

## Getting started

You need:

- Node 22.13 or later and [pnpm](https://pnpm.io/installation)
- An Octopus Energy account with a smart meter
- An Octopus API key, created on the [API access page](https://octopus.energy/dashboard/new/accounts/personal-details/api-access) of your Octopus dashboard
- Your account number (e.g. `A-1234ABCD`), shown on your bill and dashboard

Then:

```sh
git clone <this repo's URL>
cd octopus-analyser/web
cp .env.example .env   # then fill in OCTOPUS_API_KEY and OCTOPUS_ACCOUNT_NUMBER
pnpm install
pnpm dev
```

Open the URL Vite prints (http://localhost:5173 by default). `.env` is gitignored, so your key stays out of git. If you change `.env`, restart the dev server.

The app lives in `web/`, so every `pnpm` command is run from there.

## Deploying

See [web/README.md](web/README.md) for deploying to Cloudflare Workers with `pnpm run deploy`.

**The app has no login of its own.** Before you deploy, read the Cloudflare Access section of that README. Without Access in front of the domain, anyone who finds the URL can see your household's energy data and account details.

## Repo layout

| Path | What it holds |
| --- | --- |
| `web/src/app/` | The three pages, plus global CSS and design tokens |
| `web/src/components/` | Dashboard components, and shadcn components in `ui/` |
| `web/src/hooks/` | Data-loading hooks for usage, gas, tariffs and plans |
| `web/src/lib/` | Octopus API clients, tariff pricing, periods and custom plans |
| `web/src/stores/` | The persisted settings store |
| `web/server/` | The dev-only `/graphql` proxy, a Vite plugin |
| `web/worker/` | The production `/graphql` proxy, a Cloudflare Worker |
| `web/scripts/` | The deploy script |
| `web/public/` | Static assets, `robots.txt` and the security headers |
