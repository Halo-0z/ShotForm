# ShotForm 投篮姿态分析与训练辅助系统

Vue 3 + Tauri/Rust + Python MediaPipe + SQLite 的 Windows 桌面项目。支持图片、短视频姿态分析，本地规则建议、可选混元 AI、参考模板比较、训练记录与两次训练对比、HTML/JSON 报告。

## 当前交付状态

本次补齐了历史保存、训练信息管理、对比与报告流程，并提供实验工具。完整 Rust 测试 87 项、前端单元测试 227 项、浏览器测试 18 项、Python 测试 11 项均通过。Heavy/Lite 已真实推理；Tauri 图片/视频分析、保存、结束进程后重启恢复、原生 HTML/JSON 导出已实测。浏览器模拟接口测试与真实桌面验收在验证记录中分列，托盘菜单正常退出等补充场景仍待验证。

用户暂未提供训练素材，20～30 段真实实验、人工标注、3 组训练前后样例和答辩电脑验证仍待完成。请查看 [验收记录](docs/verification.md)、[后续清单](docs/remaining-work.md)。

## 环境与启动

目标环境：Windows x64、Python 3.12、Node.js 24、Rust MSVC 工具链、Microsoft Edge WebView2。Rust 编译还需要 Visual Studio Build Tools 的“使用 C++ 的桌面开发”组件及 Windows SDK。仅安装 Rust 或 VS Code 不够。

在项目根目录执行：

```powershell
npm ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
.\.venv\Scripts\python.exe scripts/check_environment.py
.\scripts\start.ps1
```

`requirements-lock.txt` 是本次验证环境的完整版本列表；`requirements.txt` 是核心依赖约束。只使用 `opencv-contrib-python`，不要同时安装另一个提供 `cv2` 的 OpenCV 包。

本次已在此电脑安装项目 npm 依赖、项目 `.venv` 与用户目录 Rust。Rust 安装没有修改系统 PATH，启动脚本会在当前进程加入 `$env:USERPROFILE\.cargo\bin`。Microsoft C++ Build Tools、MSVC 与 Windows SDK 已由用户安装，本轮 Rust 编译和桌面启动成功。

只看界面可执行 `npm run dev`。浏览器支持素材预览、片段选择，但真实姿态分析和 SQLite 操作需要桌面端。桌面端请选择文件按钮导入视频，避免拖拽时缺少系统文件路径。建议先使用 MP4/H.264；其他容器的可播放性取决于本机解码支持。

混元配置见 [HUNYUAN_SETUP.md](HUNYUAN_SETUP.md)。不配置 API 密钥也可完成本地姿态分析、历史管理和报告导出。

## 使用流程

1. 上传页切换图片或视频模式，选择素材。视频建议裁剪一次投篮的 2～6 秒片段。
2. 查看骨架、关节角度和本地建议；需要时手动生成 AI 辅助建议。
3. 点击保存历史记录。同一次分析保存成功后按钮禁用，防止重复写入。
4. 历史页编辑训练日期、备注、标签。筛选在数据库端执行后再分页。
5. 选择两条同一人的记录，在对比区域手动选取同一动作阶段的帧。变化值为后一次减前一次，不自动判断进步。
6. 分析页导出 HTML 或 JSON；对比区导出 HTML。HTML 内嵌图片，可离线打开，并通过浏览器打印为 PDF。

历史保存的是当次选中帧、抽样帧及已有建议。原视频移动后仍可查看抽样结果，但不能据此恢复未保存的原视频帧。不同帧的 AI 建议不覆盖已保存代表帧的建议。

## 检查命令

```powershell
npm run build
npm test
npm run test:render
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
# 使用已安装的 C++ 工具链：
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path src-tauri/Cargo.toml --offline
```

实验说明见 [实验操作指南](docs/experiments/README.md)。论文和答辩材料见 [毕设说明](docs/thesis-guide.md)。原仓库中已有设计文档与测试报告保留作为历史资料，不代表本次验证结论。

原项目作者与许可见 [LICENSE](LICENSE)。论文应区分原有功能、本次增量实现与个人完成的实验。
