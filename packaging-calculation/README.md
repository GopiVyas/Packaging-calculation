# Packaging Solution

Load planning for export orders: from carton, to pallet, to container.
A multi-tenant micro-SaaS: one MongoDB database for all customers, with every record tied to a customer account (`orgId`).

```
packaging-solution/
├── server/   Express + MongoDB (Mongoose) API and the calculation engine
└── client/   React (Vite) web app — works on computer, tablet and phone
```

## 1. Run it on your computer (local MongoDB)

`server/.env` is already set for a local MongoDB on `mongodb://127.0.0.1:27017/packaging_solution`
and the web app on **http://127.0.0.1:5173**. Change `MONGODB_URI` if your database name or port differs.

## 1b. Original Atlas instructions

You need **Node.js 20+** and a **MongoDB Atlas** database (the free M0 cluster is enough).

```bash
# 1. API
cd server
cp .env.example .env        # paste your Atlas connection string and a long random JWT_SECRET
npm install
npm run seed                # standard pallets/containers + demo account
npm run dev                 # http://127.0.0.1:4000

# 2. Web app (second terminal)
cd client
npm install
npm run dev                 # http://127.0.0.1:5173
```

Log in with the demo account **demo@packaging.local / demo1234** (Business plan, with wheel hubs, brake discs and cartons already added), or sign up to create a new customer account on a 14-day Pro trial.

## 2. Tests

```bash
cd server
npm test                                            # calculation engine: 21 hand-checked examples
MONGODB_URI_TEST="mongodb+srv://.../ps_test" npm test   # + customer isolation tests (use a throwaway database!)
```

The isolation tests create two companies and prove that company B cannot read, edit or delete company A's data, that an `orgId` sent by the browser is ignored, and that a database query without an `orgId` is refused.

## 3. How customer data is kept separate

- Every customer company is an **Organization**. Users, parts, cartons, plans, and custom pallets and containers all carry `orgId`.
- `orgId` comes **only** from the login token (`req.orgId` in `middleware/auth.js`), never from the request body.
- `plugins/tenant.js` adds the `orgId` filter to every query automatically and **throws** if a query has none.
- Standard pallets and containers have `orgId: null`. Every customer can read them; nobody can edit them. "Copy to edit" makes a customer-owned copy.
- Saved plans store the inputs **and** the calculated result, so a plan never changes when parts or cartons are edited later.

## 4. Subscription plans

Everything a plan allows lives in one file: `server/src/config/plans.js`.

| Plan | Price (placeholder) | Includes |
|---|---|---|
| Free | ₹0 | 1 part, 1 carton, calculate (no saving) |
| Pro | ₹999 / month | Saved data, carton suggestions, saved plans |
| Business | ₹3,999 / month | + mixed orders, up to 10 users, warehouse phone links |
| Enterprise | Custom | + API |

- **Server:** `requireFeature('suggest')` and `checkLimit('parts', Part)` block anything the plan doesn't include, with HTTP **402**.
- **Client:** shows an "Upgrade needed" message for a 402 error.
- **Trials and lapsed payments:** a trial gives full plan features until `trialEndsAt`. An expired trial or unpaid subscription falls back to Free. Data is kept, never deleted.

## 5. API overview

| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/signup · /login · /logout | Signup creates the Organization and its Owner |
| GET | /api/auth/me | User, organization and plan entitlements |
| CRUD | /api/parts · /api/cartons | Part box size is calculated from its shape on save |
| CRUD | /api/pallets · /api/containers | Plus `POST /:id/copy` for templates |
| POST | /api/cartons/suggest | Pro and above |
| POST | /api/plans/calculate | Results for all 4 goals at once (switching goal is instant) |
| CRUD | /api/plans | The server recalculates on save |
| POST | /api/plans/:id/share | Business plan: read-only phone link |
| GET | /api/share/:token | Public phone view data |
| CRUD | /api/users | Owner only: team members and roles |

## 6. The calculation engine (`server/src/engine`)

Pure functions in mm and kg, with no database access. A fixed version of the same calculation always gives the same result.

1. **shapes.js** turns a shape into the box it needs: box, square, circle (Ø × Ø × h), diamond (diagonals), or other.
2. **fit.js** does the three fitting steps:
   - **Parts in a carton:** tries every orientation, or only floor turns for upright parts, then caps by carton weight.
   - **Cartons on a pallet:** cartons stay this side up; tries both floor turns; layers under the height limit; caps by pallet load.
   - **Pallets in a container:** one tier, both floor turns, height check, payload cap.
3. **planLine.js** gives the full plan for one part and one carton (cartons, pallets, containers, cost, fill).
4. **rank.js** ranks options by goal (tie-breakers included) and writes the plain-words explanation.
5. **mixedOrder.js** puts all pallets of the order into containers, heaviest first from the front wall.
6. **suggest.js** builds carton sizes around the part and returns the best pallet fit, lowest cost and fewest cartons.

The version-1 limits match the proposal: no mixed parts inside one carton, no pallets stacked on pallets, round shapes packed as their bounding box, no 3D view.

## 7. Before going live (next phases)

- **Phase 2 — Billing:** Razorpay Subscriptions checkout, plus a verified webhook that sets `organization.plan` and `subscriptionStatus`; grace period and GST invoices.
- **Accounts:** email verification, password reset, and email invites (instead of temporary passwords).
- **Admin:** a platform admin page listing organizations, plans and usage, with trial extension.
- **Operations:** Atlas backups, Sentry, separate dev/staging/production databases, and terms and privacy pages.
- **Deploy:** build the client (`npm run build`, host `client/dist` on Vercel or Netlify, set `VITE_API_URL`) and run the server on Render, Railway or your own server with `NODE_ENV=production` and `CLIENT_URL` set to the web app's address.

Container and pallet sizes in `seed.js` are typical published figures. Check them against your shipping line.

## Phase 0 + 1 (part page like the reference)

- **Projects → parts → part page** with 8 sections; 3D on the left (react-three-fiber), data on the right; EN / DE / ZH.
- **Runs** (`/api/runs`): each calculation is saved as `R-YYYY-NNNN` with frozen settings and results; old runs reload without recomputing.
- Engine `runPart` (`server/src/engine/run.js`): every carton × every container; carton height trimmed to the packed layers; pallets stacked up to N high under the roof minus clearance; cost per piece = carton price / pieces per carton + freight / pieces per container; recommended container per carton.
- **Confirm and lock** (section 7), **PDF record** (`GET /api/runs/:id/pdf`), **share link** off by default, public read-only view at `/s/:token`.
- Sections 2 (STEP upload), 3 (cluster) and real-shape packing algorithms in section 4 come in Phases 2–5. Runs are instant now; Phase 3 moves them onto a job queue.

## Phase 2 — STEP upload and the real part (section 2)

A third service reads CAD files. Start it next to the server and the web app:

```bash
cd cad-service
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt                          # Python 3.10–3.13
uvicorn app:app --host 127.0.0.1 --port 8000
python test_app.py                                       # 3 hand-checked tests
python make_samples.py                                   # sample parts in samples/ (clamp, flange, bracket)
```

- **Project page → Upload STEP**: STEP (.step/.stp) or STL, up to 50 MB. Weight from a material (volume × density) or entered in grams.
- **Section 2** shows the real 3D model, volume, bounding box, surface, triangles, watertight, solids, format, weight and packing position; replace the file or download the original.
- **Section 4** draws the real part in every carton slot. The engine still packs the part's bounding box; real-shape packing is Phase 4.
- Files are stored in `server/storage/<orgId>/<partId>/` (`STORAGE_DIR` in `server/.env`). The server reaches the CAD service at `CAD_SERVICE_URL`.
- **Materials** are master data (12 standard ones from `npm run seed`; customers can add their own).

## Phase 3 — background calculations and Running Jobs

- **Run calculation** now only queues the run (HTTP 202). A worker calculates it in a separate thread, so the API never blocks.
- The queue is the MongoDB `runs` collection (`queued → running → done | failed | cancelled`), so **no Redis is needed**. Workers claim runs atomically, so several can run side by side.
- **Presets**: Quick (10 s), Standard (60 s), Thorough (6 min). A run that goes over its budget + 50 % is stopped. The box engine needs < 1 s; the budget matters from Phase 4.
- **Live progress** in section 1 and sections 4–8, **Cancel** button, and a **Running Jobs** page (header) listing active runs and those finished in the last 24 h.
- Runs left "running" by a crashed server go back to the queue after 15 min (at most 3 attempts).
- By default the worker runs inside the API (`RUN_WORKER=true`, `WORKER_CONCURRENCY=2`). For heavier loads set `RUN_WORKER=false` and start `npm run worker` as its own process (one or more).

## Phase 4 — real-shape packing (section 4)

For parts with a STEP/STL file, every run (Standard and Thorough presets) also packs the **real geometry** in the CAD service (`cad-service/pack.py`, endpoint `POST /pack`):

- **Column Stacking** — copies stack into each other vertically (trays, cups, profiles), optionally with a sideways offset per layer (staircase).
- **Repeating Pattern** — like Column Stacking, plus side-by-side nesting and staggered rows (round parts).
- Works on a voxel model of the part (longest side / 64 for Standard, / 96 for Thorough). A voxel counts as solid whenever the surface touches it, so copies **never overlap** (they may touch). Every orientation of the part is tried (only turns about the vertical axis for upright parts).
- The best quotable count of Grid packing / Column Stacking / Repeating Pattern is used for the carton, its height trim, pallets, containers and cost. The carton weight limit still applies.
- Section 4 shows every algorithm with its count and compute time (★ = quoted), and draws the chosen arrangement with the real part. Baseline shows box grid packing in the carton as entered.
- If the CAD service is down, the run still finishes with box packing and says so.
- Tests: `python test_pack.py` checks with exact mesh booleans (`pip install manifold3d`) that no two packed copies overlap and that all are inside the carton. Sample `samples/tray.step` (stackable tray) nests 30 per carton where box packing fits 18.
- Not yet: copies turned against each other (pairs, interlocking clusters) — that is Phase 5 (Cluster).

## Phase 5 — clusters (section 3) and cluster packing

- `cad-service/cluster.py`: copies of the part are turned 180° (about Z, X and Y; only Z for upright parts) and slid together from every side until they touch, for pairs and pairs of pairs. Each cluster is scored by **fill** (part material / cluster box) and **vs. loose** (same pieces each in their own box = 100%).
- **Section 3** lists every cluster considered (best first) with pieces, size, fill, vs. loose, rotations and the cartons that use it, and shows the cluster in 3D (one colour per piece).
- **Cluster Packing** packs the best clusters side by side; **Nested Clusters** also lets clusters nest into each other. Both are tried in every carton, turned both ways; the best of all five algorithms is quoted.
- A 180° turn of the voxel grid is an exact rotation of the cells, and every piece keeps an exact matrix, so the no-overlap guarantee still holds (`python test_pack.py` checks it with exact mesh booleans).
- Example: `samples/bracket.step` — four L-brackets interlock into a 138 × 78 × 81 mm block (264 % vs. loose); in a 400 × 300 × 263 carton Cluster Packing fits 120 where box packing fits 50.
- Section 7 (Confirm winner) and the PDF now show the packing method actually used.
