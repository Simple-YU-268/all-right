# 界面主题

在「设置 → 通用偏好 → 界面主题」选择「油印卷子」或「手绘笔记」。切换立即生效，保存在当前设备的 `allright.theme.v1` 偏好中；默认仍是油印卷子。此偏好不随题库备份迁移。

第二主题使用 Looseleaf 的原始 TypeScript 绘线引擎生成确定性的铅笔边框，品牌字体为 Kevin Sans。中文题干与解析沿用可读字体，公式继续使用 KaTeX。所有字体、绘线代码均随应用提供，运行时无需联网。

## 维护

- `src/domain/theme.ts`：主题读取、应用、保存以及同源窗口同步。
- `src/components/ThemePicker.tsx`：主题选择器；手绘主题下换成 Looseleaf 绘线单选控件，两种主题都能用键盘选择。
- `src/components/LooseleafApp.tsx`：手绘主题自己的应用外壳（顶部导航、学习桌、练习、题库、错题本、设置）。
- `src/vendor/looseleaf/`：固定版本的 Looseleaf 组件与绘线引擎；控件的背景与描边由上游引擎按控件尺寸生成，不改动 DOM 结构与点击区域。
- `src/styles/looseleaf.generated.css`：由 `npm run build:looseleaf-css` 从上游样式生成并加 `.ll-ui` 作用域，请勿手工编辑。
- `src/styles/themes.css`：主题变量、局部控件样式与主题选择器；不修改原版配色。
- `src/vendor/looseleaf/SOURCE.md`：固定上游版本与来源；MIT 原文保留在源码和字体目录。

执行 `npm run vendor:looseleaf` 可重新取得固定版本源码与字体。升级前修改脚本中的 revision 并重新核对效果。

验证：`npm run verify:themes`，默认使用 `http://127.0.0.1:5180/`。可通过 `ALLRIGHT_TEST_URL` 指向其他测试服务。该检查覆盖切换、刷新持久化、键盘选择、绘线像素、公式、对错提交行为及窄屏布局。

样式编译保留 `theme, base, components, utilities` 的层顺序。不能删除该声明：否则通用 ink host 的相对定位会覆盖进度条填充的绝对定位，导致填充高度为零。主题验证包含此回归断言。

揭晓后的选项使用红／绿纸面与批改符号，保留 `aria-disabled` 语义且不再绑定点击操作，避免通用禁用配方将所有答案画成相同的灰色虚线。当前答题卡题号另有轮廓，不只依靠颜色识别。
