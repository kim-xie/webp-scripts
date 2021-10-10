module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true,
    jest: true
  },
  settings: {
    jest: { version: 26 }
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended'
  ],
  // ESLint的解析器,用于解析typescript,检查和规范Typescript代码
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  // .eslintignore不生效使用此配置
  ignorePatterns: ['dist', 'node_modules', 'test'],
  rules: {
    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    'jest/expect-expect': 0
  }
}
