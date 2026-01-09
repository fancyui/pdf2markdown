const fs = require('fs');
const path = require('path');
const { processOCR } = require('./ocrService');

async function handlePDFUpload(filePath, customPrompt, model, provider) {
  console.log('Processing PDF: converting each page to image for OCR');

  try {
    const { convertPDFToImages } = require('./pdfUtils');
    const imagePaths = await convertPDFToImages(filePath);

    let markdownContent = `# PDF 文档 (OCR识别)\n\n`;
    markdownContent += `**总页数**: ${imagePaths.length}\n\n`;
    markdownContent += `---\n\n`;

    for (let i = 0; i < imagePaths.length; i++) {
      console.log(`Processing page ${i + 1}/${imagePaths.length}`);

      const pageContent = await processOCR(imagePaths[i], customPrompt, model, provider);
      markdownContent += `## 第 ${i + 1} 页\n\n${pageContent}\n\n`;

      if (fs.existsSync(imagePaths[i])) {
        fs.unlinkSync(imagePaths[i]);
      }
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return markdownContent.trim();
  } catch (error) {
    console.error('PDF processing failed:', error);
    throw new Error(`PDF处理失败: ${error.message}`);
  }
}

async function handleImageUpload(filePath, customPrompt, model, provider) {
  try {
    const markdownContent = await processOCR(filePath, customPrompt, model, provider);

    fs.unlinkSync(filePath);

    return markdownContent;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

module.exports = { handlePDFUpload, handleImageUpload };
