// Sections 1 and 4–8 of the part page, all driven by one calculation run.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { api, apiBase } from '../../api.js';
import { useAuth, useCan } from '../../auth.jsx';
import Section, { Facts } from '../../components/Section.jsx';
import Viewer3D from '../../components/Viewer3D.jsx';
import ErrorNotice from '../../components/ErrorNotice.jsx';
import { cartonScene, palletScene, containerScene } from '../../scenes.js';
import { money, num } from '../../format.js';

export const PRESETS = {
  quick: { label: 'Quick (10 s)', short: 'quick 10 s', max: '15 s' },
  standard: { label: 'Standard (60 s)', short: '60 s budget', max: '1.5 min' },
  thorough: { label: 'Thorough (6 min)', short: '6 min budget', max: '9 min' }
};

export function StatusBadge({ status }) {
  const cls = { queued: 'badge-grey', running: 'badge-blue', done: 'badge-green', failed: 'badge-orange', cancelled: 'badge-grey' }[status] || 'badge-grey';
  if (status === 'done') return null;
  return <span className={`badge ${cls}`}>{status}</span>;
}

/** Progress card shown in sections 4–8 while a run is queued or running. */
export function RunProgress({ run, compact }) {
  const [busy, setBusy] = useState(false);
  const pct = run.progress?.pct || 0;
  const cancel = async () => { setBusy(true); try { await api.post(`/runs/${run._id}/cancel`); } catch { /* finished meanwhile */ } };
  if (compact) return <p className="muted" style={{ margin: 0 }}>{run.number} is {run.status} — {pct}%. This section fills in when it is done.</p>;
  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <p style={{ margin: 0 }}><b>{run.number}</b> <StatusBadge status={run.status} /> <span className="muted">{run.progress?.step}</span></p>
      <div className="progress" role="progressbar" aria-label="Calculation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div style={{ width: `${pct}%`, background: 'var(--blue)' }} /></div>
      <div className="inline"><span className="muted" style={{ fontSize: 13 }}>{pct}% · you can leave this page — the calculation keeps running. See all on Running Jobs.</span>
        <button className="btn btn-ghost" style={{ minHeight: 36 }} disabled={busy || run.cancelRequested} onClick={cancel}>{busy || run.cancelRequested ? 'Cancelling…' : 'Cancel'}</button></div>
    </div>
  );
}

const d3 = (o) => `${num(o.l)}×${num(o.w)}×${num(o.h)}`;
const LIMIT = { weight: 'Weight', volume: 'Volume', height: 'Height', space: 'Space', stacking: 'Stacking setting' };

/* ---------- 1 · Calculation settings ---------- */
export function SettingsSection({ part, runs, run, onPick, onRan, canEdit }) {
  const [master, setMaster] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/cartons'), api.get('/pallets'), api.get('/containers')]).then(([cartons, pallets, containers]) => {
      setMaster({ cartons, pallets, containers });
      const prev = run?.inputs;
      setForm({
        cartonIds: prev?.cartonIds || cartons.map((c) => c._id),
        palletId: prev?.palletId || pallets.find((p) => p.name.startsWith('EUR'))?._id || pallets[0]?._id,
        containerIds: prev?.containerIds || containers.slice(0, 2).map((c) => c._id),
        optimiseHeight: (run?.result?.settings || run?.request?.settings)?.optimiseHeight ?? true,
        maxTiers: (run?.result?.settings || run?.request?.settings)?.maxTiers ?? 2,
        clearanceMm: (run?.result?.settings || run?.request?.settings)?.clearanceMm ?? 50,
        qty: (run?.result?.settings || run?.request?.settings)?.qty ?? 10000,
        preset: run?.preset && run.preset !== 'instant' ? run.preset : 'standard'
      });
    }).catch(setError);
  }, [run?._id]);

  const toggle = (key, id) => setForm({ ...form, [key]: form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id] });
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`/runs/part/${part._id}`, {
        cartonIds: form.cartonIds, palletId: form.palletId, containerIds: form.containerIds, preset: form.preset,
        settings: { optimiseHeight: form.optimiseHeight, maxTiers: Number(form.maxTiers), clearanceMm: Number(form.clearanceMm), qty: Number(form.qty) }
      });
      onRan(r);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const s = run?.result?.settings;

  return (
    <Section n={1} id="sec1" help="Each run freezes its settings and results. Old runs stay readable forever; loading one swaps every section below to that run's numbers — it never recomputes."
      left={<>
        <h3 className="sub">Runs for this part</h3>
        {!runs.length && <div className="run-empty">No runs yet. Choose the settings on the right and run the first calculation.</div>}
        <div className="stack" style={{ gap: 8 }}>
          {runs.map((r, i) => (
            <button key={r._id} className={`run-item${run?._id === r._id ? ' on' : ''}`} onClick={() => onPick(r._id)}>
              <span><b className="mono">{r.number}</b> {i === 0 && <span className="muted">latest</span>} <StatusBadge status={r.status} /> {r.lock?.at && <span className="badge badge-green">Locked</span>}</span>
              <span className="muted" style={{ fontSize: 13 }}>{new Date(r.createdAt).toLocaleString()} · {PRESETS[r.preset]?.short || 'instant'} · {r.used?.cartons?.length ?? r.inputs.cartonIds.length} carton(s){r.status === 'done' ? ` · ${r.durationMs ?? 0} ms` : ''}</span>
              {(r.status === 'queued' || r.status === 'running') && <span className="progress" style={{ width: '100%', marginTop: 4 }}><span style={{ display: 'block', height: '100%', width: `${r.progress?.pct || 0}%`, background: 'var(--blue)', borderRadius: 999 }} /></span>}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 14 }}>Old runs stay readable forever. Loading one swaps every module below to that run's frozen numbers — it never recomputes.</p>
      </>}
      right={<div className="stack">
        {run?.result && <Facts rows={[
          ['Packaging type', 'Pallet + carton'],
          ['Cartons', `${run.used.cartons.length} carton(s)`],
          ['Optimise carton height', s.optimiseHeight ? 'On' : 'Off'],
          ['Pallets', run.used.pallet],
          ['Containers', run.used.containers.join(' · ')],
          ['Stacking in container', `${s.maxTiers} high · ${s.clearanceMm} mm roof clearance`]
        ]} />}
        {canEdit && master && form && (
          <details className="run-form" open={!run}>
            <summary>{run ? 'Change settings and run again' : 'Settings for the first run'}</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <fieldset className="fs"><legend>Cartons</legend>
                {master.cartons.length ? <div className="chips">{master.cartons.map((c) => (
                  <label key={c._id} className="chip"><input type="checkbox" checked={form.cartonIds.includes(c._id)} onChange={() => toggle('cartonIds', c._id)} />{c.name}</label>
                ))}</div>
                  : <p className="notice" style={{ margin: 0 }}><span>There are no cartons yet, so there is nothing to pack into. Add at least one in <Link to="/cartons">Master data → Cartons</Link>, then come back here.</span></p>}
                {master.cartons.length > 0 && !form.cartonIds.length && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Tick at least one carton.</p>}
              </fieldset>
              <div className="field"><label htmlFor="rp">Pallet</label>
                <select id="rp" className="input" value={form.palletId} onChange={(e) => setForm({ ...form, palletId: e.target.value })}>
                  {master.pallets.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select></div>
              <fieldset className="fs"><legend>Containers</legend>
                <div className="chips">{master.containers.map((c) => (
                  <label key={c._id} className="chip"><input type="checkbox" checked={form.containerIds.includes(c._id)} onChange={() => toggle('containerIds', c._id)} />{c.name}</label>
                ))}</div>
              </fieldset>
              <div className="grid-fit">
                <div className="field"><label htmlFor="rt">Pallets stacked</label>
                  <select id="rt" className="input" value={form.maxTiers} onChange={(e) => setForm({ ...form, maxTiers: e.target.value })}>
                    <option value={1}>1 (no stacking)</option><option value={2}>2 high</option><option value={3}>3 high</option>
                  </select></div>
                <div className="field"><label htmlFor="rc">Roof clearance (mm)</label><input id="rc" className="input num" value={form.clearanceMm} onChange={(e) => setForm({ ...form, clearanceMm: e.target.value })} /></div>
                <div className="field"><label htmlFor="rq">Order quantity</label><input id="rq" className="input num" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
              </div>
              <label className="inline" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" checked={form.optimiseHeight} onChange={(e) => setForm({ ...form, optimiseHeight: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />Optimise carton height to the contents</label>
              <div className="field"><label htmlFor="pre">Preset</label>
                <select id="pre" className="input" value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })}>
                  {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                </select></div>
            </div>
          </details>
        )}
        <ErrorNotice error={error} />
        {canEdit && <div className="inline">
          <button className="btn btn-primary" onClick={start} disabled={busy || !form?.cartonIds.length || !form?.containerIds.length}>{busy ? 'Queuing…' : run ? 'Re-run calculation' : 'Run calculation'}</button>
          {form && <span className="muted" style={{ fontSize: 14 }}>Computing time <b>at most {PRESETS[form.preset].max}</b> — an upper bound; most runs finish sooner</span>}
        </div>}
      </div>} />
  );
}

/* ---------- 4 · Carton ---------- */
const ALGO_NAMES = { grid: 'Grid packing (box)', column: 'Column Stacking', pattern: 'Repeating Pattern', cluster: 'Cluster Packing', nested: 'Nested Clusters' };
const ms = (v) => (v == null ? '—' : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(1)} s`);

export function CartonSection({ run, sel, setSel, part }) {
  const r = run.result;
  const c = r.cartons.find((x) => x.id === sel);
  const [baseline, setBaseline] = useState(false);
  const [algo, setAlgo] = useState(null);
  useEffect(() => { setAlgo(null); }, [sel, run._id]);
  // Draw the real part when this run was made from the part's current CAD file (same box size).
  const b = run.result.part.box;
  const cad = !!part?.cad?.modelFile && part.box && Math.abs(part.box.l - b.l) < 0.01 && Math.abs(part.box.w - b.w) < 0.01 && Math.abs(part.box.h - b.h) < 0.01;
  const url = cad ? `${apiBase}/parts/${part._id}/model.glb?v=${new Date(part.cad.uploadedAt).getTime()}` : null;
  // Baseline = grid packing in the carton as entered. Optimized = chosen algorithm (default: the best);
  // the carton is shown trimmed only for the algorithm the trim was made for.
  const shown = baseline ? 'grid' : algo || c?.method || 'grid';
  const trimmedView = !baseline && shown === c?.method;
  const scene = useMemo(() => {
    if (!c) return null;
    if (shown === 'grid') return cartonScene(c, { baseline: !trimmedView, cad });
    return realScene(c, c.arrangements[shown], trimmedView);
  }, [c, shown, trimmedView, cad]);
  if (!c) return <Section n={4} id="sec4" left={<div className="sec-pad-full">
    <p style={{ marginTop: 0 }}><b>The part does not fit in any carton of this run</b>, so there is nothing to put on pallets or in containers (sections 5–7).</p>
    {r.skipped?.length > 0 && <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>{r.skipped.map((x) => <li key={x.id}><b>{x.name}</b>: {x.reason}</li>)}</ul>}
    <p className="muted" style={{ margin: 0 }}>Fix the carton in <Link to="/cartons">Master data → Cartons</Link> (sizes are inside dimensions in mm) or tick another carton in section 1, then run again.</p>
  </div>} right={null} />;
  const outer = trimmedView ? c.outer : c.baselineOuter;
  const inner = trimmedView ? c.inner : c.originalInner;
  const arr = shown === 'grid' ? null : c.arrangements[shown];
  const shownCount = shown === 'grid' ? c.algorithms.find((a) => a.id === 'grid').count : (arr.copies || arr.placements).length;
  const instances = !url ? null : shown === 'grid'
    ? { url, box: part.box, items: scene.items }
    : { url, box: part.box, matrices: scene.matrices };
  const rs = r.realShape;
  const isCad = r.part.shape === 'cad';

  return (
    <Section n={4} id="sec4" help="Each carton of the run, packed with every algorithm. The best quotable count is used for pallets, containers and cost. Optimized trims the carton height to the packed parts; Baseline shows grid packing in the carton as entered."
      left={<>
        <div className="viewer-bar">
          <div className="seg"><button aria-pressed={baseline} onClick={() => setBaseline(true)}>Baseline</button><button aria-pressed={!baseline} onClick={() => setBaseline(false)}>Optimized</button></div>
          <label className="field" style={{ gap: 2 }}><span className="muted" style={{ fontSize: 13 }}>View arrangement</span>
            <select className="input" style={{ minHeight: 36 }} disabled={baseline} value={shown} onChange={(e) => setAlgo(e.target.value)}>
              {c.algorithms.map((a) => <option key={a.id} value={a.id}>{a.name}{a.best ? ' ★' : ''}</option>)}
            </select></label>
        </div>
        <Viewer3D key={`${c.id}-${shown}-${trimmedView}`} boxes={scene.boxes} dims={scene.dims} fileName={`${r.part.name}-carton-${shown}`} instances={instances}
          caption={`${d3(outer)} mm outer · ${d3(inner)} mm inner · showing ${Math.min(shownCount, scene.shown ?? shownCount)} of ${shownCount}`}
          layers={[{ id: 'carton', label: 'Carton', on: true }, { id: 'inner', label: 'Carton (inner)', on: false }, { id: 'envelope', label: 'Packed envelope', on: false }]} />
      </>}
      right={<>
        <h3 className="sub">Results by carton</h3>
        <div className="table-wrap">
          <table className="table pick" style={{ minWidth: 640 }}>
            <thead><tr><th style={{ minWidth: 230 }}>Carton</th><th className="r">Count</th><th className="r">Weight</th><th className="r">Fill</th><th className="r">Cost / piece</th><th>Binding</th></tr></thead>
            <tbody>{r.cartons.map((x) => (
              <tr key={x.id} className={x.id === sel ? 'hl' : ''} onClick={() => setSel(x.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(x.id)}>
                <td><b>{d3(x.outer)} mm outer{x.trimmed ? ' (optimised)' : ''}</b><br /><span className="muted" style={{ fontSize: 12 }}>{x.name} · {ALGO_NAMES[x.method] || 'Grid packing (box)'} · {d3(x.inner)} inner{x.trimmed ? ` · was ${d3(x.baselineOuter)} outer` : ''}</span></td>
                <td className="mono r">{x.perCarton}</td>
                <td className="mono r" style={{ whiteSpace: 'nowrap' }}>{num(x.grossKg, 1)} kg</td>
                <td className="mono r">{x.fill}%</td>
                <td className="mono r">{money(x.costPerPiece, run.currency)}</td>
                <td>{x.binding}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>Ranked by cost per piece, so the top row is the cheapest way to ship this part. Click a row — the 3D on the left follows. Fill is how much of the carton's inner volume is part material.</p>
        <h3 className="sub" style={{ marginTop: 20 }}>Packing algorithm · {d3(c.outer)} mm outer</h3>
        {arr?.clusterIndex != null && <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>{ALGO_NAMES[shown]} uses cluster {arr.clusterIndex + 1} ({arr.piecesPerCluster} pieces) — see section 3.{arr.mixed && arr.singles > 0 ? ` The space left over is filled with ${arr.singles} single part${arr.singles === 1 ? '' : 's'}.` : ''}</p>}
        <table className="table pick">
          <thead><tr><th>Packing algorithm</th><th className="r">Count</th><th className="r">Compute</th></tr></thead>
          <tbody>
            {c.algorithms.map((a) => (
              <tr key={a.id} className={!baseline && a.id === shown ? 'hl' : ''} onClick={() => { setBaseline(false); setAlgo(a.id); }} tabIndex={0}>
                <td>{a.name} {a.best && <span title="Best quotable algorithm" style={{ color: 'var(--blue)' }}>★</span>} {a.nested && <span className="badge badge-blue">nested</span>}{a.rawCount > a.count && <span className="muted" style={{ fontSize: 12 }}> · {a.rawCount} fit, weight allows {a.count}</span>}</td>
                <td className="mono r">{a.count}</td><td className="mono r">{ms(a.computeMs)}</td>
              </tr>
            ))}
            {!isCad && ['Column Stacking', 'Repeating Pattern', 'Cluster Packing', 'Nested Clusters'].map((n) => <tr key={n} className="muted"><td>{n}</td><td colSpan={2} className="r" style={{ fontSize: 13 }}>needs a STEP file (section 2)</td></tr>)}
            {isCad && !c.arrangements?.column && <tr className="muted"><td colSpan={3} style={{ fontSize: 13 }}>Real-shape methods were not run{run.preset === 'quick' ? ' (Quick preset)' : ''}.</td></tr>}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 13 }}>★ marks the best quotable algorithm — the one whose count is quoted. Click a row to view its arrangement.
          {rs && <> Real-shape methods use a {rs.voxelMm} mm voxel model; copies never overlap and may touch.{rs.timedOut && ' Stopped at the time budget — a longer preset may find more.'}</>}</p>
        {r.realShapeError && <p className="notice" style={{ marginTop: 8 }}><span>{r.realShapeError}</span></p>}
      </>} />
  );
}

export function rowMajor34(r) {
  return new THREE.Matrix4().set(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], 0, 0, 0, 1);
}

/** Real-shape arrangement: carton boxes + one matrix per copy (from the CAD service). */
function realScene(c, arr, trimmed) {
  const wall = c.wallMm || 0;
  const inner = trimmed ? c.inner : c.originalInner;
  const outer = trimmed ? c.outer : c.baselineOuter;
  const boxes = [
    { pos: [0, 0, 0], size: [outer.l, outer.h, outer.w], color: '#9AA3AE', opacity: 0.18, edge: true, layer: 'carton' },
    { pos: [wall, wall, wall], size: [inner.l, inner.h, inner.w], wire: true, color: '#C98A2B', layer: 'inner' }
  ];
  // carton frame (X = length, Y = width, Z = up, mm) → viewer (x, y up, z) in metres
  const frame = new THREE.Matrix4().makeTranslation(0, 0, outer.w).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  const base = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001).multiply(frame).multiply(new THREE.Matrix4().makeTranslation(wall, wall, wall));
  const matrices = arr.copies
    // clusters: one exact 3×4 row-major matrix per piece
    ? arr.copies.map((r) => base.clone().multiply(rowMajor34(r)))
    : arr.placements.map((p) => {
      const Mpart = new THREE.Matrix4().fromArray(arr.matrix).transpose(); // service sends row-major
      return base.clone().multiply(new THREE.Matrix4().makeTranslation(p[0], p[1], p[2])).multiply(Mpart);
    });
  return { boxes, matrices, dims: { l: outer.l, w: outer.w, h: outer.h }, shown: matrices.length };
}

/* ---------- 3 · Cluster ---------- */
const PIECE_COLORS = ['#7B5BD6', '#2E8B6E', '#D9534F', '#3F7FD1', '#E39B2D', '#2BA3A3', '#8C98A8', '#B5462F'];

export function ClusterSection({ run, part }) {
  const r = run?.result;
  const list = r?.clusters;
  const [pick, setPick] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { setPick(0); }, [run?._id]);
  const cl = list?.[pick];
  const usedBy = (i) => (r?.cartons || []).filter((c) => c.method && c.arrangements?.[c.method]?.clusterIndex === i).map((c) => c.name);
  const cad = !!part?.cad?.modelFile && r && Math.abs(part.box.l - r.part.box.l) < 0.01;
  const url = cad ? `${apiBase}/parts/${part._id}/model.glb?v=${new Date(part.cad.uploadedAt).getTime()}` : null;
  const scene = useMemo(() => {
    if (!cl?.pieces) return null;
    const [L, W, H] = cl.size;
    const frame = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001)
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, W)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    return {
      boxes: [{ pos: [0, 0, 0], size: [L, H, W], wire: true, color: '#6C8EBF', layer: 'brick' }],
      items: cl.pieces.map((p, i) => ({ matrix: frame.clone().multiply(rowMajor34(p)), color: PIECE_COLORS[i % PIECE_COLORS.length] })),
      dims: { l: L, w: W, h: H }
    };
  }, [cl]);

  const empty = (msg) => <Section n={3} id="sec3"><p className="muted sec-pad-full" style={{ margin: 0 }}>{msg}</p></Section>;
  if (!run || run.status !== 'done') return empty('Run the calculation in section 1 to see clusters.');
  if (r.part.shape !== 'cad') return empty('Clusters need the real geometry: upload a STEP file in section 2, then run with the Standard or Thorough preset.');
  if (!list?.length) return empty(run.preset === 'quick' ? 'The Quick preset skips clusters. Run with Standard or Thorough.' : (r.realShapeError || 'No cluster packs denser than single parts. Turning this part gives the same shape or nothing that interlocks, so stacking (section 4) is the better method.'));
  const shownList = open ? list : list.slice(0, 1);

  return (
    <Section n={3} id="sec3" help="Copies of the part are turned 180° against each other and slid together until they touch, then packed as one unit. Fill = how much of the cluster's box is part material. vs. loose = how much more fits than the same pieces in their own boxes (100% = no gain)."
      left={scene && url
        ? <Viewer3D key={`${run._id}-${pick}`} boxes={scene.boxes} dims={scene.dims} pieces={{ url, items: scene.items }} fileName={`${r.part.name}-cluster-${pick + 1}`}
          caption="one colour per piece" layers={[{ id: 'brick', label: 'Cluster brick', on: true }]} />
        : <p className="muted">3D preview is available for the 12 best clusters.</p>}
      right={<>
        <h3 className="sub">Clusters of {r.part.name}</h3>
        <div className="table-wrap">
          <table className="table pick" style={{ minWidth: 600 }}>
            <thead><tr><th>Cluster</th><th className="r">Pcs</th><th>Size (mm)</th><th className="r">Fill</th><th className="r">vs. loose</th><th>Rotations</th><th>Used</th></tr></thead>
            <tbody>{shownList.map((x) => (
              <tr key={x.index} className={x.index === pick ? 'hl' : ''} onClick={() => setPick(x.index)} tabIndex={0}>
                <td>Cluster {x.index + 1}</td><td className="mono r">{x.pcs}</td>
                <td className="mono">{x.size.map((v) => num(v)).join(' × ')}</td>
                <td className="mono r">{x.fill != null ? `${x.fill}%` : '—'}</td>
                <td className="mono r" style={{ color: x.vsLoose > 100 ? 'var(--green)' : 'var(--muted)' }}>{x.vsLoose}%</td>
                <td>{x.label}</td>
                <td style={{ fontSize: 13 }}>{usedBy(x.index).join(', ') || <span className="muted">—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {list.length > 1 && <button className="linkbtn" style={{ color: 'var(--blue)', padding: '8px 0' }} onClick={() => setOpen(!open)}>{open ? '▾ Show only the best' : `▸ ${r.clustersConsidered - 1} more the engine considered`}</button>}
        <p className="muted" style={{ fontSize: 13 }}>Fill is how much of a cluster's own box is part material. "vs. loose" compares the cluster with the same pieces each in its own box — above 100% means grouping gains space. The best clusters are tried in every carton by Cluster Packing and Nested Clusters (section 4); nothing is discarded.</p>
        {r.realShape?.clusterVoxelMm && <p className="muted" style={{ fontSize: 13 }}>Clusters are built on a {r.realShape.clusterVoxelMm} mm voxel model; pieces never overlap and may touch.</p>}
      </>} />
  );
}

/* ---------- 5 · Pallet ---------- */
export function PalletSection({ run, sel }) {
  const r = run.result;
  const c = r.cartons.find((x) => x.id === sel);
  const scene = useMemo(() => c && palletScene(c, r.pallet), [c]);
  if (!c) return null;
  const P = r.pallet;
  return (
    <Section n={5} id="sec5" help="The pallet is flat, so 'inner' is the headroom above the deck up to the stack limit."
      left={<>
        <div className="viewer-bar"><b>{P.name}</b></div>
        <Viewer3D key={c.id} boxes={scene.boxes} dims={scene.dims} fileName={`${r.part.name}-pallet`}
          caption={`${c.pallet.perPallet} cartons · ${c.pallet.perLayer} per layer${c.pallet.layer.mixed ? ' (mixed directions)' : ''}`}
          layers={[{ id: 'loaded', label: 'Cartons', on: true }, { id: 'deck', label: 'Pallet deck', on: true }, { id: 'stack', label: 'Carton stack outline', on: false }, { id: 'limit', label: 'Stack limit', on: true }]} />
      </>}
      right={<>
        <h3 className="sub">This pallet</h3>
        <Facts rows={[
          ['Footprint (outer)', `${num(P.L)} × ${num(P.W)} mm`],
          ['Deck height', `${num(P.deckH)} mm`],
          ['Carton stack', `${num(scene.usedL)} × ${num(scene.usedW)} × ${num(c.pallet.stackH)} mm`],
          ['Loaded pallet', `${num(P.L)} × ${num(P.W)} × ${num(c.pallet.heightMm)} mm`],
          ['Stack limit', `${num(P.L)} × ${num(P.W)} × ${num(P.maxStackH - P.deckH)} mm (stack limit ${num(P.maxStackH)} − deck ${num(P.deckH)})`],
          ['Weight limit', `${num(P.maxLoadKg)} kg · tare ${num(P.weightKg)} kg`]
        ]} />
        <h3 className="sub" style={{ marginTop: 20 }}>This load</h3>
        <Facts rows={[
          ['Carton (outer)', `${d3(c.outer)} mm${c.trimmed ? ` · height cut from ${num(c.baselineOuter.h)} mm to fit the packed parts` : ''}`],
          ...(c.cartonLimitedBy === 'weight' ? [['Carton filled by', `Weight: ${c.perCarton} parts reach the carton's max. weight (${num(c.grossKg, 1)} kg packed). Check the part weight in section 2.`]] : []),
          ['Cartons per layer', `${c.pallet.perLayer}${c.pallet.layer.mixed ? ' · mixed directions' : ''}`],
          ['Pallet layers', c.pallet.layers],
          ['Cartons per pallet', c.pallet.perPallet],
          ['Pieces per pallet', <b key="p">{num(c.piecesPerPallet)}</b>],
          ['Load', `${num(c.pallet.loadKg ?? c.pallet.palletKg - (P.weightKg || 0), 1)} kg of ${num(P.maxLoadKg)} kg max. load`],
          ['Gross weight', `${num(c.pallet.palletKg, 1)} kg (load + ${num(P.weightKg || 0)} kg pallet)`],
          ['Pieces per carton', c.perCarton],
          ['Limited by', c.pallet.limitedBy === 'weight'
            ? `Weight: ${c.pallet.perPallet} × ${num(c.grossKg, 1)} kg cartons reach the ${num(P.maxLoadKg)} kg limit (space for ${c.pallet.perLayer * c.pallet.layers})`
            : LIMIT[c.pallet.limitedBy] || c.pallet.limitedBy]
        ]} />
      </>} />
  );
}

/* ---------- 6 · Container ---------- */
export function ContainerSection({ run, sel, ctSel, setCtSel }) {
  const r = run.result;
  const c = r.cartons.find((x) => x.id === sel);
  const ct = c?.containers.find((k) => k.id === ctSel) || c?.containers[0];
  const scene = useMemo(() => c && ct && containerScene(c, ct, r.pallet), [c, ct]);
  if (!c || !ct) return null;
  return (
    <Section n={6} id="sec6" help="Pallets are placed on the floor, then stacked as many tiers high as fit under the roof minus the clearance, up to the run's stacking setting."
      left={<>
        <div className="viewer-bar">
          <label className="field" style={{ gap: 2 }}><span className="muted" style={{ fontSize: 13 }}>Container type</span>
            <select className="input" style={{ minHeight: 36 }} value={ct.id} onChange={(e) => setCtSel(e.target.value)}>
              {c.containers.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select></label>
        </div>
        <Viewer3D key={`${c.id}-${ct.id}`} boxes={scene.boxes} dims={scene.dims} fileName={`${r.part.name}-${ct.name}`} height={380}
          caption={`${ct.pallets} loaded pallets drawn · limited by ${(LIMIT[ct.limitedBy] || '').toLowerCase()}`}
          layers={[{ id: 'pallets', label: 'Pallets', on: true }, { id: 'stack', label: 'Loaded stack outline', on: false }, { id: 'space', label: 'Load space', on: true }, { id: 'shell', label: 'Container', on: true }]} />
      </>}
      right={<>
        <h3 className="sub">This container</h3>
        <Facts rows={[
          ['Inner size', `${d3(ct.inner)} mm`],
          ['Load space', `${num(ct.inner.l)} × ${num(ct.inner.w)} × ${num(ct.loadH)} mm (inner height ${num(ct.inner.h)} − clearance ${num(r.settings.clearanceMm)})`],
          ['Loaded stack', `${num(scene.stackL)} × ${num(scene.stackW)} × ${num(c.pallet.heightMm * ct.tiers)} mm`],
          ['Pallets per floor layer', `${ct.perFloorLayer}${ct.floor.mixed ? ' · lengthwise and crosswise' : ''}`],
          ['Pallets stacked', `${ct.tiers} · loaded pallet ${num(c.pallet.heightMm)} mm`],
          ['Pallets loaded', <span key="pl"><b>{ct.pallets}</b> {ct.limitedBy === 'stacking'
            ? `· limited by the stacking setting (${ct.tiers} high); the height has room for ${ct.tiersRoomFor}. Change "Pallets stacked" in section 1 to load more.`
            : `${LIMIT[ct.limitedBy]}-bound`}</span>],
          ['Weight', `${num(ct.kg)} kg of ${num(ct.payloadKg)} kg`]
        ]} />
        <h3 className="sub" style={{ marginTop: 20 }}>Containers in this run</h3>
        <table className="table pick">
          <thead><tr><th>Container</th><th className="r">Pallets</th><th className="r">Pieces</th><th className="r">Cost / piece</th></tr></thead>
          <tbody>{c.containers.map((k) => (
            <tr key={k.id} className={k.id === ct.id ? 'hl' : ''} onClick={() => setCtSel(k.id)} tabIndex={0}>
              <td>{k.name} {k.recommended && <span className="badge badge-green">Recommended</span>}</td>
              <td className="mono r">{k.pallets}</td><td className="mono r"><b>{num(k.pieces)}</b></td><td className="mono r">{money(k.costPerPiece, run.currency)}</td>
            </tr>
          ))}</tbody>
        </table>
      </>} />
  );
}

/* ---------- 7 · Result ---------- */
export function ResultSection({ run, sel, onLocked, canEdit }) {
  const r = run.result;
  const c = r.cartons.find((x) => x.id === sel) || r.cartons[0];
  const best = c?.containers.find((k) => k.recommended);
  const [form, setForm] = useState({ cartonId: run.lock?.cartonId || r.winner?.cartonId || '', containerId: run.lock?.containerId || r.winner?.containerId || '', reason: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const rows = r.cartons.flatMap((x) => x.containers.map((k) => ({ x, k }))).sort((a, b) => (a.k.costPerPiece ?? 1e12) - (b.k.costPerPiece ?? 1e12));
  const formCarton = r.cartons.find((x) => x.id === form.cartonId);
  const locked = run.lock?.at;

  const lock = async () => {
    setBusy(true); setError(null);
    try { const res = await api.post(`/runs/${run._id}/lock`, { ...form, algorithm: formCarton?.method || 'grid' }); onLocked(res.lock); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  if (!c) return null;

  return (
    <Section n={7} id="sec7" help="The numbers you quote (ERP numbers) and the decision you lock in. A locked result cannot be changed; run again to compare new settings.">
      <div className="sec-pad-full">
        <h3 className="sub">ERP numbers</h3>
        <label className="check" style={{ maxWidth: 560, marginBottom: 16 }}>
          <input type="checkbox" checked={r.settings.optimiseHeight} readOnly disabled />
          <span><b style={{ display: 'block' }}>Carton height optimised to the contents</b><span className="muted" style={{ fontSize: 13 }}>{c.trimmed ? `${num(c.baselineOuter.h)} → ${num(c.outer.h)} mm outer` : 'no change for this carton'}</span></span>
        </label>
        <div className="erp">
          <div><span>Carton</span><b>{d3(c.outer)} mm outer{c.trimmed ? ' (optimised)' : ''}</b></div>
          <div><span>Pieces per carton</span><b>{num(c.perCarton)}</b></div>
          <div><span>Pieces / pallet</span><b>{num(c.piecesPerPallet)}</b></div>
          <div><span>Pallets per container</span><b>{best ? best.pallets : '—'}</b></div>
        </div>
        <table className="table" style={{ maxWidth: 760 }}>
          <thead><tr><th>Container</th><th className="r">Pieces</th><th className="r">Cost / piece</th><th className="r">For {num(r.settings.qty)} pcs</th></tr></thead>
          <tbody>{c.containers.map((k) => (
            <tr key={k.id}><td>{k.name} {k.recommended && <span className="badge badge-green">Recommended</span>}</td><td className="mono r">{num(k.pieces)}</td><td className="mono r">{money(k.costPerPiece, run.currency)}</td><td className="mono r">{k.containersNeeded ?? '—'} container(s)</td></tr>
          ))}</tbody>
        </table>

        <h3 className="sub" style={{ marginTop: 24 }}>By carton and container</h3>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 820 }}>
            <thead><tr><th>Carton</th><th>Container</th><th className="r">Pallet layers</th><th className="r">Per pallet</th><th className="r">Per container</th><th>Limited by</th><th className="r">Cost / piece ▲</th></tr></thead>
            <tbody>{rows.map(({ x, k }) => (
              <tr key={x.id + k.id}><td>{d3(x.outer)} mm outer{x.trimmed ? ' (optimised)' : ''} <span className="muted">· {x.name}</span></td><td>{k.name}</td><td className="mono r">{x.pallet.layers}</td><td className="mono r"><b>{num(x.piecesPerPallet)}</b></td><td className="mono r"><b>{num(k.pieces)}</b></td><td>{LIMIT[k.limitedBy]}</td><td className="mono r">{money(k.costPerPiece, run.currency)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        {c.trimmed && <><h3 className="sub" style={{ marginTop: 20 }}>Notes</h3><ul className="muted" style={{ fontSize: 14, margin: 0 }}><li>carton height optimised to the packed contents — piece counts unchanged</li></ul></>}

        <div style={{ borderTop: '1px solid var(--line)', marginTop: 24, paddingTop: 20 }}>
          <h3 className="sub">Confirm winner</h3>
          {locked ? (
            <p className="notice" style={{ background: 'var(--green-soft)', borderColor: '#B7DCC6' }}>
              <span>✓ <b>Locked</b> by {run.lock.byName} on {new Date(run.lock.at).toLocaleString()}: {r.cartons.find((x) => x.id === run.lock.cartonId)?.name}, {r.pallet.name}, {r.cartons.find((x) => x.id === run.lock.cartonId)?.containers.find((k) => k.id === run.lock.containerId)?.name}, {ALGO_NAMES[run.lock.algorithm] || 'Grid packing (box)'}.{run.lock.reason && <> Reason: “{run.lock.reason}”</>}</span>
            </p>
          ) : (
            <div className="stack">
              <div className="grid-fit" style={{ maxWidth: 900 }}>
                <div className="field"><label htmlFor="wc">Carton</label><select id="wc" className="input" disabled={!canEdit} value={form.cartonId} onChange={(e) => { const x = r.cartons.find((y) => y.id === e.target.value); setForm({ ...form, cartonId: e.target.value, containerId: x?.bestContainerId || '' }); }}>{r.cartons.map((x) => <option key={x.id} value={x.id}>{x.name} · {d3(x.outer)}</option>)}</select></div>
                <div className="field"><label htmlFor="wp">Pallet</label><select id="wp" className="input" disabled><option>{r.pallet.name}</option></select></div>
                <div className="field"><label htmlFor="wk">Container</label><select id="wk" className="input" disabled={!canEdit} value={form.containerId} onChange={(e) => setForm({ ...form, containerId: e.target.value })}>{formCarton?.containers.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></div>
                <div className="field"><label htmlFor="wa">Packing algorithm</label><select id="wa" className="input" disabled><option>{ALGO_NAMES[formCarton?.method] || 'Grid packing (box)'}</option></select></div>
              </div>
              <div className="field" style={{ maxWidth: 900 }}><label htmlFor="wr">Reason</label><textarea id="wr" className="input" rows={3} style={{ padding: 10 }} disabled={!canEdit} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <ErrorNotice error={error} />
              {canEdit && <div><button className="btn btn-blue" style={{ background: 'var(--blue)', color: '#fff' }} disabled={busy || !form.cartonId || !form.containerId} onClick={lock}>Confirm and lock this result</button></div>}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

/* ---------- 8 · Download ---------- */
export function DownloadSection({ run, onShare, canEdit }) {
  const can = useCan();
  const { session } = useAuth();
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const base = (import.meta.env.VITE_API_URL || '') + '/api';
  const link = `${window.location.origin}/s/${run.shareToken}`;
  const toggle = async () => {
    setError(null);
    try { const r = await api.post(`/runs/${run._id}/share`, { on: !run.shareOn }); onShare(r.shareOn); } catch (e) { setError(e); }
  };
  return (
    <Section n={8} id="sec8" help="The PDF is the record of this run. The share link is printed in it but serves nothing until you switch it on.">
      <div className="sec-pad-full">
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
          <a className="btn" href={`${base}/runs/${run._id}/pdf`} target="_blank" rel="noreferrer">Download PDF</a>
        </div>
        <h3 className="sub" style={{ marginTop: 16 }}>Share link</h3>
        <p className="muted" style={{ marginTop: 0 }}>One read-only link to this calculation. Anyone who opens it sees the same numbers you do — including freight cost — but cannot change anything or start a calculation.</p>
        <h4 style={{ margin: '0 0 4px' }}>{run.shareOn ? 'Shared' : 'Not shared'}</h4>
        <p className="muted" style={{ marginTop: 0 }}>{run.shareOn ? 'Anyone with the link can open it now.' : 'This link is printed in the PDF but serves nothing until you switch it on. Sending the PDF is sending the link.'}</p>
        <div className="inline" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span className="mono" style={{ overflowWrap: 'anywhere', fontSize: 14 }}>{link}</span>
          <button className="btn btn-ghost" style={{ minHeight: 36 }} onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); }}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        <ErrorNotice error={error} />
        {canEdit && (can('shareLinks')
          ? <button className={`btn ${run.shareOn ? 'btn-ghost' : 'btn-primary'}`} style={{ marginTop: 12, ...(run.shareOn ? {} : { background: 'var(--blue)', borderColor: 'var(--blue)' }) }} onClick={toggle}>{run.shareOn ? 'Stop sharing' : 'Share this calculation'}</button>
          : <p className="muted" style={{ fontSize: 13 }}>Share links are included in the Business plan (you are on {session.entitlements.label}).</p>)}
      </div>
    </Section>
  );
}
