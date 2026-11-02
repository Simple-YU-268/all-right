---
name: ALL RIGHT 全对
description: 蜡纸油印卷子——靛蓝墨印在冷灰纸面上，朱红只留给答错。
# 世界种子 seed:5a458fc0b4902f70 ｜ FORM: 蜡纸油印卷子（THE ROLL）
colors:
  blue-1: "#dde2f3"
  blue-2: "#b3bddf"
  blue-3: "#7e8bc4"
  blue-4: "#4a5dab"
  blue-5: "#2a3e8f"
  blue-6: "#1f2e6b"
  ink-900: "#1b2450"
  ink-800: "#262f52"
  ink-700: "#3a3f52"
  ink-500: "#656a79"
  ink-400: "#7e8393"
  paper: "#f5f7f7"
  paper-raised: "#fbfcfc"
  paper-sunken: "#dbe0e1"
  desk: "#e2e5e6"
  rule: "#d2d8da"
  rule-strong: "#b7c0c3"
  wrong: "#b5342a"
  wrong-soft: "#f6e5e2"
  wrong-line: "#e3b4ad"
  right: "#2c7355"
  right-soft: "#e1ede7"
  right-line: "#a9cab9"
  rail: "#1a2247"
  rail-ink: "#ffffff"
  rail-ink-dim: "#b9bed8"
  focus: "#2a3e8f"
typography:
  display:
    fontFamily: '"Noto Serif SC", "Songti SC", "SimSun", "Source Han Serif SC", serif'
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0em"
  headline:
    fontFamily: '"Noto Serif SC", "Songti SC", "SimSun", "Source Han Serif SC", serif'
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  title:
    fontFamily: '"Noto Serif SC", "Songti SC", "SimSun", "Source Han Serif SC", serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Hiragino Sans GB", system-ui, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  meta:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Hiragino Sans GB", system-ui, sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  label:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Hiragino Sans GB", system-ui, sans-serif'
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.04em"
  data:
    fontFamily: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
rounded:
  chip: "3px"
  control: "4px"
  panel: "6px"
  capsule: "999px"
  mark: "0"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.blue-5}"
    textColor: "{colors.rail-ink}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.blue-6}"
    textColor: "{colors.rail-ink}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 16px"
  button:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-500}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-700}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.control}"
    height: "34px"
    padding: "6px 12px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-500}"
    rounded: "{rounded.chip}"
    height: "22px"
    padding: "0 8px"
  panel:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.panel}"
    padding: "16px"
  nav-rail:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-ink}"
    width: "236px"
  databar-cell:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-900}"
    padding: "12px 16px 16px"
  option-row:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  option-key:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-500}"
    rounded: "{rounded.capsule}"
    size: "26px"
  segmented:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink-500}"
    rounded: "{rounded.control}"
    height: "26px"
    padding: "0 12px"
  ink-step:
    backgroundColor: "{colors.paper-sunken}"
    width: "7px"
    height: "14px"
---

# Design System: ALL RIGHT 全对

## Overview

**Creative North Star: "蜡纸油印卷子（THE ROLL）"**

这套界面的世界观是一张蜡纸油印卷子：一张冷灰的桌面（`--desk`），一张纸白的卷面（`--paper`），靛蓝色的墨在纸上压出五级浓淡。墨不是装饰，是读数——掌握度、每日题量、分类正确率共用同一支靛蓝墨的浓淡，深一格就是记得牢一格。答错的地方留一道朱红批改，石绿勾是老师的正确答案，靛蓝下划线是学生自己划的那一条，三支墨各管一件事，绝不混用。

它是一张工作台，不是一堆仪表盘。数字被当作表单里的读数来排：一条 58px 高的数据栏顶在内容区最上方，左端是标题与题库副名，右端是题量分段控件与靛蓝主按钮；往下一条发丝分隔横带压着五个读数格（已练题数／总正确率／今日练习／连续练习／错题本）；主场图是占满宽度的近 14 天练习量柱状图；右侧窄栏是错题本摘要。深度不靠阴影，靠 1px 发丝分隔线和纸面本身的色阶；圆角只在 3–6px 之间；密度高、留白紧、扫读优先。

它明确拒绝刷题产品的默认排法：一排彩色统计卡片加进度圆环，把数字当装饰。这里的每个数字都要指向一个动作（读数格的脚注就写着"还剩多少题未练""今天还没开始"）。全场只有一处作者动效——练习结算那一刻纸面翻成负片再落回数字（620ms，可关）。

**Key Characteristics:**

- **一支墨分五级**：靛蓝浓淡同时表达"练了多少"和"记得多牢"；格数＝数量，墨色＝档位。
- **纸面优先**：面板之间只用 1px 发丝线，纸色分三档（`paper` / `paper-raised` / `paper-sunken`），不用阴影抬层。
- **朱红只给错**：朱红与石绿被绑定到"答错／答对"这一件事上，破坏性操作改用墨阶中性色。
- **宋体读题面**：Noto Serif SC（自托管）读题干与解析，系统无衬线做界面，IBM Plex Mono 读数据。
- **每个读数都通向动作**：练习量、正确率、掌握分布都在同一张纸上，且都能点进去接着练。

## Colors

这是一套纸与墨的配色：冷灰纸面为底，一支靛蓝墨负责所有数据与主操作，两支状态墨（朱红、石绿）只负责批改对错。

### Primary

- **靛蓝油墨 1–6 级**（`#dde2f3` → `#1f2e6b`）：同一支墨的六档浓淡。`blue-5`（`#2a3e8f`）是主色——主按钮、当前选中项、链接、焦点环；`blue-6`（`#1f2e6b`）只做按下与悬停；`blue-4`（`#4a5dab`）做选中态描边与输入框聚焦描边；`blue-3`（`#7e8bc4`）与 `blue-2`（`#b3bddf`）是墨阶中段；`blue-1`（`#dde2f3`）是极浅的衬底（选中选项的底色、导入预览抬头、拖拽悬停底色），**不是数据墨阶的一档**。
- **最深的一级是 `ink-900`（`#1b2450`），不是 `blue-5`。** 已交付的五级读数墨阶是 `blue-2 → blue-3 → blue-4 → blue-5 → ink-900`（见「墨分五色」规则）；`ink-900` 是这支墨在数据语境下的最深一级。

### Secondary

- **朱红批改**（`#b5342a`）：只表示"错"。答错选项的键与叉、结算里的错题数、错题本的叉标、柱状图里的答错段、导入校验的 issues 区，全部且只能用它。浅底 `wrong-soft`（`#f6e5e2`）、描边 `wrong-line`（`#e3b4ad`）是它的两档衬底。

### Tertiary

- **石绿正解**（`#2c7355`）：只表示"对"。正确答案的勾、答对结果的题面、"掌握度 已掌握"档、练习进度点里的答对点。浅底 `right-soft`（`#e1ede7`）、描边 `right-line`（`#a9cab9`）是它的两档衬底。

### Neutral

- **冷灰桌面**（`#e2e5e6`）：`body` 底色，是托着卷面的那张桌子。
- **纸白**（`#f5f7f7`）：内容区底色。
- **纸白·浮起**（`#fbfcfc`）：面板、输入框、按钮、数据栏的纸面。
- **纸白·凹陷**（`#dbe0e1`）：进度轨、未填的墨格、幽灵按钮底、代码块底。
- **墨阶文字**：`ink-900`（`#1b2450`）标题与数据 → `ink-800`（`#262f52`）选项正文 → `ink-700`（`#3a3f52`）正文 → `ink-500`（`#656a79`）说明、标签、占位符与"无数据"标记 → `ink-400`（`#7e8393`）只出现在描边、图标与禁用态，不承载可读文字。
- **发丝线**：`rule`（`#d2d8da`）面板分隔与表格横线，`rule-strong`（`#b7c0c3`）控件描边。
- **导航深靛蓝**：`rail`（`#1a2247`）轨面，`rail-ink`（`#ffffff`）主文字，`rail-ink-dim`（`#b9bed8`）次要文字与未选中项。

### Named Rules

**The Ink Rule（墨分五色）.** 所有表达"多少"和"多牢"的读数共用一支靛蓝墨的五级浓淡，不得引入第二种数据色相。五级是 `blue-2 / blue-3 / blue-4 / blue-5 / ink-900`；`blue-1` 只做浅衬底，`paper-sunken` 只做"未练习"的空白格。

**The Vermillion Rule（朱红只给错）.** 朱红只用于"错"——答错的题、导入校验查出的问题。石绿只用于"对"。删除、清空等破坏性操作**不得**借用朱红：它们改用墨阶中性色，通过压深（`ink-700`）表达强度，而不是靠红。

**The Readable Ink Rule（可读文字最低一档墨）.** 正文、标签、占位符与"无数据"标记一律不低于 `--ink-500`（纸白上 4.95:1）。`--ink-400`（3.68:1）只用于描边、图标与禁用态，不写可读文字。

**The Paper Rule（纸面分层）.** 面板与容器之间只允许 1px 发丝线加纸色阶差（`paper` / `paper-raised` / `paper-sunken`）来分层，不得用宽柔阴影垫在 1px 描边之下。

**The Honest Data Rule（示例要标）.** 演示题库是合成内容，界面必须标注"示例"；不得把它写成真题、真实数据或官方成绩。

## Typography

**Display Font:** Noto Serif SC（`public/fonts/noto-serif-sc.css` 自托管子集，回退 Songti SC / SimSun / Source Han Serif SC / serif）
**Body Font:** PingFang SC / Microsoft YaHei / Noto Sans SC / Hiragino Sans GB / system-ui / sans-serif（中文界面用系统无衬线，这是世界的既定分工，不是显示字体）
**Label/Mono Font:** IBM Plex Mono（`public/fonts/ibm-plex-mono.css` 自托管，回退 ui-monospace / SFMono-Regular / Menlo / Consolas）

**Character:** 三个角色各司其职：宋体读题面（题干、解析、栏目标题），系统无衬线做界面外壳（按钮、标签、说明），等宽读数据（一切读数、日期、计数、比例）。等宽数字统一 `tabular-nums`，所以读数栏里的数字永远对齐成列。

### Hierarchy

- **Display**（宋体 400，1.75rem / 1.7）：题干面 `.t-stem`。练习屏的排版主角，列宽 ≤780px；≤860px 收到 1.375rem。
- **Headline**（宋体 600，1.375rem / 1.3）：页面标题 `.pagehead__title`；导航栏品牌名同族，更小一档（1.25rem，字距 0.01em）。
- **Title**（宋体 600，0.875rem / 1.3）：面板标题、题库名、分类名等栏内标题；16px 档用于空状态标题、拖拽区标题、结算结果标题。
- **Body**（无衬线 400，0.875rem / 1.6）：选项正文、表单说明、面板正文。解析正文例外，用宋体 0.875rem / 1.75，像一段讲义。
- **Meta**（无衬线 400，0.8125rem）：次要说明、时间戳、分类行注记。
- **Label**（无衬线 400，0.6875rem，字距 0.04em，`ink-500`）：读数格标签、表单字段名、刻度数字、解析标签。
- **Data**（等宽 500，`tabular-nums`）：结算正确率 2rem、读数格数值 1.375rem、结算分格 1.25rem、分类正确率 0.875rem、计数 0.8125rem、图表日期 0.6875rem。

### Named Rules

**The Three Voices Rule（三支嗓子）.** 题面一律宋体，界面一律系统无衬线，数据一律 IBM Plex Mono。不得让等宽字去装点"技术感"，也不得让系统黑体当显示字体——显示面的宋体必须来自自托管的 Noto Serif SC。

**The Fixed Ramp Rule（字号不随窗缩放）.** 字号走固定阶梯，不随视口宽度插值；响应式只允许换档（如题干 28px→22px），不做流体排版。全场已无字面 px 字号——每一个字号都取自 `--t-*` 阶，包括图表日期这类最小号。

## Layout

外壳是一张两栏的桌面：左侧 236px 深靛蓝导航 rail（`grid-template-columns: 236px minmax(0, 1fr)`），右侧内容区纸白。内容区内边距 32px / 32px / 48px，最大宽度 1280px 居中；顶栏最小高度 58px，底边一条发丝线。

- **顶栏（58px）**：左端标题与题库副名，右端是题量分段控件（10/20/50/全部）与靛蓝主按钮「开始随机练习」。≤860px 时操作区换到第二行并可横向滚动。
- **读数条**：5 等分单元格，格间 1px 竖发丝线；≤860px 变 2 列并补横线，最后一格（错题本）跨整行。
- **看板**：主栏 `minmax(0,1fr)` + 侧栏 348px，间距 24px，两栏顶对齐；≤1080px 侧栏落到主栏下方。
- **练习页**：单栏居中，最大宽度 780px——题面、选项、批改、解析、动作从上到下依次排。
- **间距节奏**：4 / 8 / 12 / 16 / 24 / 32 / 48（`s1`–`s7`）。组内用 `s2`–`s4`，组间用 `s5`–`s6`，空状态用 `s7`。

**响应式：**

- **≤1080px**：看板侧栏折到主栏下方，单栏。
- **≤860px**：rail 折成两行——品牌一行，五项导航平铺一行（等宽 5 列，不再横向滚动）；读数条 2 列；题干 28px→22px；结算分格 3 列→1 列。
- **≤560px**：rail 隐藏品牌副标、导航图标与计数徽标；图表日期隔一个隐藏；分类行与错题行改双列网格，阶梯墨格只缩不取消（7×14 → 5×10）。

## Elevation & Depth

这是一套**平**的系统：面板不浮，靠 1px 发丝线与纸色阶（`paper` / `paper-raised` / `paper-sunken`）分层；全场唯一一处阴影是分段控件的选中键（`0 1px 1px rgba(27,36,80,0.07)`），用来把"按下去的那一格"抬离凹陷的底轨。浮层（若有）才允许用阴影。令牌表里的 `--lift-1` / `--lift-2` 已定义但当前无任何组件消费。

动效只有一套语法：状态过渡统一 `--dur 160ms` + `--ease cubic-bezier(0.22,0.61,0.36,1)`；作者动效只有一处——结算卡片的纸面翻页（`paper-flip` 620ms），内里的文字与按钮各自跟一支 `ink-flip*` 动画同步翻，否则深底深字会消失。`prefers-reduced-motion` 会把所有动画压到 0.01ms；设置页另有「结算翻页」开关（`data-motion="reduced"`），把翻页整段关掉。

### Shadow Vocabulary

- **分段控件选中键**（`box-shadow: 0 1px 1px rgba(27,36,80,0.07)`）：唯一一处阴影，只用来抬起选中格。

### Known Boundaries（已知的未竟边界，不是缺陷）

以下几处是这个世界还没做出来的上限，记录下来是为了让后来的界面知道它们**尚未被 canonize**，而不是当成缺陷去修：

- **纸面是平涂的**：蜡纸与油印纸的纤维、压印颗粒没有做，冷灰纸面目前是干净的一层色。
- **墨阶是干净的 CSS 阶梯**：套色偏移、印压不匀没有做；浓淡是精确的色值跳变，不是压出来的浓淡。
- **主按钮没有盖印质感**：「开始随机练习」是干净的靛蓝色块，没有盖印的边缘与压痕。
- **反相只翻了结算卡片**：纸面负片只作用在结算卡片上，不是全屏翻面。
- **纸面偏冷是有意的**：冷灰偏冷是用户认可深靛蓝 rail 之后的结果，保留。

### Named Rules

**The Hairline Rule（发丝线分层）.** 层级靠 1px 线与纸色阶，不靠阴影。宽柔阴影垫在 1px 描边之下（幽灵卡）在本世界不存在，也不要新增。

**The One Moment Rule（只留一处动效）.** 全场只保留结算那一次纸面翻页；不要给每个区块加同一种入场动画。

## Shapes

形体语言是"几乎不圆"的：面板与控件的圆角都收在 3–6px（`--r-panel` 6px、`--r-control` 4px、`--r-chip` 3px），读起来是纸与表格，不是气泡。胶囊（`999px`）只出现在两个地方：选项键——它必须靠**形状与位置**区分而不是靠边框——以及浏览器滚动条滑块，那是浏览器表面自带的惯例。

另一端是墨迹类标记：rail 导航点、图例色样、墨阶格、掌握度轨与填块一律 `border-radius: 0`，是印上去的正方，不是控件。正方与圆角的差别刚好把"墨"和"件"分开。（练习进度点 dotrail 仍是圆点 `50%`：那是一颗一颗的进度点，不是墨块。）

描边只有两种粗细：1px 发丝线（`rule`，面板分隔与表格横线）与 1px 控件线（`rule-strong`，输入框、按钮、分段控件）。正确／错误的选项与结果不用左侧色条，而是"整块浅衬底 + 一圈同色 1px 描边"（`right-soft` + `right-line`、`wrong-soft` + `wrong-line`）。

### Named Rules

**The Square Mark Rule（墨迹是正方）.** 墨迹类标记——rail 导航点、图例色样、墨阶格、掌握度条——圆角一律 0：它们是印上去的方块，不是控件。控件的圆角留在 3–6px，胶囊只给选项键与滚动条滑块。

## Components

### Buttons

克制的纸面按钮，高度 34px（小号 28px、大号 40px），圆角 4px，内边距 0 16px（小号 0 12px）。

- **Primary**：靛蓝底 `blue-5` + 白字；悬停压深到 `blue-6`；禁用时退到 `blue-2` 底 + 白字。
- **Secondary**：纸白浮起底 `paper-raised` + 1px `rule-strong` 描边 + `ink-800` 字；悬停描边转 `ink-400`、底转 `paper`；按下底转 `paper-sunken`。
- **Ghost**：透明底 + `ink-500` 字；悬停垫 `paper-sunken`。
- **Danger（破坏性）**：**不用朱红**。纸白底 + `rule-strong` 描边 + `ink-700` 字；悬停整块反相成 `ink-700` 底 + 纸白字。
- **Focus**：`outline: 2px solid` 靛蓝 + 2px 偏移，落在纸面上；焦点环**不再自带圆角**，跟随元素自身的圆角走。

### Chips（标签）

高 22px、圆角 3px、1px 描边、0 8px 内边距、11px 字。中性标签是纸白底 + `rule` 描边 + `ink-500` 字；蓝色标签（当前题库、分类）是 `blue-1` 底 + `blue-2` 描边 + `blue-6` 字；错题标签是 `wrong-soft` 底 + `wrong-line` 描边 + `wrong` 字；答对标签是 `right-soft` 底 + `right-line` 描边 + `right` 字。掌握度标签是透明底的"一枚 8×8 方块 + 文字"，方块颜色就是那一级墨色。

### 选项行（练习页的签名组件）

一条选项 = 一个键胶囊 + 文本 + 可选的批改标记。键胶囊 26px 圆（`999px`）、1px `rule-strong` 描边、纸白底、等宽字。**揭晓后三种标记各走一支墨**：正确答案是石绿键 + 石绿勾；选错了的是朱红键 + 朱红叉（选项底转 `wrong-soft`）；"你划的那一条"另加一道靛蓝下划线（2px，偏移 5px），压在选项文字上——**与老师的对错批改分开记**。未选中的选项揭晓后降到 55% 透明度。选项下方常驻一行读法说明：靛蓝下划线＝你选的，勾＝正确答案，叉＝选错了。

### 墨阶阶梯条（签名组件）

五格，每格 7×14px（窄屏 5×10px），格间距 2px，空格是 `paper-sunken`，每格是正方（圆角 0）。**格数＝数量，墨色＝档位，同一行里的格子同色**——所以一格浅蓝可以与五格近黑并存，读得出"做得对，但还没记牢"。分类正确率行里：格数取正确率（`round(ratio × 5)`），墨色取该分类的掌握度均值档；读数条第一格（已练题数）里：格数取覆盖率，墨色跟随格数。

### 读数条（databar）

一条 5 格的表单式数据带，每格：11px 标签 → 等宽 22px 数值（可带 11px 单位）→ 11px 脚注。脚注必须写下一步动作或状态（"还剩 0 题未练""今天还没开始""已掌握 9 题"），这是"数字要能行动"的落点。

### 近 14 天练习量（主场图）

柱高＝当日题量，靛蓝段＝答对、朱红段＝答错（自下而上：朱红段贴基线在下，靛蓝段叠在其上）。答对段的墨色由当日题量决定：≤2 题 `blue-2`、≤5 题 `blue-3`、≤10 题 `blue-4`、≤20 题 `blue-5`、>20 题 `ink-900`——是绝对阈值，跨天可比。图左侧两道刻度（上界与一半），刻度线画在它标的那个数值上；底部一排等宽日期（11px），今天加粗。下方图例把整支墨的五级一次列全——`blue-2 / blue-3 / blue-4 / blue-5 / ink-900` 五个正方色样，文字只写"答对（色深＝当日题量）"；另一格是朱红正方色样 + "答错"。

### 掌握分布条

每行 = 52px 标签 + 凹陷轨（14px 高，`paper-sunken`，正方）+ 计数。填充宽度＝该档题数占比，颜色＝那一档的墨色（未练习＝`paper-sunken`，往上是 `blue-2`→`ink-900`），轨与填块都是正方。

### 分段控件（题量 / 练习方式 / 动效）

凹陷底轨（`paper-sunken`）+ 1px `rule-strong` 描边 + 2px 内缩距；每项高 26px、圆角 3px（`--r-chip`）。选中项是纸白浮起片 + `ink-900` 字 + 那唯一一处 1px 阴影。

### 面板（Panel）

1px `rule` 描边 + 圆角 6px + `paper-raised` 底，**无阴影**。面板头是 12px/16px 内边距 + 一条发丝下划线 + 宋体标题（14px/600）+ 一句 11px 灰色读法说明；面板体默认 16px 内边距，可选 flush（0 内边距，表格贴边）。

### 进度点轨（dotrail）

练习页题序进度：9px 圆点，1px `rule-strong` 描边；答对填石绿、答错填朱红、当前题加粗描边转 `ink-900`。

### 输入框与下拉

最小高 34px、圆角 4px、1px `rule-strong` 描边、`paper-raised` 底、`ink-800` 字、6px 12px 内边距。悬停描边转 `ink-400`；聚焦时描边转 `blue-4`，并加一道 `blue-1` 的 2px 内描边。占位符用 `--ink-500`（4.95:1），不用更浅的墨。下拉用两条 5px 的 CSS 斜线拼出箭头，不引图标。文本域用等宽 13px，行高 1.6。

### 导航 rail

236px 深靛蓝竖栏：顶部是品牌名（宋体 20px/600，"ALL RIGHT" + 11px 副标"全对"），中间五项竖排导航（看板／练习／题库／错题本／设置），底部压当前题库信息（题库名 + 题数与分类数），底部与上方之间一条 12% 白发丝线。导航项 = 6px 方形墨点（圆角 0）+ 16px 线性图标 + 14px 文字；未选中是 `rail-ink-dim`，悬停垫 7% 白底、字转白，当前项垫 13% 白底（契约原文写的是"吃满饱和底色"，实际落地是白墨 13% 压上来的半透明底，不是第二种饱和色相）、字转白加 500 字重、墨点满透明度；错题本一项右侧带等宽计数徽标。图标一律 lucide 线性图标，rail 内线宽 1.75，其余界面 2。

### 导入校验清单（题库页）

导入预览里的问题清单是"老师在你卷子上画的批改"：`wrong-soft` 底 + `wrong` 字，每行左侧一个等宽题号（"第 12 题"），右边说清是哪一题的哪个字段不对。整块清单可滚动（最高 220px），后面的导入按钮照常可用——有问题的题会被跳过，其余照常导入。朱红在这里是对的，但必须走令牌，不许写死色值。

### 浏览器表面（属于这套设计的一部分）

选中文本：`blue-2` 底 + `ink-900` 字。滚动条：10px 细轨，滑块 `rule-strong`、圆头 999px，悬停转 `ink-400`。焦点环：靛蓝 2px + 2px 偏移，圆角跟随被聚焦元素。所有数字读数走 `tabular-nums`。

## Do's and Don'ts

### Do:

- **Do** 用同一支靛蓝墨的五级浓淡表达任何"多少／多牢"的读数（掌握度、每日题量、分类正确率），格数＝数量、墨色＝档位。
- **Do** 把朱红只留给"答错"、石绿只留给"答对"；破坏性操作改用墨阶中性色并靠压深表达强度。
- **Do** 用 1px 发丝线（`rule`）分面板、1px 控件线（`rule-strong`）描控件，靠纸色三档分层次。
- **Do** 把数字放进 IBM Plex Mono 并保持 `tabular-nums`，让读数列对齐。
- **Do** 给每个读数配一句通向动作的脚注（还剩多少题、今天练没练、重刷去哪）。
- **Do** 把圆角收在 3–6px；胶囊（999px）只留给选项键。
- **Do** 把墨迹类标记（rail 导航点、图例色样、墨阶格、掌握度条）画成正方，圆角 0——它们是印上去的方块，不是控件。
- **Do** 保留题目的形状与位置区分法：键胶囊靠形状与位置，颜色只表状态。
- **Do** 标注示例数据；演示题库要明说是合成内容，不是真题。
- **Do** 让唯一的动效留在结算翻页，并让设置里的「结算翻页」开关真正关掉它。

### Don't:

- **Don't** 加第二种数据色相、进度圆环、迷你走势线，或一排装饰性统计卡；主场图只有一张，其余是表与读数。
- **Don't** 用朱红做破坏性操作、错误提示或装饰性强调——朱红是"答错"专用墨。
- **Don't** 用低于 `--ink-500` 的墨写正文、占位符或数据标记；`--ink-400` 只留给描边、图标与禁用态。
- **Don't** 用硬偏移阴影（`4px 4px 0` 那种）当深度系统，也不要在 1px 描边下垫宽柔阴影。
- **Don't** 在标题上方加 kicker／eyebrow 小标签；标题自己说话。
- **Don't** 用 Unicode 字符或 emoji 代替图标，也不要混用多套图标风格；用 lucide 线性图标，界面 2 号线宽、rail 1.75、批改标记 2.4–2.6。
- **Don't** 用系统黑体或 Impact 当显示字体；显示面的宋体必须来自自托管的 Noto Serif SC。
- **Don't** 让字号随视口宽度插值；走固定阶梯，响应式只换档。
- **Don't** 把冷灰纸面改成暖米色，也不要给纸面加纹理或颗粒——纹理是尚未实现的边界，不是待补的规则。
