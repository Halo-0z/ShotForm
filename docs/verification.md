# 本次实现与验证记录

执行日期：2026-11-15（Asia/Shanghai）。代码基于提交 `9c78dde1e6b3b06e3c30795d62720f1abd41430a` 的增量修改。下列早期记录保留当时结果；**当前状态以文末“Rust、Heavy 与原生桌面复核”一节为准**，提交记录见 Git 历史。

## 已实现的增量

- 图片/视频模式入口，文件格式、空文件、200MB 限制及浏览器预览提示；图片结果显示与无结果状态。
- 保存按钮接入数据库接口，接收记录 ID；并发保存合并、成功后禁止重复插入、失败后允许重试。过期保存或 AI 响应不会关联到新分析。
- 保存抽样帧、图像、本地建议与已有 AI 建议；修复视频历史恢复过程中对比快照被帧切换清空的问题。
- 训练日期、备注、标签；增量数据库迁移；数据库侧筛选和分页；历史编辑。
- 两条训练记录的姿态图、手动帧选择、角度差值、变化图表；缺失和低置信度指标显示原因。
- 单次分析 HTML/JSON、训练对比 HTML；图片内嵌、文字转义、无 AI 占位、打印样式、取消导出反馈。
- 默认模板的示例数据标识、参考来源填写提示；环境检查、启动脚本、实验测量和人工角度评估工具。

## 自动检查

| 检查 | 实际结果 | 能证明什么 |
|---|---|---|
| `npm run build` | 通过 | TypeScript 类型检查与 Vite 生产构建完成 |
| `npm test` | 216 项通过，0 失败 | 现有前端测试与新增比较、报告安全、保存/恢复/AI 状态测试 |
| `npm run test:render` | 13 项通过 | Edge 浏览器的上传预览、训练编辑、帧切换、导出取消、离线报告和页面状态 |
| Python `unittest` | 5 项通过 | 真实 SQL 文本的迁移/筛选/分页行为、角度计算、空标注不产生虚假误差 |
| Python `pip check` | 通过 | 当前虚拟环境的包依赖无冲突 |
| 修改的业务前端文件 ESLint | 通过 | 新增组件、报告逻辑、Store、分析/历史/上传页的静态检查 |
| 修改的数据库/类型 Rust 文件 rustfmt 检查 | 通过 | Rust 源文件可解析并符合格式；不等同于编译通过 |
| `git diff --check` | 通过 | 无差异空白错误 |

浏览器训练测试使用明确标记的测试夹具和模拟 Tauri 接口。SQLite 测试从生产 Rust 文件提取真实 SQL，用 Python SQLite 执行；它验证 SQL 行为，但不替代 Rust 类型检查或 Tauri 集成测试。过期的界面断言已按当前路由与组件行为更新，没有通过跳过失败测试获得通过结果。

## 真实 Python 推理检查

环境：Windows 11 x64、Python 3.12.10、MediaPipe 0.10.21、OpenCV contrib 4.11.0.86、NumPy 1.26.4。完整环境见 [environment.json](experiments/verification/environment.json)。

| 输入 | 实际结果 | 单次耗时 |
|---|---|---|
| 仓库 `public/hero/kobe-shot.png` | 检出 33 个关键点 | 1.073 秒 |
| 仓库 `tests/fixtures/upload-sample.mp4` | 尝试 16 帧、读取 16 帧、返回目标姿态 16 帧 | 1.727 秒 |
| 640×480 全黑图像 | `No pose detected`，0 个关键点 | 未计入基准结果 |

该早期检查没有记录实际加载模型，且当时 Heavy 已截断；这些耗时不能归属于 Heavy。耗时仅为一次 Python 进程检查，包含启动、解码、推理和 JSON 输出，不包含 Rust/UI，也不是统计性能结论。素材来源及 SHA-256 见 [results.json](experiments/verification/results.json)。没有用这两个素材计算模型准确率或训练效果。

人工标注尚为空，评估工具实际返回有效比较 0、MAE `null`，见 [empty-label-check.json](experiments/verification/empty-label-check.json)。没有填造人工点位或真实实验结果。

## 尚未通过的验证

Rust 编译/测试在 `link.exe not found` 处停止，未运行到项目单元测试。当前电脑已安装 Rust，但缺少 Microsoft C++ 工具链与 SDK。桌面端启动、原生保存对话框及文件权限、退出重启恢复仍待实际联调。

混元 API 未配置，本次没有发起付费 AI 请求；API 失败时的本地流程通过模拟错误测试，不代表真实模型调用已验证。用户暂无训练素材，真实数据集、人工标注、前后训练样例、答辩电脑与录屏仍按 [后续清单](remaining-work.md) 完成。

## 2026-11-15 独立审计两项修复复核

本轮范围仅为规则建议串帧、角度置信度下限抬高两项修复及相应回归，不迁移技术框架、不增加功能。保留现有 Vue + Tauri/Rust + Python/MediaPipe；目前迁移会重新引入界面、桌面接口和算法调用的联调成本。

### 修复内容与变更文件

| 文件 | 本轮变更 |
|---|---|
| `src/stores/analysis.ts` | 规则建议绑定分析会话、时间戳和视频帧索引；切帧/请求开始/失败清空数据。独立请求对象阻止快速 A→B→A、同时间戳帧及旧会话的迟到响应覆盖当前结果。保存只读取状态完成且归属匹配的 `currentRuleSuggestions`，移除无归属建议覆盖入口。视频分析只发起一次规则请求，恢复历史时不再额外请求覆盖已保存建议。 |
| `src/views/Analysis.vue` | HTML/JSON 使用同一有效建议入口；导出的视频代表帧索引与当前角度一致。 |
| `src-tauri/src/analysis/angles.rs` | 置信度仅限制到概率范围 0～1，不再抬高下限；独立使用 0.55 判定阈值。新增双腿不重叠、相关点 visibility=0.1/1.0 对照，以及 0.54/0.55 阈值边界用例。 |
| `src/lib/training-comparison.js`、`src/lib/training-comparison.d.ts` | 提取趋势图实际使用的数据筛选函数用于测试；低置信度角度不产生趋势点，保留合法零值。 |
| `src/components/ProgressChart.vue` | 使用经过测试的趋势数据筛选；全为低置信度时清空曲线。回归发现筛选卸载后的异步图表初始化报错，补上加载后的容器有效性检查。 |
| `src/stores/analysis.test.js` | 新增 5 项：等待/失败时保存不串帧、A→B→A 的迟到成功/失败响应、恢复历史和分析会话隔离。已有 AI 失败测试改由真实规则加载入口建立本地建议。 |
| `src/lib/training-workflow.test.js` | 新增 1 项：四个膝/髋低置信度结果在前后两个方向均无差值，也不进入趋势图数据。 |
| `tests/render/audit-regressions.spec.ts` | 新增 3 项：页面按钮实际生成的 HTML/JSON 和保存参数，在延迟/失败/成功时均使用正确建议；真实 ECharts 配置排除低置信度点并清除失效曲线。 |
| `docs/verification.md` | 本轮实际测试结果与待验证边界。 |

### 本轮实际执行结果

| 检查 | 结果 |
|---|---|
| `npm run build` | 通过，含 TypeScript 检查及 Vite 生产构建。存在既有 Browserslist 过期和动态/静态导入提示。 |
| `npm test` | **222 通过，0 失败，0 跳过**。比上一轮新增 6 项。 |
| `npm run test:render` | 最终 **16 通过，0 失败**。第一次完整运行 15 通过、1 失败，错误为筛选后图表异步初始化 `invalid dom`；补容器检查后完整重跑全部通过，未跳过或删除失败断言。 |
| 8 个本轮前端/测试文件 ESLint | **0 错误，12 个 `no-explicit-any` 警告**（图表实例 1 个、浏览器测试模拟接口 11 个）。 |
| `rustfmt --check src-tauri/src/analysis/angles.rs` | 通过；仅证明解析/格式，不代表 Rust 类型检查或单元测试执行成功。 |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib analysis::angles::tests` | **未执行到项目测试**：依赖编译报 `linker link.exe not found`，退出码 1。新增 Rust 用例仍待验证。 |
| `git diff --check` | 通过；Git 有 LF/CRLF 转换提示，无差异空白错误。 |

浏览器测试使用构造数据和模拟 Tauri 调用，不涉及真实 SQLite 插入、原生文件对话框或磁盘导出。visibility=0.1 的前端回归使用预期 Rust 输出形态（confidence=0.1、status=low_confidence）验证消费链；并未用它代替尚未执行的 Rust 算法测试。Python 算法与实验工具本轮未修改、未重新验收。

### 仍待验证

- Microsoft C++ 工具链和 SDK 就绪后，运行上述 Rust 角度测试及完整 `cargo test --manifest-path src-tauri/Cargo.toml`。
- 真实桌面：图片/视频分析后保存，退出并重启恢复；快速切帧时检查建议归属，确认历史中角度、图像和建议一致。
- 真实桌面：通过原生保存对话框导出 HTML/JSON，检查磁盘内容、取消行为、离线图片和中文；等待/失败状态下不得带入上一帧建议。
- 实际 Rust 输出到训练对比、趋势图的端到端验证；不使用构造数据测试宣称真实算法已通过。

本轮没有发起任何付费 AI API 调用，也没有安装或绕过限制安装 C++ 工具链。旧历史中已经保存的错误建议或被抬高的置信度没有批量重写；需要对原素材重新分析才能得到修正后的结果。

## 2026-11-15 追加 P2：对比快照与视频分型

本轮仅处理追加的两项 P2，保留上一轮修复，不迁移框架或扩展功能。

### 变更文件与行为

| 文件 | 本轮变更 |
|---|---|
| `src/stores/analysis.ts` | 增加完整对比快照写入口，同时同步选中模板的结果；沿用已有 JSON 保存结构。 |
| `src/stores/comparison.ts` | 对比计算完成、命中缓存、切换模板时同步 analysis Store，不再仅更新已保存的历史。校验当前分析对象和视频帧，防止迟到结果进入另一份分析。进入页面优先恢复 analysis Store 持有的快照，包括历史完整排名、各模板详情及当前选择；无需访问现有模板。显式刷新才绕过快照重新计算。 |
| `src/types/index.ts` | 统一 `getRecordShotType`：视频优先整段分型；缺失/null/空字符串才回退单帧；明确的 unknown 保持待确认。兼容既有枚举字符串形式。 |
| `src/views/Analysis.vue`、`src/views/History.vue`、`src/lib/training-report.ts` | 分析页、历史标签及 HTML 报告使用同一分型函数。 |
| `src-tauri/src/database/repository.rs` | SQL 使用整段优先的相同口径，在分页前完成分型筛选；兼容 camelCase/snake_case/PascalCase 字符串。旧视频缺失整段分型时，读取结果也回退单帧，避免 SQL 与前端显示不同。增加 Rust 读取/筛选回归用例。无新增表、无批量重写历史。 |
| `src/stores/analysis.compare-integration.test.js` | 新增未保存分析的完整快照同步、旧快照优先与显式刷新、同时间戳新分析隔离 3 项用例；原有持久化测试保留。 |
| `src/types/record-shot-type.test.js` | 新增 2 项分型优先级、枚举形式与旧记录回退用例。 |
| `tests/test_database_sql.py` | 新增 2 项生产 SQL 回归，覆盖整段二段式/单帧一段式、图片、23 条匹配记录跨页，以及缺失分型与 unknown。 |
| `tests/render/p2-regressions.spec.ts` | 新增 2 项页面验收：对比→选 Thompson→保存→页面重载→模拟删除模板→历史重新打开仍显示 Thompson→显式刷新才改用现有模板；历史显示、筛选、分页及 HTML 报告分型一致。 |
| `docs/verification.md` | 本轮实际结果与验收边界。 |

### 实际测试结果

| 命令/检查 | 结果 |
|---|---|
| `npm run build` | 通过：TypeScript 检查和 Vite 生产构建完成。 |
| `npm test` | **227 通过，0 失败，0 跳过**。 |
| `npm run test:render` | **18 通过，0 失败**，包含上一轮串帧/低置信度回归和本轮 2 项验收。 |
| `.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -v` | **7 通过**：4 项生产 SQL 测试、3 项实验工具测试。 |
| 本轮 9 个前端/测试文件 ESLint | **0 错误，8 警告**，均为新增浏览器测试的 `no-explicit-any`，业务代码无 ESLint 警告。 |
| `rustfmt --edition 2021 --check src-tauri/src/database/repository.rs` | 通过，仅代表解析/格式检查。 |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib database::repository::tests` | **未执行到项目测试**：依赖编译仍报 `linker link.exe not found`，退出码 101。 |
| `git diff --check` | 通过。 |

新增浏览器测试第一次运行有 2 个定位器错误（“查看详情”应为现有按钮“查看分析”；分型控件改按实际 combobox 角色定位），修正测试定位后单独 2 项及全套 18 项均通过；未跳过或删除行为断言。

快照页面测试使用真实 Vue/Pinia 数据流、页面重载和 localStorage 模拟持久化，模板删除及 Tauri 命令为模拟。分型页面测试通过测试桥接调用 Python SQLite，执行从生产 repository.rs 提取的 SQL；不是用 JavaScript 重写筛选逻辑。以上不能替代原生 Tauri/Rust 集成验收。

**仍待验证**：C++ 工具链就绪后的完整 Rust 测试，以及原生桌面对比→保存→退出重启→恢复、真实模板删除后的历史查看、真实 SQLite 筛选和原生 HTML/JSON 导出。上一轮未执行项目继续保留待验证。本轮未调用付费 AI API。

## 2026-11-15 Rust、Heavy 与原生桌面复核（当前状态）

本轮未更换技术框架、未接入 RTMPose、未调用任何付费 AI API。修复与先前已授权的训练功能一并按主题提交；没有打 tag。

### 三项 Rust 失败的核实

- 腾讯 TokenHub 当前官方文档列出 `hy3` 为文本模型、`hy4` 支持图片；`hy3-preview` 不能同时被断言为视觉和非视觉模型。默认改为文本 `hy3`、视觉 `hy4`，沿用可配置环境变量。依据：[模型列表](https://cloud.tencent.cn/document/product/1823/130051)、[图片输入指南](https://cloud.tencent.cn/document/product/1823/132252)，核查日期 2026-11-15。
- 有图片时先请求视觉候选，失败且错误类型允许回退时再请求文本候选。视觉请求序列化为 text + image_url；文本候选仅接收结构化姿态文本，不带图片。测试覆盖默认候选顺序、重复配置去重、空配置、无图片、鉴权停止与模型不可用回退；改为纯函数测试，避免并行测试修改全局环境变量。这里只验证构造和错误分类，不宣称线上付费接口已实测。
- 肘部优先级沿用配置：超出正常范围 **大于 20°** 才为 high，等于 20° 是 medium。保留强偏差测试，并新增左右肘及投篮肘三种名称、上下边界 19.9/20/20.1° 和正常区间边界测试，没有跳过或删除失败用例来获得通过。

### Heavy 修复与追溯

旧 Heavy 文件 1,999,138 字节，SHA-256 `91e6c3b7a14671368541155ad8a3db5667315fc81c895a5dd1af5a10ed786784`，加载错误 `Unable to open zip archive.`。逐字节比较确认旧文件等于官方完整文件的前 1,999,138 字节，证明内容截断；原始下载为何被截断尚无证据。

从 [Google 官方版本 1 Heavy](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task) 重新下载后，通过 SHA-256、ZIP CRC 和实际 MediaPipe 实例创建检查，再替换模型。下载脚本不会仅凭文件存在成功，也不会在校验失败时覆盖原模型。

| 实际模型 | 字节数 | SHA-256 |
|---|---:|---|
| Heavy | 30,664,242 | `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b` |
| Lite | 5,777,746 | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` |

`models/manifest.json` 固定官方地址和校验值；`scripts/download_pose_model.py` 负责下载、校验和真实加载。ASCII 模型缓存改为按内容哈希定位并校验，防止同名/同大小文件替换后继续使用旧缓存。

Python stderr、推理 JSON 均输出实际模型 backend/name/sha256/fallback_reasons；视频各帧经 Rust 传递到 SQLite、JSON 和 HTML。`check_environment.py` 对每个 task 实际创建并关闭 detector，输出 loadable 和错误，不能再将文件大小当成加载成功。

真实本地推理用同一仓库图片和短视频，分别强制 Heavy、Lite，以及原截断 Heavy→Lite。三条路径均检出图片 33 点、视频 16/16 姿态帧，回退路径明确记录 `Unable to open zip archive.`。另以缺失 Heavy 与人工损坏文件验证回退。原始坏文件仅保留于忽略目录 `.tmp`，不提交第二份模型或个人素材。

| 路径 | 图片进程耗时 | 视频进程耗时 |
|---|---:|---:|
| Heavy | 1.920 s | 3.413 s |
| Lite | 2.034 s | 2.585 s |
| 原坏 Heavy → Lite | 2.045 s | 2.743 s |

每格仅一次运行，含进程启动/解码/推理/JSON 输出，不是性能排名；没有人工标注，不能据此比较准确率。具体素材哈希、结果、实际模型见 [results.json](experiments/model-verification/results.json)，环境见 [environment.json](experiments/model-verification/environment.json)。旧 verification 目录中的推理耗时未记录实际模型，不能归属于 Heavy。

### 实际执行的检查

| 检查 | 实际结果 |
|---|---|
| `cargo test --manifest-path src-tauri/Cargo.toml --offline` | **87 通过，0 失败，0 忽略**；main/doc 测试各 0 项。此前膝髋 visibility=0.1、SQL 迁移/分页/视频整段分型用例均已执行。 |
| `npm run build` | TypeScript 与 Vite 生产构建通过。仍有既有 Browserslist 数据过期、动态/静态混合导入提示。 |
| `npm test` | **227 通过，0 失败，0 跳过**。 |
| `npm run test:render` | **18 通过，0 失败**。Tauri 接口为模拟，不算原生桌面测试。 |
| `.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -v` | **11 通过**，包含真实 Heavy/Lite 推理、缺失/损坏回退与缓存验证。 |
| Python `py_compile`、`pip check` | 修改的五个 Python 脚本语法检查通过；依赖无冲突。 |
| 全部改动前端/测试文件 ESLint | **0 错误、33 警告**，均为 no-explicit-any。 |
| `git diff --check` | 通过。 |

### 真实 Tauri 桌面验收（不是模拟接口）

使用 `npm run tauri dev` 启动 Windows WebView2 应用，项目 `.venv` 真正运行 MediaPipe。启动进程清除两个混元密钥环境变量；没有点击 AI 生成。

首次图片分析确实发生 `Arc::try_unwrap` 所有权竞争导致的 panic，随后 Drop 中 poisoned mutex 引起进程终止（0xc0000409）。`DaemonHandle` 改为独占 Child，独立线程持续排空 stderr，健康检查使用 try_wait；新增四次真实 Python 子进程启动/请求/关闭回归。修复后才重新执行以下流程：

1. 原生文件对话框选择 `public/hero/kobe-shot.png`，真实分析33点，生成本地角度/建议，保存记录 #1，按钮禁用防止重复保存。
2. 原生选择 `tests/fixtures/upload-sample.mp4`，分析约2.97秒片段、16个抽样帧，保存记录 #2。SQLite 只读检查确认两条记录及各帧 modelInfo 均为有效 Heavy，保存角度/建议与原生 JSON 一致，见 [native-database.json](experiments/model-verification/native-database.json)。
3. 在视频对比页选择汤普森，快照写入对应历史；结束原应用进程并确认退出，再重新执行 Tauri 启动。从历史页面重新打开图片、视频，图像/帧/分型恢复；视频对比仍显示汤普森及原有排名。**本次用进程终止方式退出，尚未验证托盘菜单正常退出。**
4. 原生对话框导出图片 HTML/JSON、视频 JSON、重启恢复后的视频 HTML，真实写入中文目录。取消 JSON 保存对话框显示“已取消导出”，没有虚假成功。
5. 对实际磁盘 HTML 文件用独立 Edge 测试浏览器离线打开，确认内嵌图片成功解码、中文、模型名称/哈希和 AI“未生成”。实际 JSON 解析确认33点、视频16帧和本地建议。文件大小/哈希见 [native-exports.json](experiments/model-verification/native-exports.json)；报告原件留在 `.tmp/native-acceptance`，不纳入仓库。

模拟接口测试继续覆盖：建议延迟/失败/迟到响应、模板删除后旧快照优先、保存失败重试、低置信度图表排除等。上述原生流程没有注入模拟接口，也没有用浏览器测试代替真实 SQLite/原生文件写入。

### 剩余验证与限制

- 托盘正常退出、原生模板删除后恢复、移动源视频、不可写导出位置、打印 PDF、长期数据分页等补充场景仍待原生验证；相关模拟/SQL测试通过并不等于这些步骤实测。
- 没有付费 AI 线上验证，只有模型能力官方资料核对、请求构造及错误分类测试。
- 用户暂无个人训练素材。20～30段采集、约20帧人工标注、3组同人前后对比和答辩目标电脑仍待完成。下一阶段以同素材同标注比较 Lite/Heavy 误差、漏检及重复耗时；效果不足再独立评估 RTMPose。
- 本轮保留已有技术框架，暂不打里程碑 tag。桌面核心数据闭环已实测，但不把上述补充场景或整个毕设实验写成完成。

提交前逐文件审查并执行非改写 ESLint、完整构建与各层测试。提交时禁用会自动执行 `eslint --fix` / `prettier --write` 的 Husky 钩子，避免它改写已经验证的文件及分组暂存内容；这不表示跳过上述实际测试。Tauri 自动生成的四份 schema 停止跟踪并加入忽略，磁盘文件保留；源码 capabilities/default.json 正常提交。

## 2026-11-15 Python daemon 超时与回收补修

范围仅为 daemon 通信截止时间、进程回收与相应回归，不新增功能、不换模型、不调用付费 AI API、不打 tag。

### 实现与验证方法

- stdin 写入、stdout 按行读取移到独立工作线程，调用方通过 channel 的 `recv_timeout` 等待。ready 使用 10 秒绝对截止时间，请求使用 15 秒绝对截止时间，包含等待写入；状态行、空行不会重置计时。即使 Python 不输出换行或不读取 stdin，也不会阻塞调用线程的截止判断。
- ready/请求超时或通信失败后，关闭旧会话通道、终止并回收旧 Child，同时从 `PoseDetector` 清除失效 handle。下一次分析使用新进程和新通道，旧响应不能进入新会话。保留原有文件模式回退。
- shutdown 非阻塞发送退出命令，最多给子进程 2 秒主动退出时间，之后 kill 并 wait 回收；重复 shutdown/Drop 幂等。仅 join 已结束的管道线程，避免异常继承管道的后代使退出无限等待。

Rust 新增 7 项回归，使用真实 Python 子进程及可控协议脚本，不使用 MediaPipe、前端 mock 或付费接口：

| 场景 | 行为检查 |
|---|---|
| 永不发送 ready | 超时失败、进程已回收、通道已清空 |
| 无响应且不读 stdin | 4 MiB 请求超过管道容量，仍按请求时限失败并清理；旧 handle 不可再次请求 |
| ready 延迟 12 秒 | 使用生产默认 10 秒限制，拒绝迟到成功 |
| 响应延迟 17 秒 | 使用生产默认 15 秒限制，拒绝迟到结果 |
| 持续发送 working 状态行 | 状态流不能延长请求截止时间 |
| 忽略 shutdown | 超过退出宽限后 kill、回收，重复关闭不挂起 |
| 失败后下一次分析 | 首次超时走原有文件回退；下一次文件/base64 分析来自新 daemon，不能返回旧会话的标记结果 |

快速故障用例注入 200 ms 请求/退出超时；两项迟到用例保留完整生产 10/15 秒时间。最初恢复用例的脚本只向 stdout 输出，未实现 Windows 的 `--output-file` 协议，因此第一次测试失败；补齐测试脚本的真实协议后重新跑全套，未删除行为断言或跳过用例。

### 本轮实际检查

- 完整 Rust：94 项通过，0 失败、0 忽略；main/doc 各 0 项。命令：`cargo test --manifest-path src-tauri/Cargo.toml --offline -- --nocapture`。最后一轮测试耗时 15.15 s；默认 ready 超时实测 **10.0063605 s**，默认请求超时 **15.0180688 s**，均拒绝迟到响应并完成子进程回收。
- Python/SQL/模型：`python -m unittest discover -s tests -p 'test_*.py' -v`，项目 `.venv` 中 11 项通过（6.596 s），包含 Heavy/Lite 真实本地推理。
- 修复后原生 Tauri 图片分析通过：原生文件对话框选择 `public/hero/kobe-shot.png`，展示姿态图和角度；stderr 确认实际 Heavy、SHA-256 为 `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`、无回退。日志记录 daemon 正常 shutdown，分析后进程枚举没有残留 pose_detect Python。
- **托盘正常退出通过**：用户协助右键展开系统托盘菜单（自动化工具无法直接定位系统托盘区域），随后自动化读取真实 ShotForm 托盘窗口并点击“退出 ShotForm”。窗口枚举确认主窗口、托盘窗口均消失；系统进程枚举确认应用 PID 21888 已退出，且没有残留 `pose_detect` Python。没有调用模拟退出接口或使用强制结束进程代替这一步。退出后日志有 WebView2 `Failed to unregister class Chrome_WidgetWin_0. Error = 1412` 提示，未阻止进程退出；未另行定位此 WebView2 提示。
- 启动阶段一次构建因旧测试实例占用 EXE 报“拒绝访问 (os error 5)”，清理该旧实例后构建、启动成功。此准备动作与上述正常托盘退出分开记录。
- `rustfmt --edition 2021 --check src-tauri/src/pose/detector.rs` 与 `git diff --check` 通过。
- 本轮没有改前端，未重跑前端 227/浏览器 18/生产构建；这些数字属于前轮实际结果及用户独立复核，不作为本轮新执行次数。

### 验证边界

本轮修复的是 daemon 超时，不是整个分析任务的总时限。原有文件模式回退、视频子进程仍使用同步 `Command::output`，未纳入此次超时改造；操作系统拒绝 kill、异常后代继承管道以及分析进行中强行退出等场景未做故障注入。托盘正常退出已补验，但本轮未重新执行保存、退出后重启恢复、视频分析及导出整套流程，前轮结果保留原有验证方式说明。真实素材精度实验、付费 AI 和其他待验收项目仍按前述状态记录。

## 2026-11-15 独立模型实验环境与本机冒烟验证

本轮完成可运行的实验工具和本机 CPU/CUDA 路径，不代表正式精度实验完成。Heavy 默认、Lite 回退、前端、SQLite、历史协议与 Rust 角度规则均未修改；未调用付费 AI，未打 tag。文件回退/视频子进程总超时、取消、进程树回收已加入后续清单，尚未在产品实现。

### 实验交付

`experiments/model_lab/` 包含官方模型下载/哈希记录、一次解码抽帧、坐标与置信度转换、独立模型子进程、资源测量和八个二维关节的配对评估。实验结果另用版本化 JSON，缺点不填零、候选深度为 null；真人标注为空时不给出误差。详细点位表、公式、遮挡和抖动定义、运行方法见 [模型对照协议](experiments/model-comparison.md)。

候选为官方 RTMPose-m body7 256×192 + YOLOX-m HumanArt 640×640，通过 rtmlib 0.0.16 / ONNX Runtime GPU 1.23.2 在 `.venv-model-lab` 运行；Heavy 使用应用 `.venv` 及已锁定 SHA 的 Tasks CPU 模型。两解释器均 Python 3.12.10。候选依赖完整冻结于 `experiments/requirements-lock.txt`。RTMW 当前未下载或实测，只记录后续触发条件及身体点映射边界。

### 实际本机测量

Windows，Ryzen 5 9600X（6核12线程），约23.13 GiB可见物理内存，RTX 5060 Ti 8GB（驱动617.42）。同一份16张原尺寸PNG：仓库图片1张 + 仓库视频按每6帧抽样得到15张。每配置3遍、48次推理；第一遍与后两遍分列。数据和机器证据见 [model-lab-smoke](experiments/model-lab-smoke/README.md)。

| 配置 | 后两遍每帧平均 / P95 | 本批源素材到结果耗时 | Python进程树RSS采样峰值 |
|---|---:|---:|---:|
| Heavy CPU | 54.12 / 71.06 ms | 4.696 s | 336.68 MiB |
| RTMPose CPU | 176.50 / 230.92 ms | 9.883 s | 357.43 MiB |
| RTMPose CUDA | 244.27 / 363.08 ms | 17.979 s | 1345.66 MiB |

本批耗时包含共享的一次源素材准备0.433秒和3遍模型子进程全程，不是单帧或 Tauri 界面响应时间。当前有其他桌面负载，未控制温度/电源/后台 GPU 使用；以上是一次工具冒烟，不据此推断模型的普遍速度。首次成功CUDA会话第一帧曾耗时57.692秒，最终表格来自之后的新进程，不能隐去驱动/cuDNN缓存和首次编译开销的差异。Heavy在Windows仍是CPU基线，没有宣称执行过Heavy GPU。

Windows WDDM 的进程显存查询返回N/A，三个配置的进程显存峰值均为 null；整卡显存采样单独保存在run.json，不能算模型独占显存。资源检查发现 Windows venv 启动器会派生真正Python进程，初次只量启动器的约7MiB读数已作废；修正为进程树RSS及回收后重跑，最终证据只采用修正结果。

Heavy有6帧、候选有15帧检测到多人，缺人工目标框时报告歧义；选中目标的帧数分别10/16、1/16，**不等于漏检率或精度**。没有人工点位/目标存在/遮挡标注，肩肘髋膝误差、遮挡组误差、漏检率、连续帧残差抖动均未测，配对有效角度数为0。正式20～30段材料、人工标注、连续序列、不同目标电脑（若需要）仍待提供；不要求为了实验额外准备第二台电脑。

### 发现的问题与实际检查

- GPU首次运行实际失败：`Could not locate cudnn_engines_tensor_ir64_9.dll` / `CUDNN_STATUS_SUBLIBRARY_LOADING_FAILED`，退出码1；未静默回退CPU。只给实验子进程增加pip NVIDIA bin的DLL搜索路径后，重跑检测器/姿态CUDA推理成功。provider和原失败日志哈希均已记录。
- 独立安装脚本通过；首次直接运行受本机PowerShell脚本策略限制，随后采用仅本次进程的 `-ExecutionPolicy Bypass` 执行，不改系统策略。应用`.venv`的`pip check`通过；实验环境`pip check`有rtmlib要求CPU ORT/opencv-python发行名的两条元数据提示，原因及避免同名二进制覆盖的安装方法已说明，没有写成全绿。
- `cargo test --manifest-path src-tauri/Cargo.toml --offline`：**94通过，0失败、0忽略**，15.10秒；main/doc各0项。
- 应用`.venv`执行Python测试：**25通过**（原11 + 新14），5.457秒；含真实Heavy/Lite推理和映射、非有限点、低分排除、多人身份、无人帧误检、同帧哈希、标注缺失、遮挡及时间残差检查。几何/标注用例为明确的人工构造测试数据，不是实验人工标签。
- 独立实验进程测试：**3通过**，包括真实50MiB内存分配能计入工作进程树、慢GPU查询不拖延超时、超时后实际工作PID消失、失败退出码保留。
- Heavy CPU、RTMPose CPU、RTMPose CUDA各48次真实本地推理通过；语法编译检查及`git diff --check`通过。前端/浏览器/Tauri流程本轮未重跑，沿用之前独立复核的状态，不增加本轮实测次数。

当前没有足够标注证据证明候选收益，继续保留Heavy默认。后续先补真实标注并按同一协议对照，再决定是否进入RTMW评估或产品模型接入。

## 2026-11-15：人工标注入口、阶段计时与交替重复实验

本轮仅修改独立实验工具及文档，未修改`src/`、`src-tauri/`、产品Python识别脚本、默认Heavy和历史协议。沿用之前视频，准备30个连续帧，提供离线框选/12点标注、未知点、逐帧确认、中文导入导出及帧身份校验。评估增加人工有效分母/覆盖和逐对模型误差；草稿不当真值，未知中间帧断开残差时间对。真实人工标注尚未产生。

实际执行：

- `.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py'`：**34通过**，含原25项及新增9项。新用例验证身份/尺寸/哈希不可变、越界/非有限坐标拒绝、未知点不带坐标、逐帧确认、HTML转义、覆盖率/双模型配对和残差断链、阶段包装保持输入输出。合成标签只用于测试。
- `.venv-model-lab/Scripts/python.exe -m unittest discover -s experiments/model_lab -p 'test_runtime.py'`：**6通过**。包括原3项真实子进程内存/超时/回收，再加轮次平衡、空闲连续采样、忙碌门禁到期阻止执行。
- `node experiments/model_lab/test_annotator.mjs experiments/local/annotation-pilot/标注页面.html`：**1个真实Edge无头浏览器流程通过**，覆盖缩放坐标、框、未知点、不完整确认拒绝、切帧保留、修改撤销确认、中文导出/导入、篡改帧身份拒绝且不丢当前工作；无浏览器脚本异常。生成页面截图已查看。该测试不等于真人标注或Tauri原生验收。
- 本机30帧：Heavy CPU、RTMPose CPU/CUDA六轮、每轮三遍，**18/18独立进程成功，每配置540次真实推理**；标准CUDA/显式绑定四轮、每轮三遍，**8/8进程成功，每模式360次推理**。全部先通过CPU/GPU空闲门禁；模型实际provider、原始预测、阶段/内存/负载保留。六轮热遍每帧中位数分别40.96/149.22/47.53 ms，不能据此推断精度。
- CUDA执行模式等价：30帧、79个人体实例，所有映射坐标最大差0、分数最大差0，检查通过；此前16帧42实例诊断也通过。不是人工角度误差。
- 26组原始预测重新汇总与保存结果一致；冻结数据/归档成员SHA-256、90行/组、归档CRC及门禁记录检查通过。证据见 [受控实验记录](experiments/model-lab-controlled/README.md)。不完整的早期尝试因CPU忙而被门禁停止，另行保留，没有混入最终表格。
- Python语法编译、`git diff --check`及暂存区证据字节哈希检查通过。冻结证据加入Prettier忽略规则，避免格式化破坏哈希；新HTML/MJS已手动格式化并重新跑浏览器。提交时不运行自动修改文件的lint-staged钩子，实际测试如上单独执行。

未执行或未完成：真实人工框/肩肘髋膝角度、遮挡覆盖、漏检及残差抖动；第二人标注复核；清晰单人等新增片段；独立目标电脑（若需要）；GPU首遍长尾的kernel级归因。本轮不重跑Rust94项、产品前端测试/构建、产品浏览器18项及Tauri保存恢复导出；这些沿用上轮独立复核状态，不计入本轮测试数。没有调用付费AI API，没有新增产品入口或切换默认模型。

## 2026-11-16：三段用户投篮素材的预测复核

按用户选材要求，①源帧192～216（含优先试标五帧）、②30～48、③120～150，共75张原始PNG，在Heavy CPU/RTMPose CUDA各运行单遍。两组进程成功退出，全部原始点位/分数及所有人物保留，新增`people`/`selected_person_index`仅作用于独立实验输出；产品默认Heavy、规则及历史格式不变。没有付费AI请求。

新增只读复核脚本生成75张原图/两模型骨架并排图和离线索引。低分用空心点/虚线，歧义人物独立保留，图外点不夹到边缘；失败模型运行在报告显式列出。所有人工标注字段仍为空，没有运行人工精度评价。②生成额外5帧无预测叠加试标页；看不准的点设未知，不要求凑齐12个坐标。

实测与检查：

- Python **39项通过**，4.895秒，新增5项覆盖低分/缺失/非有限/越界区别、多套预测保留、数据及选人身份不匹配拒绝、画图不修改原预测、失败运行及空标签保留。
- 独立实验进程 **6项通过**，1.183秒。Python语法编译通过。
- 真实Edge无头浏览器 **1个流程通过**：75张对照图离线加载、末帧锚点、展开明细、补充试标页五帧及空标签检查；无脚本错误和外部HTTP请求。查看了实际对照图及浏览器截图。非Tauri验证、非真人标注。
- 两模型原始输出各75行，逐帧输入哈希、①原有五帧哈希、归档CRC/成员SHA-256检查通过；由原预测重算全部逐帧状态，与review.json一致。原有3个前端修改的文件字节哈希仍一致，本轮未改动它们。

空闲门禁失败（后台CPU忙）已保留，随后仅做功能检查。耗时是该负载下单遍观测，包含CUDA首帧约1994.20ms，不当受控速度收益。完整数据、失败分类、计时边界和人工交接见 [三段素材实测记录](experiments/shooting-review-20261116/README.md)。本轮没有人工误差、人工覆盖率、漏检率或残差抖动结论；Rust、产品前端及Tauri未重测。后续以真实人工复核为前提，再计算逐关节配对结果；继续保留Heavy。
