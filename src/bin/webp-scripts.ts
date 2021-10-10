#!/usr/bin/env node
const program = require('commander')
const packageInfo = require('../../package.json')
const webpConverter = require('../lib/core/webpConverter')
const logger = require('../lib/utils/logger')

;(async () => {
  program.version(packageInfo.version, '-V, --version').usage('<inputDir> [outputDir] [options]')

  program
    .requiredOption('-I, --inputDir <inputDir>', 'imgs or img input dir')
    .option('-W, --watch [boolean]', 'use watch mode', false)
    .option('-O, --outputDir <outputDir>', 'imgs or img output dir')
    .option(
      '-A, --action [action]',
      'use action has generateWebp、deleteWebp、deleteNotWebp',
      'generateWebp'
    )
    .option('-R, --recursive [boolean]', 'imgs input dir recursive')
    .option('-L, --showLog [boolean]', 'show webp log')
    .option('-Q, --quality [number]', 'cwebp quality 0~100', 75)
    .action(async (options: any) => {
      const { inputDir, watch, recursive, showLog, quality, action } = options
      const outputDir = options.outputDir || inputDir
      if (inputDir) {
        try {
          await webpConverter
            .webpconvert({
              watch,
              action,
              inputPath: inputDir,
              outputPath: outputDir,
              isRecursion: recursive,
              quality,
              showLog
            })
            .then(() => {
              logger.info('end')
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
