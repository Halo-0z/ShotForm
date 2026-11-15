# 本轮先标之前导入的视频

可以用来启动实验。`tests/fixtures/upload-sample.mp4` 是 592×1280、30 fps、89 帧（约 2.97 秒）的屏幕录制片段，包含真实投篮动作、多人重叠和运动模糊。它适合做目标人物归属及遮挡短序列的试验；不代表清晰单人场景，也不代替多段正式实验材料。原拍摄来源尚未核实，后续请补来源、拍摄条件及使用说明。

本轮准备第 30～59 帧（1.000～1.967 秒），连续 30 帧，没有插值、抽掉中间帧或模型预填。生成后的离线页面在 `experiments/local/annotation-pilot/标注页面.html`，双击用 Edge 打开即可。页面与 PNG、个人标注均留在忽略目录，不提交 Git。

## 标注步骤

1. 填写标注者姓名或固定代号。确认要分析的是画面中哪一个人，在备注中记录号码/衣着；整段坚持同一个目标。前景 7 号和后方人物有重叠，不要把两个人的关节拼在一起。
2. 选择“在画面中”，拖动目标框。框只供模型检测结果归属使用，不裁剪模型输入。多人躯干中心同时落入框时仍会报告歧义，不自动挑选最有利结果。
3. 左右按人物自己的左右。依次点选左右肩、肘、腕、髋、膝、踝的关节中心。肩肘髋膝角度还需要腕、踝两个端点，所以共 12 点。
4. 直接看得见选“可见”；遮挡但能可靠判断中心时选“遮挡但可可靠判断”；被挡住或模糊到无法确定时点“当前点设为未知”。未知点没有坐标，不参与相关角度计算。不要为了填满表而猜测。
5. 选择本帧遮挡分组，记录模糊/重叠等情况。12 点均已定位或明确设为未知后，勾选“我已逐点检查本帧”。修改任何字段会撤销该帧确认，需重新检查。
6. 下一帧继续。切帧保留当前页面内的标注；关闭前点击“导出标注 JSON”。下次打开页面用“导入继续”。草稿也可以导出，但没有确认的帧不进入误差/漏检分母。

页面离线运行，无网络、无付费 API，也不显示模型建议点。导出并不等于上传或自动写回实验目录。将 JSON 保存好，提供其本机路径后即可合并验证、冻结版本并重新跑模型。

第一遍可以先检查 3～5 帧能否可靠分辨关键点。若肩、髋中心大多看不清，应保留未知和失败案例，并补一段清晰单人、固定机位、全身可见的投篮视频。没有足够可靠标注时不能得出精度收益。残差抖动需要相邻帧都有独立可信标签，不能跨过中间未知帧拼接，也不要复制上一帧坐标来制造平滑。

至少选一部分由另一位同学独立复核并记录差异，区分模型误差与人工点选误差。本次工具测试中的 `SYNTHETIC BROWSER TEST` 标签仅存在于浏览器临时下载中，没有写入待标注页面或实验真值。

## 重建与合并命令

以下路径在项目根目录执行。输出均拒绝覆盖；重复操作请使用新目录/新文件名。

```powershell
.venv/Scripts/python.exe experiments/model_lab/prepare.py docs/experiments/annotation-pilot-manifest.json --output experiments/local/annotation-pilot --stride 1 --max-frames 30
.venv/Scripts/python.exe experiments/model_lab/annotate.py experiments/local/annotation-pilot/dataset.json --html experiments/local/annotation-pilot/标注页面.html

# 把下面路径换成实际导出的 JSON，合并结果须与原 PNG 同目录
.venv/Scripts/python.exe experiments/model_lab/annotate.py experiments/local/annotation-pilot/dataset.json --import-labels C:/实际路径/annotations.json --output experiments/local/annotation-pilot/reviewed-dataset.json
.venv-model-lab/Scripts/python.exe experiments/model_lab/run.py experiments/local/annotation-pilot/reviewed-dataset.json --output experiments/local/labeled-pilot-01 --machine-label local-9600x-5060ti
.venv-model-lab/Scripts/python.exe experiments/model_lab/evaluate.py experiments/local/labeled-pilot-01 --output experiments/local/labeled-pilot-01/summary.json
```

导入只合并标注字段，拒绝更改帧顺序、图像哈希、源信息、尺寸或时间。框/点须在原图范围内，未知点不得带猜测坐标。合并后保留 `annotation_review_required: true`，明确确认后才纳入人工真值；原有未使用新版工具的数据仍兼容旧标注协议。

评价同时给每个关节的人工有效分母、模型接受数、覆盖率、失败原因、遮挡分组，及两模型共同有效角度上的配对误差。三个模型共同有效集为空时，单独两个模型仍可有配对结果。缺点不会补零；未知帧会断开时间残差对。
