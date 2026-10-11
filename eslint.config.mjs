import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "docs/**"] },
  {
    // CLAUDE.md rule 1: runtime AI is Gemini only.
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: ["@anthropic-ai/sdk", "openai"], patterns: ["@anthropic-ai/*"] },
      ],
    },
  },
];

export default config;
