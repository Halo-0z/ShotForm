# Heavy / RTMPose 模型对照协议

本实验与桌面业务隔离，默认模型继续为 Heavy，Lite 回退保持原状。候选不写入 SQLite、不调用现有建议/分型模块，也不改变历史的 33 点定义。没有人工标注前只验证推理和计量工具，不能得出角度精度或训练效果结论。

## 数据与坐标契约

实验格式为 `shotform-model-lab-v1`，与生产 `PoseData` 不兼容。所有 x/y 均为原始 PNG 像素，原点左上，x 向右、y 向下；先还原模型裁剪/缩放，再算角度，不在归一化坐标中计算。左右遵循被拍摄者身体左右，保持图像原有朝向，不额外镜像。

| 部位 | COCO17 原编号（左/右） | 实验语义编号（沿用 MediaPipe） |
|---|---|---|
| 肩 | 5 / 6 | 11 / 12 |
| 肘 | 7 / 8 | 13 / 14 |
| 腕 | 9 / 10 | 15 / 16 |
| 髋 | 11 / 12 | 23 / 24 |
| 膝 | 13 / 14 | 25 / 26 |
| 踝 | 15 / 16 | 27 / 28 |
| 鼻、眼、耳 | 0、1/2、3/4 | 0、2/5、7/8 |

RTMPose-m 本候选为 COCO17，`to_openpose=False`。手指、足跟等没有对应点时不生成；不填零、不把邻近点复制成缺失点。候选 z 为 `null`，Heavy 原生相对 z 单独放 `native_z`，本次只使用二维坐标，不能比较成米或世界坐标。未来 RTMW 的 COCO-WholeBody133 身体前 17 点可按同表对齐；其手/脸/脚与 MediaPipe 的语义需另行核对，当前未安装或实测 RTMW。

Heavy `score` 为 visibility；RTMPose 为 rtmlib 的原始 SimCC 分数，不是经过跨模型校准的可见概率。保留原值，拒绝 NaN，不抬高下限；同时报告全有限点误差、三个点各自 `score >= 0.55` 的筛选误差及覆盖数。**这个筛选规则仅用于实验**：现有 Rust 使用三点平均置信度并有腿部重叠标记，本轮不替换它，也不声称实验有效角度数等同产品有效数。正式选择阈值需单独验证集，不能为提升测试集成绩临时调阈值。

几何定义与 `angles.rs` 三点二维公式一致：肩=髋–肩–肘，肘=肩–肘–腕，髋=肩–髋–膝，膝=髋–膝–踝。退化/缺失角度记 `null` 并附原因。候选正式接入产品前仍须验证缺失脚/手点对投篮手判断、姿态图、3D角度和规则建议的影响，不能直接把 17 点包装为完整 33 点。

## 相同输入与人工标注

1. 在现有 `manifest.json` 填真实素材来源、条件及路径；单独保留仓库 `smoke-manifest.json`。准备脚本只解码一次，按固定 stride 输出 PNG，记录原视频/PNG SHA-256、帧号、时间、尺寸。所有模型必须通过同一份帧哈希检查。
2. 人工在原 PNG 上标注，禁止复制任意模型点。填写 `subject_present: true/false`、`annotator`、`occlusion`（如 clear/arm_occluded/leg_occluded）和 `manual_keypoints`。每点包含 `x, y, state`，state 取 visible/occluded/unknown；无法可靠推断的遮挡点设 unknown 或缺省，不用于误差。
3. 多人帧在 `target_bbox: [x1,y1,x2,y2]` 标出同一训练者。框只用于检测结果的目标归属，不裁剪输入、不跳过检测器。以肩髋中心落入框选人；多个匹配/没有匹配均报告歧义。没有人工目标框且检测到多人时禁止自动选择某个人，避免跨帧换人。Heavy 最多检测 3 人，候选人体检测数不限，这属于当前管线差异。
4. 肩肘髋膝清晰关键帧约20张；抖动需要额外连续标注短序列，不能仅用稀疏20帧推断视频稳定性。多人/遮挡/侧面/正面分组，至少一部分标注交由第二人复核。标注完成后冻结数据版本，再运行两模型。

标注格式示例（数字仅演示，不能作为真实标签）：

```json
{"subject_present": true, "annotator": "实际标注者", "occlusion": "clear",
 "manual_keypoints": {"11": {"x": 100, "y": 200, "state": "visible"}}}
```

## 指标与解释

- 肩肘髋膝：左右分别给 MAE、P95、样本数；既报告各模型全部可比较点，又报告双方共同有效的配对集合。低分/缺点不能用零误差补齐。未标注时误差为 null。
- 漏检：分母为人工确认目标存在的帧；分子为不能得到目标点的帧（单列无检测、多人歧义、目标未匹配）。对人工确认无人帧另报误检。按遮挡组给分母、失败数与角度误差。
- 帧间抖动：连续已标注帧上的 `|(预测角−人工角)后−(预测角−人工角)前|/Δt`，单位 °/s。正常投篮动作本身会改变角度，所以不把原始角度差当模型抖动；缺点断开相邻对，无标签为 null。此残差变化指标仍包含人工标注噪声。
- 端到端：`source_to_results_wall_s`=一次源视频解码/PNG准备耗时+整个模型子进程耗时；后者含导入、加载、PNG解码、人体检测、姿态、角度、JSON及退出观测。另报模型加载和第一遍/后两遍每帧耗时。明确排除 Tauri UI/Rust 流程；不是应用操作总响应时间。模型下载不计入推理。
- 内存：采样 Python 工作进程树 RSS 合计峰值（最短50ms，包含 Windows venv 启动器与实际解释器，共享页可能重复计数）；独立线程每秒尝试读取这组进程的显存，避免 GPU 查询阻塞实验截止时间。WDDM 不提供时为 null，不能写 0。整卡显存另存原始快照，含其他程序，不替代模型显存。
- 每配置固定顺序执行3遍，第一遍与后两遍分开。正式实验应重复独立进程运行并交替模型顺序，关闭无关负载、记录电源模式和温度条件，不能凭当前一次冒烟结果下性能排名结论。

## 独立环境及命令

只用 `.venv-model-lab` 安装候选，Heavy 子进程仍用已验证的 `.venv`。不要求两台电脑：若本机也是答辩电脑，记录同一机器即可；CPU/GPU 两种模式不是两台电脑实测。未来换机时复制相同模型哈希、数据哈希和脚本后在目标机重跑。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File experiments/setup.ps1
.venv-model-lab/Scripts/python.exe experiments/model_lab/download.py --output models/experimental/rtmpose-m
.venv-model-lab/Scripts/python.exe experiments/model_lab/prepare.py docs/experiments/manifest.json --output experiments/local/dataset-01 --stride 3 --max-frames 60
.venv-model-lab/Scripts/python.exe experiments/model_lab/run.py experiments/local/dataset-01/dataset.json --output experiments/local/run-01 --machine-label local-9600x-5060ti --repeats 3
.venv-model-lab/Scripts/python.exe experiments/model_lab/evaluate.py experiments/local/run-01 --output experiments/local/run-01/summary.json
```

先编辑 dataset.json 完成人工标注，再 run。run 保存冻结标注副本；评估拒绝已被更改的副本或不同帧哈希。输出目录和结果均拒绝覆盖。无 GPU 的电脑加 `--backends heavy-cpu rtmpose-cpu`；`--heavy-python` 可指定基线解释器。脚本是实验入口，当前未加入桌面选模型按钮。

rtmlib 0.0.16 的包元数据同时依赖两种 OpenCV wheel 和 CPU onnxruntime。安装脚本使用本机冻结的 `requirements-lock.txt` 和 `--no-deps`，仅安装 contrib OpenCV 和 GPU ORT（该 wheel 同时提供 CPU provider），避免同名模块互相覆盖。因此实验环境 `pip check` 会提示 rtmlib 缺少名为 opencv-python/onnxruntime 的发行包；该元数据提示保留记录，以真实 import、会话 provider 和推理检查为准。`requirements.txt` 记录直接依赖，重新解析依赖时 rtmlib 需单独 `--no-deps` 安装。应用 `.venv` 不受影响。GPU provider 初始化失败会报错，禁止悄悄把 CPU 结果记成 GPU。模型来源、归档/ONNX 哈希随下载记录；正式运行应与已审阅的模型清单核对。

## 进入默认模型切换的条件

先完成真实标注集和本机实测，再决定是否值得做产品接入。必须逐关节检查配对误差和遮挡覆盖，收益应明显超出人工标注差异，且漏检、耗时和资源可接受；多人身份不能漂移。只提高公开数据集 AP 不满足条件。若 RTMPose 在本项目真实材料中仍有明确的全身/手脚遮挡短板，再固定 RTMW 权重和依赖做独立对照，不预先扩大候选数。通过后另立接入任务，保留 Heavy/Lite 回退和模型来源记录；旧历史按原模型解释，禁止重新解释成新模型坐标。

## 依据

- [MMPose COCO17 点位定义](https://github.com/open-mmlab/mmpose/blob/main/configs/_base_/datasets/coco.py)
- [rtmlib Body 模型配置与推理流程](https://github.com/Tau-J/rtmlib/blob/main/rtmlib/tools/solution/body.py)
- [RTMPose 原始实现](https://github.com/open-mmlab/mmpose/tree/main/projects/rtmpose)
- [ONNX Runtime CUDA 依赖与 DLL 加载说明](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html)

上述资料只用于模型来源/接口核对，公开基准没有写入本项目实验结果。

本机执行记录见 [本轮验证记录](../verification.md) 末尾；正式精度实验仍需人工标注。
