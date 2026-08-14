import React, { useMemo, useState, useEffect } from 'react';
import { posterSVG } from './poster/renderPoster.js';
import { geometry, cellRect } from './poster/layout.js';
import { theme } from './poster/theme.js';
import {
  loadModel, saveModel, sampleModel, emptyModel,
  MONTHS_ZH, daysInMonth, dow, iso,
} from './data/model.js';
import { exportPosterPDF } from './poster/exportPdf.js';

const YEAR = 2026;
const WK = ['日', '一', '二', '三', '四', '五', '六'];

export default function App() {
  const [model, setModel] = useState(() => loadModel(YEAR));
  const [sel, setSel] = useState(null); // {m, d}
  const [busy, setBusy] = useState('');

  useEffect(() => { saveModel(model); }, [model]);

  const svg = useMemo(() => posterSVG(model), [model]);
  const g = useMemo(() => geometry(), []);

  // 更新某天
  const patchDay = (m, d, patch) => setModel((prev) => {
    const key = iso(YEAR, m, d);
    const days = { ...prev.days };
    const next = { ...(days[key] || {}), ...patch };
    // 清掉空字段
    if (next.note === '') delete next.note;
    if (!next.categoryId) delete next.categoryId;
    if (Object.keys(next).length === 0) delete days[key]; else days[key] = next;
    return { ...prev, days };
  });

  const toggleMilestone = (m, d, label) => setModel((prev) => {
    const date = iso(YEAR, m, d);
    const exists = prev.milestones.find((x) => x.date === date);
    let milestones;
    if (exists) milestones = prev.milestones.filter((x) => x.date !== date);
    else milestones = [...prev.milestones, { date, label: label || '里程碑' }];
    return { ...prev, milestones };
  });
  const setMilestoneLabel = (m, d, label) => setModel((prev) => ({
    ...prev,
    milestones: prev.milestones.map((x) => (x.date === iso(YEAR, m, d) ? { ...x, label } : x)),
  }));

  const selRec = sel ? (model.days[iso(YEAR, sel.m, sel.d)] || {}) : null;
  const selMs = sel ? model.milestones.find((x) => x.date === iso(YEAR, sel.m, sel.d)) : null;

  const doExport = async () => {
    setBusy('正在生成印刷级 PDF…');
    try { await exportPosterPDF(model); setBusy(''); }
    catch (e) { console.error(e); setBusy('导出未完成: ' + (e?.message || e)); }
  };

  return (
    <div className="app">
      <header className="bar">
        <div className="bar__l">
          <span className="bar__year">{YEAR}</span>
          <span className="bar__title">线性年历 · 海报生成器</span>
          <span className="bar__tag">方向② 暖·手作·编辑</span>
        </div>
        <div className="bar__r">
          <button className="btn" onClick={() => window.print()}>打印预览</button>
          <button className="btn btn--primary" onClick={doExport}>导出印刷 PDF ▸</button>
          <button className="btn btn--ghost" onClick={() => { setModel(sampleModel(YEAR)); setSel(null); }}>重置示例</button>
          <button className="btn btn--ghost" onClick={() => { if (confirm('清空全部内容?')) { setModel(emptyModel(YEAR)); setSel(null); } }}>清空</button>
        </div>
      </header>

      {busy && <div className="toast">{busy}</div>}

      <div className="work">
        <div className="stagewrap">
          <div className="stage" style={{ aspectRatio: '841 / 594' }}>
            <div className="poster" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="overlay">
              {Array.from({ length: 12 }).map((_, m) => {
                const dim = daysInMonth(YEAR, m);
                return Array.from({ length: dim }).map((__, i) => {
                  const d = i + 1;
                  const c = cellRect(g, m, d);
                  const isSel = sel && sel.m === m && sel.d === d;
                  return (
                    <button key={`${m}-${d}`} className={'hit' + (isSel ? ' hit--sel' : '')}
                      style={{ left: `${c.x / 841 * 100}%`, top: `${c.y / 594 * 100}%`, width: `${c.w / 841 * 100}%`, height: `${c.h / 594 * 100}%` }}
                      title={`${m + 1}月${d}日`} onClick={() => setSel({ m, d })} />
                  );
                });
              })}
            </div>
          </div>
        </div>

        <aside className="panel">
          {!sel && <div className="panel__hint">点海报上任意一天 →<br />在这里写备注、分类、设里程碑。<br /><br />屏幕编辑刻意做得朴素;<br />力气都在导出的那张纸上。</div>}
          {sel && (
            <div className="editor">
              <div className="editor__date">
                {MONTHS_ZH[sel.m]} {sel.d} 日 <span className="editor__wk">周{WK[dow(YEAR, sel.m, sel.d)]}</span>
              </div>

              <label className="fld">备注
                <input type="text" value={selRec.note || ''} placeholder="一句话…"
                  onChange={(e) => patchDay(sel.m, sel.d, { note: e.target.value })} />
              </label>

              <div className="fld">分类(密度即纹理)
                <div className="chips">
                  <button className={'chip' + (!selRec.categoryId ? ' chip--on' : '')} onClick={() => patchDay(sel.m, sel.d, { categoryId: undefined })}>无</button>
                  {model.categories.map((cat) => (
                    <button key={cat.id} className={'chip' + (selRec.categoryId === cat.id ? ' chip--on' : '')}
                      onClick={() => patchDay(sel.m, sel.d, { categoryId: cat.id })}>
                      <span className="chip__sw" style={{ background: cat.color }} />{cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fld">里程碑(排版锚点)
                {!selMs && <button className="btn btn--sm" onClick={() => toggleMilestone(sel.m, sel.d)}>＋ 设为里程碑</button>}
                {selMs && (
                  <div className="ms">
                    <input type="text" value={selMs.label} onChange={(e) => setMilestoneLabel(sel.m, sel.d, e.target.value)} />
                    <button className="btn btn--sm btn--ghost" onClick={() => toggleMilestone(sel.m, sel.d)}>移除</button>
                  </div>
                )}
              </div>

              <button className="btn btn--ghost btn--sm editor__close" onClick={() => setSel(null)}>关闭</button>
            </div>
          )}

          <div className="panel__foot">
            数据自动存本机(localStorage) · 屏幕用系统字, 导出换 OFL 嵌入款
          </div>
        </aside>
      </div>
    </div>
  );
}
