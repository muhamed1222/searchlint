export default [
  {
    ignores: [
      "node_modules/**",
      ".vscode-test/**",
      "pnpm-lock.yaml",
      "packages/**",
      "apps/**",
      "services/**"
    ]
  },
  {
    files: ["*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      "no-empty": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
];
