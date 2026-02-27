const fs = require('fs');
const path = require('path');

// Load prompts from markdown files
const promptsDir = path.join(__dirname, '../../prompts');

const loadPrompt = (filename) => {
    const filePath = path.join(promptsDir, filename);
    try {
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch (error) {
        console.error(`Failed to load prompt from ${filename}:`, error.message);
        return '';
    }
};

module.exports = {
    DEFAULT_PROMPT: loadPrompt('markdown.md'),
    HTML_PROMPT: loadPrompt('html.md'),
    TEXT_PROMPT: loadPrompt('text.md'),
    POST_PROCESS_PROMPT: loadPrompt('post-process.md'),
    DIRECTORY_PROMPT: loadPrompt('directory.md'),
    POST_PROCESS_MODEL: 'google/gemini-3-flash-preview',
    POST_PROCESS_PROVIDER: 'openrouter',
    PROVIDERS: {
        novita: {
            default: 'qwen/qwen3-vl-235b-a22b-instruct',
            models: {
                'qwen/qwen3-vl-235b-a22b-instruct': { maxTokens: 32768 }
            }
        },
        openrouter: {
            default: 'google/gemini-3-flash-preview',
            models: {
                'google/gemini-3-flash-preview': { maxTokens: 500000 },
                'qwen/qwen3-vl-235b-a22b-instruct': { maxTokens: 130000 }
            }
        }
    },
    DEFAULT_MAX_TOKENS: 500000,
    TEMPERATURE: 0.3,
    TOP_P: 1
};
