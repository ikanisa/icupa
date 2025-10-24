# Dependency Inventory



## Warnings

- ⚠️ @supabase/supabase-js version mismatch → 2.45.4: app (2.45.4) | 2.45.0: @ecotrips/admin (2.45.0), @ecotrips/client (2.45.0), @ecotrips/api (2.45.0), @ecotrips/supabase (2.45.0)

- ⚠️ next version mismatch → 15.5.3: app (15.5.3) | 14.2.33: @ecotrips/admin (14.2.33), @ecotrips/client (14.2.33), ops-console (14.2.33)

- ⚠️ react version mismatch → 19.1.0: app (19.1.0) | 18.3.1: @ecotrips/admin (18.3.1), @ecotrips/client (18.3.1), ops-console (18.3.1) | 18.0.0: @ecotrips/ui (^18.0.0)

- ⚠️ react-dom version mismatch → 19.1.0: app (19.1.0) | 18.3.1: @ecotrips/admin (18.3.1), @ecotrips/client (18.3.1), ops-console (18.3.1) | 18.0.0: @ecotrips/ui (^18.0.0)

- ⚠️ @types/node version mismatch → 20: app (^20) | 20.11.30: @ecotrips/admin (20.11.30), @ecotrips/client (20.11.30) | 20.19.21: ops-console (20.19.21)

- ⚠️ @types/react version mismatch → 19: app (^19) | 18.3.3: @ecotrips/admin (18.3.3), @ecotrips/client (18.3.3) | 18.2.64: ops-console (18.2.64)

- ⚠️ @types/react-dom version mismatch → 19: app (^19) | 18.3.0: @ecotrips/admin (18.3.0), @ecotrips/client (18.3.0) | 18.2.19: ops-console (18.2.19)

- ⚠️ eslint version mismatch → 9.13.0: app (^9.13.0) | 8.57.0: ops-console (8.57.0) | 8.57.0 || ^9.0.0: @ecotrips/eslint-config (^8.57.0 || ^9.0.0)

- ⚠️ eslint-config-next version mismatch → 15.5.3: app (15.5.3) | 14.2.33: ops-console (14.2.33) | 14.0.0 || ^15.0.0: @ecotrips/eslint-config (^14.0.0 || ^15.0.0)

- ⚠️ tailwindcss version mismatch → 4: app (^4) | 3.4.3: @ecotrips/admin (3.4.3), @ecotrips/client (3.4.3)

- ⚠️ typescript version mismatch → 5: app (^5) | 5.9.3: @ecotrips/admin (5.9.3), @ecotrips/client (5.9.3), ops-console (5.9.3), @ecotrips/api (5.9.3), @ecotrips/i18n (5.9.3), @ecotrips/supabase (5.9.3), @ecotrips/types (5.9.3), @ecotrips/ui (5.9.3)



## Runtime Alignment Focus

- @supabase/supabase-js: 2.45.4: app | 2.45.0: @ecotrips/admin, @ecotrips/client, @ecotrips/api, @ecotrips/supabase

- next: 15.5.3: app | 14.2.33: @ecotrips/admin, @ecotrips/client, ops-console

- react: 19.1.0: app | 18.3.1: @ecotrips/admin, @ecotrips/client, ops-console | ^18.0.0: @ecotrips/ui

- react-dom: 19.1.0: app | 18.3.1: @ecotrips/admin, @ecotrips/client, ops-console | ^18.0.0: @ecotrips/ui

- typescript: ^5: app | 5.9.3: @ecotrips/admin, @ecotrips/client, ops-console, @ecotrips/api, @ecotrips/i18n, @ecotrips/supabase, @ecotrips/types, @ecotrips/ui

## app
- package.json: app/package.json
- version: 0.1.0
- node engine: >=18.17.0 <19
- Dependencies: 6
  - Pinned (5): @supabase/supabase-js@2.45.4, next@15.5.3, react@19.1.0, react-dom@19.1.0, zod@3.23.8
- Dev Dependencies: 11
  - Pinned (2): @playwright/test@1.51.1, eslint-config-next@15.5.3
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- @ecotrips/config: file:../packages/config
- @supabase/supabase-js: 2.45.4
- next: 15.5.3
- react: 19.1.0
- react-dom: 19.1.0
- zod: 3.23.8

### Dev Dependencies
- @ecotrips/eslint-config: file:../packages/eslint-config
- @ecotrips/prettier-config: file:../packages/prettier-config
- @playwright/test: 1.51.1
- @tailwindcss/postcss: ^4
- @types/node: ^20
- @types/react: ^19
- @types/react-dom: ^19
- eslint: ^9.13.0
- eslint-config-next: 15.5.3
- tailwindcss: ^4
- typescript: ^5

## @ecotrips/admin
- package.json: apps/admin/package.json
- version: 0.0.1
- node engine: >=18.17.0 <19
- Dependencies: 13
  - Pinned (7): @supabase/auth-helpers-nextjs@0.10.0, @supabase/auth-helpers-react@0.5.0, @supabase/supabase-js@2.45.0, next@14.2.33, react@18.3.1, react-dom@18.3.1, zod@3.23.8
- Dev Dependencies: 10
  - Pinned (8): @playwright/test@1.51.1, @types/node@20.11.30, @types/react@18.3.3, @types/react-dom@18.3.0, autoprefixer@10.4.16, postcss@8.5.6, tailwindcss@3.4.3, typescript@5.9.3
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- @ecotrips/api: file:../../packages/api
- @ecotrips/config: file:../../packages/config
- @ecotrips/i18n: file:../../packages/i18n
- @ecotrips/supabase: file:../../packages/supabase
- @ecotrips/types: file:../../packages/types
- @ecotrips/ui: file:../../packages/ui
- @supabase/auth-helpers-nextjs: 0.10.0
- @supabase/auth-helpers-react: 0.5.0
- @supabase/supabase-js: 2.45.0
- next: 14.2.33
- react: 18.3.1
- react-dom: 18.3.1
- zod: 3.23.8

### Dev Dependencies
- @ecotrips/eslint-config: file:../../packages/eslint-config
- @ecotrips/prettier-config: file:../../packages/prettier-config
- @playwright/test: 1.51.1
- @types/node: 20.11.30
- @types/react: 18.3.3
- @types/react-dom: 18.3.0
- autoprefixer: 10.4.16
- postcss: 8.5.6
- tailwindcss: 3.4.3
- typescript: 5.9.3

## @ecotrips/client
- package.json: apps/client/package.json
- version: 0.0.1
- node engine: >=18.17.0 <19
- Dependencies: 11
  - Pinned (5): @supabase/auth-helpers-nextjs@0.10.0, @supabase/supabase-js@2.45.0, next@14.2.33, react@18.3.1, react-dom@18.3.1
- Dev Dependencies: 9
  - Pinned (7): @types/node@20.11.30, @types/react@18.3.3, @types/react-dom@18.3.0, autoprefixer@10.4.16, postcss@8.5.6, tailwindcss@3.4.3, typescript@5.9.3
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- @ecotrips/api: file:../../packages/api
- @ecotrips/config: file:../../packages/config
- @ecotrips/i18n: file:../../packages/i18n
- @ecotrips/supabase: file:../../packages/supabase
- @ecotrips/types: file:../../packages/types
- @ecotrips/ui: file:../../packages/ui
- @supabase/auth-helpers-nextjs: 0.10.0
- @supabase/supabase-js: 2.45.0
- next: 14.2.33
- react: 18.3.1
- react-dom: 18.3.1

### Dev Dependencies
- @ecotrips/eslint-config: file:../../packages/eslint-config
- @ecotrips/prettier-config: file:../../packages/prettier-config
- @types/node: 20.11.30
- @types/react: 18.3.3
- @types/react-dom: 18.3.0
- autoprefixer: 10.4.16
- postcss: 8.5.6
- tailwindcss: 3.4.3
- typescript: 5.9.3

## ops-console
- package.json: ops/console/package.json
- version: 0.1.0
- Dependencies: 3
  - Pinned (3): next@14.2.33, react@18.3.1, react-dom@18.3.1
- Dev Dependencies: 8
  - Pinned (6): @types/node@20.19.21, @types/react@18.2.64, @types/react-dom@18.2.19, eslint@8.57.0, eslint-config-next@14.2.33, typescript@5.9.3
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- next: 14.2.33
- react: 18.3.1
- react-dom: 18.3.1

### Dev Dependencies
- @ecotrips/eslint-config: file:../../packages/eslint-config
- @ecotrips/prettier-config: file:../../packages/prettier-config
- @types/node: 20.19.21
- @types/react: 18.2.64
- @types/react-dom: 18.2.19
- eslint: 8.57.0
- eslint-config-next: 14.2.33
- typescript: 5.9.3

## ecotrips
- package.json: package.json
- node engine: >=18.17.0 <19
- Dependencies: 0
- Dev Dependencies: 1
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dev Dependencies
- turbo: ^2.5.8

## @ecotrips/api
- package.json: packages/api/package.json
- version: 0.0.1
- Dependencies: 3
  - Pinned (2): @supabase/supabase-js@2.45.0, zod@3.23.8
- Dev Dependencies: 2
  - Pinned (2): typescript@5.9.3, vitest@2.1.4
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- @ecotrips/types: file:../types
- @supabase/supabase-js: 2.45.0
- zod: 3.23.8

### Dev Dependencies
- typescript: 5.9.3
- vitest: 2.1.4

## @ecotrips/config
- package.json: packages/config/package.json
- version: 0.0.1
- Dependencies: 1
  - Pinned (1): zod@3.23.8
- Dev Dependencies: 0
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- zod: 3.23.8

## @ecotrips/eslint-config
- package.json: packages/eslint-config/package.json
- version: 0.0.1
- Dependencies: 0
- Dev Dependencies: 0
- Peer Dependencies: 2
- Optional Dependencies: 0

### Peer Dependencies
- eslint: ^8.57.0 || ^9.0.0
- eslint-config-next: ^14.0.0 || ^15.0.0

## @ecotrips/i18n
- package.json: packages/i18n/package.json
- version: 0.0.1
- Dependencies: 1
  - Pinned (1): intl-messageformat@10.5.14
- Dev Dependencies: 1
  - Pinned (1): typescript@5.9.3
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- intl-messageformat: 10.5.14

### Dev Dependencies
- typescript: 5.9.3

## @ecotrips/prettier-config
- package.json: packages/prettier-config/package.json
- version: 0.0.1
- Dependencies: 0
- Dev Dependencies: 0
- Peer Dependencies: 1
- Optional Dependencies: 0

### Peer Dependencies
- prettier: ^3.0.0

## @ecotrips/supabase
- package.json: packages/supabase/package.json
- version: 0.0.1
- Dependencies: 3
  - Pinned (2): @supabase/auth-helpers-nextjs@0.10.0, @supabase/supabase-js@2.45.0
- Dev Dependencies: 1
  - Pinned (1): typescript@5.9.3
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- @ecotrips/types: file:../types
- @supabase/auth-helpers-nextjs: 0.10.0
- @supabase/supabase-js: 2.45.0

### Dev Dependencies
- typescript: 5.9.3

## @ecotrips/types
- package.json: packages/types/package.json
- version: 0.0.1
- Dependencies: 1
  - Pinned (1): zod@3.23.8
- Dev Dependencies: 1
  - Pinned (1): typescript@5.9.3
- Peer Dependencies: 0
- Optional Dependencies: 0

### Dependencies
- zod: 3.23.8

### Dev Dependencies
- typescript: 5.9.3

## @ecotrips/ui
- package.json: packages/ui/package.json
- version: 0.0.1
- Dependencies: 2
  - Pinned (2): @radix-ui/react-slot@1.2.3, clsx@2.1.1
- Dev Dependencies: 1
  - Pinned (1): typescript@5.9.3
- Peer Dependencies: 2
- Optional Dependencies: 0

### Dependencies
- @radix-ui/react-slot: 1.2.3
- clsx: 2.1.1

### Dev Dependencies
- typescript: 5.9.3

### Peer Dependencies
- react: ^18.0.0
- react-dom: ^18.0.0

## @ecotrips/tools
- package.json: tools/package.json
- version: 0.0.1
- Dependencies: 0
- Dev Dependencies: 0
- Peer Dependencies: 0
- Optional Dependencies: 0
