# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered PDF/image to Markdown/HTML/text converter. Uses vision models (Novita AI or OpenRouter) for OCR. Supports parallel processing, retry logic, and optional AI post-processing.

## Commands

```bash
# Development (runs both server and client)
npm run dev

# Server only
cd server && npm start        # production
cd server && npm run dev      # with nodemon

# Client only
cd client && npm start        # runs on port 3002

# Build client for production
cd client && npm run build
```

## Architecture

**Monorepo structure:**
- `client/` - React frontend (port 3002)
- `server/` - Express backend (port 3001)
- `prompts/` - OCR prompts as .md files (loaded at startup)

**Server flow (PDF):**
1. `index.js` receives upload → `fileHandler.js`
2. `pdfUtils.js` converts PDF pages to PNG images via pdftoimg-js
3. Pages processed in parallel (configurable concurrency) via `ocrService.js`
4. Failed pages retry with exponential backoff
5. `tableUtils.js` merges tables spanning across pages
6. Optional AI post-processing (removes headers/footers, merges tables)
7. Optional append content added to end

**Key server files:**
- `server/src/index.js` - Express routes, auth middleware, multer upload
- `server/src/ocrService.js` - API calls to Novita/OpenRouter vision models
- `server/src/fileHandler.js` - Parallel processing with retry logic
- `server/src/config.js` - Model configs, loads prompts from `/prompts/`
- `server/src/tableUtils.js` - Cross-page table merging heuristics

**Client files:**
- `client/src/App.js` - Main component with upload, preview, download
- `client/src/config.js` - Provider/model options, default append content

## Configuration

Environment variables in `server/.env`:
- `NOVITA_API_KEY` / `OPENROUTER_API_KEY` - API keys (at least one required)
- `OCR_CONCURRENCY=3` - Parallel page processing limit
- `OCR_MAX_RETRIES=3` - Retry attempts per page
- `OCR_RETRY_DELAY=2000` - Base retry delay (ms), exponential backoff
- `ACCESS_TOKEN` - Optional auth token
- `LOG_LEVEL` - debug/info/warn/error/silent

## Prompts

Prompts are stored as markdown files in `/prompts/` and loaded by `server/src/config.js`:
- `markdown.md`, `html.md`, `text.md` - Format-specific OCR prompts
- `post-process.md` - AI post-processing prompt
- `append-content.md` - Default content to append

Modify prompts directly in these files; restart server to apply changes.

## API Endpoints

- `POST /api/convert/pdf` - Basic PDF conversion
- `POST /api/convert/pdf-stream` - Streaming with progress updates
- `POST /api/convert/image` - Image file conversion
- `POST /api/convert/image-url` - Image URL conversion
- `GET /api/health` - Health check

All `/api/*` routes require `ACCESS_TOKEN` if configured (via query param, header, or body).
