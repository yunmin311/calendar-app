import React, { useMemo, useState } from 'react';
import { renderRecord } from './poster/renderRecord.js';
import { geometry, cellRect } from './poster/layout.js';
import { MONTHS_ZH, daysInMonth, dow, iso } from './data/model.js';
import { sampleActivities, toRecordModel, ACTIVITY_TYPES, MAX_LEVEL } from './data/activity.js';
import { exportRecordPDF } from './poster/exportPdf.js';

const YEAR = 2026;
const WK = ['日', '一', '二', '三', '四', '五', '六'];
const TYPE_NAME = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.id, t.name]));

// 这个壳 = 「渲染+导出组件」的预览台:
//   进 = CO 活动数据数组(现用占位 sampleActivities, 真 schema 等 CO 落地再换)
//   出 = 月历留痕(B 暖·编辑+拓质+朱砂) + 印刷 PDF
// 不做活动编辑/存储(那是 CO 的事), 只读预览 + 逐日检视。
export default function App() {
  const [activities, setActivities] = useState(() => sampleActivities(YEAR));
  const [variant, setVariant] = useState('editorial-rubbing'); // B 默认; 可切 A 对照
  const [sel, setSel] = useState(null); // {m, d}
  const [busy, setBusy] = useState('');

  const model = useMemo(() => toRecordModel(activities, YEAR, variant), [activities, variant]);
  const svg = useMemo(() => renderRecord(model, { variant }), [model, variant]);
  const g = useMemo(() => geometry(), []);

  // 逐日检视: 点某天 → 拉出当天所有活动(从输入数组过滤, 只读)
  const selDate = sel ? iso(YEAR, sel.m, sel.d) : null;
  const selActs = selDate ? activities.filter((a) => a.date === selDate) : [];
  const selDay = selDate ? model.days[selDate] : null;
  const selMs = sel ? model.milestones.find((x) => x.date === selDate) : null;

  const doExport = async () => {
    setBusy('正在生成印刷级 PDF(含拓质 300dpi 栅格化)…');
    try { await exportRecordPDF(activities, YEAR, variant); setBusy(''); }
    catch (e) { console.error(e); setBusy('导出未完成: ' + (e?.message || e)); }
  };

  return (
    <div className="app">
      <header className="bar">
        <div className="bar__l">
          <span className="bar__year">{YEAR}</span>
          <span className="bar__title">活动留痕 · CO 记录生成器</span>
          <span className="bar__tag">方向② 暖·编辑 + 拓古材质(B)</span>
        </div>
        <div className="bar__r">
          <div className="seg" role="group" aria-label="变体">
            <button className={'seg__b' + (variant === 'editorial-rubbing' ? ' seg__b--on' : '')}
              onClick={() => setVariant('editorial-rubbing')}>B 暖·拓质</button>
            <button className={'seg__b' + (variant === 'tuogu-ink' ? ' seg__b--on' : '')}
              onClick={() => setVariant('tuogu-ink')}>A 全拓·墨</button>
          </div>
          <button className="btn" onClick={() => window.print()}>打印预览</button>
          <button className="btn btn--primary" onClick={doExport}>导出印刷 PDF ▸</button>
          <button className="btn btn--ghost" onClick={() => { setActivities(sampleActivities(YEAR)); setSel(null); }}>重置示例活动</button>
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
          {!sel && (
            <div className="panel__hint">
              点月历上任意一天 →<br />看那天在 CO 里做了什么。<br /><br />
              墨深 = 当日投入(4 档)· 留白 = 没活动<br />朱砂印 = 出版/里程碑。<br /><br />
              这是「渲染+导出组件」的预览台,<br />活动数据现用占位,真数据由 CO 喂入。
            </div>
          )}
          {sel && (
            <div className="editor">
              <div className="editor__date">
                {MONTHS_ZH[sel.m]} {sel.d} 日 <span className="editor__wk">周{WK[dow(YEAR, sel.m, sel.d)]}</span>
              </div>

              {selDay ? (
                <div className="fld">强度
                  <div className="lvl">
                    {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                      <span key={i} className={'lvl__b' + (i < selDay.level ? ' lvl__b--on' : '')} />
                    ))}
                    <span className="lvl__t">level {selDay.level} · 投入 {selDay.count}</span>
                  </div>
                </div>
              ) : (
                <div className="fld"><span className="muted">留白 —— 这天没有 CO 活动</span></div>
              )}

              {selMs && <div className="ms-tag"><span className="ms-tag__seal" />出版 / 里程碑:{selMs.label}</div>}

              {selActs.length > 0 && (
                <div className="fld">当天活动（{selActs.length}）
                  <ul className="acts">
                    {selActs.map((a) => (
                      <li key={a.id} className="acts__i">
                        <span className="acts__t">{TYPE_NAME[a.type] || a.type}</span>
                        <span className="acts__ttl">{a.title}</span>
                        <span className="acts__w">×{a.weight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button className="btn btn--ghost btn--sm editor__close" onClick={() => setSel(null)}>关闭</button>
            </div>
          )}

          <div className="legend">
            {model.categories.filter((c) => c.id !== 'publish').map((c) => (
              <span key={c.id} className="legend__i"><span className="legend__sw" style={{ background: c.color }} />{c.name}</span>
            ))}
            <span className="legend__i"><span className="legend__sw legend__sw--seal" />出版</span>
          </div>

          <div className="panel__foot">
            进 = CO 活动数组(占位)· 出 = 月历留痕 + 印刷 PDF · 屏幕系统字，导出换 OFL 嵌入款
          </div>
        </aside>
      </div>
    </div>
  );
}
