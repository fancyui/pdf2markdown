const fs = require('fs');
const path = require('path');

// Load .env before reading any model configuration. dotenv never overrides
// variables that already exist in the environment, so real env vars still win.
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

// ---------------------------------------------------------------------------
// Model configuration
//
// OpenRouter models are driven by environment variables (server/.env):
//   OPENROUTER_MODEL       -> default model, e.g. google/gemini-3-flash-preview
//   OPENROUTER_MODELS      -> comma separated dropdown options,
//                             each entry is "vendor/model" or "vendor/model|Label"
//   OPENROUTER_MAX_TOKENS  -> fallback max_tokens for models without a known limit
// The built-in values below are only used when those variables are not set.
// ---------------------------------------------------------------------------

const BUILTIN_MODEL_OPTIONS = {
    novita: [
        { value: 'qwen/qwen3-vl-235b-a22b-instruct', label: 'qwen3-vl-235b' }
    ],
    openrouter: [
        { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
        { value: 'qwen/qwen3-vl-235b-a22b-instruct', label: 'Qwen3 VL 235B' }
    ]
};

// Known per-model output limits (used when a model is in the list above)
const BUILTIN_MAX_TOKENS = {
    'qwen/qwen3-vl-235b-a22b-instruct': 130000,
    'google/gemini-3-flash-preview': 500000
};

const humanizeModelLabel = (id) => String(id || '')
    .split('/')
    .pop()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const parseList = (value) => String(value || '')
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);

// "vendor/model" or "vendor/model|Pretty Label"
const parseModelOption = (raw) => {
    const text = String(raw).trim();
    const separatorIndex = text.indexOf('|');
    if (separatorIndex === -1) {
        return { value: text, label: humanizeModelLabel(text) };
    }
    const value = text.slice(0, separatorIndex).trim();
    const label = text.slice(separatorIndex + 1).trim();
    return { value, label: label || humanizeModelLabel(value) };
};

const dedupeOptions = (options) => {
    const seen = new Set();
    return options.filter((option) => {
        if (!option.value || seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
    });
};

const positiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_MAX_TOKENS = positiveInt(process.env.DEFAULT_MAX_TOKENS, 500000);
const OPENROUTER_MAX_TOKENS = positiveInt(process.env.OPENROUTER_MAX_TOKENS, DEFAULT_MAX_TOKENS);

// OpenRouter options: .env wins, built-in list is the fallback.
const openrouterEnvOptions = dedupeOptions(
    parseList(process.env.OPENROUTER_MODELS).map(parseModelOption)
);
const openrouterBaseOptions = openrouterEnvOptions.length
    ? openrouterEnvOptions
    : BUILTIN_MODEL_OPTIONS.openrouter;

const openrouterDefaultModel =
    (process.env.OPENROUTER_MODEL || '').trim() ||
    openrouterBaseOptions[0].value;

// Keep the default model selectable and first in the dropdown
const openrouterOptions = dedupeOptions([
    openrouterBaseOptions.find((option) => option.value === openrouterDefaultModel)
        || { value: openrouterDefaultModel, label: humanizeModelLabel(openrouterDefaultModel) },
    ...openrouterBaseOptions
]);

const NOVITA_OPTIONS = BUILTIN_MODEL_OPTIONS.novita;
const NOVITA_DEFAULT_MODEL = NOVITA_OPTIONS[0].value;

const PROVIDER_DEFAULT_MAX_TOKENS = {
    novita: DEFAULT_MAX_TOKENS,
    openrouter: OPENROUTER_MAX_TOKENS
};

const buildModelTable = (options, provider) => {
    return options.reduce((table, option) => {
        table[option.value] = {
            maxTokens: BUILTIN_MAX_TOKENS[option.value] || PROVIDER_DEFAULT_MAX_TOKENS[provider]
        };
        return table;
    }, {});
};

const PROVIDERS = {
    novita: {
        // API_MODEL env var keeps working as the novita default (legacy behaviour)
        default: (process.env.API_MODEL || '').trim() || NOVITA_DEFAULT_MODEL,
        models: buildModelTable(NOVITA_OPTIONS, 'novita')
    },
    openrouter: {
        default: openrouterDefaultModel,
        models: buildModelTable(openrouterOptions, 'openrouter')
    }
};

// Effective max_tokens for a provider/model pair (used by ocrService)
const getModelMaxTokens = (provider, model) => {
    const providerConfig = PROVIDERS[provider] || PROVIDERS.novita;
    const modelId = model || providerConfig.default;
    return providerConfig.models[modelId]?.maxTokens
        || PROVIDER_DEFAULT_MAX_TOKENS[provider]
        || DEFAULT_MAX_TOKENS;
};

// Payload for GET /api/models so the client dropdown follows server/.env
const getProviderModels = () => ({
    novita: {
        default: NOVITA_DEFAULT_MODEL,
        models: NOVITA_OPTIONS
    },
    openrouter: {
        default: openrouterDefaultModel,
        models: openrouterOptions
    }
});

module.exports = {
    DEFAULT_PROMPT: loadPrompt('markdown.md'),
    HTML_PROMPT: loadPrompt('html.md'),
    TEXT_PROMPT: loadPrompt('text.md'),
    POST_PROCESS_PROMPT: loadPrompt('post-process.md'),
    DIRECTORY_PROMPT: loadPrompt('directory.md'),
    POST_PROCESS_MODEL: 'google/gemini-3-flash-preview',
    POST_PROCESS_PROVIDER: 'openrouter',
    PROVIDERS,
    PROVIDER_MODEL_OPTIONS: {
        novita: NOVITA_OPTIONS,
        openrouter: openrouterOptions
    },
    getProviderModels,
    getModelMaxTokens,
    DEFAULT_MAX_TOKENS,
    TEMPERATURE: 0.3,
    TOP_P: 1
};
