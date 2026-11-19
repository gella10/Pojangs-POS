// Backend tests (Jest + Supertest). They use a FAKE database, so no PostgreSQL is needed to run them.
import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp } from '../src/app.js';
import { sessions } from '../src/middleware/auth.js';

/** Build an app with a fake db and a ready-made signed-in session for the chosen role. */
function setup(role = 'staff') {
  const db = { query: jest.fn(), connect: jest.fn() };
  const token = `test-token-${role}`;
  sessions.set(token, { user: `${role}-user`, role, last: Date.now() });
  return { db, app: createApp(db), auth: { Authorization: `Bearer ${token}` } };
}

describe('API', () => {
  test('B-T1 GET /api/health returns ok', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('B-T2 account locks after 5 wrong passwords (AC-43)', async () => {
    const { app, db } = setup();
    db.query.mockResolvedValue({ rows: [] }); // user not found -> always "wrong password"
    const login = () => request(app).post('/api/auth/login').send({ username: 'lock-test', password: 'wrong-pass' });
    for (let i = 0; i < 5; i += 1) expect((await login()).status).toBe(401);
    expect((await login()).status).toBe(423);
  });

  test('B-T3 orders require a signed-in session (FR-18)', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(401);
  });

  test('B-T4 Samyang Buldak without a flavour is rejected (AC-04)', async () => {
    const { app, db, auth } = setup('staff');
    db.query.mockResolvedValueOnce({ rows: [{ id: 4, name: 'Samyang Buldak', category: 'Noodles', price: 100, available: true }] });
    const res = await request(app).post('/api/orders').set(auth)
      .send({ items: [{ id: 4, qty: 1 }], order_type: 'dine_in', payment: 'Cash' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/flavour/i);
  });

  test('B-T5 reconciliation shows +1 and Check for sales 2,500 vs cash 2,501 (AC-31, AC-32)', async () => {
    const { app, db, auth } = setup('owner');
    db.query.mockResolvedValueOnce({ rows: [{ total: 2500 }] }).mockResolvedValueOnce({ rows: [{ total: 2501 }] });
    const res = await request(app).get('/api/reconciliation?date=2026-07-21').set(auth);
    expect(res.body).toMatchObject({ difference: 1, status: 'Check' });
  });

  test('B-T6 a non-Buldak order needs no flavour and is priced by the server (AC-10)', async () => {
    const { app, db, auth } = setup('staff');
    db.query.mockResolvedValueOnce({ rows: [
      { id: 2, name: 'Jin Ramen Spicy', category: 'Noodles', price: 65, available: true },
      { id: 8, name: 'Fried Egg', category: 'Toppings', price: 15, available: true }] });
    const client = {
      query: jest.fn(async (sql) => (sql.startsWith('INSERT INTO orders') ? { rows: [{ id: 9, total: 145 }] } : { rows: [] })),
      release: jest.fn(),
    };
    db.connect.mockResolvedValue(client);

    const res = await request(app).post('/api/orders').set(auth)
      .send({ items: [{ id: 2, qty: 2 }, { id: 8, qty: 1 }], order_type: 'dine_in', payment: 'Cash', total: 1 }); // fake client total ignored
    expect(res.status).toBe(201);
    const insertOrder = client.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO orders'));
    expect(insertOrder[1][4]).toBe(145); // 2 x 65 + 15
  });

  test('B-T7 staff cannot read orders (owner only)', async () => {
    const { app, auth } = setup('staff');
    const res = await request(app).get('/api/orders').set(auth);
    expect(res.status).toBe(403);
  });

  test('B-T8 sign up rejects a short password', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/auth/register').send({ username: 'mae_01', password: 'short' });
    expect(res.status).toBe(400);
  });

  test('B-T9 bad id gives 400 and unknown route gives 404', async () => {
    const { app, auth } = setup('owner');
    expect((await request(app).get('/api/menu/abc').set(auth)).status).toBe(400);
    const missing = await request(app).get('/api/nonexistent');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Not found' });
  });
});
