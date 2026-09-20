# VitePress + GitHub Actions 部署踩坑笔记
> 记录本次博客部署遇到的所有问题、原因与解决方案

## 一、构建阶段（Actions 执行报错）
1. **exit code 127：vitepress 命令找不到**
- 原因：只在电脑全局装了vitepress，**没有写入package.json依赖**，GitHub服务器执行`npm install`不会自动下载。
- 解决：本地执行 `npm install vitepress --save`，把依赖写入`package.json`和`package-lock.json`，提交到仓库；workflow脚本改用`npx vitepress build docs`调用。

2. **PowerShell 无法运行npm.ps1**
- 原因：Windows默认PowerShell执行策略阻止脚本。
- 解决：改用CMD终端操作，或者管理员权限修改PowerShell执行策略`Set-ExecutionPolicy RemoteSigned`。

## 二、Git推送冲突问题
3. **rejected main -> main (fetch first) 推送被拒绝**
- 原因：网页端手动新增/修改了仓库文件，**远程代码版本比本地新**，本地缺少远程的改动。
- 解决：先`git pull origin main`拉取远程代码合并，再提交推送。

4. **MERGE_HEAD exists 合并卡住**
- 原因：上一次`git pull`合并中断，Git处于未完成合并状态，不能继续pull/push。
- 解决：终止未完成合并 `git merge --abort`，再重新拉取代码。

> 额外避坑提醒：不要把打包产物`docs/.vitepress/dist/`提交到Git，新建`.gitignore`忽略该目录，否则仓库臃肿、极易产生文件冲突。

## 三、GitHub Pages 网站访问阶段
5. **访问网页404**
- 原因1：Pages分支配置不对，没有选择`gh-pages`分支、根目录`/ (root)`。
- 原因2：Actions部署还没完成，保存Pages设置后需要等待1~3分钟。
- 解决：仓库Settings → Pages，设置Source为`Deploy from a branch`，分支选`gh-pages`，文件夹`/ (root)`，保存后等待。

6. **页面空白 / CSS、图片、链接404（资源加载失败）**
- 原因：VitePress配置`base`路径写错。仓库不是用户名仓库（`xxx.github.io`），项目仓库必须配置base。
- 解决：`docs/.vitepress/config.js`添加 `base: '/My-blog/'`，**前后斜杠不能省略**，修改后提交代码触发重新部署。

7. **自定义域名输入框**
- 作用：仅用于绑定你自己购买的域名；**使用免费github.io地址时，这里留空，不用填写**。

## 四、快速自查清单（以后部署前直接核对）
1. package.json是否包含vitepress依赖 ✅
2. workflow脚本使用npx调用构建命令 ✅
3. Git推送前：先pull同步远程代码，无未完成合并 ✅
4. .gitignore忽略node_modules、dist打包目录 ✅
5. vitepress config配置正确base路径 ✅
6. GitHub Pages：分支gh-pages，目录root ✅
7. 部署成功后等待几分钟再访问网站 ✅
