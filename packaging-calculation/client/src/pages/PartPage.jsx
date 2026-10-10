// The part page: 8 numbered sections, 3D on the left, data on the right.
// Sections 1 and 4–8 come from the selected calculation run (Phase 1, box engine).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import Section, { Facts, Planned } from '../components/Section.jsx';
import Viewer3D from '../components/Viewer3D.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { SHAPE_LABELS, num, partSummary } from '../format.js';
import PartSection from './part/PartSection.jsx';
import { ClusterSection, RunProgress, SettingsSection, CartonSection, PalletSection, ContainerSection, ResultSection, DownloadSection } from './part/RunSections.jsx';

const TABS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function PartPage() {
  const { projectId, partId } = useParams();
  const { t } = useI18n();
  const nav = useNavigate();
  const { session } = useAuth();
  const canEdit = session.user.role !== 'viewer';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(1);
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [saved, setSaved] = useState('');
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [sel, setSel] = useState(null);
  const [ctSel, setCtSel] = useState(null);

  const openRun = async (id) => {
    try {
      const r = await api.get(`/runs/${id}`);
      r.currency = session.org.settings?.currency || 'INR';
      setRun(r);
      if (r.status === 'done' && r.result) {
        setSel((cur) => (r.result.cartons.some((c) => c.id === cur) ? cur : r.lock?.cartonId || r.result.winner?.cartonId || r.result.cartons[0]?.id || null));
        setCtSel((cur) => cur || r.lock?.containerId || r.result.winner?.containerId || null);
      }
    } catch (e) { setError(e); }
  };
  const loadRuns = async (pick) => {
    try {
      const list = await api.get(`/runs/part/${partId}`);
      setRuns(list);
      const target = pick || list[0]?._id;
      if (target) openRun(target); else setRun(null);
    } catch (e) { setError(e); }
  };
  useEffect(() => { setRun(null); loadRuns(); }, [partId]);
  // Phase 3: while the selected run is queued or running, refresh it (and the run list) every 1.5 s.
  const busyRun = run && (run.status === 'queued' || run.status === 'running') ? run._id : null;
  useEffect(() => {
    if (!busyRun) return undefined;
    const t = setInterval(() => {
      openRun(busyRun);
      api.get(`/runs/part/${partId}`).then(setRuns).catch(() => {});
    }, 1500);
    return () => clearInterval(t);
  }, [busyRun]);
  // Keep the container choice valid when the carton changes.
  useEffect(() => {
    const c = run?.result?.cartons.find((x) => x.id === sel);
    if (c && !c.containers.some((k) => k.id === ctSel)) setCtSel(c.bestContainerId || c.containers[0]?.id);
  }, [sel, run]);

  const load = () => api.get(`/projects/${projectId}/parts`).then((d) => {
    setData(d);
    const p = d.parts.find((x) => x._id === partId);
    if (p) { setName(p.name); setGrams(String(Math.round(p.weightKg * 10000) / 10)); }
  }).catch(setError);
  useEffect(() => { load(); }, [projectId, partId]);

  // Highlight the tab of the section currently on screen.
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(Number(vis.target.id.replace('sec', '')));
    }, { rootMargin: '-120px 0px -60% 0px' });
    TABS.forEach((n) => { const el = document.getElementById(`sec${n}`); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [data]);

  const part = data?.parts.find((x) => x._id === partId);
  const scene = useMemo(() => (part ? partScene(part) : null), [part]);

  if (!data) return error ? <ErrorNotice error={error} /> : <p className="muted">Loading…</p>;
  if (!part) return <ErrorNotice error={{ message: 'Part not found in this project' }} />;

  const idx = data.parts.findIndex((x) => x._id === partId);
  const go = (d) => nav(`/projects/${projectId}/parts/${data.parts[idx + d]._id}`);
  const update = async (patch, label) => {
    setError(null);
    try { await api.put(`/parts/${part._id}`, patch); setSaved(label); load(); } catch (e) { setError(e); }
  };
  const box = part.box;

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/projects">{t('projects')}</Link> / <Link to={`/projects/${projectId}`}>{data.project.name}</Link> / <span>{part.name}</span>
      </nav>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="h1" style={{ overflowWrap: 'anywhere' }}>{part.name}</h1>
          <p className="muted mono" style={{ margin: '4px 0 0' }}>{data.project.name}{run ? ` · ${run.number}${run.status !== 'done' ? ` (${run.status})` : ''}` : ' · not calculated yet'}</p>
        </div>
        <div className="inline" style={{ gap: 8 }}>
          <button className="btn btn-ghost pager" disabled={idx <= 0} onClick={() => go(-1)} aria-label="Previous part">‹</button>
          <span className="muted">{idx + 1} {t('of')} {data.parts.length}</span>
          <button className="btn btn-ghost pager" disabled={idx >= data.parts.length - 1} onClick={() => go(1)} aria-label="Next part">›</button>
        </div>
      </div>

      <nav className="sec-tabs" aria-label="Sections">
        {TABS.map((n) => (
          <a key={n} href={`#sec${n}`} className={active === n ? 'on' : ''}
            onClick={(e) => { e.preventDefault(); document.getElementById(`sec${n}`).scrollIntoView({ behavior: 'smooth' }); }}>
            {t(`s${n}`)}
          </a>
        ))}
      </nav>
      <ErrorNotice error={error} />

      <div className="stack" style={{ gap: 20 }}>
        {/* 1 — Calculation settings */}
        <SettingsSection part={part} runs={runs} run={run} canEdit={canEdit} onPick={openRun} onRan={(r) => loadRuns(r._id)} />

        {/* 2 — Part */}
        <PartSection part={part} canEdit={canEdit} onChanged={load} />

        {/* 3 — Cluster */}
        <ClusterSection run={run} part={part} />

        {run?.status === 'done' ? <>
          <CartonSection run={run} sel={sel} setSel={setSel} part={part} />
          <PalletSection run={run} sel={sel} />
          <ContainerSection run={run} sel={sel} ctSel={ctSel} setCtSel={setCtSel} />
          <ResultSection key={run._id} run={run} sel={sel} canEdit={canEdit} onLocked={(lock) => { setRun({ ...run, lock }); setRuns(runs.map((x) => (x._id === run._id ? { ...x, lock } : x))); }} />
          <DownloadSection run={run} canEdit={canEdit} onShare={(on) => setRun({ ...run, shareOn: on })} />
        </> : [4, 5, 6, 7, 8].map((n) => (
          <Section key={n} n={n} id={`sec${n}`}>
            <div className="sec-pad-full">
              {!run && <p className="muted" style={{ margin: 0 }}>Run the calculation in section 1 to fill this section.</p>}
              {run && (run.status === 'queued' || run.status === 'running') && <RunProgress run={run} compact={n !== 4} />}
              {run && run.status === 'failed' && <p className="err" style={{ margin: 0 }}>{run.number} failed: {run.error}</p>}
              {run && run.status === 'cancelled' && <p className="muted" style={{ margin: 0 }}>{run.number} was cancelled. Pick another run in section 1 or run again.</p>}
            </div>
          </Section>
        ))}
      </div>
    </>
  );
}

// Part shape inside its bounding box (box sizes in mm; viewer axes x=L, y=H, z=W).
function partScene(part) {
  const { l, w, h } = part.box;
  const c = part.clearanceMm || 0;
  const body = { pos: [c, c, c], size: [l - 2 * c, h - 2 * c, w - 2 * c], color: '#8C98A8' };
  if (part.shape === 'circle') body.cylinder = true;
  if (part.shape === 'diamond') body.diamond = true;
  return {
    boxes: [
      body,
      { pos: [0, 0, 0], size: [l, h, w], wire: true, color: '#6C8EBF', layer: 'bbox' }
    ],
    label: SHAPE_LABELS[part.shape]
  };
}
