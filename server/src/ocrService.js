const axios = require('axios');
const { DEFAULT_PROMPT, PROVIDERS, MAX_TOKENS, TEMPERATURE, TOP_P } = require('./config');

async function processOCR(imagePath, customPrompt = '', model = null, provider = 'novita') {
  let API_KEY;
  let API_BASE_URL;

  if (provider === 'openrouter') {
    API_KEY = process.env.OPENROUTER_API_KEY;
    API_BASE_URL = 'https://openrouter.ai/api/v1';
  } else {
    API_KEY = process.env.DEEPSEEK_API_KEY;
    API_BASE_URL = process.env.API_BASE_URL || 'https://api.novita.ai/openai/v1';
  }

  const providerConfig = PROVIDERS[provider] || PROVIDERS.novita;
  const API_MODEL = model || (provider === 'novita' ? (process.env.API_MODEL || providerConfig.default) : providerConfig.default);

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
    console.log(`Sending request to ${API_BASE_URL} with model ${API_MODEL}`);
    console.log(`Using image URL: ${imageUrl || 'base64 encoded'}`);

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
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      top_p: TOP_P,
    };

    console.log('Request data:', JSON.stringify(requestData, null, 2));

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
        timeout: 300000
      }
    );

    console.log('API response received');
    return response.data.choices[0].message.content || '';
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);

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

module.exports = { processOCR };
