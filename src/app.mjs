import { pdfAdapter, MAX_BYTES } from './pdf-adapter.mjs';
import * as pdfjs from '../vendor/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
const adapter = pdfAdapter(globalThis.PDFLib);
const ids = ['sample','file','paper','margin','rotation','export','clear','sheet','front','back','status','canvas','empty','document-info','page-labels','summary','order-body','calibrate'];
const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
let source = null, generated = null, preview = null, side = 'front', busy = false;
let renderJob = null;
let marginTimer = null;
function status(message, error = false) { ui.status.textContent = message; ui.status.classList.toggle('error', error); }
function controls() {
  for (const id of ['sample','file','paper','margin','rotation','calibrate']) ui[id].disabled = busy;
  for (const id of ['sheet','front','back','export']) ui[id].disabled = busy || !generated;
  ui.clear.disabled = busy || !source;
}
async function disposePreview() {
  if (renderJob) { renderJob.cancel(); renderJob = null; }
  if (preview) { await preview.destroy(); preview = null; }
}
async function reset() {
  clearTimeout(marginTimer); marginTimer = null;
  await disposePreview(); source = generated = null; side = 'front';
  ui.canvas.hidden = true; ui.empty.hidden = false;
  ui['document-info'].textContent = 'No PDF selected';
  ui['page-labels'].replaceChildren(); ui['order-body'].replaceChildren();
  ui.summary.textContent = 'Load a PDF to see the complete printing plan.';
  ui.sheet.replaceChildren(new Option('—', '0'));
  ui.front.setAttribute('aria-pressed', 'true'); ui.back.setAttribute('aria-pressed', 'false');
  ui.file.value = ''; controls();
}
function describePlan() {
  const { plan } = source;
  ui.summary.textContent = `${plan.pageCount} pages · ${plan.sheets.length} ${plan.sheets.length === 1 ? 'sheet' : 'sheets'} · ${plan.blanks} added blanks. Table order is before back-side rotation.`;
  ui['order-body'].replaceChildren(...plan.sheets.map(sheet => {
    const row = document.createElement('tr');
    for (const value of [sheet.number, ...sheet.front, ...sheet.back]) {
      const cell = document.createElement('td'); cell.textContent = value === null ? 'Blank' : String(value); row.append(cell);
    }
    return row;
  }));
  ui.sheet.replaceChildren(...plan.sheets.map((sheet, i) => new Option(`${sheet.number} of ${plan.sheets.length}`, String(i))));
}
async function render() {
  if (!preview || !source) return;
  if (renderJob) renderJob.cancel();
  const sheetIndex = Number(ui.sheet.value);
  const page = await preview.getPage(sheetIndex * 2 + (side === 'front' ? 1 : 2));
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(1.5, 1200 / base.width) });
  ui.canvas.width = Math.ceil(viewport.width); ui.canvas.height = Math.ceil(viewport.height);
  renderJob = page.render({ canvasContext: ui.canvas.getContext('2d'), viewport });
  try { await renderJob.promise; } catch (error) { if (error.name === 'RenderingCancelledException') return; throw error; }
  renderJob = null; ui.canvas.hidden = false; ui.empty.hidden = true;
  ui.canvas.setAttribute('aria-label', `Sheet ${sheetIndex + 1}, ${side}`);
  const labels = [...source.plan.sheets[sheetIndex][side]];
  if (side === 'back' && Number(ui.rotation.value) === 180) labels.reverse();
  ui['page-labels'].replaceChildren(...labels.map(number => {
    const label = document.createElement('span'); label.textContent = number === null ? 'Blank page' : `Original page ${number}`; return label;
  }));
  ui.front.setAttribute('aria-pressed', String(side === 'front'));
  ui.back.setAttribute('aria-pressed', String(side === 'back'));
}
async function rebuild() {
  generated = null;
  await disposePreview();
  const bytes = await adapter.impose(source, {
    paper: ui.paper.value, marginMm: ui.margin.value === '' ? NaN : Number(ui.margin.value),
    backRotation: Number(ui.rotation.value),
  });
  const loading = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false,
    enableXfa: false, maxImageSize: 16_000_000, stopAtErrors: true });
  preview = await loading.promise;
  await render();
  generated = bytes;
  status(`Ready: ${source.plan.sheets.length} ${source.plan.sheets.length === 1 ? 'sheet' : 'sheets'}, ${preview.numPages} print sides. Export matches this preview.`);
}
async function run(operation) {
  if (busy) return;
  busy = true; controls();
  try { await operation(); } catch (error) {
    generated = null; ui.canvas.hidden = true; ui.empty.hidden = false;
    ui['page-labels'].replaceChildren(); status(error.message || 'The PDF could not be processed.', true);
  } finally { busy = false; controls(); }
}
async function open(bytes, name) {
  await reset(); status('Reading and arranging your PDF…');
  source = await adapter.read(bytes);
  ui['document-info'].textContent = `${name} · ${source.plan.pageCount} pages`;
  describePlan(); await rebuild();
}
function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
ui.sample.addEventListener('click', () => run(async () => open(await adapter.sample(), 'Workshop sample')));
ui.file.addEventListener('change', () => run(async () => {
  const file = ui.file.files[0]; if (!file) return;
  if (file.size > MAX_BYTES) { await reset(); throw new Error('Choose a PDF smaller than 20 MiB.'); }
  const name = file.name;
  await open(new Uint8Array(await file.arrayBuffer()), name);
}));
for (const id of ['paper','rotation']) ui[id].addEventListener('change', () => {
  if (source) run(rebuild);
});
// Typed values fire input before a committed change. Never export an old
// layout while the visible setting differs from its cached PDF.
ui.margin.addEventListener('input', () => {
  clearTimeout(marginTimer); marginTimer = null;
  if (!source) return;
  generated = null; ui.canvas.hidden = true; ui.empty.hidden = false;
  ui['page-labels'].replaceChildren(); controls();
  const value = ui.margin.value === '' ? NaN : Number(ui.margin.value);
  if (!Number.isFinite(value) || value < 0 || value > 20) {
    status('Choose a margin from 0 to 20 mm.', true); return;
  }
  status('Updating the print preview…');
  marginTimer = setTimeout(() => { marginTimer = null; if (source) run(rebuild); }, 250);
});
ui.margin.addEventListener('change', () => {
  clearTimeout(marginTimer); marginTimer = null;
  if (source) run(rebuild);
});
ui.sheet.addEventListener('change', () => run(render));
ui.front.addEventListener('click', () => run(async () => { side = 'front'; await render(); }));
ui.back.addEventListener('click', () => run(async () => { side = 'back'; await render(); }));
ui.clear.addEventListener('click', () => run(async () => { await reset(); status('Document cleared. Open a sample or choose another PDF.'); }));
ui.export.addEventListener('click', () => {
  if (generated && !busy) download(generated, 'foldsheet-booklet.pdf');
});
ui.calibrate.addEventListener('click', () => run(async () => {
  download(await adapter.calibration({ paper: ui.paper.value, backRotation: Number(ui.rotation.value) }), 'foldsheet-calibration.pdf');
  status('Calibration PDF downloaded. Print both sides at actual size and inspect the TOP labels.');
}));
controls();
