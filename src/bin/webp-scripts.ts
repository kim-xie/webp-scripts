#!/usr/bin/env node
const program = require('commander')
const packageInfo = require('../../package.json')
const webpConverter = require('../lib/core/webpConverter')
const logger = require('../lib/utils/logger')

;(async () => {
  program
    .version(packageInfo.version, '-V, --version')
    .usage('<inputDir | imgSrc> [outputDir] [options]')

  // requiredOption
  program
    .option('-W, --watch [boolean]', 'use watch mode', false)
    .option('-S, --imgSrc [imgSrc]', 'single img transform to webp')
    .option('-I, --inputDir [inputDir]', 'imgs or img input dir')
    .option('-O, --outputDir [outputDir]', 'imgs or img output dir')
    .option(
      '-A, --action [action]',
      'use action has generateWebp、deleteWebp、deleteNotWebp',
      'generateWebp'
    )
    .option('-R, --isRecursion [boolean]', 'imgs input dir isRecursion')
    .option('-L, --showLog [boolean]', 'show webp log')
    .option('-Q, --quality [number]', 'cwebp quality 0~100', 75)
    .action((options: any) => {
      const { inputDir, watch, isRecursion, showLog, quality, action, imgSrc } = options
      const outputDir = options.outputDir || inputDir
      if (inputDir || imgSrc) {
        try {
          webpConverter.webpconvert({
            watch,
            action,
            imgSrc,
            inputDir,
            outputDir,
            isRecursion,
            quality,
            showLog
          })
        } catch (error) {
          logger.error(error)
          process.exit(1)
        }
      }
    })

  program.showHelpAfterError()

  program.parse(process.argv)

  const proc = program.runningCommand

  if (proc) {
    proc.on('close', process.exit.bind(process))
    proc.on('error', () => {
      process.exit(1)
    })
  }
})()
