# ALL RIGHT 全对

电子刷题台。

一个纯前端的电子刷题工具：把 JSON 题库导入本地，按分类或随机抽题练习，答错的题自动收进错题本随时重刷，看板集中呈现练习进度、正确率与掌握分布。

![看板](.impeccable/review/desktop-dashboard.png)

界面设计遵循 [impeccable](https://github.com/pbakaus/impeccable) 的工作流，视觉方向为「蜡纸油印卷子」：靛蓝油墨印在冷灰纸面上，答错处留一道朱红批改。设计契约见 `.impeccable/surfaces/app.md`，设计系统见 `DESIGN.md`。

## 下载

Windows 桌面版见 [Releases](https://github.com/Simple-YU-268/all-right/releases)，有两个版本：

| 文件 | 说明 |
| --- | --- |
| `ALLRIGHT-Setup-0.1.0.exe` | 安装版。可选安装目录，建桌面与开始菜单快捷方式，带卸载程序 |
| `ALLRIGHT-Portable-0.1.0.exe` | 便携版。免安装，双击即用，数据存在 exe 旁边的 `data\` |

桌面上就是上面那个网页版，功能完全一样，题库和练习记录只存在自己电脑上。也可以跳过下载，直接用网页版。

## 快速开始

```bash
npm install
npm run dev      # 开发服务器，默认 http://localhost:5173/
```

生产构建：

```bash
npm run build    # 类型检查 + 打包到 dist/
npm run preview  # 本地预览打包结果
```

没有后端、没有账号、不需要部署。题库和练习记录都存在浏览器的 localStorage 里（键名 `allright.workspace.v1`），数据不会离开这台电脑。

第一次打开可以点题库页的 **载入示例题库**，先看一遍界面再导入自己的题库。

## 部署

没有后端、没有账号、不需要部署服务。`npm run build` 产出的 `dist/` 就是一堆静态文件，丢到任何能返回静态文件的地方就能用。

```bash
npm run build    # 产出 dist/
npm run preview  # 本地预览 dist/
```

```text
dist/
  index.html          单页入口（五个界面在同一个文档里切换，没有前端路由）
  assets/             JS 与 CSS，带内容哈希，可以长缓存
  fonts/              自托管的 Noto Serif SC 与 IBM Plex Mono（217 个分片，按 unicode-range 懒加载）
  favicon.svg
  sample-bank.json    合成示例题库，「载入示例题库」按钮读的它
```

体积约 6.4 MB，其中 6.1 MB 是字体分片；应用本体（JS + CSS）只有 247 KB，gzip 后 73 KB。字体全部自托管，不请求任何外部 CDN，断网也能正常显示。

### 支持哪些平台

生产构建用相对路径寻址，所以挂在域名根目录还是挂在子目录都能跑。下面的结论都是实测的（用静态服务器分别模拟根路径托管、带路径前缀的子目录托管、`file://` 直接打开）：

| 平台 / 形态 | 说明 | 实测 |
| --- | --- | --- |
| Vercel、Netlify、Cloudflare Pages | 拖 `dist/` 上去，或连仓库自动构建 | 可用 |
| GitHub Pages | 项目站会挂在 `/仓库名/` 这种子目录下 | 可用（相对路径生效） |
| 阿里云 OSS、腾讯云 COS 等对象存储的静态网站 | 带目录前缀托管 | 可用 |
| Nginx、Apache、IIS、内网共享目录 | 任何能返回静态文件的服务 | 可用 |
| 本机预览 | `npm run preview` | 可用 |
| Electron / Tauri 桌面壳 | 把 `dist/` 打进安装包 | 可用 |
| 手机、平板浏览器 | 直接访问同一个网址，界面是响应式的 | 可用 |
| `file://` 双击 `index.html` | 浏览器对 ES 模块脚本和 `crossorigin` 样式的 CORS 限制，不是本项目的问题 | **起不来** |
| PWA（装到桌面 / 手机主屏） | 当前没有 manifest 和 service worker | **未做** |

### 两件要注意的事

1. **数据跟着访问者自己的浏览器走。** 题库、练习记录、错题本都写在浏览器本地存储里（键名 `allright.workspace.v1`），不经过服务器，也不同步到别的设备。公开部署后，每位用户的数据各自独立；换设备用设置页的「导出备份」再导入。
2. **要离线用**，把 `dist/` 拷到本机并起一个静态服务（例如 `npx serve dist`），别直接双击 `index.html`。

## 桌面版（Windows exe）

除了网页版，同一套界面也能打成 Windows 桌面程序。桌面壳用 Electron（`electron/main.cjs`），界面本体还是上面那个静态构建，所以两种形态长得一模一样。

```bash
npm run electron:build     # 构建 + 生成图标 + 打包，产物在 release/
```

产出两个 exe：

| 文件 | 说明 |
| --- | --- |
| `release/ALLRIGHT-Setup-1.0.0.exe` | 安装版。可以选安装目录，会建桌面和开始菜单快捷方式，带卸载程序 |
| `release/ALLRIGHT-Portable-1.0.0.exe` | 便携版。免安装，双击即用，数据存在 exe 旁边 |

各约 111～122 MB——大头是 Electron 自带的 Chromium，应用本体（界面 + 字体）只有 6.4 MB。Windows 10 / 11 x64 上直接跑，不需要预装任何运行时。

**桌面版的几处特别之处**

- **用 `app://` 协议而不是 `file://` 端出页面。** 这样页面有一个真正的源，localStorage 稳定落盘，「载入示例题库」的 fetch 也不会被浏览器的 CORS 规则拦掉——换成 `file://` 这两样都会坏。
- **数据存在本机**：安装版在 `%APPDATA%\all-right\`，便携版在 exe 旁边的 `data\`。菜单「文件 → 打开数据文件夹」可以直接跳过去。题库、练习记录、错题本都在这儿，换电脑用设置页的「导出备份」。
- **窗口大小和位置会被记住**，下次打开还是上次那个尺寸。
- **中文菜单**：文件（打开数据文件夹、退出）／视图（重新加载、缩放、全屏、开发者工具）／帮助（关于）。默认那套英文菜单已经换掉了。
- **没有代码签名**，Windows SmartScreen 可能拦一下。点「更多信息 → 仍要运行」就行；要在正式分发时消除这个提示，需要买一张代码签名证书。

开发桌面版：`npm run electron:dev` 会先起 Vite，再拉起 Electron，改前端代码即时热更新。

## 五个界面

| 界面 | 做什么 |
| --- | --- |
| **看板** | 近 14 天练习量、分类正确率、掌握度分布、错题本摘要。柱状图左有两道刻度，能直接读出当天题量；分类正确率的阶梯条一次读两件事：格数＝正确率，墨色＝掌握度。每个数字都指向一个动作。 |
| **练习** | 三种模式：随机抽题、按分类、错题重刷。选完模式再选题量（10 / 20 / 50 / 全部）。逐题作答、立即出解析；揭晓后石绿勾＝正确答案，朱红叉＝选错了，靛蓝下划线＝你划的那一条。 |
| **题库** | 导入 JSON（拖文件、选文件、直接粘贴）、导入前预览校验、按题库分别统计、导出备份、删除题库。 |
| **错题本** | 答错的题自动进来，按分类筛选、按错误次数排序。答对一次即移出，也可以手动移出或单题重刷。 |
| **设置** | 给 AI 助手用的 JSON 模板与字段写法、数据导出与清空、结算动效开关。 |

练习结束后有一页结算，纸面会整屏反相一次再落回数字——这是这个方向里唯一的一次全屏动效。

## 题库 JSON 格式

题库是 JSON 文件。除了手写，也可以让**你自己的 AI 助手**来转译——见下一节。

最简形式，一个只有题干的数组也能导入（缺选项会被逐条报错）：

```json
{
  "name": "我的题库",
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "category": "第一章",
      "stem": "这里写题干。",
      "options": [
        { "key": "A", "text": "选项一" },
        { "key": "B", "text": "选项二" }
      ],
      "answer": ["A"],
      "explanation": "这里写解析。",
      "difficulty": 2,
      "tags": ["常考"]
    }
  ]
}
```

设置页的「下载模板」会导出同样结构的文件。解析器写得比较宽松，以下写法都认（完整清单在设置页）：

| 字段 | 接受的键名 |
| --- | --- |
| 根节点 | 直接是题目数组，或 `{ name, questions }`；题目数组还可用 `items` / `data` / `list` / `题目` / `试题`；题库名可用 `name` / `title` / `bank` / `题库名` / `题库` |
| 题干 | `stem` / `question` / `title` / `题干` / `题目` / `问题` / `content` |
| 选项 | `options` / `choices` / `选项` / `answers` / `answersList`；可以是对象数组、字符串数组，或 `{ "A": "…", "B": "…" }` 这样的键值表 |
| 答案 | `answer` / `correct` / `correctAnswer` / `答案` / `正确答案` / `right`；可写 `"A"`、`"AB"`、`["A","B"]`、数字下标、判断题的 `true` / `false` / `正确` / `错误` |
| 解析 | `explanation` / `analysis` / `解析` / `答案解析` / `说明` / `note` |
| 分类 | `category` / `chapter` / `section` / `分类` / `章节` / `目录` / `knowledge` |
| 难度 | `difficulty` / `level` / `难度` / `star` / `stars`；写 `easy` / `medium` / `hard` / `简单` / `中等` / `困难` 或 1–5 的数字 |
| 标签 | `tags` / `label` / `labels` / `标签` / `知识点` |
| 题型 | `type` / `题型` / `questionType`；`single` / `multiple` / `judge`（或 `单选` / `多选` / `判断`） |

几个约定：

- **题型可以不写。** 答案多于一个字母就是多选；两个「正确 / 错误」选项就是判断题。
- **答案是单选时**写 `"A"` 或 `["A"]` 都可以，多选写 `"AB"` 或 `["A","B"]`。
- **答案不在选项里**会被指出来，不会静默导入成错题。
- **导入前会先预览**：题量、分类分布、题型分布，以及逐条的问题清单（有问题的题可以单独剔掉再导）。

## 数据与隐私

- 所有数据只写入当前浏览器的 localStorage，不上传、不同步、不联网。
- 题库页右上角「导出备份」可以导出完整工作区（含题库与练习记录），换机器时导入即可。
- 清浏览器数据会一并清掉题库和记录，重要数据请先导出备份。
- 仓库里的 `public/sample-bank.json` 是**合成内容**，不是任何考试的真题，界面上也标注了「示例」。

## 用 AI 助手转译题库

手上的题库往往不是 JSON：可能是 CSV、Excel 粘贴的文本、Word/PDF 抽出来的段落，或者某个题库网站导出的文件。

题库页有一段现成的**转译提示词**，设置页有配套的 **JSON 模板**：

1. 打开题库页的「让 AI 助手帮你转译题库」，点「复制提示词」。
2. 打开设置页的「AI 转译用 JSON 模板」，点「复制模板」。
3. 把题库文件和这两段一起发给你的 AI 助手（ChatGPT、Claude、豆包、通义……都行）。
4. 助手会回一个 `.json` 文件，把它拖回题库页的导入框。
5. 导入前会先预览题量、分类与题型分布，有问题的题可以逐条剔掉再导。

提示词里已经写清了目标结构、答案与选项的抽取规则、判断题与多选的判定方式，以及「读不出来就跳过、不要臆造」的底线。

## 数据与动效

- **动效**：练习结算时纸面会整屏翻成负片再落回数字。这是你世界里唯一的一次全屏动效，可以在设置里关掉；系统开了「减少动态效果」时也会自动跳过。

## 项目结构

```text
src/
  App.tsx                 外壳：左侧导航 + 五个界面路由
  domain/
    types.ts              Question / Attempt / Workspace 等类型
    parseBank.ts          宽容的题库 JSON 解析器（逐条报错，不静默丢弃）
    bankTemplate.ts       给 AI 助手的 JSON 模板、字段别名表与转译提示词
    stats.ts              看板统计：日题量、分类正确率、掌握度分布
    session.ts            练习会话：抽题、判分、结算
    storage.ts            localStorage 读写与 JSON 下载
    store.tsx             全局状态（React context + reducer）
    motion.ts             结算动效开关（data-motion="reduced"）
  components/
    Dashboard.tsx  Practice.tsx  Banks.tsx  WrongBook.tsx
    Settings.tsx          AI 转译模板、数据导出与清空、动效开关
    bits.tsx              共用零件：墨阶条、掌握度标记、分段控件、空状态
  styles/
    tokens.css            设计令牌：色板、字号阶、间距、圆角、阴影
    base.css              基础排版与控件
    app.css               布局与各界面样式
public/
  sample-bank.json        合成示例题库（30 题 / 6 个分类）
  fonts/                  自托管的 Noto Serif SC 与 IBM Plex Mono
scripts/
  shots.mjs               用 Edge 跑一遍截图，供设计评审
  shoot-sketch.mjs        渲染决策页的锁定草图
  shoot-summary.mjs       结算页反相动画的逐帧截图
  verify-copy.mjs         校验提示词、模板复制与动效开关的落库行为
  verify-e2e.mjs          端到端冒烟：设置页模板 → 导入 → 答错 → 错题本 → 看板
  verify-deploy.mjs       部署形态回归：构建产物挂根目录与子目录都要能起来
  verify-electron.mjs     桌面壳冒烟：窗口、导航、导入、答题、重启后数据仍在
  verify-packaged.mjs     对打包成品做同样的检查（asar 里的 app:// 协议）
  verify-portable.mjs     便携版检查：数据确实落在 exe 旁边的 data\
  verify-installer.mjs    安装版检查：静默安装 → 启动 → 静默卸载
  make-icon.mjs           把 favicon.svg 渲成 Windows 图标
  electron-dev.mjs        开发模式：起 Vite 并拉起 Electron
```

技术栈：React 18 + Vite 6 + TypeScript，图标用 [lucide-react](https://lucide.dev)。除开发依赖外没有第三方运行时依赖。

## 开发命令

```bash
npm run dev        # 开发服务器
npm run build      # 类型检查 + 打包
npm run preview    # 预览打包结果
npx tsc --noEmit   # 只跑类型检查
npm run verify:e2e # 端到端冒烟（需要 dev server 跑着）
npm run verify:deploy  # 部署形态回归（需要先 npm run build）
npm run electron:dev      # 开发桌面版（起 Vite + Electron）
npm run electron:build    # 打包成 Windows exe（产物在 release/）
npm run verify:electron   # 桌面壳冒烟
npm run verify:packaged   # 对打包成品做检查（需要先 electron:build）
npm run verify:portable   # 便携版检查（需要先 electron:build）
npm run verify:installer  # 安装版检查（需要先 electron:build）
node scripts/shots.mjs         # 生成 .impeccable/review/ 下的全套截图
node scripts/shoot-summary.mjs # 结算页与反相动画的截图
node scripts/verify-copy.mjs   # 校验提示词 / 模板复制与动效开关
```
