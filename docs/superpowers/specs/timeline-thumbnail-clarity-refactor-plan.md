# 时间轴缩略图清晰度重构方案

## 问题描述

在 Tauri WebView2 环境下，视频上传组件的时间轴缩略图出现模糊问题。具体表现：

- 滑动条在时间轴左右两边时清晰
- 拖动到中间选中区域时变模糊
- 缩略图和滑动条都可能受影响

经过多次尝试修复（调整遮罩透明度、移除嵌套 overflow、Canvas 尺寸优化等），问题仍然存在。

## 根本原因分析

### 可能的渲染问题

1. **多图层叠加触发低质量 GPU 合成**
    - `.clip-range-filmstrip` 内有多个绝对定位层（thumbnails + mask + window）
    - Tauri WebView2 的多层叠加可能触发低质量的 GPU 渲染路径

2. **box-shadow 触发合成层**
    - `.clip-range-window` 的 `box-shadow` 可能创建新的合成层
    - 合成层叠加可能导致渲染质量下降

3. **overflow 嵌套问题**
    - 之前的修改在 `.clip-range-frame-image` 添加了 `overflow: hidden`
    - 多层 overflow 嵌套在 WebView2 中可能产生模糊

## 重构目标

1. **简化 DOM 结构** - 减少绝对定位层的数量
2. **避免多图层叠加** - 使用更简洁的渲染方式
3. **保留功能** - 选中区域高亮、未选中区域暗化、滑动条交互
4. **保持视觉设计** - 圆角、边框、阴影效果

## 重构方案

### 方案 A：clip-path 裁剪方式（推荐）

**核心思路**：使用 `clip-path` 直接在缩略图容器上实现选中效果，完全移除遮罩层和选中窗口元素。

**实现细节**：

1. **HTML 结构调整**

```html
<div class="clip-range-filmstrip">
    <!-- 只保留缩略图 -->
    <div class="clip-range-thumbnails">
        <!-- frames... -->
    </div>
    <!-- 移除 clip-range-mask-start, clip-range-mask-end, clip-range-window -->
</div>
```

2. **CSS 实现**

```css
.clip-range-thumbnails {
    /* 使用 clip-path 实现选中效果 */
    clip-path: inset(0% calc(100% - var(--clip-end-percent)) 0% var(--clip-start-percent));
}

/* 未选中区域的暗化效果通过父容器的伪元素实现 */
.clip-range-filmstrip::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    /* 使用 clip-path 裁剪出未选中区域 */
    clip-path: polygon(
        0% 0%,
        var(--clip-start-percent) 0%,
        var(--clip-start-percent) 100%,
        0% 100%,
        var(--clip-end-percent) 0%,
        100% 0%,
        100% 100%,
        var(--clip-end-percent) 100%
    );
}
```

3. **Vue 计算属性**

```javascript
const clipStartPercent = computed(() => /* ... */)
const clipEndPercent = computed(() => /* ... */)

// 为 CSS 变量提供值
const filmstripStyle = computed(() => ({
  '--clip-start-percent': `${trimStartPercent.value}%`,
  '--clip-end-percent': `${trimEndPercent.value}%`
}))
```

**优点**：

- 减少 DOM 节点数量
- 避免多图层叠加
- clip-path 是现代 CSS，性能良好
- 选中区域和未选中区域完全分离

**缺点**：

- clip-path 的兼容性需要检查（但在 Tauri WebView2 中应该没问题）
- 需要重新实现选中窗口的边框和阴影效果

### 方案 B：渐变遮罩方式

**核心思路**：使用 CSS 渐变实现暗化效果，移除遮罩层元素。

**实现细节**：

1. **HTML 结构调整**

```html
<div class="clip-range-filmstrip">
    <div class="clip-range-thumbnails"></div>
    <!-- 单个遮罩层，使用渐变 -->
    <div class="clip-range-overlay"></div>
</div>
```

2. **CSS 实现**

```css
.clip-range-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
        to right,
        rgba(0, 0, 0, 0.4) 0%,
        rgba(0, 0, 0, 0.4) var(--clip-start-percent),
        transparent var(--clip-start-percent),
        transparent var(--clip-end-percent),
        rgba(0, 0, 0, 0.4) var(--clip-end-percent),
        rgba(0, 0, 0, 0.4) 100%
    );
}
```

**优点**：

- 更简单的实现
- 减少 DOM 节点

**缺点**：

- 渐变遮罩可能仍然有层级问题
- 选中窗口的边框效果需要单独实现

### 方案 C：完全分离渲染层和交互层

**核心思路**：将视觉渲染和用户交互完全分离。

**实现细节**：

1. **渲染层**：只负责显示缩略图和选中效果
2. **交互层**：只负责滑动条交互
3. **两层完全独立**，避免样式冲突

```html
<!-- 渲染层 -->
<div class="clip-range-render-layer">
    <div class="clip-range-thumbnails"></div>
    <div class="clip-range-selection-effect"></div>
</div>

<!-- 交互层 -->
<div class="clip-range-interaction-layer">
    <input type="range" class="clip-range-input-start" />
    <input type="range" class="clip-range-input-end" />
</div>
```

**优点**：

- 完全避免样式冲突
- 清晰的职责分离

**缺点**：

- 实现复杂度高
- 需要精确的对齐计算

## 推荐方案

**方案 A（clip-path 裁剪方式）** 是最佳选择，因为：

1. 彻底移除遮罩层和选中窗口元素
2. 使用现代 CSS clip-path，性能良好
3. 选中区域和未选中区域完全分离，避免渲染冲突
4. 实现相对简单，风险可控

## 实施步骤

1. **清理现有代码**
    - 移除 `.clip-range-mask` 和 `.clip-range-window` 相关代码
    - 移除相关的 Vue 计算属性（clipStartMaskStyle, clipEndMaskStyle, clipSelectionStyle）

2. **实现 clip-path 方案**
    - 添加 CSS 变量控制 clip-path
    - 实现选中效果
    - 保留滑动条交互

3. **保留必要功能**
    - 滑动条拖动
    - 选中区域高亮边框
    - 未选中区域暗化

4. **测试验证**
    - Tauri 环境下测试清晰度
    - 功能完整性测试
    - 性能测试

## 风险评估

- **低风险**：clip-path 是现代 CSS 标准，在 WebView2 中支持良好
- **中风险**：需要重新实现选中窗口的视觉效果
- **高风险**：无

## 预期效果

- 缩略图在任何位置都保持清晰
- 滑动条交互不受影响
- 视觉效果与之前一致或更好
