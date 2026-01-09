/**
 * Simple logger with log level support
 * LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' | 'silent'
 * NODE_ENV: 'development' | 'production'
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4
};

function getLogLevel() {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
        return LOG_LEVELS[envLevel];
    }

    // Default: debug in development, info in production
    return process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;
}

const currentLevel = getLogLevel();

const logger = {
    debug: (...args) => {
        if (currentLevel <= LOG_LEVELS.debug) {
            console.log('[DEBUG]', ...args);
        }
    },

    info: (...args) => {
        if (currentLevel <= LOG_LEVELS.info) {
            console.log('[INFO]', ...args);
        }
    },

    warn: (...args) => {
        if (currentLevel <= LOG_LEVELS.warn) {
            console.warn('[WARN]', ...args);
        }
    },

    error: (...args) => {
        if (currentLevel <= LOG_LEVELS.error) {
            console.error('[ERROR]', ...args);
        }
    },

    // Always log, regardless of level (for critical startup messages)
    always: (...args) => {
        console.log(...args);
    }
};

module.exports = logger;
