const fs = require('fs');
const path = require('path');
const { pdfToImg } = require('pdftoimg-js');

async function convertPDFToImages(pdfPath) {
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

    const pdfBuffer = fs.readFileSync(pdfPath);
    const images = await pdfToImg(pdfBuffer, {
      type: 'png',
      scale: 2
    });

    console.log(`PDF converted to ${images.length} pages`);

    const files = [];
    for (let i = 0; i < images.length; i++) {
      // images[i] is a data URL: data:image/png;base64,...
      const base64Data = images[i].split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const imagePath = path.join(outputDir, `page-${i + 1}.png`);
      fs.writeFileSync(imagePath, buffer);
      files.push(imagePath);
    }

    console.log(`Found ${files.length} image files`);
    return files;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new Error(`PDF转换失败: ${error.message}`);
  }
}

module.exports = { convertPDFToImages };
