import { AlertTriangle, CheckCircle2, Info, Layers } from 'lucide-react';
export function InfoPanel({ result, carton, productTypes }) {
    const hasWarnings = result.warnings.filter((w) => w.length > 0).length > 0;
    const allFit = result.packedCount === result.requestedCount && result.requestedCount > 0;
    return (<div className="space-y-4">
      {/* Status */}
      <div className={`rounded-lg p-3 flex items-start gap-2.5 ${allFit
            ? 'bg-green-50 text-green-800 border border-green-200'
            : hasWarnings
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
        {allFit ? (<CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-600"/>) : (<AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500"/>)}
        <div className="text-sm">
          {allFit ? (<p className="font-medium">All products fit successfully.</p>) : hasWarnings ? (<div className="space-y-1">
              <p className="font-medium">Some items could not be placed:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                {result.warnings
                .filter((w) => w.length > 0)
                .map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            </div>) : (<p>No products to pack.</p>)}
        </div>
      </div>

      {/* Carton Info */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400"/>
          Carton Details
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Length" value={`${carton.length} cm`}/>
          <Stat label="Width" value={`${carton.width} cm`}/>
          <Stat label="Height" value={`${carton.height} cm`}/>
          <Stat label="Volume" value={`${result.cartonVolume.toLocaleString()} cm³`}/>
        </div>
      </div>

      {/* Packing Results */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Packing Results</h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Packed" value={`${result.packedCount} / ${result.requestedCount}`}/>
          <Stat label="Layers" value={`${result.layers}`}/>
          <Stat label="Used Volume" value={`${result.usedVolume.toLocaleString()} cm³`}/>
          <Stat label="Unused Space" value={`${(100 - result.efficiency).toFixed(1)}%`}/>
          <Stat label="Space Efficiency" value={`${result.efficiency.toFixed(1)}%`}/>
        </div>
      </div>

      {/* Nesting savings */}
      {result.nestingEnabled && result.nestedStacks > 0 && (<div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-blue-600"/>
            <h3 className="text-sm font-semibold text-blue-700">Nesting Savings</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Nested Stacks" value={`${result.nestedStacks}`}/>
            <Stat label="Space Saved" value={`${result.spaceSaved.toLocaleString(undefined, { maximumFractionDigits: 1 })} cm³`}/>
          </div>
          <p className="text-xs text-blue-500 mt-2">
            Cups and jars are stacked inside each other, saving vertical space.
          </p>
        </div>)}

      {/* Product Legend */}
      {productTypes.length > 0 && (<div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Product Legend</h3>
          <div className="space-y-1.5">
            {productTypes.map((pt) => {
                const packed = result.productTypeCounts[pt.id] || 0;
                return (<div key={pt.id} className="flex items-center gap-2.5 text-sm bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
                  <span className="w-4 h-4 rounded flex-shrink-0 border border-slate-300" style={{ backgroundColor: pt.color }}/>
                  <span className="font-medium text-slate-700">{pt.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {packed}/{pt.quantity} packed
                  </span>
                </div>);
            })}
          </div>
        </div>)}
    </div>);
}
function Stat({ label, value }) {
    return (<div className="bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>);
}
