const axios = require('axios');
const path = require('path');
const {
  DEFAULT_PROMPT,
  HTML_PROMPT,
  TEXT_PROMPT,
  DIRECTORY_PROMPT,
  PROVIDERS,
  DEFAULT_MAX_TOKENS,
  TEMPERATURE,
  TOP_P,
  POST_PROCESS_PROMPT,
  POST_PROCESS_MODEL,
  POST_PROCESS_PROVIDER
} = require('./config');
const logger = require('./logger');

async function postProcessDocument(rawMarkdown) {
  const API_KEY = process.env.OPENROUTER_API_KEY;
  const API_BASE_URL = 'https://openrouter.ai/api/v1';
  const API_MODEL = POST_PROCESS_MODEL;

  if (!API_KEY) {
    logger.warn('OPENROUTER_API_KEY not set, skipping post-processing');
    return rawMarkdown;
  }

  try {
    logger.info('Starting AI post-processing with model:', API_MODEL);

    const requestData = {
      model: API_MODEL,
      messages: [
        {
          role: "system",
          content: "你是一个专业的文档审校专家，擅长清理和优化 OCR 输出的文档。"
        },
        {
          role: "user",
          content: POST_PROCESS_PROMPT + "\n\n---\n\n以下是需要处理的文档：\n\n" + rawMarkdown
        }
      ],
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: 0.2,
      top_p: TOP_P,
    };

    const response = await axios.post(
      `${API_BASE_URL}/chat/completions`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/daniel/pdf2markdown',
          'X-Title': 'PDF2Markdown PostProcess'
        },
        timeout: 3600000
      }
    );

    logger.info('Post-processing completed');
    return response.data.choices[0].message.content || rawMarkdown;
  } catch (error) {
    logger.error('Post-processing error:', error.response?.data || error.message);
    logger.warn('Returning raw markdown due to post-processing failure');
    return rawMarkdown;
  }
}

async function processOCR(imagePath, customPrompt = '', model = null, provider = 'novita', outputFormat = 'markdown', context = null, pageImages = []) {
  let API_KEY;
  let API_BASE_URL;

  if (provider === 'openrouter') {
    API_KEY = process.env.OPENROUTER_API_KEY;
    API_BASE_URL = 'https://openrouter.ai/api/v1';
  } else {
    API_KEY = process.env.NOVITA_API_KEY || process.env.DEEPSEEK_API_KEY;
    API_BASE_URL = process.env.API_BASE_URL || 'https://api.novita.ai/openai/v1';
  }

  const providerConfig = PROVIDERS[provider] || PROVIDERS.novita;
  const API_MODEL = model || (provider === 'novita' ? (process.env.API_MODEL || providerConfig.default) : providerConfig.default);

  // Get model-specific maxTokens or use default
  const modelConfig = providerConfig.models[API_MODEL];
  const maxTokens = modelConfig?.maxTokens || DEFAULT_MAX_TOKENS;

  logger.info(`Using model: ${API_MODEL}, maxTokens: ${maxTokens}, format: ${outputFormat}`);

  if (!API_KEY) {
    throw new Error(`${provider.toUpperCase()}_API_KEY is not set in environment variables`);
  }

  const fs = require('fs');

  // Select prompt based on output format
  const FORMAT_PROMPTS = {
    markdown: DEFAULT_PROMPT,
    html: HTML_PROMPT,
    text: TEXT_PROMPT
  };

  const defaultPrompt = FORMAT_PROMPTS[outputFormat] || DEFAULT_PROMPT;
  let prompt = defaultPrompt;

  // Append custom prompt if provided instead of replacing
  if (customPrompt && customPrompt.trim()) {
    prompt += `\n\n[Additional Instructions]:\n${customPrompt}`;
  }

  // Add context if provided
  if (context) {
    prompt = context + '\n\n' + prompt;
  }

  // Add image references if provided (for embedding extracted images in markdown)
  if (pageImages && pageImages.length > 0 && outputFormat === 'markdown') {
    const imageHint = `\n\n[本页包含以下嵌入图片，请在识别到图片区域时引用。如果在 HTML 表格内部，必须使用 <img src="./images/文件名.png" width="200" /> 格式以确保显示]\n${pageImages.map(img => `![图片](./images/${path.basename(img)})`).join('\n')
      }`;
    prompt = prompt + imageHint;
    logger.debug(`Added ${pageImages.length} image hints to prompt`);
  }

  const promptSource = customPrompt ? 'custom' : `prompts/${outputFormat}.md`;
  logger.info(`Prompt source: ${promptSource}, length: ${prompt.length} chars`);
  logger.debug(`Prompt preview: ${prompt.substring(0, 150).replace(/\n/g, ' ')}...`);

  let imageUrl = null;
  let base64Image = null;

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    imageUrl = imagePath;
  } else {
    const imageBuffer = fs.readFileSync(imagePath);
    base64Image = imageBuffer.toString('base64');
  }

  try {
    logger.debug(`Sending request to ${API_BASE_URL} with model ${API_MODEL}`);
    logger.debug(`Using image URL: ${imageUrl || 'base64 encoded'}`);

    const userContent = [
      {
        type: "text",
        text: prompt
      }
    ];

    if (imageUrl) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      });
    } else {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${base64Image}`
        }
      });
    }

    // Add additional thumbnail images if provided (Multi-Image Vision Prompting)
    if (pageImages && pageImages.length > 0 && outputFormat === 'markdown') {
      const sharp = require('sharp');
      // Limit to 10 images to avoid payload size issues
      const limitedImages = pageImages.slice(0, 10);
      for (const imgPath of limitedImages) {
        try {
          if (fs.existsSync(imgPath)) {
            // Optimization: Resize and compress thumbnail to reduce API payload
            // Max width/height 512px, convert to JPEG with 80% quality
            const thumbBuffer = await sharp(imgPath)
              .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toBuffer();

            const thumbBase64 = thumbBuffer.toString('base64');
            const thumbName = path.basename(imgPath);

            userContent.push({
              type: "text",
              text: `Asset image to match: ${thumbName}`
            });
            userContent.push({
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${thumbBase64}`
              }
            });
            logger.debug(`Included compressed thumbnail ${thumbName} in visual prompt`);
          }
        } catch (e) {
          logger.warn(`Failed to add thumbnail ${imgPath} to prompt: ${e.message}`);
        }
      }
    }

    const requestData = {
      model: API_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a professional OCR assistant that can accurately recognize text content in images and convert it to Markdown format."
        },
        {
          role: "user",
          content: userContent
        }
      ],
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
      top_p: TOP_P,
    };

    logger.debug('Request data:', JSON.stringify(requestData, null, 2));

    const response = await axios.post(
      `${API_BASE_URL}/chat/completions`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          ...(provider === 'openrouter' && {
            'HTTP-Referer': 'https://github.com/daniel/pdf2markdown', // Optional, for OpenRouter tracking
            'X-Title': 'PDF2Markdown OCR'
          })
        },
        timeout: 3600000
      }
    );

    logger.debug('API response received');

    // Validate response structure
    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      logger.error('Unexpected API response:', JSON.stringify(response.data, null, 2));
      throw new Error('API返回了意外的响应结构');
    }

    return response.data.choices[0].message?.content || '';
  } catch (error) {
    logger.error('API Error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      throw new Error('API密钥无效，请检查DEEPSEEK_API_KEY');
    } else if (error.response?.status === 429) {
      throw new Error('API请求频率限制，请稍后重试');
    } else if (error.response?.status === 402) {
      throw new Error('账户余额不足，请充值');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('请求超时，请检查网络连接');
    } else {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || error.message;
      throw new Error(`OCR处理失败 (${provider}): ${errorMessage}`);
    }
  }
}

module.exports = { processOCR, postProcessDocument };
