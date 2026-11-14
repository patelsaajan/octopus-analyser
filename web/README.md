# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Deploying

The app deploys to Cloudflare Workers on a custom domain: static assets plus a small Worker (`worker/index.ts`) that proxies `/graphql` to Octopus.

```sh
pnpm exec wrangler login   # once
pnpm run deploy            # `pnpm deploy` is a different, built-in pnpm command
```

`scripts/deploy.sh` copies `wrangler.example.jsonc` to the gitignored `wrangler.jsonc` on first run (asking for the domain, which is kept out of git), prompts for the Octopus API key and account number, builds, and uploads both values as Worker secrets with the deploy. Leave a prompt blank to keep the stored secret. Extra arguments go to Wrangler, e.g. `pnpm run deploy --dry-run`.
