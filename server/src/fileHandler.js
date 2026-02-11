const fs = require('fs');
const path = require('path');
const { processOCR, postProcessDocument } = require('./ocrService');
const { DIRECTORY_PROMPT } = require('./config');
const { mergeImagesVertically } = require('./imageUtils');
const logger = require('./logger');

/**
 * Extract directory text and heading rules from specified pages
 * @param {string[]} imagePaths - All page image paths
 * @param {object} directoryPages - {startPage, endPage} (1-indexed)
 * @param {string} model - Model to use
 * @param {string} provider - Provider to use
 * @returns {Promise<{directory: string, headingRules: string}>} - Extracted directory and heading rules
 */
async function extractDirectory(imagePaths, directoryPages, model, provider) {
  const { startPage, endPage } = directoryPages;

  // Convert to 0-indexed
  const startIndex = startPage - 1;
  const endIndex = endPage;

  if (startIndex < 0 || endIndex > imagePaths.length || startIndex >= endIndex) {
    logger.warn(`Invalid directory page range: ${startPage}-${endPage}`);
    return { directory: '', headingRules: '' };
  }

  const directoryImages = imagePaths.slice(startIndex, endIndex);
  logger.info(`Extracting directory from pages ${startPage}-${endPage} (${directoryImages.length} pages)`);

  // Merge directory pages into long image
  const tempDir = path.join('uploads', 'temp_images');
  const longImagePath = path.join(tempDir, `directory-${Date.now()}.png`);

  await mergeImagesVertically(directoryImages, longImagePath);

  // OCR with directory-specific prompt
  const responseText = await processOCR(longImagePath, DIRECTORY_PROMPT, model, provider, 'text');

  // Clean up long image
  if (fs.existsSync(longImagePath)) {
    fs.unlinkSync(longImagePath);
  }

  // Parse JSON response
  let directory = '';
  let headingRules = '';

  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      directory = parsed.directory || '';
      headingRules = parsed.headingRules || '';
    } else {
      // Fallback: use the whole text as directory
      directory = responseText;
    }
  } catch (parseError) {
    logger.warn('Failed to parse directory JSON, using raw text');
    directory = responseText;
  }

  logger.info(`Directory extracted: ${directory.length} chars, rules: ${headingRules.length} chars`);
  return { directory, headingRules };
}

/**
 * Handle PDF upload with parts mode
 * @param {string} filePath - PDF file path
 * @param {object[]} parts - [{startPage, endPage, title}]
 * @param {object} directoryPages - {startPage, endPage} (optional)
 * @param {string} customPrompt - Custom prompt
 * @param {string} model - Model to use
 * @param {string} provider - Provider to use
 * @param {function} onProgress - Progress callback
 * @param {string} appendContent - Content to append
 * @param {string} outputFormat - Output format
 * @param {boolean} enablePostProcess - Enable post-processing
 * @returns {Promise<string>} - Final markdown
 */
async function handlePDFPartsUpload(filePath, parts, directoryPages, customPrompt, model, provider, onProgress = null, appendContent = '', outputFormat = 'markdown', enablePostProcess = false) {
  logger.info(`Processing PDF with parts mode: ${parts.length} parts`);

  // Retry configuration
  const MAX_RETRIES = parseInt(process.env.OCR_MAX_RETRIES) || 3;
  const RETRY_DELAY = parseInt(process.env.OCR_RETRY_DELAY) || 2000;

  try {
    const { convertPDFToImages } = require('./pdfUtils');
    const imagePaths = await convertPDFToImages(filePath);

    logger.info(`PDF converted to ${imagePaths.length} pages`);

    if (onProgress) {
      onProgress({ type: 'progress', current: 0, total: parts.length + (directoryPages ? 1 : 0), status: 'splitting' });
    }

    // Extract directory if provided
    let directoryText = '';
    let headingRules = '';
    if (directoryPages && directoryPages.startPage && directoryPages.endPage) {
      logger.info('Extracting directory context...');
      const dirResult = await extractDirectory(imagePaths, directoryPages, model, provider);
      directoryText = dirResult.directory;
      headingRules = dirResult.headingRules;

      if (onProgress) {
        onProgress({ type: 'progress', current: 0, total: parts.length, status: 'ocr' });
      }
    }

    // Process each part with retry logic
    const partResults = [];
    const tempDir = path.join('uploads', 'temp_images');

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const { startPage, endPage, title } = part;

      logger.info(`Processing part ${i + 1}/${parts.length}: "${title}" (pages ${startPage}-${endPage})`);

      // Convert to 0-indexed
      const startIndex = startPage - 1;
      const endIndex = endPage;

      if (startIndex < 0 || endIndex > imagePaths.length || startIndex >= endIndex) {
        logger.warn(`Invalid part page range: ${startPage}-${endPage}, skipping`);
        partResults.push({ content: `[无效的页码范围: ${startPage}-${endPage}]` });
        continue;
      }

      const partImages = imagePaths.slice(startIndex, endIndex);

      // Merge part images into long image
      const longImagePath = path.join(tempDir, `part-${i}-${Date.now()}.png`);
      await mergeImagesVertically(partImages, longImagePath);

      // Build context prompt with directory and heading rules
      let contextPrompt = null;
      if (directoryText || headingRules) {
        contextPrompt = `[文档上下文]
当前处理章节: ${title}
${headingRules ? `标题层级规则:\n${headingRules}\n` : ''}${directoryText ? `目录大纲:\n${directoryText}` : ''}
[/文档上下文]`;
      }

      // OCR the long image with retry logic
      let content = '';
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.debug(`OCR attempt ${attempt}/${MAX_RETRIES} for part ${i + 1}`);
          content = await processOCR(longImagePath, customPrompt, model, provider, outputFormat, contextPrompt);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          logger.warn(`Part ${i + 1} OCR failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);

          if (attempt < MAX_RETRIES) {
            const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
            logger.debug(`Retrying part ${i + 1} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!content && lastError) {
        content = `[Part ${i + 1} OCR failed: ${lastError.message}]`;
      }

      partResults.push({ content });

      // Clean up long image
      if (fs.existsSync(longImagePath)) {
        fs.unlinkSync(longImagePath);
      }

      if (onProgress) {
        onProgress({ type: 'progress', current: i + 1, total: parts.length, status: 'ocr' });
      }
    }

    // Clean up all page images
    for (const imagePath of imagePaths) {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Clean up PDF
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (onProgress) {
      onProgress({ type: 'progress', current: parts.length, total: parts.length, status: 'merging' });
    }

    // Merge all parts (without adding part titles)
    let rawMarkdown = '';
    for (const part of partResults) {
      rawMarkdown += part.content + '\n\n';
    }

    let finalMarkdown = rawMarkdown;

    // Post-processing if enabled
    if (enablePostProcess) {
      if (onProgress) {
        onProgress({ type: 'progress', current: parts.length, total: parts.length, status: 'postprocess' });
      }

      logger.debug('Waiting 3 seconds before post-processing to avoid rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      logger.info('Starting AI post-processing...');
      finalMarkdown = await postProcessDocument(rawMarkdown);
    }

    // Append content if provided
    let finalResult = finalMarkdown;
    if (appendContent && appendContent.trim()) {
      finalResult += '\n\n' + appendContent.trim();
    }

    return finalResult;
  } catch (error) {
    logger.error('PDF parts processing failed:', error);
    throw new Error(`PDF处理失败: ${error.message}`);
  }
}

async function handlePDFUpload(filePath, customPrompt, model, provider, onProgress = null, appendContent = '', outputFormat = 'markdown', enablePostProcess = false) {
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

    let finalMarkdown = rawMarkdown;

    // AI 后处理：清理页眉页脚、合并跨页表格 (仅在启用时执行)
    if (enablePostProcess) {
      if (onProgress) {
        onProgress({ type: 'progress', current: imagePaths.length, total: imagePaths.length, status: 'postprocess' });
      }

      // 延时 3 秒，避免 API 限流
      logger.debug('Waiting 3 seconds before post-processing to avoid rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      logger.info('Starting AI post-processing...');
      finalMarkdown = await postProcessDocument(rawMarkdown);
    } else {
      logger.info('AI post-processing disabled, skipping...');
    }

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

async function handleImageUpload(filePath, customPrompt, model, provider, outputFormat = 'markdown') {
  try {
    const markdownContent = await processOCR(filePath, customPrompt, model, provider, outputFormat);

    fs.unlinkSync(filePath);

    return markdownContent;
  } catch (error) {
    logger.error('Error processing image:', error);
    throw error;
  }
}

module.exports = { handlePDFUpload, handleImageUpload, handlePDFPartsUpload, extractDirectory };
