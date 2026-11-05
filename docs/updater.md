# 桌面更新发布

更新入口使用 Tauri updater，下载后校验签名再运行安装程序。

本机签名私钥位于用户目录 `.allright-signing/updater.key`，不在仓库内。
必须安全备份私钥；公钥已写入 Tauri 配置。不要重新生成密钥覆盖旧密钥。

发布时设置 `TAURI_SIGNING_PRIVATE_KEY` 为私钥文件路径后运行 `npm run tauri:build`。
不要把私钥内容写入日志或提交到仓库。

构建完成后执行：

```powershell
node scripts/make-update-manifest.mjs "src-tauri/target/release/bundle/nsis/ALL RIGHT 全对_<版本>_x64-setup.exe.sig"
```

将生成的 `release/latest.json` 与同次构建的安装包上传到同一正式发行版。
安装包附件名称必须为 `ALLRIGHT-Setup-<版本>.exe`，版本必须高于已安装版本。
发布前测试签名校验失败、网络失败、保存失败和真实旧版覆盖更新。

v0.8.0 及更早安装版没有更新插件，首次升级仍需手动安装支持更新的新版本。
当前 latest.json 未上传时，界面显示检查失败而非误报已是最新版本。
