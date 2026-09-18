const fs = require('fs');
const path = require('path');
const {
  createCanvas,
  DOMMatrix,
  Path2D,
  ImageData
} = require('@napi-rs/canvas');

// pdfjs-dist (v4) ships ESM builds only, so it is loaded lazily via import().
let pdfjsPromise = null;

const loadPdfjs = () => {
  if (!pdfjsPromise) {
    // Polyfill browser globals pdf.js expects. pdf.js normally gets these from
    // the `canvas` package (not installed here); @napi-rs/canvas provides them.
    if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrix;
    if (!globalThis.Path2D) globalThis.Path2D = Path2D;
    if (!globalThis.ImageData) globalThis.ImageData = ImageData;
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
};

const PDFJS_DIST_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'));

// Canvas factory backed by @napi-rs/canvas. pdf.js's built-in NodeCanvasFactory
// requires the unmaintained `canvas` package and crashes with
// "Cannot read properties of undefined (reading 'createCanvas')" without it.
class NapiCanvasFactory {
  create(width, height) {
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    const canvas = createCanvas(width, height);
    return {
      canvas,
      context: canvas.getContext('2d')
    };
  }

  reset(canvasAndContext, width, height) {
    if (!canvasAndContext.canvas) {
      throw new Error('Canvas is not specified');
    }
    if (width <= 0 || height <= 0) {
      throw new Error('Invalid canvas size');
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function convertPDFToImages(pdfPath, scale = 2) {
  const tempDir = path.join('uploads', 'temp_images');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const fileName = path.basename(pdfPath, '.pdf');
  const outputDir = path.join(tempDir, fileName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log(`Converting PDF to images: ${pdfPath}`);

    const pdfjs = await loadPdfjs();
    const pdfBuffer = fs.readFileSync(pdfPath);

    const doc = await pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      CanvasFactory: NapiCanvasFactory,
      // Built-in fonts/CMaps ship with pdfjs-dist (needed for non-embedded
      // standard fonts and CJK encodings)
      standardFontDataUrl: path.join(PDFJS_DIST_ROOT, 'standard_fonts') + path.sep,
      cMapUrl: path.join(PDFJS_DIST_ROOT, 'cmaps') + path.sep,
      cMapPacked: true,
      isEvalSupported: false
    }).promise;

    const files = [];
    try {
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');

        // White background: OCR input should not have alpha artifacts
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: context, viewport }).promise;

        const pngBuffer = await canvas.encode('png');
        const imagePath = path.join(outputDir, `page-${pageNum}.png`);
        fs.writeFileSync(imagePath, pngBuffer);
        files.push(imagePath);

        page.cleanup();
      }
    } finally {
      await doc.destroy();
    }

    if (files.length === 0) {
      throw new Error('PDF中没有页面');
    }

    console.log(`Found ${files.length} image files`);
    return files;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new Error(`PDF转换失败: ${error.message}`);
  }
}

module.exports = { convertPDFToImages };
