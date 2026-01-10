const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processOCR } = require('./ocrService');
const { handlePDFUpload, handleImageUpload } = require('./fileHandler');
const { DEFAULT_PROMPT } = require('./config');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple token authentication middleware
const ACCESS_TOKEN = process.env.ACCESS_TOKEN?.trim();
const authMiddleware = (req, res, next) => {
  // Skip auth if no token configured
  if (!ACCESS_TOKEN) {
    return next();
  }

  // Check token in query, header, or body
  const token = (req.query.token || req.headers['x-access-token'] || req.body?.token || '')?.trim();

  logger.debug(`Auth check: received="${token}", expected="${ACCESS_TOKEN}"`);

  if (token === ACCESS_TOKEN) {
    return next();
  }

  logger.warn(`Unauthorized access attempt from ${req.ip}, token: "${token}"`);
  return res.status(401).json({ error: '未授权访问，请提供有效的访问令牌' });
};

// Apply auth to API routes
app.use('/api', authMiddleware);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/api/convert/pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const customPrompt = req.body.prompt || '';
    const { model, provider } = req.body;
    const result = await handlePDFUpload(req.file.path, customPrompt, model, provider);

    res.json({ success: true, markdown: result });
  } catch (error) {
    logger.error('Error processing PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Streaming version for progress updates
app.post('/api/convert/pdf-stream', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const customPrompt = req.body.prompt || '';
    const { model, provider, appendContent, outputFormat } = req.body;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const onProgress = (data) => {
      res.write(JSON.stringify(data) + '\n');
    };

    const result = await handlePDFUpload(req.file.path, customPrompt, model, provider, onProgress, appendContent, outputFormat);

    res.write(JSON.stringify({ success: true, markdown: result }) + '\n');
    res.end();
  } catch (error) {
    logger.error('Error processing PDF stream:', error);
    res.write(JSON.stringify({ error: error.message }) + '\n');
    res.end();
  }
});

app.post('/api/convert/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const customPrompt = req.body.prompt || '';
    const { model, provider } = req.body;
    const result = await handleImageUpload(req.file.path, customPrompt, model, provider);

    res.json({ success: true, markdown: result });
  } catch (error) {
    logger.error('Error processing image:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/convert/image-url', async (req, res) => {
  try {
    const { imageUrl, prompt, model, provider } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'No image URL provided' });
    }

    const customPrompt = prompt || DEFAULT_PROMPT;
    const result = await processOCR(imageUrl, customPrompt, model, provider);

    res.json({ success: true, markdown: result });
  } catch (error) {
    logger.error('Error processing image URL:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

const server = app.listen(PORT, () => {
  logger.always(`Server running on port ${PORT}`);
  logger.always(`Health check: http://localhost:${PORT}/api/health`);
});

// Set server timeout to 1 hour (3600000 ms)
server.timeout = 3600000;

