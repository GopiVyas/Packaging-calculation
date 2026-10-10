// Proves one customer can never see or change another customer's data.
// Needs a throwaway database:  MONGODB_URI_TEST=mongodb+srv://.../ps_test npm test
// (skipped automatically when MONGODB_URI_TEST is not set)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI_TEST;
process.env.JWT_SECRET ||= 'test-secret';
process.env.MONGODB_URI ||= uri || 'mongodb://unused';

describe.skipIf(!uri)('tenant isolation (API)', () => {
  let server, base;
  const jar = {};

  async function call(who, method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(jar[who] ? { cookie: jar[who] } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) jar[who] = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  beforeAll(async () => {
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    const { createApp } = await import('../app.js');
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}/api`;
    const Pallet = (await import('../models/Pallet.js')).default;
    await Pallet.collection.insertOne({ name: 'Template pallet', L: 1200, W: 1000, deckH: 150, maxStackH: 1800, maxLoadKg: 1000, weightKg: 25, orgId: null });
    for (const who of ['a', 'b']) {
      const r = await call(who, 'POST', '/auth/signup', { orgName: `Org ${who}`, name: `User ${who}`, email: `${who}@test.local`, password: 'password123' });
      expect(r.status).toBe(201);
    }
  });

  afterAll(async () => {
    server?.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('B cannot read, edit or delete A\'s part', async () => {
    const created = await call('a', 'POST', '/parts', { name: 'Secret hub', shape: 'box', dims: { length: 220, width: 220, height: 120 }, weight: 2.4 });
    expect(created.status).toBe(201);
    const id = created.body._id;

    expect((await call('b', 'GET', '/parts')).body).toHaveLength(0);
    expect((await call('b', 'GET', `/parts/${id}`)).status).toBe(404);
    expect((await call('b', 'PUT', `/parts/${id}`, { name: 'Hacked' })).status).toBe(404);
    expect((await call('b', 'DELETE', `/parts/${id}`)).status).toBe(404);
    expect((await call('a', 'GET', `/parts/${id}`)).body.name).toBe('Secret hub');
  });

  it('orgId sent by the client is ignored', async () => {
    const meA = await call('a', 'GET', '/auth/me');
    const r = await call('b', 'POST', '/cartons', { name: 'Sneaky', innerL: 100, innerW: 100, innerH: 100, maxWeightKg: 10, orgId: meA.body.org.id });
    expect(r.status).toBe(201);
    expect((await call('a', 'GET', '/cartons')).body.map((c) => c.name)).not.toContain('Sneaky');
  });

  it('both see the standard pallet template, neither can edit it', async () => {
    const list = (await call('a', 'GET', '/pallets')).body;
    const tpl = list.find((p) => p.isTemplate);
    expect(tpl).toBeTruthy();
    expect((await call('b', 'GET', '/pallets')).body.some((p) => p.isTemplate)).toBe(true);
    expect((await call('a', 'PUT', `/pallets/${tpl._id}`, { name: 'Mine now' })).status).toBe(404);
    expect((await call('a', 'POST', `/pallets/${tpl._id}/copy`)).status).toBe(201);
  });

  it('a query without orgId is refused by the tenant guard', async () => {
    const Part = (await import('../models/Part.js')).default;
    await expect(Part.find({})).rejects.toThrow(/Tenant guard/);
  });
});
