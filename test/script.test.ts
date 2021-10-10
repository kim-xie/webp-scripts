import { describe, test, expect } from '@jest/globals'
const webpConverter = require('../src/lib/core/webpConverter')

describe('validate: webpConverter', () => {
  test('test webpConverter', async () => {
    expect(
      await webpConverter({
        watch: true,
        action: 'generateWebp',
        inputPath: 'test/img',
        outputPath: '.',
        isRecursion: true,
        quality: 75,
        showLog: false
      })
    )
  })
})
