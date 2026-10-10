// Section 2 · Part — the geometry everything below is computed from.
// A part is either typed sizes (box, circle…) or an uploaded STEP / STL file analysed by the CAD service.
import { useEffect, useMemo, useState } from 'react';
import { api, apiBase } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import Section, { Facts } from '../../components/Section.jsx';
import Viewer3D from '../../components/Viewer3D.jsx';
import ErrorNotice from '../../components/ErrorNotice.jsx';
import { num, partSummary } from '../../format.js';

export default function PartSection({ part, canEdit, onChanged }) {
  const { t } = useI18n();
  const [materials, setMaterials] = useState([]);
  const [name, setName] = useState(part.name);
  const [grams, setGrams] = useState('');
  const [materialId, setMaterialId] = useState(part.materialId || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => { api.get('/materials').then(setMaterials).catch(() => {}); }, []);
  useEffect(() => {
    setName(part.name);
    setGrams(String(Math.round(part.weightKg * 10000) / 10));
    setMaterialId(part.materialId || '');
  }, [part._id, part.weightKg, part.materialId, part.name]);

  const box = part.box;
  const cad = part.shape === 'cad' && part.cad?.modelFile;
  const modelUrl = cad ? `${apiBase}/parts/${part._id}/model.glb?v=${new Date(part.cad.uploadedAt).getTime()}` : null;
  const material = materials.find((m) => m._id === part.materialId);

  const boxes = useMemo(() => {
    const wire = { pos: [0, 0, 0], size: [box.l, box.h, box.w], wire: true, color: '#6C8EBF', layer: 'bbox' };
    if (cad) return [wire];
    const body = { pos: [0, 0, 0], size: [box.l, box.h, box.w], color: '#8C98A8' };
    if (part.shape === 'circle') body.cylinder = true;
    if (part.shape === 'diamond') body.diamond = true;
    return [body, wire];
  }, [part]);

  const run = async (label, fn) => {
    setBusy(label); setError(null); setMsg('');
    try { await fn(); setMsg(label); onChanged(); } catch (e) { setError(e); } finally { setBusy(''); }
  };
  const save = (patch, label) => run(label, () => api.put(`/parts/${part._id}`, patch));
  const uploadFile = (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return run('3D file analysed', () => api.upload(`/parts/${part._id}/cad`, fd));
  };

  const facts = cad ? [
    ['Volume', part.volumeMm3 ? `${num(part.volumeMm3 / 1000, 1)} cm³` : 'unknown (not a closed solid)'],
    ['Bounding box', `${num(box.l, 1)} × ${num(box.w, 1)} × ${num(box.h, 1)} mm`],
    ['Surface', `${num(part.cad.areaMm2 / 100, 1)} cm²`],
    ['Triangles', num(part.cad.triangles)],
    ['Watertight', part.cad.watertight ? 'Yes' : 'No — volume and fill may be off'],
    ['Solids', part.cad.solids],
    ['Format', part.cad.format],
    ['Weight', `${num(part.weightKg * 1000, 1)} g (${part.weightSource === 'material' ? `${material?.name || 'material'} · ${material?.densityGcm3 ?? '?'} g/cm³` : 'manual'})`],
    ['Packing position', part.cad.orientation === 'rotated' ? 'Turned to its tightest box' : 'As drawn — already the best position found'],
    ['Uploaded file', `${part.cad.fileName} · ${num(part.cad.sizeBytes / 1024, 0)} KB`]
  ] : [
    ['Shape', partSummary(part)],
    ['Bounding box', `${num(box.l, 1)} × ${num(box.w, 1)} × ${num(box.h, 1)} mm`],
    ['Volume', part.volumeMm3 ? `${num(part.volumeMm3 / 1000, 1)} cm³` : `${num((box.l * box.w * box.h) / 1000, 1)} cm³ (box)`],
    ['Weight', `${num(part.weightKg * 1000, 1)} g (${part.weightSource === 'material' ? material?.name || 'material' : 'manual'})`],
    ['Packing position', part.upright ? 'Upright only — turns on the floor' : 'Any orientation'],
    ['Format', 'Entered by hand']
  ];

  return (
    <Section n={2} id="sec2" help="Upload a STEP or STL file to use the real geometry. The engine still packs the part's bounding box in this version; real-shape packing comes in Phase 4."
      left={<Viewer3D key={modelUrl || part._id} boxes={boxes} dims={{ l: box.l, w: box.w, h: box.h }} fileName={part.name}
        model={cad ? { url: modelUrl, box } : null}
        layers={[{ id: 'bbox', label: t('boundingBox'), on: true }]}
        caption={cad ? `${num(part.cad.triangles)} triangles` : null} />}
      right={<div className="stack">
        <div className="field"><label htmlFor="pn">Name</label>
          <div className="inline" style={{ flexWrap: 'nowrap' }}>
            <input id="pn" className="input" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-ghost" disabled={!canEdit || !name.trim() || name === part.name} onClick={() => save({ name }, 'Name saved')}>Save</button>
          </div></div>
        <div className="field"><label htmlFor="mat">Material</label>
          <div className="inline" style={{ flexWrap: 'nowrap' }}>
            <select id="mat" className="input" value={materialId} disabled={!canEdit} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">— none —</option>
              {materials.map((m) => <option key={m._id} value={m._id}>{m.name} · {m.densityGcm3} g/cm³</option>)}
            </select>
            <button className="btn btn-ghost" disabled={!canEdit || !materialId || (materialId === part.materialId && part.weightSource === 'material')}
              onClick={() => save({ materialId, weightSource: 'material' }, 'Weight from material')}>Use</button>
          </div></div>
        <div className="field"><label htmlFor="mw">Manual weight (g)</label>
          <div className="inline" style={{ flexWrap: 'nowrap', maxWidth: 320 }}>
            <input id="mw" className="input num" inputMode="decimal" value={grams} disabled={!canEdit} onChange={(e) => setGrams(e.target.value)} />
            <button className="btn btn-primary" disabled={!canEdit || !(Number(grams) > 0)} onClick={() => save({ weight: Number(grams) / 1000, weightUnit: 'kg', weightSource: 'manual' }, 'Weight set')}>Set</button>
          </div></div>
        {(msg || busy) && <p className="muted" role="status" style={{ margin: 0, fontSize: 13 }}>{busy ? `${busy}…` : `✓ ${msg}`}</p>}
        <ErrorNotice error={error} />
        <Facts rows={facts} />
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Bounding box shown at {num(box.l, 1)} × {num(box.w, 1)} × {num(box.h, 1)} mm.</p>
        <div className="inline">
          {canEdit && (
            <label className="btn btn-blue" style={{ background: 'var(--blue)', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>
              {cad ? 'Replace STEP file' : 'Upload STEP file'}
              <input type="file" accept=".step,.stp,.stl" hidden disabled={!!busy} onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])} />
            </label>
          )}
          {cad && <a className="btn btn-ghost" href={`${apiBase}/parts/${part._id}/source`}>Download {part.cad.format}</a>}
        </div>
        {cad && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Runs made before a new upload keep their old numbers; run the calculation again to use the new file.</p>}
      </div>} />
  );
}
