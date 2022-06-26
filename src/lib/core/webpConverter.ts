const Chalk = require('Chalk')
const childProcess = require('child_process')
const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')
const webp = require('webp-converter')

/**
 * 异步递归读取文件夹下的文件
 * @param currentDirPath 读取当前目录
 * @param isRecursion 是否递归读取
 * @param showLog 显示读取文件日志
 * @param callback 回调
 */
function readDirFile(
  currentDirPath: string,
  isRecursion: boolean,
  showLog: boolean,
  callback: (filePath: string, name: string, stats: any) => void
) {
  fs.readdir(currentDirPath, (err: any, files: any[]) => {
    if (err) {
      console.warn(err)
      return
    }
    files.forEach(name => {
      const filePath = path.join(currentDirPath, name)
      fs.stat(filePath, (error: any, stats: any) => {
        if (error) {
          console.warn(Chalk.red('获取文件stats失败'))
        } else {
          const isFile = stats.isFile() // 是文件
          const isDir = stats.isDirectory() // 是文件夹
          if (isFile) {
            callback && callback(filePath, name, stats)
          }
          if (isDir && isRecursion) {
            readDirFile(filePath, isRecursion, showLog, callback)
          }
        }
      })
    })
  })
}

/**
 * @remarks 字节转换
 * @param byte 字节
 * @returns
 */
const ByteSize = (byte = 0) => {
  if (byte === 0) return '0 B'
  const unit = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(byte) / Math.log(unit))
  return (byte / Math.pow(unit, i)).toPrecision(3) + ' ' + sizes[i]
}

/**
 * 判断目录或文件夹是否存在？不存在创建
 * @param pathStr
 * @returns
 */
const mkdirPath = (pathStr: string) => {
  fileIsExist(
    pathStr,
    tempstats => {
      if (!tempstats.isDirectory()) {
        fs.unlinkSync(pathStr)
        fs.mkdirSync(pathStr)
      }
    },
    () => {
      // 不存在则创建
      fs.mkdirSync(pathStr)
    }
  )
  return pathStr
}

/**
 * 判断路径是否存在
 * @param pathStr
 * @param onFail
 * @param onSuccess
 */
const fileIsExist = (pathStr: string, onSuccess: (tempstats: any) => void, onFail: () => void) => {
  fs.access(pathStr, fs.constants.F_OK, (err: any) => {
    if (err) {
      // 不存在
      onFail && onFail()
    } else {
      const tempstats = fs.statSync(pathStr)
      onSuccess && onSuccess(tempstats)
    }
  })
}

// 获取文件size
const getFileSize = (filePath: any) => {
  const stat = fs.statSync(filePath)
  return stat.size || 0
}

/**
 * webp转换工具
 * @param action generateWebp\deleteWebp\deleteNotWebp -- （3选1）watch为fasle下生效
 * @param watch 是否开启文件夹监听模式：开启会一直监听文件夹下的文件变动
 * @param imgSrc 处理单张图片（比文件目录优先级更高）
 * @param inputDir 需要监听或读取的图片文件夹路径
 * @param outputDir 生成webp需要存放的路径，默认会生成在同一文件夹下
 * @param isRecursion 是否需要递归文件夹
 * @param quality 压缩质量
 * @param showLog 显示日志
 */
const webpconvert = async ({
  action,
  watch,
  imgSrc,
  inputDir,
  outputDir,
  isRecursion,
  quality,
  showLog
}: {
  [key: string]: any
}) => {
  // 统计
  let timer: any = null
  let inputFileCount = 0
  let generateFileCount = 0
  let generateSuccFileCount = 0
  // .webp结尾的文件
  const webpFile = /(.+?\.webp$)/
  const imgFile = /\.(jpe?g|png|gif)$/
  const watchFiles = /\.(jpe?g|png|gif|webp)$/
  // 默认使用本地安装cwebp工具
  let currentRunEnv = 'local'
  // webp图片质量，默认75
  quality = quality || 75
  // 输出文件目录
  outputDir = outputDir && mkdirPath(outputDir)

  const startTime = new Date().toLocaleString()
  console.log(Chalk.yellow(`${watch ? 'watch' : action} is begining at ${startTime}`))

  console.log(Chalk.greenBright(`inputPath: ${imgSrc || inputDir}`))
  console.log(Chalk.greenBright(`outputPath: ${outputDir || inputDir}`))

  /**
   * 获取当前环境：
   *    1、本地安装cwebp转换工具（谷歌官方下载地址：https://storage.googleapis.com/downloads.webmproject.org/releases/webp/index.html）（需配置环境变量）
   *    2、安装webp-converter转换工具（linux环境安装可能会失败 - 安装linux缺失依赖问题解决如下：）
   *       yum install libXext.x86_64
   *       yum install libXrender.x86_64
   *       yum install libXtst.x86_64
   */
  currentRunEnv = getCurrentEnv()

  /**
   * 转化模式：优先级从高到低
   * watch > imgSrc > inputDir
   */
  if (watch) {
    /**
     * 使用监听文件夹的方式
     * */
    const watcher = chokidar.watch(inputDir, {
      // 忽略监听的文件及目录
      ignored: (paths: string) => {
        // 文件夹通过
        let ignored = false
        if (paths.indexOf('.') > -1) {
          ignored = !watchFiles.test(paths)
        }
        return ignored
      },
      // 保护进程不退出持久监听
      persistent: true,
      // 监听的inputDir所相对的路径
      cwd: '.',
      // 限定了会递归监听多少个子目录
      depth: isRecursion ? Infinity : 0
    })
    // 监听增加，修改，删除文件的事件
    watcher.on('all', (event: string, path: string) => {
      switch (event) {
        case 'addDir':
          console.log(Chalk.green(`[add new dir] ${path}`))
          break
        case 'add':
          // 只处理新增的imgFile
          if (imgFile.test(path)) {
            console.log(
              Chalk.green(
                `[add new img] ${path} [size is: ${Chalk.red(ByteSize(getFileSize(path)))}]`
              )
            )
            inputFileCount += 1
            // 添加新图片，自动转webp
            generateWebpImgByEnv(path)
          }
          break
        case 'change':
          // 只处理修改的imgFile
          if (imgFile.test(path)) {
            console.log(
              Chalk.green(
                `[change the img] ${path} [size is: ${Chalk.red(ByteSize(getFileSize(path)))}]`
              )
            )
            // 图片有变更，先删除掉原来的webp，再重新生成
            deleteImg(getWebpImgName(path), (status: string) => {
              console.log(Chalk.green(`[delete old webp] ${getWebpImgName(path)}  ${status}`))
            })
            inputFileCount += 1
            generateWebpImgByEnv(path)
          }
          break
        case 'unlink':
          // 删除webp，则重新生成
          if (webpFile.test(path)) {
            const destFile = path.split('.webp')[0]
            fileIsExist(
              destFile,
              () => {
                // 原图存在，则重新生成
                generateWebpImgByEnv(destFile)
              },
              () => {
                // 原图不存在，不处理
                console.log(Chalk.red(`[deleteWebp no such file] ${destFile}`))
              }
            )
          } else {
            // 图片删除,删除掉原来的webp
            deleteImg(getWebpImgName(path), (status: string) => {
              console.log(Chalk.green(`[delete old webp] ${getWebpImgName(path)}  ${status}`))
            })
          }
          break
        case 'unlinkDir':
          console.log(Chalk.green(`[delete old dir] ${path}`))
          break
        default:
          break
      }
    })
  } else if (imgSrc) {
    /**
     * 转化单张图片
     */
    const imgPath = path.join(imgSrc)
    const size = getFileSize(imgPath)
    doWorkByFile(imgPath, size)
  } else {
    /**
     * 读取文件夹的方式进行文件读取
     * isRecursion: 是否需要递归文件夹
     * */
    readDirFile(inputDir, isRecursion, showLog, (filePath, name, stats) => {
      doWorkByFile(filePath, stats.size)
    })
  }

  /**
   * 进行转化工作
   */
  function doWorkByFile(filePath: string, size?: number) {
    if (watchFiles.test(filePath)) {
      showLog &&
        console.log(
          Chalk.green('[read input file]', filePath, `[size is: ${Chalk.red(ByteSize(size))}]`)
        )
      // 执行删除指令
      if (action === 'deleteWebp') {
        /**
         * 如果是.webp图片，则会删掉
         */
        if (webpFile.test(filePath)) {
          fileIsExist(
            filePath,
            () => {
              inputFileCount += 1
              // 存在则删除
              deleteImg(filePath, (status: string) => {
                showLog && console.log(Chalk.green(`[delete webp] ${filePath}  ${status}`))
                endLog('deleteWebp')
              })
            },
            () => {
              // 不存在，不处理
              console.log(Chalk.red(`[deleteWebp no such file] ${filePath}`))
            }
          )
        }
      } else if (action === 'deleteNotWebp') {
        /**
         * 图片，则会删掉
         */
        if (!webpFile.test(filePath)) {
          fileIsExist(
            filePath,
            () => {
              inputFileCount += 1
              // 存在则删除
              deleteImg(filePath, (status: string) => {
                showLog && console.log(Chalk.green(`[delete img] ${filePath}  ${status}`))
                endLog('deleteImg')
              })
            },
            () => {
              // 不存在，不处理
              console.log(Chalk.red(`[deleteNotWebp no such file] ${filePath}`))
            }
          )
        }
      } else {
        /**
         * 生成webp图片
         * */
        if (!webpFile.test(filePath)) {
          fileIsExist(
            filePath,
            () => {
              inputFileCount += 1
              // 存在则生成webp
              generateWebpImgByEnv(filePath)
            },
            () => {
              // 不存在，不处理
              console.log(Chalk.red(`[generateWebp no such file] ${filePath}`))
            }
          )
        }
      }
    } else {
      console.log(Chalk.red(`${filePath} 文件不支持，目前只支持传入jpg、jpeg、png、webp格式的图片`))
    }
  }

  /**
   * 环境探针 - 同步方式执行
   * @returns
   */
  function getCurrentEnv() {
    let env = 'local'
    const { error } = childProcess.spawnSync('cwebp', ['-h'])
    if (error) {
      webp.grant_permission()
      console.log(Chalk.yellow(`running in webp-converter env`))
      env = 'node'
    } else {
      console.log(Chalk.yellow(`running in local cwebp env`))
    }
    return env
  }

  /**
   * 根据环境执行不同的转换命令
   * @param filePath
   */
  function generateWebpImgByEnv(filePath: string) {
    // 日志模块
    const log = async (filePath: string, status: string) => {
      const oldSize = getFileSize(filePath)
      const webpSize = getFileSize(getWebpImgName(filePath))
      showLog &&
        console.log(
          status === 'success'
            ? Chalk.green(
                `[generate webp] ${getWebpImgName(filePath)}  [old size is: ${Chalk.red(
                  ByteSize(oldSize)
                )} webp size is: ${Chalk.red(ByteSize(webpSize))}] ${status}`
              )
            : Chalk.red(`[generate webp] ${getWebpImgName(filePath)}  ${status}`)
        )
    }
    if (currentRunEnv === 'node') {
      generateWebpImgByNode(filePath, async (status: string) => {
        log(filePath, status)
        endLog('generateWebp')
      })
    } else {
      generateWebpImgByLocal(filePath, async (status: string) => {
        log(filePath, status)
        endLog('generateWebp')
      })
    }
  }

  // 结束日志
  const endLog = (text: string) => {
    if (generateFileCount === inputFileCount) {
      timer && clearTimeout(timer)
      timer = setTimeout(() => {
        const endTime = new Date().toLocaleString()
        console.log(
          Chalk.yellow(
            `${text} is completed at ${endTime} [total is ${Chalk.red(generateSuccFileCount)} ${
              text === 'generateWebp' ? 'quality is ' + Chalk.red(quality) : ''
            }]`
          )
        )
        generateSuccFileCount = 0
        inputFileCount = 0
        generateFileCount = 0
      }, 1000)
    }
  }

  /**
   * 获取对应的webp格式的文件名，默认为文件名后加上.webp
   **/
  function getWebpImgName(filePath: string) {
    // 指定输出路径
    const fileName = path.basename(filePath)
    const pathName = filePath
      .replace(
        imgSrc ? path.dirname(filePath)?.replace('/', '\\') : inputDir?.replace('/', '\\'),
        outputDir?.replace('/', '\\')
      )
      .replace(fileName, '')
    const currentPath = mkdirPath(pathName)
    const outputFilePath = path.join(currentPath as string, fileName)

    return `${outputFilePath || filePath}.webp`
  }

  /**
   * 本地安装cwebp 执行的shell命令
   **/
  function getShellCmd(filePath: string) {
    const outPath = getWebpImgName(filePath)

    // 兼容复制图片时生成带空格的图片地址
    let hasTrim = false
    if (filePath.indexOf(' ') > -1) {
      hasTrim = true
    }
    return `cwebp -q ${quality} ${hasTrim ? `"${filePath}"` : filePath} -o ${
      hasTrim ? `"${outPath}"` : outPath
    }`
  }

  /**
   * 本地安装cwebp生成webp图片
   **/
  function generateWebpImgByLocal(filePath: string, cb: (status: string) => void) {
    childProcess.exec(getShellCmd(filePath), (err: any) => {
      generateFileCount += 1
      if (err !== null) {
        cb('fail')
        console.log(Chalk.red('请先运行cwebp -h命令检查cwebp是否安装ok：'), err)
      } else {
        generateSuccFileCount += 1
        cb('success')
      }
    })
  }

  /**
   * 安装webp-converter包生成webp图片
   **/
  function generateWebpImgByNode(filePath: string, cb: (status: string) => void) {
    const outPath = getWebpImgName(filePath)
    const logging = showLog ? '-v' : '-quiet'
    const result = webp.cwebp(filePath, outPath, `-q ${quality}`, logging)
    result.then((res: any) => {
      generateFileCount += 1
      if (res.indexOf('Error') > -1) {
        cb('fail')
        console.log(Chalk.red('webp-converter转换webp失败：'), res)
      } else {
        generateSuccFileCount += 1
        cb('success')
      }
    })
  }

  /**
   * 删除图片
   **/
  function deleteImg(path: string, cb: (status: string) => void) {
    fs.unlink(path, (err: any) => {
      if (err) {
        cb('fail')
        console.log(Chalk.red(err))
      } else {
        cb('success')
      }
    })
  }
}

module.exports = { webpconvert }
