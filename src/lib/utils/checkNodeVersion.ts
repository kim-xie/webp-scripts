const semver = require('semver')
const log = require('./logger')

module.exports = function checkNodeVersion(requireNodeVersion: string) {
  if (!semver.satisfies(process.version, requireNodeVersion)) {
    log.error(`You are using Node ${process.version}`)
    log.error(`tinyimg-scripts requires Node ${requireNodeVersion}, please update Node.`)
    process.exit(1)
  }
}
