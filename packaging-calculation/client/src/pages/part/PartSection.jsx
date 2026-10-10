// Section 2 · Part — the geometry everything below is computed from.
import React, { useEffect, useMemo, useState } from 'react';
import { api, apiBase } from '../../api.js';
import { useI18n } from '../../i18n.jsx';
import StationCard from '../../components/packing-line/StationCard.jsx';
import ViewerStage from '../../components/packing-line/ViewerStage.jsx';
import SpecList from '../../components/packing-line/SpecList.jsx';
import ErrorNotice from '../../components/ErrorNotice.jsx';
import { num, partSummary } from '../../format.js';
import { Upload, Download, Check, Save } from 'lucide-react';

export default function PartSection({ part, canEdit, onChanged }) {
  const { t } = useI18n();
  const [materials, setMaterials] = useState([]);
  const [name, setName] = useState(part.name);
  const [grams, setGrams] = useState('');
  const [materialId, setMaterialId] = useState(part.materialId || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/materials').then(setMaterials).catch(() => {});
  }, []);

  useEffect(() => {
    setName(part.name);
    setGrams(String(Math.round(part.weightKg * 10000) / 10));
    setMaterialId(part.materialId || '');
  }, [part._id, part.weightKg, part.materialId, part.name]);

  const box = part.box;
  const cad = part.shape === 'cad' && part.cad?.modelFile;
  const modelUrl = cad
    ? `${apiBase}/parts/${part._id}/model.glb?v=${new Date(part.cad.uploadedAt).getTime()}`
    : null;
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
    setBusy(label);
    setError(null);
    setMsg('');
    try {
      await fn();
      setMsg(label);
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };

  const save = (patch, label) => run(label, () => api.put(`/parts/${part._id}`, patch));

  const uploadFile = (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return run('3D file analysed', () => api.upload(`/parts/${part._id}/cad`, fd));
  };

  const facts = cad
    ? [
        ['Volume', part.volumeMm3 ? `${num(part.volumeMm3 / 1000, 1)} cm³` : 'unknown (not a closed solid)'],
        ['Bounding box', `${num(box.l, 1)} × ${num(box.w, 1)} × ${num(box.h, 1)} mm`],
        ['Surface', `${num(part.cad.areaMm2 / 100, 1)} cm²`],
        ['Triangles', num(part.cad.triangles)],
        ['Watertight', part.cad.watertight ? 'Yes' : 'No — volume and fill may be off'],
        ['Solids', part.cad.solids],
        ['Format', part.cad.format],
        [
          'Weight',
          `${num(part.weightKg * 1000, 1)} g (${
            part.weightSource === 'material'
              ? `${material?.name || 'material'} · ${material?.densityGcm3 ?? '?'} g/cm³`
              : 'manual'
          })`
        ],
        ['Packing position', part.cad.orientation === 'rotated' ? 'Turned to its tightest box' : 'As drawn — already the best position found'],
        ['Uploaded file', `${part.cad.fileName} · ${num(part.cad.sizeBytes / 1024, 0)} KB`]
      ]
    : [
        ['Shape', partSummary(part)],
        ['Bounding box', `${num(box.l, 1)} × ${num(box.w, 1)} × ${num(box.h, 1)} mm`],
        ['Volume', part.volumeMm3 ? `${num(part.volumeMm3 / 1000, 1)} cm³` : `${num((box.l * box.w * box.h) / 1000, 1)} cm³ (box)`],
        ['Weight', `${num(part.weightKg * 1000, 1)} g (${part.weightSource === 'material' ? material?.name || 'material' : 'manual'})`],
        ['Packing position', part.upright ? 'Upright only — turns on the floor' : 'Any orientation'],
        ['Format', 'Entered by hand']
      ];

  return (
    <StationCard
      n={2}
      id="sec2"
      title="Part"
      subtitle="Physical geometry and material properties"
      help="Upload a STEP or STL file to use the real geometry. The engine calculates volume, surfaces, watertight topology, and optimal bounding box."
      left={
        <ViewerStage
          key={modelUrl || part._id}
          boxes={boxes}
          dims={{ l: box.l, w: box.w, h: box.h }}
          fileName={part.name}
          model={cad ? { url: modelUrl, box } : null}
          layers={[{ id: 'bbox', label: t('boundingBox') || 'Bounding box', on: true }]}
          caption={cad ? `${num(part.cad.triangles)} triangles · CAD Analysis` : `${partSummary(part)}`}
        />
      }
      right={
        <div className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label htmlFor="pn" style={{ fontSize: 13, fontWeight: 600 }}>Name</label>
            <div className="inline" style={{ flexWrap: 'nowrap' }}>
              <input
                id="pn"
                className="input"
                value={name}
                disabled={!canEdit}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!canEdit || !name.trim() || name === part.name}
                onClick={() => save({ name }, 'Name saved')}
              >
                <Save size={14} />
                Save
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="mat" style={{ fontSize: 13, fontWeight: 600 }}>Material</label>
            <div className="inline" style={{ flexWrap: 'nowrap' }}>
              <select
                id="mat"
                className="input"
                value={materialId}
                disabled={!canEdit}
                onChange={(e) => setMaterialId(e.target.value)}
              >
                <option value="">— none —</option>
                {materials.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} · {m.densityGcm3} g/cm³
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!canEdit || !materialId || (materialId === part.materialId && part.weightSource === 'material')}
                onClick={() => save({ materialId, weightSource: 'material' }, 'Weight from material')}
              >
                Use
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="mw" style={{ fontSize: 13, fontWeight: 600 }}>Manual weight (g)</label>
            <div className="inline" style={{ flexWrap: 'nowrap', maxWidth: 320 }}>
              <input
                id="mw"
                className="input num"
                inputMode="decimal"
                value={grams}
                disabled={!canEdit}
                onChange={(e) => setGrams(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canEdit || !(Number(grams) > 0)}
                onClick={() => save({ weight: Number(grams) / 1000, weightUnit: 'kg', weightSource: 'manual' }, 'Weight set')}
              >
                Set
              </button>
            </div>
          </div>

          {(msg || busy) && (
            <p className="muted" role="status" style={{ margin: 0, fontSize: 13, color: 'var(--sh-primary)' }}>
              {busy ? `${busy}…` : `✓ ${msg}`}
            </p>
          )}

          <ErrorNotice error={error} />

          <div style={{ marginTop: 8 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sh-muted)' }}>
              Geometry Specifications
            </h4>
            <SpecList rows={facts} />
          </div>

          <div className="inline" style={{ marginTop: 8, gap: 8 }}>
            {canEdit && (
              <label className="btn btn-ghost" style={{ cursor: 'pointer', minHeight: 38 }}>
                <Upload size={14} />
                <span>{cad ? 'Replace STEP file' : 'Upload STEP / STL'}</span>
                <input
                  type="file"
                  accept=".step,.stp,.stl"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadFile(e.target.files[0]);
                  }}
                />
              </label>
            )}

            {cad && (
              <a
                className="btn btn-ghost"
                href={`${apiBase}/parts/${part._id}/model.step`}
                download={`${part.name}.step`}
                style={{ minHeight: 38 }}
              >
                <Download size={14} />
                <span>Download STEP</span>
              </a>
            )}
          </div>
        </div>
      }
    />
  );
}
