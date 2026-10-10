// PDF record of one run (section 8). Plain PDFKit, no browser needed.
// Standard PDF fonts have no ₹ sign, so amounts are written as "INR 12.34".
import PDFDocument from 'pdfkit';

const n = (x, d = 0) => Number(x ?? 0).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (x, cur) => (x == null ? '—' : `${cur} ${n(x, 2)}`);
const dims = (o) => `${n(o.l)} × ${n(o.w)} × ${n(o.h)} mm`;

export function writeRunPdf(res, { run, orgName, currency = 'INR', shareUrl }) {
  const r = run.result;
  const lockC = run.lock?.cartonId && r.cartons.find((c) => c.id === run.lock.cartonId);
  const c = lockC || r.cartons.find((x) => x.id === r.winner?.cartonId) || r.cartons[0];
  const ct = c && (c.containers.find((x) => x.id === (run.lock?.containerId || c.bestContainerId)) || c.containers[0]);

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${run.number} · ${r.part.name}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${run.number}.pdf"`);
  doc.pipe(res);

  const h = (t) => { doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).fillColor('#16191D').text(t); doc.moveDown(0.3).font('Helvetica').fontSize(10); };
  const row = (k, v) => {
    const x = doc.page.margins.left;
    const y = doc.y;
    doc.font('Helvetica').fillColor('#5A6069').text(k, x, y, { width: 165 });
    const yAfterLabel = doc.y;
    doc.fillColor('#16191D').text(String(v), x + 170, y, { width: doc.page.width - x * 2 - 170 });
    doc.x = x;
    doc.y = Math.max(doc.y, yAfterLabel) + 2;
  };
  const table = (cols, rows) => {
    const x0 = doc.page.margins.left;
    const w = (doc.page.width - x0 * 2) / cols.length;
    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#5A6069');
    cols.forEach((col, i) => doc.text(col, x0 + i * w, y, { width: w - 6 }));
    y += 16;
    doc.font('Helvetica').fontSize(9).fillColor('#16191D');
    for (const rr of rows) {
      if (y > doc.page.height - 80) { doc.addPage(); y = doc.page.margins.top; }
      rr.forEach((v, i) => doc.text(String(v), x0 + i * w, y, { width: w - 6 }));
      y += 16;
    }
    doc.x = x0;
    doc.y = y + 4;
  };

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#16191D').text(r.part.name);
  doc.font('Helvetica').fontSize(10).fillColor('#5A6069').text(`${orgName} · ${run.number} · ${new Date(run.createdAt).toLocaleString('en-GB')}`);
  if (run.lock?.at) doc.fillColor('#1E6B43').text(`Locked by ${run.lock.byName} on ${new Date(run.lock.at).toLocaleString('en-GB')}${run.lock.reason ? ` — ${run.lock.reason}` : ''}`);

  h('Part');
  row('Bounding box', dims(r.part.box));
  row('Weight', `${n(r.part.weightKg * 1000, 1)} g`);
  row('Packing position', r.part.upright ? 'Upright only' : 'Any orientation');

  h('Settings');
  row('Pallet', r.pallet.name);
  row('Optimise carton height', r.settings.optimiseHeight ? 'On' : 'Off');
  row('Pallets stacked in container', `up to ${r.settings.maxTiers}`);
  row('Container roof clearance', `${r.settings.clearanceMm} mm`);

  if (c) {
    h('ERP numbers');
    row('Carton', `${dims(c.outer)} outer${c.trimmed ? ' (height optimised)' : ''}`);
    row('Pieces per carton', n(c.perCarton));
    row('Packing method', { grid: 'Grid packing (box)', column: 'Column Stacking', pattern: 'Repeating Pattern', cluster: 'Cluster Packing', nested: 'Nested Clusters' }[c.method || 'grid']);
    row('Pieces per pallet', n(c.piecesPerPallet));
    row('Cartons per pallet', `${c.pallet.perLayer} per layer × ${c.pallet.layers} layers = ${c.pallet.perPallet}`);
    row('Pallet gross weight', `${n(c.pallet.palletKg, 2)} kg of ${n(r.pallet.maxLoadKg)} kg`);
    if (ct) {
      row('Container', ct.name);
      row('Pallets per container', `${ct.pallets} (${ct.perFloorLayer} per floor × ${ct.tiers} high) · limited by ${ct.limitedBy}`);
      row('Pieces per container', n(ct.pieces));
      row('Cost per piece', money(ct.costPerPiece, currency));
    }

    h('By carton and container');
    table(['Carton', 'Container', 'Per pallet', 'Per container', 'Limited by', 'Cost / piece'],
      r.cartons.flatMap((x) => x.containers.map((k) => [x.name, k.name, n(x.piecesPerPallet), n(k.pieces), k.limitedBy, money(k.costPerPiece, currency)])));
  }

  h('Share link');
  doc.fillColor('#1F4E8C').text(shareUrl, { link: shareUrl });
  doc.fillColor('#5A6069').text(run.shareOn ? 'The link is switched on: it opens a read-only view of this calculation.' : 'The link is switched off: it shows nothing until it is shared from the app.');

  doc.moveDown(1).fontSize(8).fillColor('#5A6069').text('Calculated plan. Confirm sizes and weights on site before loading.');
  doc.end();
}
