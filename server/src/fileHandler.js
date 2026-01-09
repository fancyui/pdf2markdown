const fs = require('fs');
const path = require('path');
const { processOCR, postProcessDocument } = require('./ocrService');

async function handlePDFUpload(filePath, customPrompt, model, provider, onProgress = null) {
  console.log('Processing PDF: converting each page to image for OCR');

  try {
    const { convertPDFToImages } = require('./pdfUtils');
    const imagePaths = await convertPDFToImages(filePath);

    if (onProgress) {
      onProgress({ type: 'progress', current: 0, total: imagePaths.length, status: 'splitting' });
    }

    const pageContents = [];
    for (let i = 0; i < imagePaths.length; i++) {
      console.log(`Processing page ${i + 1}/${imagePaths.length}`);

      if (onProgress) {
        onProgress({ type: 'progress', current: i + 1, total: imagePaths.length, status: 'ocr' });
      }

      const pageContent = await processOCR(imagePaths[i], customPrompt, model, provider);
      pageContents.push(pageContent);

      if (fs.existsSync(imagePaths[i])) {
        fs.unlinkSync(imagePaths[i]);
      }
    }

    if (onProgress) {
      onProgress({ type: 'progress', current: imagePaths.length, total: imagePaths.length, status: 'merging' });
    }

    // 基础合并：使用代码合并页面
    const { mergeTablesAcrossPages } = require('./tableUtils');
    const mergedPages = mergeTablesAcrossPages(pageContents);

    let rawMarkdown = '';
    mergedPages.forEach((content, i) => {
      rawMarkdown += `## 第 ${i + 1} 页\n\n${content}\n\n`;
    });

    // AI 后处理：清理页眉页脚、合并跨页表格
    if (onProgress) {
      onProgress({ type: 'progress', current: imagePaths.length, total: imagePaths.length, status: 'postprocess' });
    }

    // 延时 3 秒，避免 API 限流
    console.log('Waiting 3 seconds before post-processing to avoid rate limiting...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Starting AI post-processing...');
    const finalMarkdown = await postProcessDocument(rawMarkdown);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return finalMarkdown;
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
