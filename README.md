<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="80" alt="ALL RIGHT 全对">

# ALL RIGHT 全对

**把自己的题库，变成顺手的离线练习台。**

按章节刷题、集中复习错题，也可以让 Agent 帮你整理题库。

[下载 Windows 版](https://github.com/Simple-YU-268/all-right/releases/latest) · [使用与开发说明](docs/guide.md) · [MCP 配置](mcp/README.md)

</div>

## ✨ 核心功能

- 📚 **按章节练习**：选择章节和题量，或随机抽题；支持单选、多选和判断题。
- 📝 **错题复习**：答错自动进入错题本，答对后移出，支持按分类筛选。
- 📊 **进度看板**：查看练习量、正确率和掌握情况。
- 🖼️ **图片题**：题干、选项和解析都能配图，点击图片可放大。
- 🤖 **Agent 整理题库**：内置 MCP，校验并生成题库文件，无需另装 Node.js。
- 🔒 **本地保存**：题库与练习记录保存在本机，支持导出备份。

## 🚀 快速开始

当前版本 **v0.4.2**，支持 Windows x64。

- [下载安装包](https://github.com/Simple-YU-268/all-right/releases/download/v0.4.2/ALLRIGHT-Setup-0.4.2.exe)
- [查看更新与校验文件](https://github.com/Simple-YU-268/all-right/releases/tag/v0.4.2)

安装后，在「题库」载入示例题库即可试用，也可以导入自己的文件。

> 升级或换电脑前，先在「设置」里导出备份。恢复备份会替换当前工作区。

## 📸 界面展示

| 练习进度 | 图片题 |
| :---: | :---: |
| ![看板](docs/screenshots/dashboard.png) | ![图片题](docs/screenshots/picture-question.png) |

| 按章节练习 | 错题本 |
| :---: | :---: |
| ![章节入口](docs/screenshots/chapters.png) | ![错题本](docs/screenshots/wrong-book.png) |

## 使用方法

1. 在「题库」导入文件；也可以先载入示例题库试用。
2. 到「练习」选择章节和题量，或者随机抽题。
3. 答错的题自动进入错题本，答对后移出；看板可以查看练习进度。

章节可以在题库页编辑、导入或导出。同一题库中，`category` 相同的题目会归为同一章。

纯文字题库使用 `.json`，带图题库使用 `.allright`。设置页提供可复制的 JSON 模板；具体格式见[题库说明](docs/guide.md#题库格式)。

### JSON 示例

将下面的内容存为 `.json` 文件即可导入：

```json
{
  "name": "电路基础",
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "category": "第一章",
      "stem": "电流的单位是什么？",
      "options": [
        { "key": "A", "text": "安培" },
        { "key": "B", "text": "伏特" }
      ],
      "answer": ["A"],
      "explanation": "电流的单位是安培。",
      "difficulty": 1,
      "tags": []
    }
  ]
}
```

题目 `id` 应在全库唯一，答案必须对应选项的 `key`。不要让 Agent 猜测缺失的答案。

## 让 Agent 整理题库

桌面版已内置 MCP，无需另装 Node.js。在「设置 → Agent / MCP」复制配置，添加到支持 MCP 的 Agent 客户端。

接好后，可以这样提要求：

> 把这份试卷整理成 ALL RIGHT 题库，调用 MCP 校验后生成文件。不要猜答案，无法确认的题单独列出。

MCP 负责整理格式、校验和生成文件；读取 PDF、识别扫描件由 Agent 负责。目前支持纯文字题，不支持图片打包。生成后仍需在软件里预览导入，不会直接改动已有题库。

[查看 MCP 配置说明](mcp/README.md)

### MCP 配置

优先使用设置页生成的配置，路径会自动匹配当前安装位置。常用配置项如下：

| 配置项 | 含义 |
| --- | --- |
| `command` | 内置 `allright-mcp.exe` 的完整路径 |
| `env.ALLRIGHT_OUTPUT_DIR` | 生成题库的目录，默认配置指向应用数据目录下的 `mcp-output` |

服务由 Agent 客户端按需启动，ALL RIGHT 窗口无需一直打开。已有文件不会被覆盖。

## 本地开发

界面使用 React + TypeScript，桌面端使用 Tauri 2 + Rust。

```bash
npm install
npm run dev          # 网页开发
npm run build        # 构建网页
npm run tauri:dev    # 桌面开发
npm run tauri:build  # 生成 Windows 安装包
```

桌面构建还需要 Rust MSVC 工具链、Visual Studio C++ Build Tools 和 WebView2。构建时自动获取并校验内置 MCP 所需的官方 Node.js 运行时。

[开发环境与回归测试](docs/guide.md#验证) · [MCP 源码说明](mcp/README.md)

## 贡献与协议

欢迎通过 [Issues](https://github.com/Simple-YU-268/all-right/issues) 反馈问题或提出建议，也欢迎提交 Pull Request。报告问题时请附上版本、复现步骤和必要截图，题库示例请先移除个人或敏感信息。

修改代码后请运行 `npm run build`，并执行与改动相关的回归测试；MCP 改动可运行 `npm run verify:mcp`。

本项目采用 [MIT License](LICENSE)。导入和分发题库时，请自行确认内容的使用授权。

本项目使用 React、Tauri、MCP 官方 SDK、Zod、fflate 和 IconPark 等开源项目。详见[开源依赖说明](docs/open-source.md)与[第三方声明](THIRD_PARTY_NOTICES.md)。
