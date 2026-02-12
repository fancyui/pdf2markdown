const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, PDFName } = require('pdf-lib');
const logger = require('./logger');

/**
 * Extract embedded images from a PDF file
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputDir - Directory to save extracted images
 * @param {object|null} pageRange - Optional page range {start, end} (1-indexed)
 * @returns {Promise<Array>} Array of image info [{pageIndex, imageName, imagePath}]
 */
async function extractImagesFromPDF(pdfPath, outputDir, pageRange = null) {
  const images = [];
  const extractedHashes = new Set(); // For deduplication

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(dataBuffer);
    const pages = pdfDoc.getPages();

    logger.debug(`PDF has ${pages.length} pages`);

    // Determine page range to process
    const startPage = pageRange ? Math.max(0, pageRange.start - 1) : 0;
    const endPage = pageRange ? Math.min(pages.length, pageRange.end) : pages.length;

    for (let pageIndex = startPage; pageIndex < endPage; pageIndex++) {
      const page = pages[pageIndex];
      const pageNum = pageIndex + 1; // 1-indexed for output

      // Get page resources
      const resources = page.node.Resources();
      if (!resources) {
        continue;
      }

      // Get XObjects dictionary
      const xObjects = resources.get(PDFName.of('XObject'));
      if (!xObjects) {
        continue;
      }

      let imgIndex = 0;
      for (const key of xObjects.keys()) {
        try {
          const xObjectRef = xObjects.get(key);

          // Resolve reference if needed
          let xObject = xObjectRef;
          if (xObjectRef.constructor.name === 'PDFRef') {
            xObject = pdfDoc.context.lookup(xObjectRef);
          }

          if (!xObject || xObject.constructor.name !== 'PDFRawStream') {
            continue;
          }

          // Check if it's an image
          const dict = xObject.dict;
          const subtype = dict.get(PDFName.of('Subtype'));
          if (!subtype || subtype.encodedName !== '/Image') {
            continue;
          }

          // Get image properties
          const widthObj = dict.get(PDFName.of('Width'));
          const heightObj = dict.get(PDFName.of('Height'));
          const filterObj = dict.get(PDFName.of('Filter'));
          const colorSpaceObj = dict.get(PDFName.of('ColorSpace'));
          const bpcObj = dict.get(PDFName.of('BitsPerComponent'));

          const width = widthObj ? widthObj.asNumber() : 0;
          const height = heightObj ? heightObj.asNumber() : 0;
          const filter = filterObj ? filterObj.encodedName : '';
          const colorSpace = colorSpaceObj ? colorSpaceObj.encodedName : '';
          const bpc = bpcObj ? bpcObj.asNumber() : 8;

          // Get the raw image data
          const rawData = Buffer.from(xObject.contents);
          if (!rawData || rawData.length === 0) {
            continue;
          }

          // Try to extract usable image data
          const imageData = extractImageData(rawData, filter, width, height, colorSpace, bpc);
          if (!imageData || !imageData.data || imageData.data.length === 0) {
            continue;
          }

          // Generate hash for deduplication
          const hash = crypto.createHash('md5').update(imageData.data).digest('hex');

          if (extractedHashes.has(hash)) {
            logger.debug(`Skipping duplicate image on page ${pageNum}`);
            continue;
          }
          extractedHashes.add(hash);

          // Generate filename
          imgIndex++;
          const imageName = `page${pageNum}_img${imgIndex}.${imageData.extension}`;
          const imagePath = path.join(outputDir, imageName);

          // Save image
          fs.writeFileSync(imagePath, imageData.data);

          images.push({
            pageIndex: pageNum, // 1-indexed
            imageName,
            imagePath
          });

          logger.debug(`Extracted image: ${imageName} (${width}x${height}, filter: ${filter})`);
        } catch (imgError) {
          logger.warn(`Failed to extract image from page ${pageNum}: ${imgError.message}`);
        }
      }
    }

    logger.info(`Extracted ${images.length} images from PDF`);
    return images;

  } catch (error) {
    logger.error('Error extracting images from PDF:', error);
    // Don't throw - image extraction failure shouldn't break the main flow
    return images;
  }
}

/**
 * Extract usable image data from raw PDF stream data
 */
function extractImageData(rawData, filter, width, height, colorSpace, bpc) {
  const zlib = require('zlib');

  // DCTDecode = JPEG (already compressed as JPEG, ready to use)
  if (filter === '/DCTDecode') {
    return { data: rawData, extension: 'jpg' };
  }

  // JPXDecode = JPEG2000
  if (filter === '/JPXDecode') {
    return { data: rawData, extension: 'jp2' };
  }

  // Check magic bytes to detect format (some PDFs store JPEG without DCTDecode filter)
  if (rawData.length >= 4) {
    // JPEG magic bytes
    if (rawData[0] === 0xFF && rawData[1] === 0xD8) {
      return { data: rawData, extension: 'jpg' };
    }
    // PNG magic bytes
    if (rawData[0] === 0x89 && rawData[1] === 0x50 && rawData[2] === 0x4E && rawData[3] === 0x47) {
      return { data: rawData, extension: 'png' };
    }
  }

  // FlateDecode = zlib compressed raw pixel data
  if (filter === '/FlateDecode') {
    try {
      // First decompress the zlib data
      const decompressed = zlib.inflateSync(rawData);

      // Try to create PNG from decompressed raw pixels
      const pngData = createPngFromRawPixels(decompressed, width, height, colorSpace, bpc);
      if (pngData) {
        return { data: pngData, extension: 'png' };
      }
    } catch (decompressError) {
      logger.debug(`Failed to decompress FlateDecode data: ${decompressError.message}`);
    }
    // Fallback: save as raw zlib data
    logger.debug(`Could not create PNG for FlateDecode image, saving as raw`);
    return { data: rawData, extension: 'raw' };
  }

  // Unknown filter - try to save as-is
  logger.debug(`Unknown filter: ${filter}, saving as raw`);
  return { data: rawData, extension: 'raw' };
}

/**
 * Create a PNG buffer from raw pixel data (already decompressed from FlateDecode)
 */
function createPngFromRawPixels(rawData, width, height, colorSpace, bitsPerComponent) {
  try {
    if (width <= 0 || height <= 0 || rawData.length === 0) {
      return null;
    }

    // Determine color type based on color space
    let colorType = 2; // RGB by default
    let channels = 3;

    if (colorSpace === '/DeviceGray' || colorSpace === '/G') {
      colorType = 0; // Grayscale
      channels = 1;
    } else if (colorSpace === '/DeviceCMYK') {
      // CMYK needs conversion to RGB - skip for now
      logger.debug('CMYK colorspace not supported for PNG conversion');
      return null;
    } else if (colorSpace === '/DeviceRGB' || colorSpace === '/RGB') {
      colorType = 2; // RGB
      channels = 3;
    } else if (colorSpace === '/DeviceGray' || colorSpace === '/G') {
      colorType = 0;
      channels = 1;
    }

    const bitDepth = bitsPerComponent || 8;

    // Calculate expected size
    const expectedSize = width * height * channels * (bitDepth / 8);
    if (rawData.length < expectedSize) {
      logger.debug(`Raw data too small: ${rawData.length} < ${expectedSize}`);
      return null;
    }

    // Add filter byte (0 = None) for each row
    const rowSize = width * channels;
    const filteredData = Buffer.alloc(height * (rowSize + 1));
    let destIdx = 0;
    let srcIdx = 0;

    for (let y = 0; y < height; y++) {
      filteredData[destIdx++] = 0; // Filter type: None
      rawData.copy(filteredData, destIdx, srcIdx, srcIdx + rowSize);
      destIdx += rowSize;
      srcIdx += rowSize;
    }

    // Build PNG chunks
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(filteredData);

    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(bitDepth, 8); // bit depth
    ihdrData.writeUInt8(colorType, 9); // color type
    ihdrData.writeUInt8(0, 10); // compression
    ihdrData.writeUInt8(0, 11); // filter
    ihdrData.writeUInt8(0, 12); // interlace
    const ihdr = createPngChunk('IHDR', ihdrData);

    // IDAT chunk
    const idat = createPngChunk('IDAT', compressed);

    // IEND chunk
    const iend = createPngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);

  } catch (error) {
    logger.debug(`Failed to create PNG: ${error.message}`);
    return null;
  }
}

/**
 * Create a PNG chunk
 */
function createPngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');

  // Calculate CRC32 of type + data
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

/**
 * Calculate CRC32
 */
function crc32(data) {
  const table = getCrc32Table();
  let crc = 0xFFFFFFFF;

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return crc ^ 0xFFFFFFFF;
}

let crc32Table = null;
function getCrc32Table() {
  if (crc32Table) return crc32Table;

  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c;
  }
  return crc32Table;
}

/**
 * Build image map organized by page
 * @param {Array} images - Array of image info
 * @returns {object} Map of pageIndex -> [imageName, ...]
 */
function buildImageMap(images) {
  const map = {};
  for (const img of images) {
    if (!map[img.pageIndex]) {
      map[img.pageIndex] = [];
    }
    map[img.pageIndex].push(`./images/${img.imageName}`);
  }
  return map;
}

/**
 * Generate a unique task ID
 * @returns {string} Random task ID
 */
function generateTaskId() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = {
  extractImagesFromPDF,
  buildImageMap,
  generateTaskId
};
