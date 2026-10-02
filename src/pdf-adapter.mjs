import { planBooklet, fitPage } from './imposition.mjs';

export const MAX_BYTES = 20 * 1024 * 1024;
const papers = { A4: [841.8898, 595.2756], Letter: [792, 612] };

// Injection allows the same adapter to use the bundled browser and Node library.
export function pdfAdapter(lib) {
  const { PDFDocument, PDFName, degrees } = lib;

  async function read(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > MAX_BYTES) {
      throw new Error('Choose a PDF smaller than 20 MiB.');
    }
    const original = bytes.slice();
    let document;
    try {
      document = await PDFDocument.load(original, { ignoreEncryption: false, throwOnInvalidObject: true });
    } catch {
      throw new Error('This PDF is malformed or password-protected. Choose an unencrypted PDF.');
    }
    if (document.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
    const plan = planBooklet(document.getPageCount());
    const pages = document.getPages().map(page => {
      const box = page.getCropBox();
      const rotation = ((page.getRotation().angle % 360) + 360) % 360;
      if (![box.x, box.y, box.width, box.height].every(Number.isFinite)
          || Math.min(box.width, box.height) <= 0
          || Math.max(box.width, box.height) > 14400 || rotation % 90 !== 0) {
        throw new Error('This PDF has unsupported page dimensions or rotation.');
      }
      // Page annotations are not embedded as page graphics. Refuse silent loss.
      const annotations = page.node.lookupMaybe(PDFName.of('Annots'), lib.PDFArray);
      if (annotations && annotations.size() > 0) {
        throw new Error('Annotated or interactive PDFs are not supported. Export a flattened copy first.');
      }
      return { page, box, rotation };
    });
    return { original, document, pages, plan };
  }

  async function impose(input, { paper = 'A4', marginMm = 8, backRotation = 0 } = {}) {
    if (!Object.hasOwn(papers, paper) || !Number.isFinite(marginMm)
        || marginMm < 0 || marginMm > 20 || ![0, 180].includes(backRotation)) {
      throw new Error('Choose A4 or Letter, a 0–20 mm margin, and 0° or 180° back rotation.');
    }
    const [width, height] = papers[paper];
    const margin = marginMm * 72 / 25.4;
    const output = await PDFDocument.create();
    output.setTitle('FoldSheet booklet');
    output.setProducer('FoldSheet / pdf-lib');
    const embedded = new Map();
    for (const sheet of input.plan.sheets) {
      for (const side of ['front', 'back']) {
        const target = output.addPage([width, height]);
        if (side === 'back') target.setRotation(degrees(backRotation));
        for (const [cell, number] of sheet[side].entries()) {
          if (number === null) continue;
          const source = input.pages[number - 1];
          const { box, rotation } = source;
          if (!embedded.has(number)) {
            embedded.set(number, await output.embedPage(source.page, {
              left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height,
            }));
          }
          const sideways = rotation === 90 || rotation === 270;
          const fit = fitPage(sideways ? box.height : box.width,
            sideways ? box.width : box.height, width / 2, height, margin);
          const scale = fit.width / (sideways ? box.height : box.width);
          const dw = box.width * scale, dh = box.height * scale;
          let x = cell * width / 2 + fit.x, y = fit.y;
          const counterclockwise = (360 - rotation) % 360;
          if (counterclockwise === 90) x += dh;
          if (counterclockwise === 180) { x += dw; y += dh; }
          if (counterclockwise === 270) y += dw;
          target.drawPage(embedded.get(number), {
            x, y, width: dw, height: dh, rotate: degrees(counterclockwise),
          });
        }
      }
    }
    const bytes = await output.save();
    if (bytes.length > MAX_BYTES * 2) throw new Error('Output exceeds the 40 MiB limit.');
    return bytes;
  }

  async function sample() {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(lib.StandardFonts.Helvetica);
    for (let number = 1; number <= 12; number++) {
      const page = doc.addPage([420, 595]);
      page.drawText('COMMUNITY WORKSHOP', { x: 40, y: 535, size: 16, font });
      page.drawText(String(number), { x: 40, y: 290, size: 110, font });
      page.drawText('Synthetic sample - no personal data', { x: 40, y: 70, size: 12, font });
      page.drawText('TOP', { x: 40, y: 565, size: 10, font });
    }
    return doc.save();
  }

  async function calibration({ paper = 'A4', backRotation = 0 } = {}) {
    if (!Object.hasOwn(papers, paper) || ![0, 180].includes(backRotation)) {
      throw new Error('Choose A4 or Letter and a 0° or 180° back rotation.');
    }
    const [width, height] = papers[paper];
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(lib.StandardFonts.Helvetica);
    for (const side of ['FRONT', 'BACK']) {
      const page = doc.addPage([width, height]);
      if (side === 'BACK') page.setRotation(degrees(backRotation));
      page.drawText(`TOP - ${side}`, { x: 40, y: height - 60, font, size: 28 });
      page.drawText('LEFT', { x: 40, y: height / 2, font, size: 24 });
      page.drawText('RIGHT', { x: width - 125, y: height / 2, font, size: 24 });
      page.drawLine({ start: { x: width / 2, y: 40 }, end: { x: width / 2, y: height - 40 }, thickness: 1 });
      page.drawText('Print both sides at actual size. Fold at the center.', { x: 40, y: 70, font, size: 14 });
      page.drawText('Confirm TOP points the same way on both sides before a booklet run.', { x: 40, y: 45, font, size: 12 });
    }
    return doc.save();
  }

  return { read, impose, sample, calibration };
}
