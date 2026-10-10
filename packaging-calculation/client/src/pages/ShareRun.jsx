// Public read-only view of one calculation run (/s/:token), shown only while sharing is switched on.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Logo } from '../components/Icons.jsx';
import { CartonSection, PalletSection, ContainerSection, ResultSection } from './part/RunSections.jsx';

export default function ShareRun() {
  const { token } = useParams();
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const [sel, setSel] = useState(null);
  const [ctSel, setCtSel] = useState(null);

  useEffect(() => {
    api.get(`/share/r/${token}`).then((r) => {
      setRun({ ...r, _id: token });
      setSel(r.lock?.cartonId || r.result.winner?.cartonId || r.result.cartons[0]?.id);
      setCtSel(r.lock?.containerId || r.result.winner?.containerId);
    }).catch(setError);
  }, [token]);

  return (
    <>
      <header className="topbar"><div className="topbar-in"><span className="brand"><Logo />Packaging Solution</span><span className="pill-dark" style={{ marginLeft: 'auto', color: '#C9CDD3', fontSize: 13 }}>Read only</span></div></header>
      <main className="page">
        {error && <section className="card"><h1 className="h1" style={{ fontSize: 22 }}>Not available</h1><p className="muted">{error.message}</p></section>}
        {run && <>
          <p className="eyebrow">{run.orgName} · {run.number} · {new Date(run.createdAt).toLocaleDateString()}</p>
          <h1 className="h1" style={{ marginBottom: 20 }}>{run.result.part.name}</h1>
          <div className="stack" style={{ gap: 20 }}>
            <CartonSection run={run} sel={sel} setSel={setSel} />
            <PalletSection run={run} sel={sel} />
            <ContainerSection run={run} sel={sel} ctSel={ctSel} setCtSel={setCtSel} />
            <ResultSection run={run} sel={sel} canEdit={false} onLocked={() => {}} />
          </div>
        </>}
      </main>
    </>
  );
}
