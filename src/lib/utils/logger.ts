const chalk = require('chalk')

module.exports = {
  info: (text = '') => console.log(`${chalk.bgBlue('[INFO]')} ${chalk.white(text)}`),
  success: (text = '') => console.log(`${chalk.bgGreen('[SUCCESS]')} ${chalk.green(text)}`),
  warn: (text = '') => console.log(`${chalk.bgYellow('[WARN]')} ${chalk.yellow(text)}`),
  error: (text = '') => console.log(`${chalk.bgRed('[ERROR]')} ${chalk.red(text)}`)
}
