import { configs } from '@front-utils/linter';
import {defineConfig} from 'eslint/config';

export default defineConfig([
    {
        files          : ["./src/**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: null,
            },
        },
        rules: {
            'security/detect-object-injection': 'off',
        },
        extends: configs.ts,
    }
]);
