const { extractImagesFromPDF } = require('./src/imageExtractor');
const path = require('path');
const fs = require('fs');

async function test() {
    const pdfPath = 'uploads/1770878240741-515427806.pdf';
    const outputDir = 'uploads/test_mask_merge';

    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }

    console.log('Testing image extraction with mask merging on page 26...');
    const result = await extractImagesFromPDF(pdfPath, outputDir, { start: 26, end: 26 });
    console.log(`Extracted ${result.length} images.`);

    result.forEach(img => {
        console.log(`Image: ${img.imageName}, Path: ${img.imagePath}, Size: ${img.width}x${img.height}`);
    });
}

test().catch(console.error);
