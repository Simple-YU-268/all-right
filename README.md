# ALL RIGHT 全对

电子刷题台：导入 JSON 题库，随机抽题或按章节练习，错题自动进入错题本，看板追踪练习进度。题干、选项和解析都能配图，图片跟着题库包一起离线保存。

新版使用 **Rust + Tauri 2 + React + TypeScript**，全站图标使用 **IconPark (`@icon-park/react`)**。网页与桌面版共用 React 界面。

## 下载

[v0.3.0 发行版](https://github.com/Simple-YU-268/all-right/releases/tag/v0.3.0) 提供 Windows x64 安装包：

- [ALLRIGHT-Setup-0.3.0.exe](https://github.com/Simple-YU-268/all-right/releases/download/v0.3.0/ALLRIGHT-Setup-0.3.0.exe)，约 8.3 MiB。
- 同一发行版提供 `SHA256SUMS.txt` 校验文件。
- 从 v0.1.0 升级前请先导出工作区备份，再到新版「设置 → 恢复备份」恢复题库与练习记录。

## 开发

网页开发需要 Node.js 与 npm：

```bash
npm install
npm run dev
npm run build
npm run preview
```

开发地址为 `http://127.0.0.1:5173`。端口被占用时会报错，确保 Tauri 与 Vite 连接到同一个地址与端口。

Windows 桌面开发还需要 Rust stable MSVC 工具链、Visual Studio Build Tools 的「使用 C++ 的桌面开发」（含 Windows SDK），以及 Microsoft Edge WebView2 Runtime。

```bash
npm run tauri -- info
npm run tauri:dev
npm run tauri:build
npm run verify:native
```

`tauri:dev` 自动启动 Vite 和 Rust 桌面窗口；`tauri:build` 自动构建 React 并生成 Windows NSIS 安装包，产物在 `src-tauri/target/release/bundle/nsis/`，可执行程序在 `src-tauri/target/release/`。`verify:native` 启动实际程序，通过 WebView2 调试接口检查打包资源、React 启动及 Rust 工作区读写，验证时会短暂显示应用窗口。其他桌面平台需在对应系统调整 bundle targets 后构建。

应用图标已包含在仓库。修改品牌图标后执行 `npm run tauri:icon` 重新生成（图标生成脚本使用本机 Edge）。

## 按章节刷题

在「练习 → 按章节」中直接列出当前题库的全部章节入口，显示章节名、总题数和已练题数。先选择 10 / 20 / 50 / 全部，再点击章节直接开练，无需下拉选择或额外确认。

章节按题库中的出现顺序排列，题目按原题库顺序练习。所选题量大于章节题数时只练该章全部题目；切换题库后显示对应题库的章节。

### 章节如何定义和管理

每道题的 `category` 是它所属章节的完整名称。同一题库中，相同名称合为一章，不同名称生成不同章节入口，不需要创建额外的 `chapters` 数组。

| 题目 | category | 导入后的章节 |
| --- | --- | --- |
| q1、q2 | 第一章 基础知识 | 第一章 基础知识，共 2 题 |
| q3 | 第二章 进阶应用 | 第二章 进阶应用，共 1 题 |

- 导入章节：在「题库 → 我的题库」找到目标题库，点击「导入章节」，选择文件或粘贴 JSON。单章文件可填写章节名称；多章文件默认全选，也可勾选部分章节，并提供「全选」「清空选择」。保存时按题目的 `category` 自动分章，无需逐章导入。
- 批量导入按原章名保存：同名章节追加题目，不覆盖已有题目和练习记录；新增章节按文件中首次出现的顺序添加，原有章节位置保持不变。预览显示所选章数、题数及新增/追加章数；未选章节不会导入。没有章节字段的题归入「未分类」。所有选中章节一起校验、一起保存，任一选中章有错误时全部不导入。
- 编辑章节：展开题库的「查看章节」，点击该章的「编辑章节」，可原位修改章名和题目 JSON。章名不能与同题库其他章节重复。
- 追加或替换单章：点击章节行内的「导入题目」，明确选择「追加到该章」或「替换该章」。来自其他章节的题目会统一归入目标章名。
- 合并章节：导出来源章，在目标章使用「导入题目 → 追加到该章」，核对后再删除来源章。
- 导出或删除单章：使用章节行内对应按钮。删除需确认，只移除该章的题目和练习记录，其他章节与题库保留；删除最后一章后题库仍保留，可继续导入新章。
- 调整顺序：在 `questions` 数组中按目标目录顺序排列题目。章节以首次出现的顺序排列，章内保持题目原顺序。
- 未填写章节时进入「未分类」。同一题库的题目 `id` 不应重复，不要每章重新从 q1 编号。

章节管理直接更新所选题库，不会重新建立整个题库。仅改章名、解析、标签或难度会保留练习记录；修改题干、题型、选项、答案或移除题目时，确认后清理对应题目的练习记录与错题状态，其他题目保留。若影响正在进行的练习，会结束该次练习以免继续使用旧题。

新导入的题号与已有题目重复时会自动重新编号，避免覆盖现有题目与记录；同一份待保存章节内的重复 `id` 会报错，JSON 存在错误时不进行部分保存。建议操作前先导出工作区备份。

上方「导入 JSON 题库」仍是整库导入，会创建一个新题库，不会覆盖原题库或自动合并练习记录。设置页的可复制/下载模板含两章三题示例。

整份文件只有一个章节时，也可以在根节点设置 `category` 作为默认章节；题目自身填写的 `category` 优先。

## 图片题

题干、选项和解析都能配图，图文交替排版。图片存在本机的资源仓库里，不塞进 `workspace.json`，备份时跟着题库包一起走。

### 带图题库用 .allright 题库包

纯文本题库仍然是原来的 `.json`。带图片的题库改用 **`.allright` 题库包**：一个 zip 容器，里面是 `bank.json` 加 `assets/` 目录。

```text
电路练习.allright
├─ bank.json
└─ assets/
   ├─ 3f9c…（内容哈希命名的图片文件）
   └─ 8a21…
```

`bank.json` 的样子：

```json
{
  "schemaVersion": 2,
  "kind": "bank",
  "name": "电路练习",
  "assets": {
    "3f9c…": { "file": "assets/3f9c…", "mime": "image/png", "bytes": 24576 }
  },
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "category": "第一章 电路基础",
      "stem": "观察电路图，判断串联电路中的电流关系。",
      "stemBlocks": [
        { "type": "text", "text": "观察电路图，判断串联电路中的电流关系。" },
        { "type": "image", "assetId": "3f9c…", "alt": "两个电阻串联的电路示意图" }
      ],
      "options": [
        { "key": "A", "text": "各处电流相等" },
        { "key": "B", "text": "各处电流一定不同" }
      ],
      "answer": ["A"],
      "explanation": "串联电路各处的电流相等。"
    }
  ]
}
```

- `stemBlocks` / `options[].blocks` / `explanationBlocks` 是内容块数组，数组顺序就是显示顺序，`text` 与 `image` 两种块可以交替。
- 没有内容块时照旧用 `stem`、`options[].text`、`explanation` 三个文字字段；两者都在时按内容块显示，不再重复渲染文字摘要。
- `assetId` 指向 `assets` 里的资源。导入时按**真实字节**重新算哈希，名字对不上也没关系；图片类型同样以字节为准，不信扩展名和清单里写的 MIME。
- 纯图片题干也要写 `stem` 或 `alt` 这样的文字摘要，方便搜索、错题本列表和无障碍朗读。
- 首版只收 PNG、JPEG、WebP，单张不超过 8 MB。图片要先看文件头算出宽高，再真解一遍：解不开的坏图、展开后像素过多的图，导入时就拒掉，不会等到练到那题才发现图是空的。
- 题库包是别人给的文件，所以解包有硬限制：条目路径必须在包内（`..`、绝对路径一律拒绝），条目数、单文件体积和解压后总体积都有上限，压缩炸弹在展开前就被挡下。
- 题库页的「载入图片题示例」会导入一份现成的示例包（`public/sample-image-bank.allright`），可以先看看效果。

### 图片怎么存、怎么备份

- **桌面版**：Rust 把图片写进应用数据目录的 `assets/` 子目录，文件名是内容哈希，同一张图在多个题库里只存一份。
- **网页版**：图片存在 IndexedDB，不占用 `localStorage` 的配额。
- 题库导出：带图的题库导出成 `.allright` 包，纯文字题库仍是 `.json`。
- 工作区备份：带图的备份也是 `.allright` 包，里面有题库、练习记录和全部图片；恢复时先把图片落盘，全部成功后才切换工作区，不会出现「题库在、图没了」的半截状态。
- 删掉一个题库时，只有它独占的图片会被清掉；别的题库还在用的图会留下。

### 界面行为

- 题干和解析里的图按容器宽度缩放，点一下能放大，支持缩放、拖动、按 Esc 关闭，关闭后焦点回到原来的位置。
- 图片选项里，「选这个答案」和「放大看图」是两个动作：点图只会打开预览，不会顺手勾上选项。
- 题干或选项的图加载不出来时，这题不允许提交，并提示修复；加载故障不会被记成答错。解析里的图加载不出来只留一个占位提示。
- 错题本和本次结算回顾共用同一套渲染，图片在哪儿都能看见。

## 数据与旧版迁移

- 桌面版通过 Tauri IPC 调用 Rust，在应用数据目录中保存 `workspace.json`。Windows 默认路径为 `%APPDATA%\com.allright.quandui\workspace.json`。写入先落到临时文件再替换，保存失败会在界面提示；启动读取失败时不会用空工作区覆盖原文件。
- 网页版仍使用 `localStorage`，键名为 `allright.workspace.v1`；图片另存 IndexedDB 的 `allright-assets`。
- 工作区格式升到 v2：新增图片清单 `assets`，只记图片的哈希、MIME 和体积。旧版 v1 备份和旧版 `workspace.json` 都能照常读入，读取时自动升级。
- 桌面导出使用系统保存对话框；导入支持文件选择、拖放和粘贴。题库与练习记录均保存在本机。
- **从旧 Electron 版迁移**：在旧版导出「工作区备份」，再在新版「设置 → 恢复备份」选择该 JSON，确认后恢复题库、练习记录、错题本和统计。旧版数据不会自动从 Electron 的浏览器配置中迁移。
- 恢复备份会替换当前工作区，请先导出当前备份。清空本机数据前也应先备份。

## 题库格式

```json
{
  "name": "我的题库",
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "category": "第一章",
      "stem": "这里写题干",
      "options": [
        { "key": "A", "text": "选项一" },
        { "key": "B", "text": "选项二" }
      ],
      "answer": ["A"],
      "explanation": "这里写解析",
      "difficulty": 2,
      "tags": ["常考"]
    }
  ]
}
```

支持单选、多选和判断题。章节字段兼容 `category` / `chapter` / `section` / `分类` / `章节` / `目录` / `knowledge`；完整字段别名和 AI 转译模板可在设置页查看。导入前会预览题量、分类和题型分布，有问题的题会逐条提示。

第一次使用可在题库页「载入示例题库」。示例为合成内容，不是真题。

纯文本 `.json` 题库不能带图——JSON 里放不下图片。要配图请用 `.allright` 题库包，格式见上一节。

## 验证

```bash
npm run build
npm run verify:deploy
```

启动 `npm run dev` 后，在另一终端执行：

```bash
npm run verify:e2e
npm run verify:chapters
npm run verify:chapter-management
npm run verify:tauri
npm run verify:image-questions
npm run verify:pack
```

浏览器回归使用 Windows Edge。新增回归可用 `EDGE_PATH` 指定浏览器、`ALLRIGHT_TEST_URL` 指定服务地址。`verify:tauri` 使用模拟 IPC 验证前端的桌面数据加载、保存、导出、备份恢复及失败处理；原生 Rust 编译与安装包需要另行执行 `npm run tauri:build` 验证。`verify:image-questions` 覆盖题库包导入、图文展示、放大预览、完整备份与恢复以及缺图拦截。`verify:pack` 检查题库包的安全边界：路径穿越、重复条目、体积上限与图片类型不符一律拒绝。示例题库包由 `npm run make:sample-pack` 生成。

## 项目结构

```text
src/
  App.tsx             导航与页面
  components/         看板、练习、题库、错题本、设置
  domain/             解析、统计、会话、存储、图片资源与题库包
  styles/             设计令牌与响应式样式
src-tauri/
  src/lib.rs          Rust 工作区读写、图片资源仓库与 Tauri 插件注册
  tauri.conf.json     窗口、构建、CSP 与安装包配置
  capabilities/      窗口权限
  icons/              应用图标
public/               本地字体、示例题库（JSON 与 .allright）与 favicon
scripts/              图标生成与回归验证
```
