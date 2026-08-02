import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next's bundled eslint-plugin-react tries to auto-detect
  // the React version via context.getFilename(), an API ESLint 10 removed —
  // that crashes react/display-name (and would crash other version-gated
  // rules). Declaring the version explicitly skips detection entirely.
  { settings: { react: { version: "19.2.4" } } },
  // Codebase convention: prefix a deliberately-unused binding with `_`
  // (e.g. destructuring keys out of an object solely to exclude them from a
  // `...rest` spread, or an unused callback param kept for a shared
  // signature). Recognize that convention instead of flagging every site.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
