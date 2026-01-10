const fs = require('fs');
const path = require('path');
const { processOCR, postProcessDocument } = require('./ocrService');
const logger = require('./logger');

async function handlePDFUpload(filePath, customPrompt, model, provider, onProgress = null, appendContent = '', outputFormat = 'markdown') {
  logger.info('Processing PDF: converting each page to image for OCR');

  try {
    const { convertPDFToImages } = require('./pdfUtils');
    const imagePaths = await convertPDFToImages(filePath);

    if (onProgress) {
      onProgress({ type: 'progress', current: 0, total: imagePaths.length, status: 'splitting' });
    }

    // Parallel processing with concurrency limit and retry logic
    const CONCURRENCY = parseInt(process.env.OCR_CONCURRENCY) || 3;
    const MAX_RETRIES = parseInt(process.env.OCR_MAX_RETRIES) || 3;
    const RETRY_DELAY = parseInt(process.env.OCR_RETRY_DELAY) || 2000; // ms

    const pageContents = new Array(imagePaths.length);
    let completedCount = 0;

    // Process single page with retry logic
    const processPageWithRetry = async (index) => {
      let lastError;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.debug(`Processing page ${index + 1}/${imagePaths.length} (attempt ${attempt}/${MAX_RETRIES})`);
          const content = await processOCR(imagePaths[index], customPrompt, model, provider, outputFormat);
          return { index, content, success: true };
        } catch (error) {
          lastError = error;
          logger.warn(`Page ${index + 1} failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);

          if (attempt < MAX_RETRIES) {
            // Exponential backoff: 2s, 4s, 8s...
            const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
            logger.debug(`Retrying page ${index + 1} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      return { index, error: lastError, success: false };
    };

    // Process in batches with concurrency limit
    const failedPages = [];

    for (let i = 0; i < imagePaths.length; i += CONCURRENCY) {
      const batchIndices = [];
      for (let j = i; j < Math.min(i + CONCURRENCY, imagePaths.length); j++) {
        batchIndices.push(j);
      }

      const results = await Promise.allSettled(
        batchIndices.map(index => processPageWithRetry(index))
      );

      results.forEach((result, batchIndex) => {
        const pageIndex = batchIndices[batchIndex];

        if (result.status === 'fulfilled' && result.value.success) {
          pageContents[pageIndex] = result.value.content;
          completedCount++;

          if (onProgress) {
            onProgress({ type: 'progress', current: completedCount, total: imagePaths.length, status: 'ocr' });
          }
        } else {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          logger.error(`Page ${pageIndex + 1} failed after all retries:`, error?.message);
          failedPages.push(pageIndex + 1);
          pageContents[pageIndex] = `[Page ${pageIndex + 1} OCR failed: ${error?.message || 'Unknown error'}]`;
          completedCount++;

          if (onProgress) {
            onProgress({ type: 'progress', current: completedCount, total: imagePaths.length, status: 'ocr' });
          }
        }

        // Clean up image file
        if (fs.existsSync(imagePaths[pageIndex])) {
          fs.unlinkSync(imagePaths[pageIndex]);
        }
      });
    }

    if (failedPages.length > 0) {
      logger.warn(`${failedPages.length} page(s) failed: ${failedPages.join(', ')}`);
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

    // Append user-specified content at the end
    let finalResult = finalMarkdown;
    if (appendContent && appendContent.trim()) {
      finalResult += '\n\n' + appendContent.trim();
    }

    return finalResult;
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
