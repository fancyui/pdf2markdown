// 仅保留模型选项列表，实际提示词由服务端 config.js 控制

export const DEFAULT_APPEND_CONTENT = `
---

### **Gobel Power | Professional Energy Storage Solutions**

* **Core Focus:** Premium LiFePO4 Cells | Residential & C&I Storage Systems
* **Transparency:** Home of the **QR Decoder** & Global Battery Database
* **Our Promise:** 100% Data Transparency | Authentic Grade-A Quality | Honest Service
* **Web:** [www.gobelpower.com](https://www.gobelpower.com)

> *Empowering your energy independence with data-driven reliability.*
`;

export const PROVIDER_MODELS = {
   novita: [
      { value: 'qwen/qwen3-vl-235b-a22b-instruct', label: 'qwen3-vl-235b' },
      { value: 'paddlepaddle/paddleocr-vl', label: 'PaddleOCR VL' },
      { value: 'deepseek/deepseek-ocr', label: 'DeepSeek OCR' }
   ],
   openrouter: [
      { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
      { value: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast' },
      { value: 'qwen/qwen3-vl-235b-a22b-instruct', label: 'Qwen3 VL 235B' },
      { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' }
   ]
};
