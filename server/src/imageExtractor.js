const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const sharp = require('sharp');
const logger = require('./logger');

// Configuration for pdfimages binary
const PDFIMAGES_BIN = process.env.PDFIMAGES_BIN || 'pdfimages';

/**
 * Extract embedded images from a PDF file using pdfimages CLI
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

  const tempPrefix = path.join(outputDir, 'raw');

  try {
    // 1. Get image list with page numbers
    let listOptions = '-listonly';
    if (pageRange) {
      if (pageRange.start) listOptions += ` -f ${pageRange.start}`;
      if (pageRange.end) listOptions += ` -l ${pageRange.end}`;
    }
    const listCmd = `"${PDFIMAGES_BIN}" ${listOptions} "${pdfPath}"`;

    logger.debug(`Running pdfimages list: ${listCmd}`);
    const listOutput = execSync(listCmd, { encoding: 'utf8' });
    const listLines = listOutput.split('\n').filter(line => line.trim().startsWith('page='));

    if (listLines.length === 0) {
      logger.info('No images found in PDF using pdfimages -listonly');
      return images;
    }

    // 2. Extract images
    // -j: write JPEG images as JPEG, -J: write JPEG 2000 images as JP2
    let extractOptions = '-j -J';
    if (pageRange) {
      if (pageRange.start) extractOptions += ` -f ${pageRange.start}`;
      if (pageRange.end) extractOptions += ` -l ${pageRange.end}`;
    }
    const extractCmd = `"${PDFIMAGES_BIN}" ${extractOptions} "${pdfPath}" "${tempPrefix}"`;

    logger.debug(`Running pdfimages extract: ${extractCmd}`);
    execSync(extractCmd);

    // 3. Parse metadata for each image
    const imageMetadata = listLines.map(line => {
      const page = parseInt(line.match(/page=(\d+)/)?.[1] || '0');
      const width = parseInt(line.match(/width=(\d+)/)?.[1] || '0');
      const height = parseInt(line.match(/height=(\d+)/)?.[1] || '0');
      const colorspace = line.match(/colorspace=([^\s]+)/)?.[1] || '';
      return { page, width, height, colorspace };
    });

    // 4. Process extracted files
    // pdfimages names files as <prefix>-000.<ext>, <prefix>-001.<ext>, etc.
    const extractedFiles = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('raw-'))
      .sort();

    for (let i = 0; i < imageMetadata.length; i++) {
      const meta = imageMetadata[i];
      const tempFile = extractedFiles[i];
      if (!tempFile) continue;

      const tempFilePath = path.join(outputDir, tempFile);
      const ext = path.extname(tempFile).toLowerCase();

      // CHECK FOR MASK: 
      // If this image is on the same page and same size as the previous one, 
      // and this one is grayscale while previous was color, it's likely a mask.
      const prevImage = images[images.length - 1];
      const isMask = prevImage &&
        prevImage.pageIndex === meta.page &&
        prevImage.width === meta.width &&
        prevImage.height === meta.height &&
        (meta.colorspace === 'DeviceGray' || meta.colorspace === 'indexed');

      if (isMask) {
        try {
          logger.debug(`Detected mask for page ${meta.page} (${tempFile}). Merging...`);
          const colorPath = prevImage.imagePath;
          const maskPath = tempFilePath;
          const mergedPath = path.join(outputDir, `merged_${path.basename(colorPath)}`);

          // Apply mask as alpha channel
          // Note: Sharp needs to handle the input formats (PPM/PGM might need manual parse)
          let colorInput, maskInput;

          if (path.extname(colorPath) === '.ppm' || path.extname(colorPath) === '.pgm') {
            // This is tricky because prevImage.imagePath is already the converted PNG
            // but we might want the original raw data for better quality?
            // Actually, the previous image was already saved as PNG in the previous iteration.
            // We can just use that PNG.
            colorInput = prevImage.imagePath;
          } else {
            colorInput = prevImage.imagePath;
          }

          // For the current mask file (tempFilePath), it might be PGM
          if (ext === '.pgm' || ext === '.ppm') {
            const maskRaw = fs.readFileSync(tempFilePath);
            const maskInfo = parseNetpbm(maskRaw);
            maskInput = {
              create: {
                width: maskInfo.width,
                height: maskInfo.height,
                channels: maskInfo.channels,
                background: { r: 0, g: 0, b: 0, alpha: 1 }
              }
            };
            // Simpler way: convert mask to temporary PNG first or use buffer
            maskInput = await sharp(maskInfo.data, {
              raw: { width: maskInfo.width, height: maskInfo.height, channels: maskInfo.channels }
            }).png().toBuffer();
          } else {
            maskInput = tempFilePath;
          }

          await sharp(colorInput)
            .joinChannel(maskInput)
            .png()
            .toFile(mergedPath);

          // Replace original with merged
          fs.unlinkSync(colorPath);
          fs.renameSync(mergedPath, colorPath);

          logger.debug(`Successfully merged mask into ${prevImage.imageName}`);

          // Clean up mask temp file
          fs.unlinkSync(tempFilePath);
          continue; // Skip adding this mask as a separate image
        } catch (maskError) {
          logger.warn(`Failed to merge mask: ${maskError.message}`);
          // Fallback: process mask as a separate image (or just let it die)
        }
      }

      try {
        // Read raw data for hashing/deduplication
        const rawData = fs.readFileSync(tempFilePath);
        const hash = crypto.createHash('md5').update(rawData).digest('hex');

        if (extractedHashes.has(hash)) {
          logger.debug(`Skipping duplicate image on page ${meta.page} (${tempFile})`);
          fs.unlinkSync(tempFilePath);
          continue;
        }
        extractedHashes.add(hash);

        // Determine final filename
        const imgIndex = images.filter(img => img.pageIndex === meta.page).length + 1;
        const finalImageName = `page${meta.page}_img${imgIndex}.png`;
        const finalImagePath = path.join(outputDir, finalImageName);

        // Convert to PNG using sharp
        if (ext === '.ppm' || ext === '.pgm') {
          const pbmInfo = parseNetpbm(rawData);
          await sharp(pbmInfo.data, {
            raw: { width: pbmInfo.width, height: pbmInfo.height, channels: pbmInfo.channels }
          }).png().toFile(finalImagePath);
        } else {
          await sharp(tempFilePath).png().toFile(finalImagePath);
        }

        images.push({
          pageIndex: meta.page,
          imageName: finalImageName,
          imagePath: finalImagePath,
          width: meta.width,
          height: meta.height
        });

        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        logger.debug(`Extracted and converted: ${finalImageName} from ${tempFile}`);
      } catch (procError) {
        logger.warn(`Failed to process extracted image ${tempFile}: ${procError.message}`);
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    // Clean up any stray raw files
    const remainingRaw = fs.readdirSync(outputDir).filter(f => f.startsWith('raw-'));
    for (const f of remainingRaw) {
      fs.unlinkSync(path.join(outputDir, f));
    }

    logger.info(`Extracted ${images.length} images from PDF using pdfimages`);
    return images;

  } catch (error) {
    logger.error('Error extracting images using pdfimages:', error);
    return images;
  }
}

/**
 * Simple parser for PPM/PGM binary formats (P6/P5)
 * Returns {width, height, channels, data}
 */
function parseNetpbm(buffer) {
  let pos = 0;

  function nextToken() {
    // Skip comments and whitespace
    while (pos < buffer.length) {
      const char = String.fromCharCode(buffer[pos]);
      if (/\s/.test(char)) {
        pos++;
        continue;
      }
      if (char === '#') {
        // Skip comment line
        while (pos < buffer.length && buffer[pos] !== 10 && buffer[pos] !== 13) {
          pos++;
        }
        continue;
      }
      break;
    }

    let start = pos;
    while (pos < buffer.length && !/\s/.test(String.fromCharCode(buffer[pos]))) {
      pos++;
    }
    return buffer.slice(start, pos).toString();
  }

  const magic = nextToken();
  if (magic !== 'P6' && magic !== 'P5') {
    throw new Error(`Unsupported Netpbm format: ${magic}`);
  }

  const width = parseInt(nextToken());
  const height = parseInt(nextToken());
  const maxVal = parseInt(nextToken());

  if (isNaN(width) || isNaN(height) || isNaN(maxVal)) {
    throw new Error('Invalid PPM header');
  }

  if (maxVal !== 255) {
    throw new Error(`Unsupported maxVal: ${maxVal} (only 255 supported)`);
  }

  // Header ends with a single whitespace character (usually newline)
  pos++;
  const data = buffer.slice(pos);
  const channels = (magic === 'P6' ? 3 : 1);

  // Validate data size
  const expectedSize = width * height * channels;
  if (data.length < expectedSize) {
    throw new Error(`PPM data truncated: expected ${expectedSize}, got ${data.length}`);
  }

  return { width, height, channels, data: data.slice(0, expectedSize) };
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
