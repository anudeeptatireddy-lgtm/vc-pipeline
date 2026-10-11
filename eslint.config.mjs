// Lint: TypeScript + React hooks rules. (Next's preset pulled in braces via
// fast-glob, a high-severity advisory with no patched release; dev-only, but
// npm audit is now clean.)
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "docs/**", ".claude/**", "data/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // CLAUDE.md rule 1: runtime AI is Gemini only.
      "no-restricted-imports": ["error", { paths: ["@anthropic-ai/sdk", "openai"], patterns: ["@anthropic-ai/*"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
