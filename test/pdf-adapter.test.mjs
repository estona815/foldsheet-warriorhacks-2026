import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { pdfAdapter, MAX_BYTES } from '../src/pdf-adapter.mjs';
const require = createRequire(import.meta.url);
const lib = require('../vendor/pdf-lib.min.js');
const adapter = pdfAdapter(lib);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('sample becomes six real PDF sides; source bytes remain unchanged', async () => {
  const source = await adapter.sample();
  const before = hash(source);
  const input = await adapter.read(source);
  const bytes = await adapter.impose(input);
  const output = await lib.PDFDocument.load(bytes);
  assert.equal(output.getPageCount(), 6);
  assert.equal(hash(source), before);
  for (const page of output.getPages()) {
    assert.equal(page.getWidth(), 841.8898);
    assert.equal(page.getHeight(), 595.2756);
    const resources = page.node.Resources();
    assert.equal(resources.lookup(lib.PDFName.of('XObject'), lib.PDFDict).keys().length, 2);
  }
});

test('padded blank cells are not replaced by duplicated source pages', async () => {
  const doc = await lib.PDFDocument.create();
  doc.addPage().drawText('Only one page');
  const input = await adapter.read(await doc.save());
  const output = await lib.PDFDocument.load(await adapter.impose(input));
  assert.equal(output.getPageCount(), 2);
  const front = output.getPage(0).node.Resources();
  assert.equal(front.lookup(lib.PDFName.of('XObject'), lib.PDFDict).keys().length, 1);
});

test('all orthogonal source rotations and optional back rotation serialize', async () => {
  const doc = await lib.PDFDocument.create();
  for (const angle of [0, 90, 180, 270]) {
    const page = doc.addPage([100, 200]);
    page.drawText('TOP'); page.setRotation(lib.degrees(angle));
  }
  const input = await adapter.read(await doc.save());
  const output = await lib.PDFDocument.load(await adapter.impose(input,
    { paper: 'Letter', marginMm: 20, backRotation: 180 }));
  assert.equal(output.getPage(0).getRotation().angle, 0);
  assert.equal(output.getPage(1).getRotation().angle, 180);
});

test('invalid file sizes and malformed data fail', async () => {
  for (const bytes of [new Uint8Array(), new Uint8Array(MAX_BYTES + 1),
    new TextEncoder().encode('not a PDF')]) {
    await assert.rejects(adapter.read(bytes));
  }
});

test('interactive PDF is rejected to avoid silent loss of field appearances', async () => {
  const doc = await lib.PDFDocument.create();
  const page = doc.addPage();
  const field = doc.getForm().createTextField('example');
  field.setText('Important'); field.addToPage(page);
  await assert.rejects(adapter.read(await doc.save()), /Annotated or interactive/);
});

test('invalid export options fail without modifying the input', async () => {
  const input = await adapter.read(await adapter.sample());
  for (const options of [{ paper: 'A3' }, { marginMm: -1 },
    { marginMm: NaN }, { marginMm: 21 }, { backRotation: 90 }]) {
    await assert.rejects(adapter.impose(input, options));
  }
});

test('printer calibration has two sides and preserves selected back rotation', async () => {
  const bytes = await adapter.calibration({ paper: 'Letter', backRotation: 180 });
  const doc = await lib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  assert.equal(doc.getPage(0).getWidth(), 792);
  assert.equal(doc.getPage(1).getRotation().angle, 180);
  await assert.rejects(adapter.calibration({ paper: 'A3' }));
});

test('encrypted fixture is rejected without ignoring encryption', async () => {
  const bytes = new Uint8Array(await readFile(new URL('./fixtures/encrypted.pdf', import.meta.url)));
  await assert.rejects(adapter.read(bytes), /password-protected|Encrypted/);
});

test('cropped rotation fixture imports all four orientations without changing source bytes', async () => {
  const bytes = new Uint8Array(await readFile(new URL('./fixtures/rotated-cropped.pdf', import.meta.url)));
  const before = hash(bytes);
  const input = await adapter.read(bytes);
  assert.deepEqual(input.pages.map(p => p.rotation), [0, 90, 180, 270]);
  assert(input.pages.every(p => p.box.x === 40 && p.box.y === 30 && p.box.width === 320 && p.box.height === 520));
  const output = await lib.PDFDocument.load(await adapter.impose(input));
  assert.equal(output.getPageCount(), 2);
  assert.equal(hash(bytes), before);
});
