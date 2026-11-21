'use strict';

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'public/locales/**',
      'coverage/**',
      'data/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setImmediate: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error'
    }
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        CustomEvent: 'readonly',
        atob: 'readonly',
        ArrayBuffer: 'readonly',
        Uint8Array: 'readonly',
        requestAnimationFrame: 'readonly',
        URLSearchParams: 'readonly',
        prompt: 'readonly',
        confirm: 'readonly',
        google: 'readonly',
        markerClusterer: 'readonly'
      }
    }
  }
];
