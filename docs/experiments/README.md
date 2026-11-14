# 真实实验操作指南

## 两类材料必须分开

- `smoke-manifest.json`：仓库现有素材，只验证代码流程，原始拍摄来源未核验，不能当作训练效果数据集。
- `manifest.json`：真实实验清单，目前为空。等实际采集后填写，不复制测试夹具充数。

准备 20～30 段短视频，给每段唯一编号。建议记录同一训练者、固定机位、单次投篮；另选少量遮挡、多人、拍摄角度变化的失败样例。至少留出 3 组同一训练者的前后记录。未经独立验证，不把角度变化解释为训练有效。

清单条目格式（相对路径以清单所在目录为起点）：

```json
{
  "id": "S01",
  "path": "D:/你的素材目录/S01.mp4",
  "kind": "video",
  "source": "自行拍摄；拍摄日期；被拍摄者同意用于毕设",
  "condition": "固定机位、右侧、全身可见",
  "participant": "P01",
  "pair_id": "PAIR01",
  "session": "before",
  "start_ms": 0,
  "end_ms": 5000
}
```

不要把上面的示例当成已经采集的记录。图片使用 `kind: "image"`。

## 执行测量

```powershell
.\.venv\Scripts\python.exe scripts/run_experiments.py docs/experiments/manifest.json --output .tmp/experiment-01 --extract-frames 20
```

输出目录必须是新目录，脚本拒绝覆盖旧实验。结果包括：

- `environment.json`：解释器、依赖、模型文件、系统信息；不记录 API 密钥。
- `results.json`：每项素材的来源、SHA-256、错误、有效帧比例及耗时。
- 每项原始识别 JSON 与 stderr 日志；抽样帧图片。
- `annotations.json`：模型关键点与**空的人工标注栏**。

有效比例＝返回目标姿态的抽样帧数÷尝试抽样帧数，不能写成模型准确率。耗时包含 Python 进程启动、解码、推理和 JSON 输出，不包含 Rust 角度计算与界面渲染。首次模型缓存与机器负载会影响测量；正式实验应记录运行次数，使用一致方法汇总。

## 人工角度误差

在抽样帧原始像素坐标下，人工标记肩、肘、腕；不要把模型坐标复制成“人工标注”。使用能读取像素坐标的图像查看器，填入 `manual_keypoints`，并写入标注者和备注：

```json
"manual_keypoints": {
  "12": {"x": 100, "y": 200},
  "14": {"x": 140, "y": 170},
  "16": {"x": 120, "y": 100}
},
"annotator": "实际标注者"
```

上面仅演示格式，不是可用测量数据。左肩/肘/腕编号为 11/13/15，右侧为 12/14/16。保持图片尺寸不变；遮挡或不确定点写入备注，不强行标记。

```powershell
.\.venv\Scripts\python.exe scripts/evaluate_annotations.py .tmp/experiment-01/annotations.json --output .tmp/experiment-01/angle-errors.json
```

当前评估器计算左右肘的二维三点夹角，与 Rust `calculate_angle` 使用相同定义；模型点可见度低于 0.5 时跳过。结果报告有效比较数、每项绝对误差、MAE 和跳过原因。没有人工标注时 MAE 为 `null`，不是 0°。

## 人工功能验收记录模板

| 用例 | 素材编号/操作 | 实际结果 | 是否通过 | 截图/问题编号 |
|---|---|---|---|---|
| 图片分析 | 待填写 | 未执行 | 待验证 | 待填写 |
| 视频片段分析 | 待填写 | 未执行 | 待验证 | 待填写 |
| 保存并重启恢复 | 待填写 | 未执行 | 待验证 | 待填写 |
| 移动原视频后查看 | 待填写 | 未执行 | 待验证 | 待填写 |
| AI 未配置时本地流程 | 待填写 | 未执行 | 待验证 | 待填写 |
| 无人体/遮挡 | 待填写 | 未执行 | 待验证 | 待填写 |
| 两次训练对比 | 待填写 | 未执行 | 待验证 | 待填写 |
| 离线打开报告 | 待填写 | 未执行 | 待验证 | 待填写 |

实际测量后把结论与失败案例写入论文，不修改空模板来冒充执行结果。

## 固定模型、记录实际加载结果

默认优先 Heavy，失败后按候选路径回退；结果与 stderr 均带模型名称、SHA-256 和每次回退原因。先运行 `scripts/check_environment.py` 检查真实 loadable 状态。

重新获取模型（官方固定版本，下载后校验 SHA-256、ZIP CRC 并实际创建 detector，再替换文件）：

```powershell
.\.venv\Scripts\python.exe scripts/download_pose_model.py heavy
.\.venv\Scripts\python.exe scripts/download_pose_model.py lite
```

比较同一批素材时，用环境变量指定候选路径（Windows 多路径以分号分隔），分别输出到新目录：

```powershell
$env:SHOTFORM_POSE_MODELS = (Resolve-Path models/pose_landmarker_heavy.task).Path
.\.venv\Scripts\python.exe scripts/run_experiments.py docs/experiments/manifest.json --output .tmp/heavy-run-01
$env:SHOTFORM_POSE_MODELS = (Resolve-Path models/pose_landmarker_lite.task).Path
.\.venv\Scripts\python.exe scripts/run_experiments.py docs/experiments/manifest.json --output .tmp/lite-run-01
Remove-Item Env:SHOTFORM_POSE_MODELS
```

人工标注必须对应相同原始帧及坐标尺寸；比较前核对素材哈希、frame_index、timestamp_ms。使用同一份独立人工点位，不以任一模型输出代替人工标签。每次记录结果中的实际 model_info，即使指定路径也不能假设一定加载成功；失败可能回退到其他后端。正式实验需预先统一可见度筛选、重复次数及耗时汇总方法。

本轮仅仓库素材的模型加载/推理检查，结果在 `model-verification/`；不是20～30段真实训练实验。先前 `verification/` 未记录加载模型的耗时不得归属于 Heavy。
