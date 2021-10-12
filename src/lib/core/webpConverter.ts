const Chalk = require('Chalk')
const childProcess = require('child_process')
const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')
const webp = require('webp-converter')
let inputFileCount = 0
let genWebpFileCount = 0
let delWebpFileCount = 0

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
  callback: (filePath: string, name: string, stats: string) => void
) {
  fs.readdir(currentDirPath, (err: any, files: any[]) => {
    if (err) {
      console.warn(err)
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
            showLog && console.log(Chalk.green('[read input file]', filePath))
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
const webpconvert = ({
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
  // .webp结尾的文件
  const webpFile = /(.+?\.webp$)/
  const imgFile = /\.(jpe?g|png)$/
  const watchFiles = /\.(jpe?g|png|webp)$/
  // 默认使用本地安装cwebp工具
  let currentRunEnv = 'local'
  // webp图片质量，默认75
  quality = quality || 75
  // 输出文件目录
  outputDir = outputDir && mkdirPath(outputDir)

  console.log('watch: ', watch)
  const startTime = new Date().toLocaleString()
  console.log(Chalk.green(`${watch ? 'watch' : action} is begining at ${startTime} ...`))

  console.log('inputPath: ', imgSrc || inputDir)
  console.log('outputPath: ', outputDir || inputDir)

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
            console.log(Chalk.green(`[add new img] ${path}`))
            // 添加新图片，自动转webp
            generateWebpImgByEnv(path)
          }
          break
        case 'change':
          // 只处理修改的imgFile
          if (imgFile.test(path)) {
            console.log(Chalk.green(`[change the img] ${path}`))
            // 图片有变更，先删除掉原来的webp，再重新生成
            deleteImg(getWebpImgName(path), (status: string) => {
              console.log(Chalk.green(`[delete old webp] ${getWebpImgName(path)}  ${status}`))
            })
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
    doWorkByFile(path.join(imgSrc))
  } else {
    /**
     * 读取文件夹的方式进行文件读取
     * isRecursion: 是否需要递归文件夹
     * */
    readDirFile(inputDir, isRecursion, showLog, filePath => {
      doWorkByFile(filePath)
    })
  }

  /**
   * 进行转化工作
   */
  function doWorkByFile(filePath: string) {
    if (watchFiles.test(filePath)) {
      inputFileCount += 1
      // 执行删除指令
      if (action === 'deleteWebp') {
        /**
         * 如果是.webp图片，则会删掉
         */
        if (filePath.indexOf('.webp') < 0) {
          filePath = filePath + '.webp'
          fileIsExist(
            filePath,
            () => {
              // 存在则删除
              deleteImg(filePath, (status: string) => {
                console.log(Chalk.green(`[delete webp] ${filePath}  ${status}`))
              })
            },
            () => {
              // 不存在，不处理
              console.log(Chalk.red(`[deleteWebp no such file] ${filePath}`))
            }
          )
        } else {
          fileIsExist(
            filePath,
            () => {
              // 存在则删除
              deleteImg(filePath, (status: string) => {
                console.log(Chalk.green(`[delete webp] ${getWebpImgName(filePath)}  ${status}`))
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
        if (filePath.indexOf('.webp') > -1) {
          filePath = filePath.split('.webp')[0]
        }
        fileIsExist(
          filePath,
          () => {
            // 存在则删除
            deleteImg(filePath, (status: string) => {
              console.log(Chalk.green(`[delete img] ${filePath}  ${status}`))
            })
          },
          () => {
            // 不存在，不处理
            console.log(Chalk.red(`[deleteNotWebp no such file] ${filePath}`))
          }
        )
      } else {
        /**
         * 生成webp图片
         * */
        if (filePath.indexOf('.webp') < 0) {
          fileIsExist(
            filePath,
            () => {
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
      console.log(Chalk.green(`只支持传入jpg、jpeg、png、webp格式的图片`))
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
    const log = (filePath: string, status: string) => {
      console.log(
        status === 'success'
          ? Chalk.green(`[generate webp] ${getWebpImgName(filePath)}  ${status}`)
          : Chalk.red(`[generate webp] ${getWebpImgName(filePath)}  ${status}`)
      )
    }
    if (currentRunEnv === 'node') {
      generateWebpImgByNode(filePath, (status: string) => {
        log(filePath, status)
      })
    } else {
      generateWebpImgByLocal(filePath, (status: string) => {
        log(filePath, status)
      })
    }
  }

  /**
   * 获取对应的webp格式的文件名，默认为文件名后加上.webp
   **/
  function getWebpImgName(filePath: string) {
    // 指定输出路径
    if (outputDir) {
      // 输出路径递归显示
      const newFilePath =
        filePath.split(path.join(outputDir))[1] ||
        filePath.split(path.join(path.basename(imgSrc) || inputDir))[1]
      if (isRecursion) {
        filePath = path.join(outputDir, newFilePath)
      } else {
        const fileName = path.basename(filePath)
        filePath = path.join(outputDir, fileName)
      }
      const dirname = path.dirname(filePath)
      if (dirname && dirname !== path.join(outputDir)) {
        mkdirPath(dirname)
      }
    }
    return `${filePath}.webp`
  }

  /**
   * 本地安装cwebp 执行的shell命令
   **/
  function getShellCmd(filePath: string) {
    const outPath = getWebpImgName(filePath)
    return `cwebp -q ${quality} ${filePath} -o ${outPath}`
  }

  /**
   * 本地安装cwebp生成webp图片
   **/
  function generateWebpImgByLocal(filePath: string, cb: (status: string) => void) {
    childProcess.exec(getShellCmd(filePath), (err: any) => {
      if (err !== null) {
        cb('fail')
        console.log(Chalk.red('请先运行cwebp -h命令检查cwebp是否安装ok：'), err)
      } else {
        cb('success')
        genWebpFileCount += 1
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
      if (res.indexOf('Error') > -1) {
        cb('fail')
        console.log(Chalk.red('webp-converter转换webp失败：'), res)
      } else {
        cb('success')
        genWebpFileCount += 1
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
        delWebpFileCount += 1
      }
    })
  }
}

module.exports = { webpconvert, inputFileCount, genWebpFileCount, delWebpFileCount }
