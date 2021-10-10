import path from 'path'
import typescript from 'rollup-plugin-typescript2'
import babel from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { eslint } from 'rollup-plugin-eslint'
import { DEFAULT_EXTENSIONS } from '@babel/core'
import { terser } from 'rollup-plugin-terser'
import replace from 'rollup-plugin-replace'

// 按需打包nodejs内置模块  尽可能少用node模块 node-builtins可能会引入过多的代码
import builtins from 'rollup-plugin-node-builtins'
// import globals from 'rollup-plugin-node-globals';

import pkg from './package.json'

const paths = {
  input: path.join(__dirname, 'src/bin/tinyimg-scripts.ts'),
  output: path.join(__dirname, '/dist')
}

// rollup 配置项
const rollupConfig = {
  input: paths.input,
  output: [
    // 输出 commonjs 规范的代码
    {
      file: pkg.main,
      format: 'cjs',
      name: pkg.name,
      banner: '#!/usr/bin/env node'
    }
  ],

  // plugins 需要注意引用顺序
  plugins: [
    // globals(),
    builtins(),

    // 解析第三方模块 -- Must be before rollup-plugin-typescript2 in the plugin list, especially when browser: true option is used
    nodeResolve(),

    // CommonJS 模块转换为 ES2015
    commonjs(),

    // 验证导入的文件 a .eslintrc.* file in your project's root. It will be loaded automatically.
    eslint({
      throwOnError: true,
      throwOnWarning: true,
      include: ['bin/*.ts', 'lib/**/*.ts'],
      exclude: ['node_modules', 'dist', 'test']
    }),

    // ts处理  .ts -> tsc -> babel -> es5
    typescript({
      useTsconfigDeclarationDir: true,
      tsconfig: path.resolve(__dirname, './tsconfig.json')
    }),

    // babel处理 @rollup/plugin-commonjs must be placed before this plugin in the plugins
    babel({
      babelHelpers: 'runtime',
      // 只转换源代码，不运行外部依赖
      exclude: 'node_modules/**',
      // babel 默认不支持 ts 需要手动添加
      extensions: [...DEFAULT_EXTENSIONS, '.ts']
    }),

    replace({
      delimiters: ['', ''],
      '#!/usr/bin/env node': ''
    }),

    // 代码压缩
    terser()
  ]
}

export default rollupConfig
