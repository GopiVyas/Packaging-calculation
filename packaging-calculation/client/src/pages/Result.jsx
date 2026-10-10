import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useCan } from '../auth.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import { CartonPic, ContainerPic, PalletPic, StackPic } from '../components/Pictures.jsx';
import { Check, Phone, Warn } from '../components/Icons.jsx';
import { GOALS, dims, inr, num } from '../format.js';

export default function Result() {
  const { id } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const can = useCan();
  const { session } = useAuth();
  const canEdit = session.user.role !== 'viewer';

  const [plan, setPlan] = useState(id ? null : loc.state ? { inputs: loc.state.inputs, result: loc.state.result, goal: loc.state.goal || 'cost' } : null);
  const [goal, setGoal] = useState(loc.state?.goal || 'cost');
  const [tab, setTab] = useState(0);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/plans/${id}`).then((p) => {
      setPlan(p);
      setGoal(p.goal);
      if (p.shareToken) setShare({ shareToken: p.shareToken, shareExpiresAt: p.shareExpiresAt });
    }).catch(setError);
  }, [id]);

  if (!plan) {
    return error ? <ErrorNotice error={error} /> : id ? <p className="muted">Loading…</p> : (
      <section className="card stack"><p style={{ margin: 0 }}>No plan calculated yet.</p><Link className="btn btn-primary" to="/planner">Go to the planner</Link></section>
    );
  }

  const { result } = plan;
  const g = result.goals[goal];
  const line = result.lines[tab];
  const gl = g.lines[tab];
  const optById = Object.fromEntries(line.options.map((o) => [o.id, o]));
  const ordered = gl.order.map((oid) => optById[oid]);
  const rec = optById[gl.recommendedId];
  const goalName = GOALS.find((x) => x.id === goal).name;
  const floor = result.pallet.isFloorLoad;

  const changeGoal = async (gid) => {
    setGoal(gid);
    if (plan._id && canEdit) api.patch(`/plans/${plan._id}`, { goal: gid }).catch(() => {});
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await api.post('/plans', { name, goal, inputs: plan.inputs });
      nav(`/plans/${saved._id}`, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const makeShare = async () => {
    setError(null);
    try { setShare(await api.post(`/plans/${plan._id}/share`, { days: 30 })); } catch (err) { setError(err); }
  };
  const shareUrl = share ? `${window.location.origin}/share/${share.shareToken}` : '';

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{plan.name ? `Saved plan · ${plan.name}` : 'Not saved yet'} · {floor ? 'No pallet' : result.pallet.name} · {result.container.name}</p>
          <h1 className="h1">Recommendation</h1>
        </div>
        <div className="inline">
          <button className="btn btn-ghost" onClick={() => nav('/planner', { state: { inputs: plan.inputs, goal } })}>Edit inputs</button>
          {plan._id && (can('shareLinks')
            ? (share
              ? <a className="btn" href={shareUrl} target="_blank" rel="noreferrer"><Phone />Open on phone</a>
              : canEdit && <button className="btn" onClick={makeShare}><Phone />Create phone link</button>)
            : <span className="muted" style={{ fontSize: 13 }}>Phone links: Business plan</span>)}
        </div>
      </div>

      {!plan._id && canEdit && (
        can('savePlans') ? (
          <form className="card inline" style={{ marginBottom: 20, padding: 16, alignItems: 'flex-end' }} onSubmit={save}>
            <div className="field" style={{ flex: '1 1 260px' }}>
              <label htmlFor="pn">Save this plan as</label>
              <input id="pn" className="input" required placeholder="e.g. Order EX-1042 · Hamburg" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button>
          </form>
        ) : <div style={{ marginBottom: 20 }}><ErrorNotice error={{ isUpgrade: true, message: 'Saving plans is included in Pro and above.' }} /></div>
      )}
      {share && (
        <p className="notice notice-upgrade" style={{ marginBottom: 20 }}>
          <Phone />
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>Warehouse link (read only, expires {new Date(share.shareExpiresAt).toLocaleDateString()}): <span className="mono">{shareUrl}</span></span>
          <button className="btn" style={{ minHeight: 36 }} onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); }}>{copied ? 'Copied' : 'Copy'}</button>
        </p>
      )}
      <ErrorNotice error={error} />

      <div className="page-head" style={{ alignItems: 'center', marginBottom: 20 }}>
        <div role="tablist" aria-label="Order line" className="tabs">
          {result.lines.map((l, i) => (
            <button key={i} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>
              <span className="dot" style={{ background: l.color }} />{l.partName} · {num(l.qty)}
            </button>
          ))}
        </div>
        <div className="inline" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 14 }}>Goal</span>
          <div className="seg">
            {GOALS.map((x) => <button key={x.id} aria-pressed={goal === x.id} onClick={() => changeGoal(x.id)}>{x.name}</button>)}
          </div>
        </div>
      </div>

      <section className="card rec" style={{ marginBottom: 24, padding: 28 }} aria-labelledby="rec">
        <div className="rec-main">
          {rec ? <>
            <p className="badge badge-green" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '4px 10px', borderRadius: 999, margin: 0 }}><Check size={14} />Recommended for {goalName.toLowerCase()}</p>
            <h2 id="rec" style={{ margin: '10px 0 4px', fontSize: 30 }}>{rec.cartonName}</h2>
            <p className="mono muted" style={{ margin: '0 0 16px', fontSize: 14 }}>Outside {dims(rec.outer.l, rec.outer.w, rec.outer.h)} mm · {rec.perCarton} per carton ({rec.grid.nx} × {rec.grid.ny} × {rec.grid.nz})</p>
          </> : <h2 id="rec" style={{ margin: '0 0 12px', fontSize: 24 }}>No carton fits {line.partName}</h2>}
          <h3 className="section-label" style={{ fontSize: 14 }}>Why this plan</h3>
          <p className="rec-why">{gl.explanation}</p>
        </div>
        {rec && (
          <dl className="tiles">
            <div className="tile dark"><dt>Containers</dt><dd style={{ fontSize: 24 }}>{rec.containers} × {result.container.name.replace(' standard', '')}</dd></div>
            <div className="tile dark"><dt>Total cost</dt><dd style={{ fontSize: 24 }}>{inr(rec.totalCost)}</dd></div>
            <div className="tile"><dt>{floor ? 'Container loads' : 'Pallets'}</dt><dd>{rec.pallets}</dd></div>
            <div className="tile"><dt>Cartons</dt><dd>{num(rec.cartons)}</dd></div>
            <div className="tile"><dt>{floor ? 'Space used' : 'Pallet space used'}</dt><dd>{rec.fill}%</dd></div>
            <div className="tile"><dt>{floor ? 'Load weight' : 'Pallet weight'}</dt><dd>{num(rec.palletKg)}<span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}> / {num(result.pallet.maxLoadKg)} kg</span></dd></div>
          </dl>
        )}
      </section>

      <section className="card" style={{ marginBottom: 24 }} aria-labelledby="opts">
        <div className="card-head" style={{ marginBottom: 12 }}><h2 id="opts">All options for {line.partName}</h2><span className="muted" style={{ fontSize: 13 }}>Ranked by {goalName.toLowerCase()}</span></div>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 840 }}>
            <thead><tr><th>Carton</th><th className="r">Per carton</th><th className="r">{floor ? 'Per container' : 'Per pallet'}</th><th className="r">Cartons</th><th className="r">{floor ? 'Loads' : 'Pallets'}</th><th className="r">Containers</th><th className="r">Space used</th><th className="r">Total cost</th></tr></thead>
            <tbody>
              {ordered.map((o) => (
                <tr key={o.id} className={o.id === gl.recommendedId ? 'hl' : ''}>
                  <td style={{ whiteSpace: 'nowrap' }}><b>{o.cartonName}</b> {o.isSuggested && <span className="muted" style={{ fontSize: 12 }}>Suggested</span>} {o.id === gl.recommendedId && <span className="badge badge-solid">Best</span>}</td>
                  <td className="mono r">{o.perCarton}</td>
                  <td className="mono r">{o.perLayer} × {o.layers} = {o.perPallet}</td>
                  <td className="mono r">{num(o.cartons)}</td>
                  <td className="mono r">{o.pallets}</td>
                  <td className="mono r"><b>{o.containers}</b></td>
                  <td className="mono r">{o.fill}%</td>
                  <td className="mono r">{inr(o.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {line.options.length < plan.inputs.cartonIds.length && <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>{plan.inputs.cartonIds.length - line.options.length} carton(s) left out because the part does not fit in them.</p>}
      </section>

      {rec && (
        <section style={{ marginBottom: 24 }} aria-labelledby="pics">
          <div className="card-head" style={{ marginBottom: 12 }}><h2 id="pics" style={{ fontSize: 22, margin: 0 }}>Loading picture</h2><span className="muted" style={{ fontSize: 13 }}>Drawn to scale from the plan above</span></div>
          <div className="pics" style={{ marginBottom: 16 }}>
            <article className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>1 · Pack the carton</h3>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>Top view · {rec.grid.nx} × {rec.grid.ny} × {rec.grid.nz}</p>
              <div className="pic-stage"><CartonPic option={rec} color={line.color} /></div>
              <p style={{ margin: '12px 0 0', fontSize: 14 }}><b>{rec.perCarton} parts</b> per carton, {rec.grid.nz} layer{rec.grid.nz > 1 ? 's' : ''}.{line.upright ? ' Arrows: this side up.' : ''}</p>
            </article>
            <article className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>2 · {floor ? 'Floor layer' : 'Build the pallet'}</h3>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>Top view of one layer · {num(result.pallet.L)} × {num(result.pallet.W)}</p>
              <div className="pic-stage"><PalletPic option={rec} pallet={result.pallet} /></div>
              <p style={{ margin: '12px 0 0', fontSize: 14 }}><b>{rec.perLayer} cartons</b> per layer, numbered in placing order.</p>
            </article>
            <article className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>3 · Stack the layers</h3>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>Side view · max height {num(result.pallet.maxStackH)} mm</p>
              <div className="pic-stage" style={{ alignItems: 'flex-end', paddingTop: 36 }}><StackPic option={rec} pallet={result.pallet} /></div>
              <p style={{ margin: '12px 0 0', fontSize: 14 }}><b>{Math.ceil(rec.perPallet / rec.perLayer)} layers</b> = {rec.perPallet} cartons · {num(rec.palletKg)} kg</p>
            </article>
          </div>

          <article className="card">
            <div className="card-head">
              <div>
                <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>4 · Load the containers (whole order)</h3>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {g.totals.containers} × {result.container.name} · {num(g.totals.cartons)} cartons · {inr(g.totals.totalCost)} in total · numbers show loading order, heaviest first from the front wall
                </p>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
                {result.lines.map((l, i) => <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: l.color, width: 14, height: 14 }} />{l.label} = {l.partName}</li>)}
                <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ width: 14, height: 14, border: '1.5px dashed #8A9099' }} />Free slot</li>
              </ul>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              {g.containers.map((b) => (
                <div key={b.n}>
                  <p style={{ margin: '0 0 8px', fontSize: 14 }}><b>Container {b.n}</b> · {b.used} of {b.totalSlots} {floor ? 'load' : 'slots'} · <span className="mono">{num(b.kg)}</span> of {num(b.payloadKg)} kg</p>
                  <ContainerPic box={b} container={result.container} lines={result.lines} />
                </div>
              ))}
            </div>
            {g.totals.unplannedLines.length > 0 && <p className="err" style={{ marginTop: 12 }}>Not planned (no carton fits): {g.totals.unplannedLines.join(', ')}</p>}
          </article>
        </section>
      )}

      <p className="notice"><Warn />Calculated plan. Confirm sizes and weights on site before loading.</p>
    </>
  );
}
