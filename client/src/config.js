export const DEFAULT_PROMPT = `
请对提供的图像执行OCR识别，并将提取的文本内容转换为Markdown格式。具体要求如下：
保持原文结构与层级，标题、列表等需用对应的Markdown语法标注。
若图像中包含表格，需将表格转换为HTML格式并嵌入Markdown中，确保合并单元格的结构完整保留。
输出应为纯文本，无需额外解释，直接呈现转换后的Markdown内容。
注意事项：
表格需使用<table>标签，并正确处理rowspan和colspan属性以还原合并单元格。
仔细检查输出内容，确保表格结构和图片中的完全一致。
普通文本段落、标题、列表等仅使用标准Markdown语法，无需HTML。
去除页眉和页脚中的内容。
图片用占位符。
输出内容最前面不要加 \` \` \` markdown '。
如果有明显缺失的内容，可通过上下文补齐。
确保OCR识别准确性，格式转换的完整性以及文本的完整性。
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
        { value: 'x-ai/grok-4-fast', label: 'Grok 4 Fast' },
        { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' }
    ]
};
