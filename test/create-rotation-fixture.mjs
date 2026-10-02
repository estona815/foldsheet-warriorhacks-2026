import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pdfAdapter } from '../src/pdf-adapter.mjs';
const require = createRequire(import.meta.url);
const lib = require('../vendor/pdf-lib.min.js');
const document = await lib.PDFDocument.create();
const font = await document.embedFont(lib.StandardFonts.Helvetica);
for (const [index, angle] of [0, 90, 180, 270].entries()) {
  const page = document.addPage([420, 595]);
  page.setCropBox(40, 30, 320, 520);
  page.drawText(`PAGE ${index + 1} - ROTATE ${angle}`, { x: 65, y: 470, size: 16, font });
  page.drawText('TOP LEFT', { x: 60, y: 520, size: 12, font });
  page.drawText('BOTTOM RIGHT', { x: 235, y: 55, size: 12, font });
  page.drawText('OUTSIDE CROP', { x: 10, y: 570, size: 16, font });
  page.drawRectangle({ x: 55, y: 500, width: 12, height: 12, color: lib.rgb(0.8, 0.1, 0.1) });
  page.drawRectangle({ x: 330, y: 45, width: 12, height: 12, color: lib.rgb(0.1, 0.2, 0.8) });
  page.drawText(String(index + 1), { x: 130, y: 260, size: 90, font });
  page.setRotation(lib.degrees(angle));
}
const bytes = await document.save();
const fixtures = new URL('./fixtures/', import.meta.url);
await mkdir(fixtures, { recursive: true });
await writeFile(new URL('rotated-cropped.pdf', fixtures), bytes, { flag: 'wx' });
const adapter = pdfAdapter(lib);
const input = await adapter.read(bytes);
await writeFile(new URL('../foldsheet__rotation-output__2026-10-02__v001.pdf', import.meta.url),
  await adapter.impose(input), { flag: 'wx' });
console.log('Created four-page synthetic rotation fixture and two-side imposed QA output.');
