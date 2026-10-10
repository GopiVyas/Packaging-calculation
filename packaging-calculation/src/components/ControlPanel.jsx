import { useState, useRef, useCallback } from 'react';
import { NESTABLE_SHAPES } from '../packing/types.js';
import { PRODUCT_PRESETS } from '../packing/productPresets.js';
import { Plus, Trash2, Package, Search, Sparkles, Layers, FileUp, Loader2, Box } from 'lucide-react';
const SHAPE_OPTIONS = [
    { value: 'box', label: 'Box (Rectangular)' },
    { value: 'bottle', label: 'Bottle' },
    { value: 'cup', label: 'Cup / Mug' },
    { value: 'can', label: 'Can' },
    { value: 'jar', label: 'Jar' },
    { value: 'pouch', label: 'Pouch / Bag' },
    { value: 'packet', label: 'Packet / Carton' },
    { value: 'phone', label: 'Phone / Tablet' },
    { value: 'cylinder', label: 'Cylinder (generic)' },
    { value: 'sphere', label: 'Sphere' },
    { value: 'diamond', label: 'Diamond' },
    { value: 'custom', label: 'Custom' },
];
const COLOR_PRESETS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];
export function ControlPanel({ carton, productTypes, onCartonChange, onProductChange, onAddProduct, onAddPreset, onRemoveProduct, onImportCAD, onExportSTL, importing, importError, customGeometryNames, }) {
    const [showPresets, setShowPresets] = useState(false);
    const [presetSearch, setPresetSearch] = useState('');
    const fileInputRef = useRef(null);
    const filteredPresets = PRODUCT_PRESETS.filter((p) => p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
        p.shape.toLowerCase().includes(presetSearch.toLowerCase()));
    const handleFileSelect = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) {
            onImportCAD(file);
        }
        e.target.value = '';
    }, [onImportCAD]);
    return (<div className="space-y-5">
      {/* Carton Dimensions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600"/>
          Carton Dimensions
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {['length', 'width', 'height'].map((key) => (<div key={key}>
              <label className="block text-xs text-slate-500 mb-1 capitalize">{key}</label>
              <input type="number" min={1} value={carton[key]} onChange={(e) => onCartonChange({ ...carton, [key]: Math.max(1, parseFloat(e.target.value) || 1) })} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
            </div>))}
        </div>
      </div>

      {/* CAD Import / Export */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-lg p-3 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <Box className="w-4 h-4 text-blue-600"/>
          CAD Import / Export
        </h3>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".obj,.stl,.gltf,.glb" onChange={handleFileSelect} className="hidden"/>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 px-3 py-2 rounded-md border border-blue-200 transition-colors disabled:opacity-50">
            {importing ? (<Loader2 className="w-3.5 h-3.5 animate-spin"/>) : (<FileUp className="w-3.5 h-3.5"/>)}
            {importing ? 'Importing...' : 'Import CAD'}
          </button>
          <button onClick={onExportSTL} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-700 bg-white hover:bg-slate-50 px-3 py-2 rounded-md border border-slate-200 transition-colors">
            <Box className="w-3.5 h-3.5"/>
            Export STL
          </button>
        </div>
        {importError && (<p className="text-xs text-red-500 mt-2">{importError}</p>)}
        <p className="text-[10px] text-slate-400 mt-2">
          Import .obj, .stl, or .gltf/.glb files as custom products. Export the packed arrangement as STL for CAD software.
        </p>
        {customGeometryNames.length > 0 && (<div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-[10px] text-slate-400 mb-1">Imported models:</p>
            {customGeometryNames.map((name, i) => (<p key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                <Box className="w-3 h-3 text-blue-400"/>
                {name}
              </p>))}
          </div>)}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Products</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPresets(!showPresets)} className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors ${showPresets
            ? 'bg-blue-600 text-white'
            : 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100'}`}>
              <Sparkles className="w-3.5 h-3.5"/>
              Presets
            </button>
            <button onClick={onAddProduct} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors">
              <Plus className="w-3.5 h-3.5"/>
              Custom
            </button>
          </div>
        </div>

        {/* Preset picker */}
        {showPresets && (<div className="mb-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"/>
              <input type="text" value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)} placeholder="Search products..." className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {filteredPresets.map((preset) => (<button key={preset.name} onClick={() => {
                    onAddPreset(preset);
                    setShowPresets(false);
                    setPresetSearch('');
                }} className="w-full flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-md hover:bg-white border border-transparent hover:border-slate-200 transition-colors group">
                  <span className="w-3.5 h-3.5 rounded flex-shrink-0 border border-slate-300" style={{ backgroundColor: preset.color }}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{preset.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {preset.length}×{preset.width}×{preset.height} cm · qty {preset.quantity}
                    </p>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 flex-shrink-0"/>
                </button>))}
              {filteredPresets.length === 0 && (<p className="text-xs text-slate-400 text-center py-2">No presets found.</p>)}
            </div>
          </div>)}

        {/* Product list */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {productTypes.map((product, index) => (<div key={product.id} className="bg-slate-50 rounded-lg p-3 space-y-2.5 border border-slate-200">
              <div className="flex items-center gap-2">
                <input type="text" value={product.name} onChange={(e) => onProductChange(index, { ...product, name: e.target.value })} placeholder="Product name" className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                <button onClick={() => onRemoveProduct(index)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Shape</label>
                <select value={product.shape} onChange={(e) => onProductChange(index, {
                ...product,
                shape: e.target.value,
            })} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {SHAPE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['length', 'width', 'height'].map((key) => (<div key={key}>
                    <label className="block text-xs text-slate-500 mb-1 capitalize">{key}</label>
                    <input type="number" min={0.1} step={0.1} value={product[key]} onChange={(e) => onProductChange(index, {
                    ...product,
                    [key]: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                })} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                  </div>))}
              </div>

              {/* Wall thickness for nestable shapes */}
              {NESTABLE_SHAPES.includes(product.shape) && (<div className="flex items-center gap-2 bg-blue-50 rounded-md px-2.5 py-1.5 border border-blue-100">
                  <Layers className="w-3.5 h-3.5 text-blue-500 flex-shrink-0"/>
                  <label className="text-xs text-blue-600 flex-shrink-0">Wall thickness</label>
                  <input type="number" min={0.05} step={0.05} value={product.wallThickness ?? 0.3} onChange={(e) => onProductChange(index, {
                    ...product,
                    wallThickness: Math.max(0.05, parseFloat(e.target.value) || 0.05),
                })} className="w-16 px-2 py-1 text-xs border border-blue-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                  <span className="text-[10px] text-blue-400">cm — nesting overlap</span>
                </div>)}

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 flex-shrink-0">Qty</label>
                <input type="number" min={1} value={product.quantity} onChange={(e) => onProductChange(index, {
                ...product,
                quantity: Math.max(0, parseInt(e.target.value) || 0),
            })} className="w-20 px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                <div className="flex items-center gap-1.5 ml-auto">
                  {COLOR_PRESETS.map((color) => (<button key={color} onClick={() => onProductChange(index, { ...product, color })} className={`w-5 h-5 rounded-full border-2 transition-transform ${product.color === color
                    ? 'border-slate-700 scale-110'
                    : 'border-white hover:scale-110'}`} style={{ backgroundColor: color }} aria-label={`Select color ${color}`}/>))}
                </div>
              </div>
            </div>))}
          {productTypes.length === 0 && (<p className="text-sm text-slate-400 text-center py-4">No products added yet. Use Presets, Custom, or Import CAD to add.</p>)}
        </div>
      </div>
    </div>);
}
