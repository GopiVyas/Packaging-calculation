// npm run seed
// 1) Standard pallet and container templates (orgId = null, read-only for every customer).
// 2) A demo customer account with the sample order from the design, unless it already exists.
//    Login: demo@packaging.local / demo1234
// Sizes are typical published figures: check them against your shipping line before going live.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from './config/env.js';
import Organization from './models/Organization.js';
import User from './models/User.js';
import Part from './models/Part.js';
import Project from './models/Project.js';
import Material from './models/Material.js';
import Carton from './models/Carton.js';
import Pallet from './models/Pallet.js';
import Container from './models/Container.js';
import { boxForShape, toKg } from './engine/index.js';

const PALLETS = [
  { name: 'EUR 1200 × 800', L: 1200, W: 800, deckH: 144, maxStackH: 1800, maxLoadKg: 1000, weightKg: 25 },
  { name: 'Industrial 1200 × 1000', L: 1200, W: 1000, deckH: 150, maxStackH: 1800, maxLoadKg: 1000, weightKg: 25 },
  { name: 'US / GMA 1219 × 1016', L: 1219, W: 1016, deckH: 140, maxStackH: 1800, maxLoadKg: 1000, weightKg: 22 }
];
const CONTAINERS = [
  { name: '20 ft standard', innerL: 5898, innerW: 2352, innerH: 2393, payloadKg: 28200, freightCost: 120000 },
  { name: '40 ft standard', innerL: 12032, innerW: 2352, innerH: 2393, payloadKg: 26700, freightCost: 180000 },
  { name: '40 ft high cube', innerL: 12032, innerW: 2352, innerH: 2698, payloadKg: 26500, freightCost: 190000 }
];

const MATERIALS = [
  { name: 'Steel', densityGcm3: 7.85 }, { name: 'Stainless steel', densityGcm3: 8.0 }, { name: 'Cast iron', densityGcm3: 7.2 },
  { name: 'Aluminium', densityGcm3: 2.7 }, { name: 'Brass', densityGcm3: 8.5 }, { name: 'ABS', densityGcm3: 1.05 },
  { name: 'PA6 (nylon)', densityGcm3: 1.14 }, { name: 'PA6 GF30', densityGcm3: 1.36 }, { name: 'POM', densityGcm3: 1.41 },
  { name: 'PP', densityGcm3: 0.91 }, { name: 'PC', densityGcm3: 1.2 }, { name: 'Glass', densityGcm3: 2.5 }
];

const DEMO_PARTS = [
  { name: 'Wheel hub', shape: 'box', dims: { length: 220, width: 220, height: 120 }, weight: 2.4, upright: true },
  { name: 'Brake disc', shape: 'circle', dims: { diameter: 300, height: 60 }, weight: 4.5, upright: false },
  { name: 'Kitchen jar 1 L', shape: 'circle', dims: { diameter: 110, height: 160 }, weight: 0.42, upright: true },
  { name: 'Jar lid', shape: 'circle', dims: { diameter: 112, height: 18 }, weight: 0.03, upright: false },
  { name: 'Small tray', shape: 'square', dims: { side: 200, height: 25 }, weight: 0.18, upright: false }
];
const DEMO_CARTONS = [
  { name: 'Carton A', innerL: 600, innerW: 400, innerH: 300, wallMm: 5, maxWeightKg: 30, emptyWeightKg: 0.9, price: 70 },
  { name: 'Carton B', innerL: 500, innerW: 500, innerH: 260, wallMm: 5, maxWeightKg: 30, emptyWeightKg: 1.0, price: 90 },
  { name: 'Carton D1', innerL: 305, innerW: 305, innerH: 250, wallMm: 5, maxWeightKg: 25, emptyWeightKg: 0.6, price: 40 }
];

await mongoose.connect(env.mongoUri);
const sys = { skipTenant: true };

for (const p of PALLETS) await Pallet.updateOne({ name: p.name, orgId: null }, { $set: p }, { upsert: true }).setOptions(sys);
for (const c of CONTAINERS) await Container.updateOne({ name: c.name, orgId: null }, { $set: c }, { upsert: true }).setOptions(sys);
for (const m of MATERIALS) await Material.updateOne({ name: m.name, orgId: null }, { $set: m }, { upsert: true }).setOptions(sys);
console.log(`Templates: ${PALLETS.length} pallets, ${CONTAINERS.length} containers, ${MATERIALS.length} materials`);

const email = 'demo@packaging.local';
if (await User.findOne({ email }).setOptions(sys)) {
  console.log('Demo account already exists');
} else {
  const org = await Organization.create({
    name: 'Demo Exports Pvt Ltd', plan: 'business', subscriptionStatus: 'active',
    currentPeriodEnd: new Date(Date.now() + 365 * 864e5)
  });
  await User.create({ orgId: org._id, name: 'Demo Owner', email, role: 'owner', passwordHash: await bcrypt.hash('demo1234', 12) });
  const project = await Project.create({ orgId: org._id, name: 'Demo export order', description: 'Wheel hubs and brake discs for EX-1042' });
  for (const p of DEMO_PARTS) {
    await Part.create({ ...p, orgId: org._id, projectId: project._id, unit: 'mm', weightUnit: 'kg', box: boxForShape(p.shape, p.dims), weightKg: toKg(p.weight) });
  }
  for (const c of DEMO_CARTONS) await Carton.create({ ...c, orgId: org._id });
  console.log(`Demo account created: ${email} / demo1234`);
}

await mongoose.disconnect();
