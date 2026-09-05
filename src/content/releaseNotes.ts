export const bundledReleaseNotes = `### 0.1.5

#### English

- Rebuilt the Skill workspace around skills.sh discovery, leaderboard filtering, Git URL installation, and local enable/disable management.
- Added a consistent in-app Skill detail card backed by the repository SKILL.md.
- Replaced slow full-repository cloning for marketplace installs with targeted GitHub HTTPS downloads and a bounded Git fallback.
- Updated relay account editing and the CodexTool storefront endpoint while preserving the existing macOS and Windows integrations.

#### 中文

- 重构 Skill 工作区，支持 skills.sh 榜单与搜索、Git 地址安装，以及本地 Skill 启用和禁用管理。
- 新增统一风格的 Skill 详情弹窗，直接读取仓库中的 SKILL.md 展示完整介绍。
- 市场安装改用 GitHub HTTPS 定向下载，并保留有超时限制的 Git 备用通道，避免完整克隆长时间卡住。
- 完善中转账号编辑与 CodexTool 商城地址，同时保持 macOS 与 Windows 原有集成不变。

### 0.1.4

#### English

- Restored macOS quota and usage status items when an older persisted menu-bar record marked them hidden.
- Fixed compressed account rows in narrow macOS windows and let usage meters expand to the card width.
- Added the native macOS Dream Skin runtime with reviewed-gallery filtering, bounded official downloads, SHA-256, ZIP manifest, image, and Safe CSS validation, plus verified rollback handling.
- Kept the Windows tray and Dream Skin PowerShell paths unchanged and added cross-platform regression coverage.

#### 中文

- 修复旧菜单栏持久化记录导致 macOS 额度图标与用量状态项持续隐藏的问题。
- 修复 macOS 小窗口账号卡片受压缩的问题，用量进度条会自适应铺满卡片宽度。
- 补齐 macOS 原生换肤运行链路：当前平台图库筛选、官方源有界下载、SHA-256、ZIP 清单、图片与 Safe CSS 校验，以及失败回滚处理。
- 保持 Windows 托盘与 Dream Skin PowerShell 链路不变，并补充跨平台回归验证。

- 0.1.3:

#### English

- Dream Skin now accepts a fully rendered background Codex window and waits longer for slow Store CDP startup.
- Added reserved previous/next controls and a visible horizontal scroll track for long supplier categories.
- Replaced the inactive signed-updater stub with GitHub Releases version checks and safe manual downloads.

#### 中文

- Dream Skin 现在可识别已完整渲染但处于后台的 Codex 窗口，并延长 Store 冷启动端点等待时间。
- 长分类增加左右浏览按钮、预留滑动区域与可见横向滚动轨道。
- 移除未启用的签名更新占位配置，改为 GitHub Releases 版本检查与安全手动下载。

- 0.1.2:

#### English

- Fixed the Settings workspace height after switch updates in maximized WebView2 windows.
- Dream Skin now routes interrupted appearance journals through its safe restart-and-recovery path.
- Reworked all five quota tray visuals with a blue glass palette, neutral tracks and clearer small-size contrast.

#### 中文

- 修复最大化 WebView2 窗口中设置开关更新后页面高度错乱的问题。
- Dream Skin 现在会通过安全重启与恢复流程处理被中断的外观事务。
- 五种额度任务栏图标统一改为蓝色玻璃材质、中性轨道与更清晰的小尺寸对比度。

- 0.1.1:

#### English

- Fixed Dream Skin community-theme error handling and forced the bundled engine to upgrade to 1.5.17.
- Stabilized the Settings page after switch updates.
- Added an explicit installer mode and directory selection flow.

#### 中文

- 修复 Dream Skin 社区主题异常处理，并将内置引擎升级至 1.5.17。
- 修复设置页开关更新后的滚动布局错位。
- 安装程序增加明确的安装模式与目录选择流程。

- 0.1.0:

#### English

- Initial CodexTool desktop preview with accounts, analytics, native stores and quota surfaces.

#### 中文

- CodexTool 桌面预览版：账号管理、分析、原生仓库与额度展示。
`;
