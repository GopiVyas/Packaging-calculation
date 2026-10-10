// The Part Page: "The Packing Line" production workflow redesign
// Assembling all 8 stations with sticky LineRail and sticky KpiRibbon
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { SHAPE_LABELS, num, partSummary } from '../format.js';
import LineRail from '../components/packing-line/LineRail.jsx';
import KpiRibbon from '../components/packing-line/KpiRibbon.jsx';
import StationCard from '../components/packing-line/StationCard.jsx';
import PartSection from './part/PartSection.jsx';
import {
  ClusterSection,
  RunProgress,
  SettingsSection,
  CartonSection,
  PalletSection,
  ContainerSection,
  ResultSection,
  DownloadSection
} from './part/RunSections.jsx';
import { ChevronLeft, ChevronRight, Layers, Package } from 'lucide-react';

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
        setSel((cur) =>
          r.result.cartons.some((c) => c.id === cur)
            ? cur
            : r.lock?.cartonId || r.result.winner?.cartonId || r.result.cartons[0]?.id || null
        );
        setCtSel((cur) => cur || r.lock?.containerId || r.result.winner?.containerId || null);
      }
    } catch (e) {
      setError(e);
    }
  };

  const loadRuns = async (pick) => {
    try {
      const list = await api.get(`/runs/part/${partId}`);
      setRuns(list);
      const target = pick || list[0]?._id;
      if (target) openRun(target);
      else setRun(null);
    } catch (e) {
      setError(e);
    }
  };

  useEffect(() => {
    setRun(null);
    loadRuns();
  }, [partId]);

  // While run is queued or running, refresh every 1.5s
  const busyRun = run && (run.status === 'queued' || run.status === 'running') ? run._id : null;
  useEffect(() => {
    if (!busyRun) return undefined;
    const interval = setInterval(() => {
      openRun(busyRun);
      api.get(`/runs/part/${partId}`).then(setRuns).catch(() => {});
    }, 1500);
    return () => clearInterval(interval);
  }, [busyRun]);

  // Keep container choice valid when carton changes
  useEffect(() => {
    const c = run?.result?.cartons.find((x) => x.id === sel);
    if (c && !c.containers.some((k) => k.id === ctSel)) {
      setCtSel(c.bestContainerId || c.containers[0]?.id);
    }
  }, [sel, run]);

  const load = () =>
    api
      .get(`/projects/${projectId}/parts`)
      .then((d) => {
        setData(d);
        const p = d.parts.find((x) => x._id === partId);
        if (p) {
          setName(p.name);
          setGrams(String(Math.round(p.weightKg * 10000) / 10));
        }
      })
      .catch(setError);

  useEffect(() => {
    load();
  }, [projectId, partId]);

  // Scroll-spy intersection observer to highlight current station in LineRail
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(Number(vis.target.id.replace('sec', '')));
      },
      { rootMargin: '-120px 0px -55% 0px' }
    );
    TABS.forEach((n) => {
      const el = document.getElementById(`sec${n}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [data, run]);

  const scrollToStation = (n) => {
    const el = document.getElementById(`sec${n}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActive(n);
    }
  };

  const completedStations = useMemo(() => {
    const completed = [2]; // Part geometry is always defined
    if (run) completed.push(1); // Settings configured
    if (run?.status === 'done') {
      completed.push(3, 4, 5, 6);
      if (run.lock?.at) completed.push(7);
      if (run.shareOn) completed.push(8);
    }
    return completed;
  }, [run]);

  const part = data?.parts.find((x) => x._id === partId);

  if (!data) return error ? <ErrorNotice error={error} /> : <p className="muted">Loading packaging workspace…</p>;
  if (!part) return <ErrorNotice error={{ message: 'Part not found in this project' }} />;

  const idx = data.parts.findIndex((x) => x._id === partId);
  const go = (d) => nav(`/projects/${projectId}/parts/${data.parts[idx + d]._id}`);

  return (
    <>
      {/* Sticky KPI Ribbon */}
      <KpiRibbon partName={part.name} run={run} selCartonId={sel} />

      {/* Page Header with Breadcrumb and Pager */}
      <div className="sh-page-header">
        <nav className="sh-crumbs" aria-label="Breadcrumb">
          <Link to="/projects">{t('projects') || 'Projects'}</Link>
          <span>/</span>
          <Link to={`/projects/${projectId}`}>{data.project.name}</Link>
          <span>/</span>
          <span className="current">{part.name}</span>
        </nav>

        <div className="sh-header-row">
          <div className="sh-title-box">
            <h1>{part.name}</h1>
            <div className="sh-sub-meta">
              <span>{data.project.name}</span>
              <span>·</span>
              <span className="mono">
                {run
                  ? `${run.number}${run.status !== 'done' ? ` (${run.status})` : ''}`
                  : 'Pending calculation'}
              </span>
            </div>
          </div>

          <div className="sh-pager-box">
            <button
              type="button"
              className="sh-pager-btn"
              disabled={idx <= 0}
              onClick={() => go(-1)}
              aria-label="Previous part"
              title="Previous Part"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="sh-pager-text">
              {idx + 1} {t('of') || 'of'} {data.parts.length}
            </span>
            <button
              type="button"
              className="sh-pager-btn"
              disabled={idx >= data.parts.length - 1}
              onClick={() => go(1)}
              aria-label="Next part"
              title="Next Part"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <ErrorNotice error={error} />

      {/* The Packing Line Master Workflow Layout */}
      <div className="sh-packing-line-layout">
        {/* Sticky Left Stepper Rail */}
        <LineRail
          activeStation={active}
          completedStations={completedStations}
          onSelectStation={scrollToStation}
        />

        {/* 8 Connected Production Stations */}
        <div className="sh-line-main">
          {/* 1 · Calculation settings */}
          <SettingsSection
            part={part}
            runs={runs}
            run={run}
            canEdit={canEdit}
            onPick={openRun}
            onRan={(r) => loadRuns(r._id)}
          />

          {/* 2 · Part */}
          <PartSection part={part} canEdit={canEdit} onChanged={load} />

          {/* 3 · Cluster */}
          <ClusterSection run={run} part={part} />

          {run?.status === 'done' ? (
            <>
              {/* 4 · Carton */}
              <CartonSection run={run} sel={sel} setSel={setSel} part={part} />

              {/* 5 · Pallet */}
              <PalletSection run={run} sel={sel} />

              {/* 6 · Container */}
              <ContainerSection run={run} sel={sel} ctSel={ctSel} setCtSel={setCtSel} />

              {/* 7 · Result */}
              <ResultSection
                key={run._id}
                run={run}
                sel={sel}
                canEdit={canEdit}
                onLocked={(lock) => {
                  setRun({ ...run, lock });
                  setRuns(runs.map((x) => (x._id === run._id ? { ...x, lock } : x)));
                }}
              />

              {/* 8 · Download */}
              <DownloadSection
                run={run}
                canEdit={canEdit}
                onShare={(on) => setRun({ ...run, shareOn: on })}
              />
            </>
          ) : (
            [4, 5, 6, 7, 8].map((n) => (
              <StationCard key={n} n={n} id={`sec${n}`} isLast={n === 8}>
                <div style={{ padding: '24px 20px' }}>
                  {!run && (
                    <p className="muted" style={{ margin: 0 }}>
                      Run the calculation in Station 1 (Calculation settings) to populate this station.
                    </p>
                  )}
                  {run && (run.status === 'queued' || run.status === 'running') && (
                    <RunProgress run={run} compact={n !== 4} />
                  )}
                  {run && run.status === 'failed' && (
                    <p className="err" style={{ margin: 0 }}>
                      {run.number} failed: {run.error}
                    </p>
                  )}
                  {run && run.status === 'cancelled' && (
                    <p className="muted" style={{ margin: 0 }}>
                      {run.number} was cancelled. Select another run in Station 1 or trigger calculation again.
                    </p>
                  )}
                </div>
              </StationCard>
            ))
          )}
        </div>
      </div>
    </>
  );
}
