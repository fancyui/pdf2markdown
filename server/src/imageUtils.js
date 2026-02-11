const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Height of separator line between pages (pixels)
const SEPARATOR_HEIGHT = 4;
const SEPARATOR_COLOR = { r: 200, g: 200, b: 200 }; // Light gray

/**
 * Merge multiple images vertically into a single long image
 * @param {string[]} imagePaths - Array of image file paths
 * @param {string} outputPath - Output path for the merged image
 * @param {boolean} addSeparators - Add page separator lines (default: true)
 * @returns {Promise<string>} - Path to the merged image
 */
async function mergeImagesVertically(imagePaths, outputPath, addSeparators = true) {
    if (!imagePaths || imagePaths.length === 0) {
        throw new Error('No images to merge');
    }

    if (imagePaths.length === 1) {
        // Single image, just copy it
        fs.copyFileSync(imagePaths[0], outputPath);
        logger.debug(`Single image copied: ${imagePaths[0]} -> ${outputPath}`);
        return outputPath;
    }

    try {
        logger.info(`Merging ${imagePaths.length} images into long image...`);

        // Load all images and get their metadata
        const images = [];
        let maxWidth = 0;
        let totalHeight = 0;

        for (let i = 0; i < imagePaths.length; i++) {
            const imagePath = imagePaths[i];

            // Verify file exists
            if (!fs.existsSync(imagePath)) {
                logger.error(`Image file not found: ${imagePath}`);
                throw new Error(`Image file not found: ${imagePath}`);
            }

            const image = sharp(imagePath);
            const metadata = await image.metadata();

            logger.debug(`Image ${i + 1}: ${path.basename(imagePath)} - ${metadata.width}x${metadata.height}`);

            images.push({
                path: imagePath,
                width: metadata.width,
                height: metadata.height,
                channels: metadata.channels
            });

            maxWidth = Math.max(maxWidth, metadata.width);
            totalHeight += metadata.height;
        }

        // Add separator height between pages
        const separatorTotal = addSeparators ? (images.length - 1) * SEPARATOR_HEIGHT : 0;
        totalHeight += separatorTotal;

        logger.info(`Canvas size: ${maxWidth}x${totalHeight}, merging ${images.length} images${addSeparators ? ' (with separators)' : ''}`);

        // Limit: warn if image is too large (may cause API issues)
        const totalPixels = maxWidth * totalHeight;
        if (totalPixels > 50000000) { // 50 megapixels
            logger.warn(`Very large image: ${totalPixels} pixels, may cause API issues`);
        }

        // Create composite input for each image
        const compositeInputs = [];
        let currentY = 0;

        for (let i = 0; i < images.length; i++) {
            const img = images[i];

            // Resize to match max width (left-aligned, pad with white if needed)
            const tempBuffer = await sharp(img.path)
                .resize({
                    width: maxWidth,
                    height: img.height,
                    fit: 'contain',
                    position: 'northwest', // top-left alignment
                    background: { r: 255, g: 255, b: 255 }
                })
                .png()
                .toBuffer();

            compositeInputs.push({
                input: tempBuffer,
                top: currentY,
                left: 0
            });

            logger.debug(`Image ${i + 1} placed at Y: ${currentY}`);
            currentY += img.height;

            // Add separator line between pages (except after last page)
            if (addSeparators && i < images.length - 1) {
                const separatorBuffer = await sharp({
                    create: {
                        width: maxWidth,
                        height: SEPARATOR_HEIGHT,
                        channels: 3,
                        background: SEPARATOR_COLOR
                    }
                })
                .png()
                .toBuffer();

                compositeInputs.push({
                    input: separatorBuffer,
                    top: currentY,
                    left: 0
                });

                currentY += SEPARATOR_HEIGHT;
            }
        }

        // Create a white canvas and composite all images
        await sharp({
            create: {
                width: maxWidth,
                height: totalHeight,
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
            }
        })
        .composite(compositeInputs)
        .png()
        .toFile(outputPath);

        // Verify output file
        const outputStats = fs.statSync(outputPath);
        const outputMetadata = await sharp(outputPath).metadata();

        logger.info(`Long image created: ${outputPath}`);
        logger.info(`Output: ${outputMetadata.width}x${outputMetadata.height}, ${Math.round(outputStats.size / 1024)}KB`);

        // Verify dimensions match expected
        if (outputMetadata.height !== totalHeight) {
            logger.error(`Height mismatch! Expected: ${totalHeight}, Got: ${outputMetadata.height}`);
        }

        return outputPath;
    } catch (error) {
        logger.error('Error merging images:', error);
        throw new Error(`Failed to merge images: ${error.message}`);
    }
}

module.exports = {
    mergeImagesVertically
};
