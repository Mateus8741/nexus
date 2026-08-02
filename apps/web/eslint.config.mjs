import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint aqui cuida SOMENTE das regras específicas do Next.js
 * (react-hooks, core-web-vitals, regras de app router) — algo que o Biome
 * ainda não cobre. Formatação e o restante do lint (estilo, correctness,
 * imports) ficam por conta do Biome (ver biome.json na raiz), para não
 * haver regras conflitantes entre as duas ferramentas.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
