import { configs } from '@front-utils/linter';

export default [
    ...configs.ts,
    {
        files          : ["./src/**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: null,
            },
        },
    }
];
