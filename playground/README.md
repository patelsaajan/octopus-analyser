# Octopus GraphQL Playground

A local GraphiQL environment for exploring the Octopus Energy (Kraken) GraphQL API.

## Setup

1. Copy `.env.example` to `.env` and fill in your API key from the [Octopus developer dashboard](https://octopus.energy/dashboard/new/accounts/personal-details/api-access) and your account number.
2. Install and run:

   ```sh
   pnpm install
   pnpm dev
   ```

3. Open http://localhost:5173.

## How auth works

The Vite dev server exposes `/graphql`, which proxies to `https://api.octopus.energy/v1/graphql/`. On the first request it exchanges your API key for a Kraken token (via the `obtainKrakenToken` mutation), caches it for 55 minutes, and attaches it as the `Authorization` header. The API key never reaches the browser.

Without a key, schema introspection still works, so the docs explorer and autocomplete are usable before you set one up.

## Account number

When a query declares an `$accountNumber` variable, `OCTOPUS_ACCOUNT_NUMBER` is added to the variables pane automatically (unless it's already set there):

```graphql
query Account($accountNumber: String!) {
  account(accountNumber: $accountNumber) {
    number
  }
}
```
