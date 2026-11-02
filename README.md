# ALL RIGHT 全对

电子刷题台：导入 JSON 题库，随机抽题或按章节练习，错题自动进入错题本，看板追踪练习进度。

新版使用 **Rust + Tauri 2 + React + TypeScript**，全站图标使用 **IconPark (`@icon-park/react`)**。网页与桌面版共用 React 界面。

## 下载

[v0.2.0 发行版](https://github.com/Simple-YU-268/all-right/releases/tag/v0.2.0) 提供 Windows x64 安装包：

- [ALLRIGHT-Setup-0.2.0.exe](https://github.com/Simple-YU-268/all-right/releases/download/v0.2.0/ALLRIGHT-Setup-0.2.0.exe)，约 8.2 MiB。
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

## 数据与旧版迁移

- 桌面版通过 Tauri IPC 调用 Rust，在应用数据目录中保存 `workspace.json`。Windows 默认路径为 `%APPDATA%\com.allright.quandui\workspace.json`。写入先落到临时文件再替换，保存失败会在界面提示；启动读取失败时不会用空工作区覆盖原文件。
- 网页版仍使用 `localStorage`，键名为 `allright.workspace.v1`。
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

## 验证

```bash
npm run build
npm run verify:deploy
```

启动 `npm run dev` 后，在另一终端执行：

```bash
npm run verify:e2e
npm run verify:chapters
npm run verify:tauri
```

浏览器回归使用 Windows Edge。新增回归可用 `EDGE_PATH` 指定浏览器、`ALLRIGHT_TEST_URL` 指定服务地址。`verify:tauri` 使用模拟 IPC 验证前端的桌面数据加载、保存、导出、备份恢复及失败处理；原生 Rust 编译与安装包需要另行执行 `npm run tauri:build` 验证。

## 项目结构

```text
src/
  App.tsx             导航与页面
  components/         看板、练习、题库、错题本、设置
  domain/             解析、统计、会话、存储与桌面适配
  styles/             设计令牌与响应式样式
src-tauri/
  src/lib.rs          Rust 工作区读写与 Tauri 插件注册
  tauri.conf.json     窗口、构建、CSP 与安装包配置
  capabilities/      窗口权限
  icons/              应用图标
public/               本地字体、示例题库与 favicon
scripts/              图标生成与回归验证
```

界面保留「蜡纸油印卷子」的靛蓝墨与冷灰纸面设计。设计规则见 `DESIGN.md`。
