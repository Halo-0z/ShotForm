$ErrorActionPreference = "Stop"

$baseDir = (Resolve-Path -LiteralPath ".").Path
$outDir = Join-Path $baseDir "docs\generated"
$docPath = Join-Path $baseDir "ShotForm系统设计文档_完整版.doc"
$pdfPath = Join-Path $baseDir "ShotForm系统设计文档_完整版.pdf"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$wdFormatDocument = 0
$wdFormatPDF = 17
$wdPageBreak = 7
$wdStory = 6
$wdCollapseEnd = 0
$wdLineStyleSingle = 1
$wdAlignParagraphCenter = 1
$wdAlignParagraphLeft = 0
$wdPreferredWidthPercent = 2
$wdAutoFitWindow = 2

$word = $null
$doc = $null

function Add-Paragraph {
    param(
        [string]$Text = "",
        [int]$Style = 0,
        [switch]$Center,
        [switch]$Bold,
        [double]$Size = 0
    )

    $selection = $script:word.Selection
    $selection.EndKey($wdStory) | Out-Null
    $selection.TypeText($Text)
    $paragraph = $selection.Paragraphs.Item(1)
    if ($Style -gt 0) {
        try {
            $paragraph.Style = $script:doc.Styles.Item($Style)
        } catch {
            # Localized Word installations can reject built-in numeric style IDs.
        }
    }
    if ($Center) {
        $paragraph.Alignment = $wdAlignParagraphCenter
    } else {
        $paragraph.Alignment = $wdAlignParagraphLeft
    }
    if ($Bold) {
        $paragraph.Range.Font.Bold = $true
    }
    if ($Size -gt 0) {
        $paragraph.Range.Font.Size = $Size
    }
    $selection.TypeParagraph()
}

function Add-PageBreak {
    $script:word.Selection.InsertBreak($wdPageBreak)
}

function Add-Heading {
    param([string]$Text, [int]$Level = 1)
    if ($Level -eq 1) {
        Add-Paragraph -Text $Text -Bold -Size 15
    } elseif ($Level -eq 2) {
        Add-Paragraph -Text $Text -Bold -Size 13
    } else {
        Add-Paragraph -Text $Text -Bold -Size 12
    }
}

function Add-Body {
    param([string]$Text)
    Add-Paragraph -Text $Text
}

function Add-Bullets {
    param([string[]]$Items)
    foreach ($item in $Items) {
        Add-Paragraph -Text ("· " + $item)
    }
}

function Add-Table {
    param(
        [string[]]$Headers,
        [object[]]$Rows
    )

    $selection = $script:word.Selection
    $selection.EndKey($wdStory) | Out-Null
    $range = $selection.Range
    $table = $script:doc.Tables.Add($range, $Rows.Count + 1, $Headers.Count)
    $table.Borders.Enable = $true
    $table.Range.Font.Name = "宋体"
    $table.Range.Font.Size = 10
    $table.PreferredWidthType = $wdPreferredWidthPercent
    $table.PreferredWidth = 100

    for ($c = 0; $c -lt $Headers.Count; $c++) {
        $cell = $table.Cell(1, $c + 1).Range
        $cell.Text = $Headers[$c]
        $cell.Font.Bold = $true
        $cell.ParagraphFormat.Alignment = $wdAlignParagraphCenter
    }

    for ($r = 0; $r -lt $Rows.Count; $r++) {
        $row = $Rows[$r]
        for ($c = 0; $c -lt $Headers.Count; $c++) {
            $table.Cell($r + 2, $c + 1).Range.Text = [string]$row[$c]
        }
    }

    $table.AutoFitBehavior($wdAutoFitWindow)
    $selection.SetRange($table.Range.End, $table.Range.End)
    $selection.TypeParagraph()
}

function Add-BoxDiagram {
    param(
        [string]$Title,
        [string[]]$Lines
    )

    Add-Paragraph -Text ("图：" + $Title) -Center -Bold
    $text = ($Lines -join "`r")
    Add-Table -Headers @("结构化图示") -Rows @(
        ,@($text)
    )
}

try {
    $word = New-Object -ComObject Word.Application
    $script:word = $word
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Add()
    $script:doc = $doc

    $doc.PageSetup.TopMargin = $word.CentimetersToPoints(2.5)
    $doc.PageSetup.BottomMargin = $word.CentimetersToPoints(2.5)
    $doc.PageSetup.LeftMargin = $word.CentimetersToPoints(2.8)
    $doc.PageSetup.RightMargin = $word.CentimetersToPoints(2.4)
    $doc.Content.Font.Name = "宋体"
    $doc.Content.Font.Size = 11

    Add-Paragraph -Text "韩山师范学院" -Center -Bold -Size 18
    Add-Paragraph -Text "《软件工程》课程设计" -Center -Bold -Size 20
    Add-Paragraph
    Add-Paragraph -Text "学号姓名：                                    " -Size 12
    Add-Paragraph -Text "学    院：  计算机与信息工程学院            " -Size 12
    Add-Paragraph -Text "专    业：                                    " -Size 12
    Add-Paragraph -Text "题    目：  ShotForm篮球投篮姿势智能分析系统" -Size 12
    Add-Paragraph -Text "指导教师：  李旅军 副教授                    " -Size 12
    Add-Paragraph
    Add-Paragraph
    Add-Paragraph -Text "2026 年 5 月 7 日" -Center -Size 12

    Add-PageBreak
    Add-Heading "摘  要" 1
    Add-Body "本文按照结构化分析法对 ShotForm 篮球投篮姿势智能分析系统进行系统设计说明。系统面向篮球运动员、教练和个人训练者，提供图片与视频投篮动作上传、人体姿态识别、关节角度计算、投篮分型、球星模板对比、AI 训练建议和历史记录管理等功能。系统采用 Vue 3、Vite、TypeScript 构建桌面端前端界面，使用 Tauri 2 将前端工作台与 Rust 后端服务集成为跨平台桌面应用；后端通过 MediaPipe Pose Landmarker 模型与 Python 检测脚本完成姿态估计，通过 Rust 分析引擎完成角度、时序特征和相似度计算，并使用 SQLite 保存分析历史与球星模板。本文重点描述系统背景、目标、业务流程、数据流程、功能结构、模块结构、IPO、代码设计、数据库设计、界面设计、实施过程与后续展望。"
    Add-Paragraph
    Add-Body "关键词：投篮姿势分析；结构化分析法；Tauri；Vue；Rust；MediaPipe；SQLite；AI辅助训练"

    Add-PageBreak
    Add-Heading "目  录" 1
    Add-Bullets @(
        "第一章 系统概述",
        "第二章 系统分析",
        "第三章 系统设计",
        "第四章 系统实施",
        "第五章 总结与展望",
        "附录一 数据字典",
        "附录二 IPO图",
        "参考文献"
    )

    Add-PageBreak
    Add-Paragraph -Text "ShotForm篮球投篮姿势智能分析系统" -Center -Bold -Size 16
    Add-Heading "第一章 系统概述" 1
    Add-Heading "1.1 系统开发的背景" 2
    Add-Body "篮球投篮动作具有高度的技术细节，投篮稳定性往往取决于出手节奏、肩肘腕协同、下肢发力传导、躯干稳定性和出手角度等因素。传统训练中，动作评估主要依赖教练经验和肉眼观察，普通训练者难以及时获得量化反馈，也难以持续记录自己的变化。随着计算机视觉、人体姿态估计和本地桌面应用技术的发展，使用普通图片或短视频提取人体关键点并计算投篮动作指标已经具备现实可行性。ShotForm 系统正是在这一背景下开发的智能投篮姿势分析工具，目标是把姿态检测、角度分析、球星模板对比和 AI 辅助建议整合到一个专注、可信、可重复使用的桌面训练工作台中。"
    Add-Heading "1.2 系统组织结构图" 2
    Add-Body "ShotForm 不是学校业务系统，模板中的“学校组织结构图”在本设计中对应为系统组织结构图。系统整体分为用户交互层、应用状态层、Tauri 命令层、分析服务层、外部/本地能力层和数据存储层。用户通过首页、上传、分析、历史、对比、模板管理等页面进入业务流程；前端通过 Pinia 维护分析状态、视频帧选择、AI 缓存和对比会话；Tauri IPC 将请求转发给 Rust 命令；Rust 后端负责姿态检测调度、角度分析、投篮分型、球星对比、图片标注、AI 调用与数据库持久化。"
    Add-BoxDiagram "系统组织结构图" @(
        "用户/训练者",
        "  ↓",
        "Vue 3 桌面界面：首页、上传、分析、历史、对比、模板、托盘",
        "  ↓",
        "Pinia 状态层：useAnalysisStore、useComparisonStore",
        "  ↓",
        "Tauri IPC 命令层：analyze_shot、analyze_video、save_analysis_history、build_compare_workbench 等",
        "  ↓",
        "Rust 服务层：pose、analysis、image、ai、database、models",
        "  ↓",
        "MediaPipe/Python 姿态检测、本地 SQLite、腾讯混元 API"
    )
    Add-Heading "1.3 目前存在的问题" 2
    Add-Body "当前篮球训练中的主要问题包括：第一，训练反馈缺乏量化依据，训练者难以知道肘角、肩线、躯干倾斜和下肢发力是否处于合理范围；第二，投篮分型依赖专业经验，一段式、1.5 段式和二段式动作的判断不易被普通用户掌握；第三，动作对标缺少结构化参照，训练者通常只知道模仿某位球星，但不知道差异具体体现在哪些角度或阶段；第四，历史训练数据分散，难以形成可回看的分析记录；第五，传统运动捕捉设备成本高、部署复杂，不适合个人桌面训练场景；第六，部分 AI 工具只给泛化建议，缺乏与真实姿态数据结合的证据链。"
    Add-Heading "1.4 系统目标" 2
    Add-Body "系统目标是建设一个面向篮球投篮训练的桌面端智能分析系统。具体目标包括：支持图片和短视频上传；自动检测人体 33 个关键点；计算肘、肩、膝、髋、肩线、躯干、出手角等投篮相关角度；输出投篮分型、置信度和依据；支持视频关键帧、逐帧回放和时序特征分析；支持与球星模板进行相似度对比并给出关键差异；支持 AI 生成更自然的姿势审查和训练建议；支持分析历史、AI 建议缓存和对比结果保存；通过电影级首页与专业工作台内页形成清晰、聚焦、可信的使用体验。"

    Add-Heading "第二章 系统分析" 1
    Add-Heading "2.1 可行性分析" 2
    Add-Body "技术可行性方面，项目已经采用成熟技术栈实现核心能力。前端使用 Vue 3、Vite、TypeScript、Vue Router、Pinia、Tailwind CSS、Reka UI、ECharts 和 lucide-vue-next，能够支持复杂桌面工作台界面和图表展示。桌面容器使用 Tauri 2，既能调用 Rust 后端，又能保留 Web 前端的开发效率。后端 Rust 结合 sqlx、tokio、image、nalgebra、reqwest、serde 等库实现计算、异步数据库访问、图像处理和 AI API 调用。姿态识别通过 Python 脚本和 MediaPipe Pose Landmarker 模型完成，已有 heavy 与 lite 模型文件。经济可行性方面，主要框架均为开源，本地姿态检测降低云端推理成本，AI 只作为可选增强能力。操作可行性方面，用户只需上传图片或视频，系统自动完成分析、标注和保存，适合桌面训练场景。"
    Add-Heading "2.2 业务流程图" 2
    Add-Body "核心业务流程从用户进入首页开始，经过上传、检测、分析、可选 AI 审查、可选球星对比和历史保存形成闭环。视频流程在图片流程基础上增加裁剪、采样、多人主体选择、逐帧分析和最佳帧推荐。"
    Add-BoxDiagram "业务流程图" @(
        "启动应用 → 首页 → 上传工作台",
        "上传图片/视频 → 视频裁剪/主体选择",
        "姿态检测 → 关键点提取 → 角度计算",
        "投篮分型与置信度 → 骨架标注图",
        "AI 审查/AI 建议（可选）",
        "球星模板对比（可选）",
        "查看分析报告 → 保存历史 → 历史回看/删除"
    )
    Add-Heading "2.3 数据流程图" 2
    Add-Body "系统数据流以媒体文件为输入，以结构化分析结果、可视化标注图、AI 建议、对比快照和历史记录为输出。前端将图片 base64 或视频文件路径传给 Tauri 命令，后端调用姿态检测脚本得到关键点，再由 Rust 分析模块生成 ShotAnalysis 或 VideoShotAnalysis。分析数据可进入 AI payload 构建流程、球星模板对比流程和 SQLite 持久化流程。"
    Add-BoxDiagram "顶层数据流程图" @(
        "用户媒体文件",
        "  ↓",
        "上传组件 ImageUpload / VideoUpload",
        "  ↓",
        "Pinia 分析状态与 Tauri invoke",
        "  ↓",
        "PoseDetector + Python/MediaPipe",
        "  ↓",
        "PoseData 关键点",
        "  ↓",
        "角度计算、投篮分型、时序特征、骨架绘制",
        "  ↓",
        "分析工作台、AI 建议、球星对比、SQLite 历史记录"
    )
    Add-Heading "2.4 数据字典" 2
    Add-Body "系统主要数据对象包括 PoseData、Keypoint、JointAngle、ShotAnalysis、VideoShotAnalysis、VideoAnalysisFrame、TemporalFeatures、PlayerTemplate、PlayerTemplateProfile、ComparisonWorkbenchSnapshot、CorrectionSuggestion、AiShotReview、AiCoachingResponse 和 AnalysisHistory。核心字段见本节表格，完整数据字典见附录一。"
    Add-Table -Headers @("数据项", "类型", "含义") -Rows @(
        ,@("ShotAnalysis", "对象", "单张图片或单个关键帧的投篮姿态分析结果"),
        ,@("VideoShotAnalysis", "对象", "视频片段的逐帧分析、整体分型和时序特征结果"),
        ,@("PlayerTemplate", "对象", "球星模板，包含姿态、角度和视频级模板画像"),
        ,@("AnalysisHistory", "对象", "一次分析的历史记录，保存媒体路径、分析、对比和 AI 缓存")
    )

    Add-Heading "第三章 系统设计" 1
    Add-Heading "3.1 功能结构图" 2
    Add-Body "系统功能围绕上传、分析、对比和复盘四个主要任务展开，并辅以模板管理、AI 建议、主题与托盘等桌面能力。"
    Add-BoxDiagram "功能结构图" @(
        "ShotForm篮球投篮姿势分析系统",
        "├─ 首页封面：产品入口、导航、主题氛围",
        "├─ 上传工作台：图片上传、视频上传、裁剪、主体选择",
        "├─ 姿势分析：角度、分型、置信度、骨架、图表、建议",
        "├─ 球星对比：模板排名、差异明细、学习桥梁、进度",
        "├─ 模板管理：新增、编辑、删除、视频级 Profile",
        "├─ 历史记录：保存、分页、回看、删除、缓存恢复",
        "└─ 桌面能力：自定义标题栏、托盘菜单、通知、主题"
    )
    Add-Heading "3.2 模块结构图" 2
    Add-Body "前端模块采用路由视图、业务组件、基础 UI 组件、组合式函数、状态仓库、服务库的分层组织。后端模块采用命令层、分析域、姿态检测、图像处理、AI 集成、数据库仓储和模型 DTO 分层组织。"
    Add-BoxDiagram "模块结构图" @(
        "前端 src",
        "  views：Home、Upload、Analysis、Compare、Templates、History、TrayMenu",
        "  components：上传、视频时间轴、骨架舞台、图表、建议、对比详情、UI 基础组件",
        "  stores：analysis、comparison",
        "  lib/composables：对比会话、历史封装、AI 流程、主题、Toast、快捷键",
        "后端 src-tauri/src",
        "  commands：analysis、database、image、pose",
        "  analysis：angles、shot_type、comparison、temporal、suggestions",
        "  pose：detector、keypoints",
        "  image：processor、visualization",
        "  ai：hunyuan",
        "  database：models、repository"
    )
    Add-Heading "3.3 IPO图" 2
    Add-Body "本节以核心功能描述 IPO。完整 IPO 表见附录二。"
    Add-Table -Headers @("模块", "输入 Input", "处理 Process", "输出 Output") -Rows @(
        ,@("图片分析", "imageData", "姿态检测、角度计算、投篮分型、骨架绘制", "ShotAnalysis、annotatedImage"),
        ,@("视频分析", "filePath、trimStartMs、trimEndMs、subjectPoseIndex", "关键帧采样、逐帧姿态检测、时序特征、最佳帧选择", "VideoShotAnalysis"),
        ,@("球星对比", "ShotAnalysis、PlayerTemplate", "相似度计算、角度差异排序、学习桥梁生成", "ComparisonWorkbenchSnapshot"),
        ,@("历史保存", "媒体路径、分析结果、对比快照、AI建议", "JSON 序列化并写入 SQLite", "historyId")
    )
    Add-Heading "3.4 代码设计" 2
    Add-Body "前端采用 TypeScript 与 Vue 单文件组件，路由由 src/router/index.ts 管理，主要业务状态集中在 src/stores/analysis.ts 和 src/stores/comparison.ts。共享类型集中在 src/types/index.ts，并在前端对 Rust 或 AI 返回的投篮类型进行 normalizeShotType 归一化。后端使用 Rust 2021，Tauri 命令通过 generate_handler 注册；跨边界 DTO 使用 serde 的 camelCase 规则；数据库仓储在 repository.rs 中封装；分析逻辑按照 angles、shot_type、comparison、temporal 等领域文件拆分。项目脚本包含 npm run dev、npm run build、npm run lint、npm test、npm run test:render 和 python scripts/run_ci.py。"
    Add-Heading "3.5 数据库设计" 2
    Add-Body "系统使用 SQLite 本地数据库，启动时在应用数据目录创建 basketball_analyzer.db，并启用 WAL、NORMAL synchronous 和缓存设置。数据库通过 sqlx 异步访问，当前主要表为 player_templates 与 analysis_history。为兼容旧版本，repository.rs 中包含列存在性检查和 ALTER TABLE 追加字段逻辑。"
    Add-Table -Headers @("表名", "字段", "说明") -Rows @(
        ,@("player_templates", "id", "主键，自增"),
        ,@("player_templates", "name、team、description", "球星名称、球队、描述"),
        ,@("player_templates", "pose_data_json、angles_json、profile_json", "姿态、角度、视频级模板画像 JSON"),
        ,@("analysis_history", "id、created_at", "历史记录主键与创建时间"),
        ,@("analysis_history", "image_path、annotated_image_path", "原图与骨架标注图路径"),
        ,@("analysis_history", "analysis_json、comparison_json、suggestions_json", "分析、对比与建议 JSON"),
        ,@("analysis_history", "ai_coaching_summary、ai_coaching_suggestions_json", "AI 建议缓存"),
        ,@("analysis_history", "source_identifier、video_analysis_json", "来源标识与视频分析 JSON")
    )
    Add-Heading "3.6 用户界面设计" 2
    Add-Body "界面设计遵循项目 DESIGN.md 的双模式视觉系统：Home 是电影级体育封面，Upload、Analysis、History、Compare 是专业训练工作台。首页使用深色氛围、强视觉封面和单一主行动；内页使用中性结构、克制交互色、清晰数据层级和更高信息密度。核心路由保持为 /、/upload、/analysis、/history、/compare，并额外提供 /templates 与 /tray-menu。系统使用 AppSidebar 提供导航，TitleBar 提供无边框窗口控制，FogRouteTransition 作为首页与工作台之间的品牌级雾化转场。分析页优先显示结论，再显示证据、播放与细节；上传页强调上传模式、当前状态和下一步；历史页强调扫描、恢复和删除；对比页强调差异、参考目标和结论。"

    Add-Heading "第四章 系统实施" 1
    Add-Body "实施过程分为环境搭建、核心算法、前后端联通、工作台界面、AI 集成、数据库持久化、测试优化和打包发布几个阶段。环境搭建阶段完成 Vite、Vue、TypeScript、Tauri、Rust、ESLint、Prettier、Husky、Playwright 与模型文件配置。核心算法阶段实现 PoseDetector 对 Python/MediaPipe 的调用、base64 图片处理、视频关键帧采样、角度计算、投篮分型、时序特征和球星相似度计算。前后端联通阶段定义 analyze_shot、analyze_video、draw_pose_on_image、build_compare_workbench、save_analysis_history 等命令契约。界面阶段完成上传工作台、分析工作台、对比工作台、历史归档、模板管理和托盘菜单。AI 阶段完成腾讯混元 API 客户端、视觉模型候选、JSON 响应解析、错误提示和缓存策略。测试阶段通过 Node 原生 test、Playwright、Rust 单元测试和 scripts/run_ci.py 保障回归质量。发布阶段通过 Tauri bundler 面向 Windows 桌面环境打包，并保留 updater 插件能力。"

    Add-Heading "第五章 总结与展望" 1
    Add-Body "ShotForm 系统将计算机视觉、桌面应用工程、篮球动作分析和 AI 辅助建议结合起来，实现了从媒体上传到姿态识别、角度计算、分型判断、球星对比、AI 建议、历史保存的完整闭环。系统的主要特点是：在技术上采用 Vue + Tauri + Rust + Python/MediaPipe + SQLite 的分层架构；在业务上围绕上传、分析、对比、复盘形成清晰路径；在体验上采用电影级首页和专业训练工作台的双模式视觉系统。后续可继续扩展实时摄像头分析、多人同框独立追踪、训练计划生成、云同步、移动端迁移和更多运动项目的动作分析能力。"

    Add-PageBreak
    Add-Heading "附录一 数据字典" 1
    Add-Table -Headers @("名称", "字段/取值", "说明") -Rows @(
        ,@("Keypoint", "id、name、x、y、z、visibility", "MediaPipe 关键点，表示身体部位坐标和可见度"),
        ,@("PoseData", "keypoints、width、height", "一帧画面的姿态关键点集合和原始尺寸"),
        ,@("JointAngle", "name、value、normalRange、status、confidence", "关节角度、标准范围、状态和置信度"),
        ,@("ShotType", "one_motion、one_point_five_motion、two_motion、unknown", "投篮动作分型枚举"),
        ,@("ShotAnalysis", "poseData、angles、shotType、shotTypeConfidence、shotTypeReasons、aiReview、timestamp", "单帧投篮分析结果"),
        ,@("VideoAnalysisFrame", "index、timestampMs、imageData、annotatedImageData、analysis", "视频中的一个已分析关键帧"),
        ,@("TemporalFeatures", "setPointRatio、kneeElbowLeadRatio、plateauSharpness、phaseSequenceValid、confidence", "视频级时序特征"),
        ,@("VideoShotAnalysis", "videoPath、durationMs、trimStartMs、trimEndMs、fps、frames、bestFrameIndex、overallShotType、temporalFeatures", "视频分析结果"),
        ,@("PlayerTemplate", "id、name、team、description、poseData、angles、templateProfile", "球星模板"),
        ,@("PlayerTemplateProfile", "version、sourceKind、overallShotType、samplesUsed、coverage、phaseProfiles", "视频级球星模板画像"),
        ,@("ComparisonResult", "player、similarity、angleDifferences、comparisonMode", "某个球星模板的对比结果"),
        ,@("ComparisonWorkbenchSnapshot", "analysisKey、summaries、detailsByPlayerId、selectedPlayerId、selectedDetail", "对比工作台快照"),
        ,@("CorrectionSuggestion", "bodyPart、issue、suggestion、priority", "矫正建议"),
        ,@("AiShotReview", "phase、decisionMode、shotType、title、summary、reasons", "AI 投篮审查结论"),
        ,@("AnalysisHistory", "id、imagePath、annotatedImagePath、analysis、comparison、suggestions、aiCoachingSummary、videoAnalysis、createdAt", "历史记录")
    )

    Add-PageBreak
    Add-Heading "附录二 IPO图" 1
    Add-Table -Headers @("编号", "模块", "输入", "处理", "输出") -Rows @(
        ,@("IPO-01", "图片姿态分析", "图片 base64", "PoseDetector 检测关键点；calculate_all_angles 计算角度；ShotTypeClassifier 分型；PoseVisualizer 绘制骨架", "ShotAnalysis、标注图"),
        ,@("IPO-02", "视频姿态分析", "视频路径、裁剪起止、主体索引", "video_pose_detect.py 采样；逐帧检测；聚合分型；计算时序特征；选择最佳帧", "VideoShotAnalysis"),
        ,@("IPO-03", "AI 审查", "ShotAnalysis、原图/标注图", "build_ai_analysis_payload 生成结构化 payload；hunyuan.rs 调用模型；解析 JSON", "AiShotReview 或 AiCoachingResponse"),
        ,@("IPO-04", "球星对比", "用户分析结果、球星模板库", "加载模板；PoseComparator 计算角度差异和相似度；生成排名与详情", "ComparisonWorkbenchSnapshot"),
        ,@("IPO-05", "历史记录", "媒体路径、分析、对比、建议", "序列化 JSON；写入 analysis_history；按时间倒序分页读取", "AnalysisHistory 列表")
    )

    Add-PageBreak
    Add-Heading "参考文献" 1
    Add-Body "[1] Vue.js Documentation. https://vuejs.org/"
    Add-Body "[2] Tauri Documentation. https://tauri.app/"
    Add-Body "[3] Google AI Edge. MediaPipe Pose Landmarker Documentation."
    Add-Body "[4] Rust Programming Language Documentation. https://www.rust-lang.org/"
    Add-Body "[5] SQLite Documentation. https://www.sqlite.org/"
    Add-Body "[6] Tencent Hunyuan API Documentation."
    Add-Body "[7] ShotForm 项目源码与 DESIGN.md、docs/superpowers/specs/2026-04-07-cinematic-ui-system-renewal-design.md。"

    if (Test-Path -LiteralPath $docPath) { Remove-Item -LiteralPath $docPath -Force }
    if (Test-Path -LiteralPath $pdfPath) { Remove-Item -LiteralPath $pdfPath -Force }
    $doc.SaveAs2([ref]([string]$docPath), [ref]$wdFormatDocument)
    $doc.SaveAs2([ref]([string]$pdfPath), [ref]$wdFormatPDF)
    Write-Output "DOC=$docPath"
    Write-Output "PDF=$pdfPath"
} finally {
    if ($doc -ne $null) {
        $doc.Close($false) | Out-Null
    }
    if ($word -ne $null) {
        $word.Quit() | Out-Null
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}
