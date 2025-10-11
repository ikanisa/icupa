# Common UI Module

Exports shared primitives (buttons, cards, badges) and styling tokens used across surfaces. Prefer importing from this module (`import { Button, classNames } from '@/modules/common'`) instead of reaching into `src/components/ui` directly so we can evolve the underlying implementation without touching every call site.

The `themeTokens` object in `src/styles/theme.ts` centralizes recurring patterns such as the aurora gradient and glass cards. As the refactor progresses, migrate hard-coded class strings to read from these tokens.
