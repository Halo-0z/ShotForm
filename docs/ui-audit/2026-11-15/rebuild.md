# A · 球场回放台：实现与验收

用户目标：选择 A，全面重构界面，完成浅色和深色主题，保留现有功能。

设计北极星：先看清这次出手，再追问判断依据。主要用户为桌面端篮球训练者；核心动作为导入素材、逐帧回看、阅读角度与分型依据、保存训练记录和对比。

## 实现范围与证据

| 要求                | 当前实现                                                                                             | 验证证据                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 首页 `/`            | 既有球员素材、单一开始入口、可暂停轮播、雾化进入工作台                                               | after/light-home.png、dark-home.png；motion-rebuild/workflow.webm；首页职责测试                                                                 |
| 上传 `/upload`      | 图片与视频模式、预览、真实视频缩略帧、裁剪、键盘滑杆、实际分析进度、失败保留素材                     | 浅深 upload-video 截图；upload.browser-runtime、upload.light-theme、workbench-management 浏览器测试                                             |
| 分析 `/analysis`    | 主回放画面、原图/姿态切换、时间轴、速度与逐帧控制；右侧分型和角度依据；图表/表格、规则和 AI 建议入口 | 浅深 analysis-video、analysis-fixture、analysis-table 截图；replay-workbench、audit-regressions、training-workflow 测试                         |
| 历史 `/history`     | 来源分组、展开收起、日期/标签/分型筛选、分页、编辑训练、两次训练比较、趋势、查看分析和删除入口       | 浅深 history-fixture、history-editor、training-comparison 截图；training-workflow、replay-workbench；p2-regressions 使用生产 SQL 验证过滤与分页 |
| 球星对比 `/compare` | 保留后端对比与快照、模板切换、主动刷新、错误重试；差异表优先，雷达图可展开                           | 浅深 compare-ready、compare-radar、compare-error、compare-empty、compare-loading；compare.browser-runtime、p2-regressions                       |
| 模板 `/templates`   | 保留当前视频生成模板、列表、新增、编辑、确认删除与失败反馈                                           | 浅深 templates；workbench-management 验证保存失败保留字段、增改、重载、取消删除和确认删除                                                       |
| 浅深主题            | 中性结构、钢蓝操作、铜色证据；主题持久化、跟随系统、设置与共享弹窗                                   | 全部路由双主题截图；replay-workbench 的系统主题、持久化与弹窗焦点测试；upload.light-theme 的实际 CSS 验证                                       |
| 保留数据与导出      | 分析 Store、数据库、模型、IPC 协议未改；保存、历史回读、HTML/JSON 导出和已保存对比快照延续           | Git 差异范围；analysis Store、comparison-history、training-workflow 单元测试；浏览器保存、失败重试、离线报告及过期帧建议回归                    |
| 窄窗与键盘          | 侧栏收窄、短窗口上传入口、弹窗内滚动；快捷键改 Ctrl/⌘+Shift，保留编辑快捷键                          | 960px 截图、720×450 等效 200% 重排、CSS zoom=2 上传截图；replay-workbench 的焦点与尺寸测试                                                      |

复用现有路由、素材、字体和业务服务，没有把 legacy HomeWorkspace 重新引入首页或上传页。浏览器环境明确标注桌面专属功能，不伪造分析成功。

系统托盘辅助路由 `/tray-menu` 同样接入浅深配色；保留原生窗口、导航、收起和退出命令。按原生 376×380 尺寸截图验证（light/dark-tray.png），主窗口切换主题同步已打开窗口。追加主题与回放定向复查 27/27 通过，包含跨窗口 storage 同步与托盘导航。原生托盘弹出/退出进程未通过浏览器测试替代验证。

## 关键设计决定

- 分析页保留大画面、近邻播放控件、关键帧与右侧证据的阅读顺序。使用原始图像尺寸和真实关键点，低置信度角度显示不可判断。
- 回放默认暂停；播放预览与已提交分析帧分开，暂停或手动选帧才提交。播放期间禁用保存和导出，避免图像与报告依据不一致。
- 移除内页大幅背景、重复解释、假账号身份与固定正向评价。相似度明确不代表投篮水平。
- 雷达图补齐左右肘角映射；三项以上可绘制数据时，在差异表后展开。图形和表格使用同一组差异数据。
- 全局输入框装饰不再作用于 range、checkbox、radio，消除时间滑杆背景模糊。统一边距规则不再覆盖 Tailwind 控件内边距。
- 三处主要动态：进入工作台的短入场、封面到上传的既有雾化转场、操作/选中反馈；系统减少动态效果时简化，封面轮播可手动暂停。

## 验证结果与复现

在最终产品源码完成、格式化完成后，顺序执行功能回归与截图。不要同时生成审计文件和运行浏览器用例：当前 Vite 会监听审计文件写入并刷新页面，清除内存夹具。之前的偶发上下文销毁已通过开发服务器日志与失败 trace 定位到这一原因。

```powershell
npx vue-tsc --noEmit
npx playwright test --config=playwright.upload.config.ts tests/render/audit-regressions.spec.ts tests/render/compare.browser-runtime.spec.ts tests/render/replay-workbench.spec.ts tests/render/training-workflow.spec.ts tests/render/upload.browser-runtime.spec.ts tests/render/upload.light-theme.spec.ts tests/render/p2-regressions.spec.ts tests/render/workbench-management.spec.ts --repeat-each=3
node docs/ui-audit/2026-11-15/capture-after.mjs
node docs/ui-audit/2026-11-15/capture-motion.mjs
```

- 类型检查通过；上述 25 个浏览器用例连续三轮 **75/75 通过**。覆盖实际 DOM 操作与持久化模拟接口，不将截图生成等同于业务通过。
- 受影响 UI 职责、复制白名单、分析 Store、训练报告、对比快照、对比状态与进度等定向 Node 测试 **103/103 通过**；未运行与改动无关的完整测试集。
- 修改文件 ESLint 为 0 errors（54 warnings，主要为既有代码和浏览器夹具中的 any）；手动执行与 pre-commit 相同的 `npx lint-staged` 通过。
- 当前 `after/` 共 45 张页面状态截图；`observations.json` 未报告被检查容器的水平溢出。2× DPR 图仅用于细节取证，不冒称 200% 浏览器缩放；重排另外验证。
- 旧正则测试中固定背景横幅、卡片数量、旧 CSS 类名和自动播放的断言已退休。回放行为由 replay-workbench 实际操作覆盖，主题与上传由 upload.light-theme 覆盖，路由职责、模板命令、对比 Store 接线和复制白名单检查保留。
- 独立视觉评审从首轮 7/10 到复核 8/10；最终对比页局部复核通过。详见 rebuild-review.md；并非对模型准确率或桌面端完整端到端运行的评分。

## 证据边界与保留事项

截图里的分析角度、分型和历史记录为明确的布局/测试夹具，真实视频图像来自仓库已有上传样本；不代表模型实测，不写入用户数据库。浏览器测试模拟 Tauri IPC；SQL 回归执行真实生产查询。此次未运行原生模型完整推理、付费 AI 请求、发布构建或安装包验收，后端与模型文件无差异。

`evidence-rebuild/` 的首屏与 2× 图 lint 均为空。工具缺少完整 ffmpeg，MP4 编码失败保留在 report.json；使用 Playwright 编码得到 `motion-rebuild/workflow.webm`，包含主页到上传、设置切换、导入、键盘裁剪与播放暂停，运行无页面错误。评审环境未以正常速度观看，故动效主观手感未验证。

日期输入保留浏览器/系统原生日期控件，具体占位语言由环境决定；没有另建日历控件来掩盖浏览器语言差异。首页保持用户选定的体育封面职责，没有为了回放符号添加虚构时间码。
