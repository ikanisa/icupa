/**
 * Shared Prettier configuration for the ICUPA monorepo.
 * Keep in sync with lint-staged rules in package.json.
 */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
};

export default config;
