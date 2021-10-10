# 介绍

webp-scripts 是一个 png|jpg|jpeg 图片转 webp 格式命令行工具

## 1. 如何使用

**安装:**

```shell
yarn add webp-scripts
```

or

```shell
npm install webp-scripts
```

**如何使用:**

```shell
$ npx webp-scripts -h
Usage: webp-scripts <inputDir> [outputDir] [options]

Options:
  -V, --version                output the version number
  -I, --inputDir <inputDir>    imgs or img input dir
  -W, --watch [boolean]        use watch mode (default: false)
  -O, --outputDir <outputDir>  imgs or img output dir
  -A, --action [action]        use action has generateWebp、deleteWebp、deleteNotWebp (default: "generateWebp")
  -R, --recursive [boolean]    imgs input dir recursive
  -L, --showLog [boolean]      show webp log
  -Q, --quality [number]       cwebp quality 0~100 (default: 75)
  -h, --help                   display help for command
```
