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
