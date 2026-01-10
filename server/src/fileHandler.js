const fs = require('fs');
const path = require('path');
const { processOCR, postProcessDocument } = require('./ocrService');
const logger = require('./logger');

async function handlePDFUpload(filePath, customPrompt, model, provider, onProgress = null) {
  logger.info('Processing PDF: converting each page to image for OCR');

  try {
    const { convertPDFToImages } = require('./pdfUtils');
    const imagePaths = await convertPDFToImages(filePath);

    if (onProgress) {
      onProgress({ type: 'progress', current: 0, total: imagePaths.length, status: 'splitting' });
    }

    // Parallel processing with concurrency limit
    const CONCURRENCY = parseInt(process.env.OCR_CONCURRENCY) || 3;
    const pageContents = new Array(imagePaths.length);
    let completedCount = 0;

    // Process pages in parallel with concurrency limit
    const processPage = async (index) => {
      logger.debug(`Processing page ${index + 1}/${imagePaths.length}`);
      const content = await processOCR(imagePaths[index], customPrompt, model, provider);
      pageContents[index] = content;

      completedCount++;
      if (onProgress) {
        onProgress({ type: 'progress', current: completedCount, total: imagePaths.length, status: 'ocr' });
      }

      if (fs.existsSync(imagePaths[index])) {
        fs.unlinkSync(imagePaths[index]);
      }
    };

    // Process in batches with concurrency limit
    for (let i = 0; i < imagePaths.length; i += CONCURRENCY) {
      const batch = [];
      for (let j = i; j < Math.min(i + CONCURRENCY, imagePaths.length); j++) {
        batch.push(processPage(j));
      }
      await Promise.all(batch);
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
    logger.debug('Waiting 3 seconds before post-processing to avoid rate limiting...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    logger.info('Starting AI post-processing...');
    const finalMarkdown = await postProcessDocument(rawMarkdown);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return finalMarkdown;
  } catch (error) {
    logger.error('PDF processing failed:', error);
    throw new Error(`PDF处理失败: ${error.message}`);
  }
}

async function handleImageUpload(filePath, customPrompt, model, provider) {
  try {
    const markdownContent = await processOCR(filePath, customPrompt, model, provider);

    fs.unlinkSync(filePath);

    return markdownContent;
  } catch (error) {
    logger.error('Error processing image:', error);
    throw error;
  }
}

module.exports = { handlePDFUpload, handleImageUpload };
