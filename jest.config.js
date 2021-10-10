const path = require('path')

module.exports = {
  rootDir: path.resolve(__dirname),
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['<rootDir>/test/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node']
}
