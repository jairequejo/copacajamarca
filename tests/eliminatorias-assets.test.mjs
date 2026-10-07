import test from 'node:test';
import assert from 'node:assert/strict';
import { loadImage, bracketAssets } from '../assets/js/eliminatorias-graphic.js';

const failures = new Set(), requests = [];
const originalImage = globalThis.Image, originalDocument = globalThis.document;
globalThis.Image = class {
  naturalWidth = 1080;
  set src(value) {
    requests.push(value);
    queueMicrotask(() => failures.has(value) ? this.onerror?.() : this.onload?.());
  }
};
globalThis.document = { fonts: { load: async () => [], ready: Promise.resolve() } };
test.after(() => {
  if (originalImage === undefined) delete globalThis.Image; else globalThis.Image = originalImage;
  if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
});

test('An unavailable image can load on the next export after the server recovers', async () => {
  const src = '/retry-after-server-recovery.png';
  failures.add(src);
  assert.equal(await loadImage(src), null);
  failures.delete(src);
  assert.ok(await loadImage(src));
  assert.equal(requests.filter(value => value === src).length, 2);
});

test('Repeated requests share a successful image download', async () => {
  const src = '/shared-image.png';
  const [first, second] = await Promise.all([loadImage(src), loadImage(src)]);
  assert.equal(first, second);
  assert.equal(await loadImage(src), first);
  assert.equal(requests.filter(value => value === src).length, 1);
});

test('Banner export refuses a missing stadium instead of producing a plain background, then recovers', async () => {
  const src = '/assets/img/fondo-eliminatorias-tunel.png', bracket = { matches: [], champion: null };
  failures.add(src);
  await assert.rejects(bracketAssets(bracket), error => error.code === 'BANNER_ASSET_MISSING' && /fondo/.test(error.message));
  failures.delete(src);
  const assets = await bracketAssets(bracket);
  assert.ok(assets.bg && assets.cup && assets.logo);
  assert.equal(requests.filter(value => value === src).length, 2);
});
