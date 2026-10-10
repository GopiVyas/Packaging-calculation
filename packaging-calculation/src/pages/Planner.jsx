import { useState } from 'react'
import ShapeInput from '../components/ShapeInput.jsx'
import CartonSVG from '../components/CartonSVG.jsx'

function Planner() {
  const [part, setPart] = useState({ name: 'Ceramic mug', length: 120, width: 95, height: 110, quantity: 240, unit: 'mm' })
  const [goal, setGoal] = useState('space')
  const [planned, setPlanned] = useState(false)

  return <section className="planner-page">
    <div className="page-intro"><div><p className="eyebrow">PACKAGING PLANNER <span className="status-dot" /> READY</p><h1>Pack with confidence.</h1><p className="lede">Find the right carton, pallet, and container for every order.</p></div><button className="secondary-button" onClick={() => setPart({ name: '', length: '', width: '', height: '', quantity: '', unit: 'mm' })}>+ New part</button></div>
    <div className="planner-grid">
      <div className="panel input-panel"><div className="panel-heading"><div><span className="step-number">01</span><h2>Part details</h2></div><span className="panel-caption">Required</span></div><ShapeInput value={part} onChange={setPart} /></div>
      <div className="panel goal-panel"><div className="panel-heading"><div><span className="step-number">02</span><h2>Optimize for</h2></div></div><div className="goal-options">{[['space', 'Space', 'Smallest footprint'], ['cost', 'Cost', 'Lowest packaging cost'], ['containers', 'Containers', 'Fewest containers']].map(([value, label, copy]) => <button key={value} className={goal === value ? 'goal-option selected' : 'goal-option'} onClick={() => setGoal(value)}><span className="radio" /><span><strong>{label}</strong><small>{copy}</small></span></button>)}</div><button className="primary-button" onClick={() => setPlanned(true)}>Calculate packaging <span>→</span></button></div>
    </div>
    <div className="result-strip"><div><p className="eyebrow">{planned ? 'RECOMMENDED PLAN' : 'YOUR NEXT MOVE'}</p><h2>{planned ? 'Medium carton · 24 parts per carton' : 'Ready to size your order?'}</h2><p>{planned ? '10 cartons · 1 pallet · 1 container' : 'Enter your part dimensions above to see the best fit.'}</p></div><CartonSVG /><div className="result-metric"><strong>{planned ? '92%' : '—'}</strong><span>space used</span></div></div>
  </section>
}

export default Planner
