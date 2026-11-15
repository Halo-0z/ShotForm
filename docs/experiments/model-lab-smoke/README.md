# 本机模型实验入口验证（2026-11-15）

这是一张仓库图片和一段仓库视频解码得到的16帧（图片1、视频15）的流程检查，无人工点位、无人/遮挡真值或训练目标框，不能作为正式精度数据集。原素材拍摄来源未核验。每个配置一个进程内跑3遍，共48次帧推理。

- `dataset.json`：冻结的帧清单、来源、哈希、帧号、空标注。
- `models.json`：官方 OpenMMLab 下载地址、归档/ONNX SHA-256。模型二进制未提交。
- `run.json`：最终修正进程树采样后的硬件、耗时、RSS、整卡显存原始采样及退出码。
- `summary.json`：配对指标及覆盖分母。所有真实误差/漏检率/残差抖动均因未标注而为 null，不是零。
- `provenance.json`：实际 provider、包版本、模型哈希、原始预测文件哈希；另记首次成功 GPU 推理的冷开销和此前 DLL 加载失败。

原 PNG、完整预测和原始日志留在忽略目录 `.tmp/model-lab-dataset-final`、`.tmp/model-lab-verified-tree`。这里不重复提交素材或机器路径日志。重建输入：

```powershell
.venv-model-lab/Scripts/python.exe experiments/model_lab/prepare.py docs/experiments/smoke-manifest.json --output experiments/local/smoke-frames --stride 6 --max-frames 16
.venv-model-lab/Scripts/python.exe experiments/model_lab/run.py experiments/local/smoke-frames/dataset.json --output experiments/local/smoke-run --machine-label 你的机器编号 --repeats 3
.venv-model-lab/Scripts/python.exe experiments/model_lab/evaluate.py experiments/local/smoke-run --output experiments/local/smoke-run/summary.json
```

帧内容哈希用于核对相同输入；新准备耗时会不同，整个 dataset.json 的哈希因此不同，应在同一次准备上运行所有模型。本次 Heavy/RTMPose 分别有6/15帧多人歧义，没有人工目标框因此不选人；这些不是已标注的漏检数。当前 RTMPose CUDA 会话包含 CUDAExecutionProvider 和 CPUExecutionProvider，部分形状运算仍在CPU；没有把失败后 CPU 自动重试记为 GPU。

当前机器有其他桌面负载，未控制温度/电源/后台 GPU 使用。这些耗时用于确认计量链路与发现冷启动开销，不作性能排名或默认模型切换依据。若答辩也在本机进行，无须另找一台；若换机，再按相同哈希补测。
