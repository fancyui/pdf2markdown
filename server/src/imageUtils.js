const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Merge multiple images vertically into a single long image
 * @param {string[]} imagePaths - Array of image file paths
 * @param {string} outputPath - Output path for the merged image
 * @returns {Promise<string>} - Path to the merged image
 */
async function mergeImagesVertically(imagePaths, outputPath) {
    if (!imagePaths || imagePaths.length === 0) {
        throw new Error('No images to merge');
    }

    if (imagePaths.length === 1) {
        // Single image, just copy it
        fs.copyFileSync(imagePaths[0], outputPath);
        return outputPath;
    }

    try {
        logger.debug(`Merging ${imagePaths.length} images into long image...`);

        // Load all images and get their metadata
        const images = [];
        let maxWidth = 0;
        let totalHeight = 0;

        for (const imagePath of imagePaths) {
            const image = sharp(imagePath);
            const metadata = await image.metadata();

            images.push({
                path: imagePath,
                width: metadata.width,
                height: metadata.height,
                channel: metadata.channels
            });

            maxWidth = Math.max(maxWidth, metadata.width);
            totalHeight += metadata.height;
        }

        logger.debug(`Max width: ${maxWidth}, Total height: ${totalHeight}`);

        // Create composite input for each image
        const compositeInputs = [];
        let currentY = 0;

        for (const img of images) {
            // Resize to match max width (left-aligned, pad with white if needed)
            const tempBuffer = await sharp(img.path)
                .resize({
                    width: maxWidth,
                    height: img.height,
                    fit: 'contain',
                    position: 'northwest', // top-left alignment
                    background: { r: 255, g: 255, b: 255 }
                })
                .toBuffer();

            compositeInputs.push({
                input: tempBuffer,
                top: currentY,
                left: 0
            });

            currentY += img.height;
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

        logger.debug(`Long image created: ${outputPath}`);
        return outputPath;
    } catch (error) {
        logger.error('Error merging images:', error);
        throw new Error(`Failed to merge images: ${error.message}`);
    }
}

module.exports = {
    mergeImagesVertically
};
