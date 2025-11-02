# @icupa/config

Shared configuration presets for ESLint, Prettier, and TypeScript that power the ICUPA monorepo. Use the provided entry points to keep tooling consistent across every workspace package.

## Usage

### ESLint

```js
// eslint.config.js
import config from "@icupa/config/eslint";

export default config;
```

### Prettier

```js
// prettier.config.mjs
import config from "@icupa/config/prettier";

export default config;
```

### TypeScript

```json
{
  "extends": "@icupa/config/tsconfig/base"
}
```

Additional presets exist for framework-specific needs like Next.js via `@icupa/config/tsconfig/next` and Node runtimes via `@icupa/config/tsconfig/node`.
