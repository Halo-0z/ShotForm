export const escapeHtml = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    )

export function reportImage(source) {
    // Only embedded raster images; never embed arbitrary URLs, SVG or active HTML.
    return /^data:image\/(png|jpeg|jpg|webp|bmp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(source ?? "")
        ? `<img class="pose" alt="姿态分析图" src="${escapeHtml(source)}">`
        : "<p>无可嵌入的姿态图</p>"
}

export function reportTable(headers, rows) {
    return `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
}

export function reportDocument(title, content) {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escapeHtml(title)}</title><style>
  *{box-sizing:border-box}body{font:16px/1.7 'Microsoft YaHei',sans-serif;color:#202b38;background:#f4f5f7;margin:0}main{max-width:1000px;margin:32px auto;padding:40px;background:white}h1{font-size:28px}h2{margin-top:30px;font-size:20px;border-bottom:1px solid #ddd}p{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;margin:18px 0}td,th{padding:10px;border:1px solid #ccd2d9;text-align:left}th{background:#eef1f5}.pose{max-width:100%;max-height:430px;object-fit:contain}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}.muted{color:#5b6470;font-size:14px}@media(max-width:650px){main{padding:18px}.pair{grid-template-columns:1fr}}@media print{@page{size:A4;margin:15mm}body{background:white}main{padding:0;margin:0;max-width:none}tr,img{break-inside:avoid}thead{display:table-header-group}.no-print{display:none}}
  </style></head><body><main><h1>${escapeHtml(title)}</h1>${content}<p class="muted">本报告用于观察姿态变化。角度变化和模板相似度不等于训练效果或投篮水平；“出手角”指肩—腕连线相对水平线的角度。</p><p class="no-print muted">可使用浏览器打印功能保存为 PDF。</p></main></body></html>`
}
