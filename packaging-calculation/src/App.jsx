import { useState } from 'react'
import Planner from './pages/Planner.jsx'
import Parts from './pages/Parts.jsx'
import Cartons from './pages/Cartons.jsx'
import PalletsContainers from './pages/PalletsContainers.jsx'
import Result from './pages/Result.jsx'
import PlanView from './pages/PlanView.jsx'
import Register from './pages/Register.jsx'
import PackVision from './pages/PackVision.jsx'
import './App.css'

const pages = { PackVision, Register, Planner, Parts, Cartons, PalletsContainers, Result, PlanView }

function App() {
  const [activePage, setActivePage] = useState('PackVision')
  const Page = pages[activePage]

  if (activePage === 'PackVision') {
    return <Page onRegistered={() => setActivePage('Planner')} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#packvision" onClick={() => setActivePage('PackVision')}><span className="brand-mark">P</span><span>Packwise</span></a>
        <nav aria-label="Main navigation">
          {Object.keys(pages).map((page) => <button className={activePage === page ? 'nav-button active' : 'nav-button'} key={page} onClick={() => setActivePage(page)}>{page === 'PalletsContainers' ? 'Pallets' : page}</button>)}
        </nav>
        <button className="avatar" aria-label="Open account menu">MC</button>
      </header>
      <main><Page onRegistered={() => setActivePage('Planner')} /></main>
    </div>
  )
}

export default App
