const fs = require('fs');
const path = require('path');
const pdfPoppler = require('pdf-poppler');

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
  
  const options = {
    format: 'png',
    out_dir: outputDir,
    out_prefix: 'page',
    scale: 2048
  };
  
  try {
    console.log(`Converting PDF to images: ${pdfPath}`);
    
    const info = await pdfPoppler.convert(pdfPath, options);
    console.log(`PDF converted to ${info.numPages} pages`);
    
    const files = fs.readdirSync(outputDir)
      .filter(file => file.startsWith('page-') && file.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      })
      .map(file => path.join(outputDir, file));
    
    console.log(`Found ${files.length} image files`);
    return files;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new Error(`PDF转换失败: ${error.message}`);
  }
}

module.exports = { convertPDFToImages };
