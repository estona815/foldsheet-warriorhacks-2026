export function planBooklet(pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 64) {
    throw new RangeError('Choose a PDF with 1–64 pages.');
  }
  const paddedCount = Math.ceil(pageCount / 4) * 4;
  const page = number => number <= pageCount ? number : null;
  const sheets = Array.from({ length: paddedCount / 4 }, (_, i) => ({
    number: i + 1,
    front: [page(paddedCount - 2 * i), page(1 + 2 * i)],
    back: [page(2 + 2 * i), page(paddedCount - 1 - 2 * i)],
  }));
  return { pageCount, paddedCount, blanks: paddedCount - pageCount, sheets };
}

export function fitPage(width, height, cellWidth, cellHeight, margin) {
  if (![width, height, cellWidth, cellHeight, margin].every(Number.isFinite)
      || Math.min(width, height, cellWidth, cellHeight) <= 0
      || margin < 0 || margin * 2 >= Math.min(cellWidth, cellHeight)) {
    throw new RangeError('Page dimensions and printable margins must be valid.');
  }
  const scale = Math.min((cellWidth - margin * 2) / width,
    (cellHeight - margin * 2) / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  return { width: drawWidth, height: drawHeight,
    x: (cellWidth - drawWidth) / 2, y: (cellHeight - drawHeight) / 2 };
}
