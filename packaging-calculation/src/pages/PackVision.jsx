import { useMemo, useState } from 'react'
import { Box, Eye, EyeOff, Grid3X3, RotateCcw, Tags } from 'lucide-react'
import { ControlPanel } from '../components/ControlPanel.jsx'
import { InfoPanel } from '../components/InfoPanel.jsx'
import { Viewport } from '../components/three/Viewport.jsx'
import { packProducts } from '../packing/packingEngine.js'
import { createProductFromPreset } from '../packing/productPresets.js'
import { exportPackedSceneAsSTL, downloadSTL } from '../lib/cadExport.js'
import { importCADFile } from '../lib/cadImport.js'
import './PackVision.css'

const INITIAL_CARTON = { length: 60, width: 40, height: 30 }

function createCustomProduct(index, dimensions, name) {
  return {
    id: `custom-${Date.now()}-${index}`,
    name,
    shape: 'custom',
    ...dimensions,
    quantity: 1,
    color: '#3b82f6',
  }
}

export default function PackVision() {
  const [carton, setCarton] = useState(INITIAL_CARTON)
  const [productTypes, setProductTypes] = useState([])
  const [view, setView] = useState('3d')
  const [transparent, setTransparent] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [nestingEnabled, setNestingEnabled] = useState(true)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [customGeometries, setCustomGeometries] = useState(new Map())

  const result = useMemo(
    () => packProducts(carton, productTypes, nestingEnabled),
    [carton, productTypes, nestingEnabled],
  )

  const updateProduct = (index, product) => {
    setProductTypes((current) => current.map((item, itemIndex) => itemIndex === index ? product : item))
  }

  const addPreset = (preset) => {
    setProductTypes((current) => [...current, createProductFromPreset(preset, current.length)])
  }

  const addProduct = () => {
    setProductTypes((current) => [...current, createCustomProduct(current.length, { length: 10, width: 10, height: 10 }, 'New product')])
  }

  const removeProduct = (index) => {
    setProductTypes((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const importCAD = async (file) => {
    setImporting(true)
    setImportError('')
    try {
      const imported = await importCADFile(file)
      const product = createCustomProduct(productTypes.length, imported.dimensions, imported.name)
      setProductTypes((current) => [...current, product])
      setCustomGeometries((current) => new Map(current).set(product.id, imported))
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import this CAD file.')
    } finally {
      setImporting(false)
    }
  }

  const exportSTL = () => {
    const stl = exportPackedSceneAsSTL(result.items, carton, customGeometries)
    downloadSTL(stl)
  }

  return (
    <div className="packvision">
      <header className="packvision-header">
        <div className="packvision-brand"><span className="packvision-mark"><Box size={16} /></span><span><strong>PackVision 3D</strong><small>Carton Packing Visualizer</small></span></div>
        <div className="view-toolbar">
          {['top', 'front', 'side', '3d'].map((option) => <button key={option} className={view === option ? 'view-button active' : 'view-button'} onClick={() => setView(option)}>{option === '3d' ? '3D View' : `${option[0].toUpperCase()}${option.slice(1)} View`}</button>)}
          <button className="view-button" onClick={() => setView('quad')}><Grid3X3 size={13} /> Quad View</button>
          <button className="view-button" onClick={() => setResetTrigger((value) => value + 1)}><RotateCcw size={13} /> Reset</button>
          <button className={transparent ? 'view-button active' : 'view-button'} onClick={() => setTransparent((value) => !value)}>{transparent ? <EyeOff size={13} /> : <Eye size={13} />} Transparent</button>
          <button className={showLabels ? 'view-button active' : 'view-button'} onClick={() => setShowLabels((value) => !value)}><Tags size={13} /> Labels</button>
          <button className={nestingEnabled ? 'view-button active' : 'view-button'} onClick={() => setNestingEnabled((value) => !value)}><Grid3X3 size={13} /> Nesting</button>
        </div>
      </header>
      <div className="packvision-body">
        <aside className="packvision-sidebar">
          <ControlPanel
            carton={carton}
            productTypes={productTypes}
            onCartonChange={setCarton}
            onProductChange={updateProduct}
            onAddProduct={addProduct}
            onAddPreset={addPreset}
            onRemoveProduct={removeProduct}
            onImportCAD={importCAD}
            onExportSTL={exportSTL}
            importing={importing}
            importError={importError}
            customGeometryNames={Array.from(customGeometries.values()).map((geometry) => geometry.name)}
          />
          <InfoPanel result={result} carton={carton} productTypes={productTypes} />
        </aside>
        <main className="packvision-stage">
          <div className="stage-label">{view === 'quad' ? '3D View' : `${view[0].toUpperCase()}${view.slice(1)} View`}</div>
          {view === 'quad' ? <div className="quad-view">{['top', 'front', 'side', '3d'].map((quadView) => <div className="quad-cell" key={quadView}><span>{quadView} view</span><Viewport view={quadView} carton={carton} result={result} transparent={transparent} showLabels={showLabels} resetTrigger={resetTrigger} customGeometries={customGeometries} /></div>)}</div> : <Viewport view={view} carton={carton} result={result} transparent={transparent} showLabels={showLabels} resetTrigger={resetTrigger} customGeometries={customGeometries} />}
        </main>
      </div>
    </div>
  )
}
