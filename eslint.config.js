import js from "@eslint/js"
import tseslint from "typescript-eslint"
import pluginVue from "eslint-plugin-vue"
import prettier from "eslint-config-prettier/flat"
import globals from "globals"

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs["flat/recommended"],
    prettier,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            "vue/multi-word-component-names": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
    {
        files: ["**/*.vue"],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
            },
        },
    },
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/target/**",
            "**/src-tauri/**",
            "**/.venv/**",
            "**/coverage/**",
            "**/.vite/**",
            "**/*.min.js",
            "tailwind.config.js",
        ],
    },
]
