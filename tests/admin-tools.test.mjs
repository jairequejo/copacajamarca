import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAppUpdate, activateAppUpdate, freshPageURL, registerAdminPWA } from '../admin/app-update.js';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { loadCarnetPeople, carnetPersonName, carnetFileName } from '../admin/carnets-data.js';

test('Web and registered PWA states are distinguished without inventing an update', async () => {
  assert.deepEqual(await checkAppUpdate(undefined, 'https://example.test/admin/'), { kind: 'web' });
  assert.deepEqual(await checkAppUpdate({ getRegistration: async () => undefined }, 'https://example.test/admin/'), { kind: 'web' });
  let checked = false;
  const registration = { update: async () => { checked = true; }, waiting: null };
  const serviceWorker = { getRegistration: async () => registration };
  assert.equal((await checkAppUpdate(serviceWorker)).kind, 'current');
  assert.equal(checked, true);
  registration.waiting = {};
  assert.equal((await checkAppUpdate(serviceWorker)).kind, 'ready');
  registration.update = async () => { throw new Error('Offline'); };
  await assert.rejects(checkAppUpdate(serviceWorker), /Offline/);
});

test('PWA checks wait for installation and preserve failures', async () => {
  const worker = new EventTarget();
  worker.state = 'installing';
  const registration = { installing: worker, update: async () => {}, waiting: null };
  const pending = checkAppUpdate({ getRegistration: async () => registration });
  setImmediate(() => {
    worker.state = 'installed';
    registration.waiting = worker;
    worker.dispatchEvent(new Event('statechange'));
  });
  assert.equal((await pending).kind, 'ready');
  worker.state = 'redundant';
  await assert.rejects(checkAppUpdate({ getRegistration: async () => registration }), /No se pudo instalar/);
});

test('PWA activation only succeeds after the waiting worker activates', async () => {
  const serviceWorker = new EventTarget();
  const worker = new EventTarget();
  worker.state = 'installed';
  worker.postMessage = message => {
    assert.deepEqual(message, { type: 'SKIP_WAITING' });
    serviceWorker.controller = worker;
    worker.state = 'activated';
    serviceWorker.dispatchEvent(new Event('controllerchange'));
  };
  await activateAppUpdate(serviceWorker, { waiting: worker });
  worker.state = 'installed';
  serviceWorker.controller = null;
  worker.postMessage = () => {};
  await assert.rejects(activateAppUpdate(serviceWorker, { waiting: worker }, 5), /Cierra las otras ventanas/);
  await assert.rejects(activateAppUpdate(serviceWorker, {}), /ya no está pendiente/);
});

test('PWA registration stays within Admin and bypasses worker script caching', async () => {
  const registration = {};
  const serviceWorker = {
    ready: Promise.resolve(registration),
    register: async (url, options) => {
      assert.equal(url, 'https://example.test/admin/sw.js');
      assert.deepEqual(options, { scope: 'https://example.test/admin/', updateViaCache: 'none' });
      return registration;
    },
  };
  assert.equal(await registerAdminPWA(serviceWorker, 'https://example.test/admin/app-update.js?v=1'), registration);
  assert.equal(await registerAdminPWA(undefined), null);
});

test('Admin worker accepts updates explicitly, claims clients, and never intercepts Supabase or persists data', async () => {
  const listeners = {}, requests = [];
  let skipped = false, claimed = false;
  const self = {
    registration: { scope: 'https://example.test/admin/' },
    addEventListener: (type, callback) => { listeners[type] = callback; },
    skipWaiting: () => { skipped = true; return Promise.resolve(); },
    clients: { claim: () => { claimed = true; return Promise.resolve(); } },
  };
  runInNewContext(await readFile(new URL('../admin/sw.js', import.meta.url), 'utf8'), {
    self, URL, fetch: async (request, options) => { requests.push({ request, options }); return 'response'; },
  });
  assert.equal(skipped, false);
  let pending;
  listeners.message({ data: { type: 'SKIP_WAITING' }, waitUntil: promise => { pending = promise; } });
  await pending;
  assert.equal(skipped, true);
  listeners.activate({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.equal(claimed, true);
  for (const url of ['https://example.test/fixture/', 'https://example.test/administrator/file', 'https://api.supabase.co/rest/v1/personas']) {
    listeners.fetch({ request: { url, method: 'GET' }, respondWith: () => assert.fail('Unrelated request intercepted') });
  }
  listeners.fetch({ request: { url: 'https://example.test/admin/admin.js?v=61', method: 'GET' }, respondWith: promise => { pending = promise; } });
  assert.equal(await pending, 'response');
  assert.equal(requests[0].options.cache, 'no-store');
});

test('Refresh preserves the chosen admin view and replaces a previous cache buster', () => {
  const url = new URL(freshPageURL('https://example.test/admin/?vista=carnets&cat=2014&actualizacion=1#preview', 2));
  assert.equal(url.searchParams.get('vista'), 'carnets');
  assert.equal(url.searchParams.get('cat'), '2014');
  assert.deepEqual(url.searchParams.getAll('actualizacion'), ['2']);
  assert.equal(url.hash, '#preview');
});

test('Carnet loading reads beyond Supabase first page and never presents a query failure as no people', async () => {
  const people = Array.from({ length: 501 }, (_, dni) => ({ dni }));
  const client = {
    from(table) {
      assert.equal(table, 'personas');
      const query = {
        select() { return query; },
        in(field, roles) { assert.equal(field, 'rol'); assert.deepEqual(roles, ['ENTRENADOR', 'DELEGADO', 'JUGADOR']); return query; },
        order() { return query; },
        range(start, end) { return { data: people.slice(start, end + 1), error: null }; },
      };
      return query;
    },
  };
  assert.equal((await loadCarnetPeople(client)).length, 501);
  const broken = {
    from() { const q = { select: () => q, in: () => q, order: () => q, range: () => ({ error: new Error('Permission denied') }) }; return q; },
  };
  await assert.rejects(loadCarnetPeople(broken), /Permission denied/);
});

test('Carnet search names use actual name fields and duplicate names do not overwrite PDFs', () => {
  assert.equal(carnetPersonName({ nombres: 'José', apellidos: 'Pérez' }), 'Pérez, José');
  assert.equal(carnetPersonName({ nombre_completo: 'José Pérez' }), 'José Pérez');
  const person = { name: 'José Pérez', role: 'JUGADOR', team: '../Equipo / A' };
  const first = carnetFileName({ ...person, dni: 'TEST-001' }, 1);
  const second = carnetFileName({ ...person, dni: 'TEST-002' }, 2);
  assert.notEqual(first, second);
  assert.equal(first.includes('..'), false);
  assert.match(first, /Jose_Perez_TEST-001\.pdf$/);
});
