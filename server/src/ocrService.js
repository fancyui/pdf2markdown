const axios = require('axios');
const {
  DEFAULT_PROMPT,
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

async function processOCR(imagePath, customPrompt = '', model = null, provider = 'novita') {
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

  logger.info(`Using model: ${API_MODEL}, maxTokens: ${maxTokens}`);

  if (!API_KEY) {
    throw new Error(`${provider.toUpperCase()}_API_KEY is not set in environment variables`);
  }

  const fs = require('fs');

  const prompt = customPrompt || DEFAULT_PROMPT;

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
    return response.data.choices[0].message.content || '';
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
