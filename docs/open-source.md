# 开源依赖与声明

ALL RIGHT 使用现有开源项目处理通用能力，题库和练习相关规则由项目维护。

| 能力 | 项目 | 许可证 |
| --- | --- | --- |
| 界面 | React | MIT |
| 桌面框架与插件 | Tauri | MIT / Apache-2.0，以各包为准 |
| MCP 协议 | Model Context Protocol TypeScript SDK | MIT |
| 工具参数校验 | Zod | MIT |
| ZIP 压缩与解压 | fflate | MIT |
| 界面图标 | IconPark React | Apache-2.0 |

npm 实际版本、传递依赖及随包许可证见根目录 `THIRD_PARTY_NOTICES.md`。
运行 `npm run notices` 可从锁文件与本地已安装依赖重新生成，安装包包含该文件。

## v0.4.1 核对结果

- npm：锁定版本的 105 个生产依赖及其许可证原文汇总于 `THIRD_PARTY_NOTICES.md`。
- Rust：411 个锁定依赖（含其他平台及构建依赖）汇总于 `RUST_THIRD_PARTY_NOTICES.md`；MIT/Apache 双许可组件可选择宽松许可。MPL-2.0 组件未修改，清单提供对应版本源码链接，以满足获取其源码的需要。
- 运行时：v0.4.1 不再分发 Bun。改为 Node.js 24.20.0 官方 Windows x64 二进制，构建时与官方 SHASUMS256 核对，随包保留该版本完整 LICENSE（含第三方组件声明）。来源：https://nodejs.org/dist/v24.20.0/ 。
- 字体：用 fontTools 检查了 116 个 woff2 的 name 表，家族均为 Noto Serif SC 或 IBM Plex Mono；随字体附上 Google Fonts 官方仓库对应 OFL-1.1 原文。未对字体文件做二次修改。

这是工程层面的依赖与声明核对，不是法律意见，也不承诺发现了所有上游元数据缺陷。

安装包还包含 `resources/rust-source-supplement.zip`：保留 MPL 组件及未提供顶层许可证文件组件的原始 crate 源码（包含原始元数据和版权说明），便于查阅和复核。其他组件的锁定源码可从清单中的版本链接获取。

## 历史问题

### 2026-11-02 审计发现：发行阻断项

当前内置服务使用 Bun 1.4.3 的 `--compile`。其官方版本许可证说明
（https://github.com/oven-sh/bun/blob/bun-v1.4.3/LICENSE.md）指出，运行时静态链接
JavaScriptCore/WebKit，涉及 LGPL 与可修改、重新链接相关要求。
仅随包附 MIT 或 npm 许可证清单不足以证明整个二进制的分发要求已满足。
此问题通过 v0.4.1 移除 Bun 分发路径处理。
已发布的 v0.4.0 同样需要回溯检查，不能宣称完成了完整合规审计。

字体的 OFL 文本已从 Google Fonts 官方仓库补入 `public/fonts/`：
`OFL-NotoSerifSC.txt` 与 `OFL-IBMPlexMono.txt`。这些文件对应字体家族的授权，
具体字体二进制的下载历史无法从现有仓库完整恢复；已核对内部家族信息，未声称逐字节匹配某一上游提交。


## 后续选型原则

先复用已有依赖，再评估成熟开源方案。引入前核对许可证、维护情况、离线能力、包体积和 Windows/Tauri 兼容性；保留来源与许可证，不为替换而替换。
文档提取、OCR、图片预览等新能力应先做小范围验证，再决定是否引入。
