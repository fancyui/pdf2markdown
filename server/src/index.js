const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const archiver = require('archiver');
const { processOCR } = require('./ocrService');
const { handlePDFUpload, handleImageUpload, handlePDFPartsUpload } = require('./fileHandler');
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
    const { model, provider, appendContent, outputFormat, enablePostProcess } = req.body;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const onProgress = (data) => {
      res.write(JSON.stringify(data) + '\n');
    };

    const result = await handlePDFUpload(req.file.path, customPrompt, model, provider, onProgress, appendContent, outputFormat, enablePostProcess === 'true');

    res.write(JSON.stringify({
      type: 'complete',
      success: true,
      markdown: result.markdown,
      taskId: result.taskId,
      images: result.images,
      outputFileName: result.outputFileName
    }) + '\n');
    res.end();
  } catch (error) {
    logger.error('Error processing PDF stream:', error);
    res.write(JSON.stringify({ type: 'error', error: error.message }) + '\n');
    res.end();
  }
});

// Parts mode: split PDF into parts and merge each part as long image
app.post('/api/convert/pdf-parts', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const customPrompt = req.body.prompt || '';
    const { model, provider, appendContent, outputFormat, enablePostProcess } = req.body;

    // Parse parts and directoryPages from JSON strings
    let parts = [];
    let directoryPages = null;

    try {
      if (req.body.parts) {
        parts = JSON.parse(req.body.parts);
      }
      if (req.body.directoryPages) {
        directoryPages = JSON.parse(req.body.directoryPages);
      }
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid parts or directoryPages format' });
    }

    if (!parts || parts.length === 0) {
      return res.status(400).json({ error: 'No parts specified' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const onProgress = (data) => {
      res.write(JSON.stringify(data) + '\n');
    };

    const result = await handlePDFPartsUpload(
      req.file.path,
      parts,
      directoryPages,
      customPrompt,
      model,
      provider,
      onProgress,
      appendContent,
      outputFormat,
      enablePostProcess === 'true'
    );

    res.write(JSON.stringify({
      type: 'complete',
      success: true,
      markdown: result.markdown,
      taskId: result.taskId,
      images: result.images,
      outputFileName: result.outputFileName
    }) + '\n');
    res.end();
  } catch (error) {
    logger.error('Error processing PDF parts:', error);
    res.write(JSON.stringify({ type: 'error', error: error.message }) + '\n');
    res.end();
  }
});

app.post('/api/convert/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const customPrompt = req.body.prompt || '';
    const { model, provider, outputFormat } = req.body;
    const result = await handleImageUpload(req.file.path, customPrompt, model, provider, outputFormat);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error processing image:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/convert/image-url', async (req, res) => {
  try {
    const { imageUrl, prompt, model, provider, outputFormat } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'No image URL provided' });
    }

    const customPrompt = prompt || '';
    const result = await handleImageUrlUpload(imageUrl, customPrompt, model, provider, outputFormat);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error processing image URL:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve extracted images
app.get('/api/images/:taskId/:imageName', (req, res) => {
  const { taskId, imageName } = req.params;
  const imagePath = path.join(__dirname, '../../uploads', taskId, 'images', imageName);

  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  res.sendFile(imagePath);
});

// Serve converted files
app.get('/api/files/:taskId/:fileName', (req, res) => {
  const { taskId, fileName } = req.params;
  const filePath = path.join(__dirname, '../uploads', taskId, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});

// Download all images as ZIP
app.get('/api/download/images/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const imageDir = path.join(__dirname, '../../uploads', taskId, 'images');

  if (!fs.existsSync(imageDir)) {
    return res.status(404).json({ error: 'No images found for this task' });
  }

  const images = fs.readdirSync(imageDir);
  if (images.length === 0) {
    return res.status(404).json({ error: 'No images found for this task' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=images-${taskId}.zip`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  for (const imageName of images) {
    const imagePath = path.join(imageDir, imageName);
    archive.file(imagePath, { name: imageName });
  }

  archive.finalize();
});

const server = app.listen(PORT, () => {
  logger.always(`Server running on port ${PORT}`);
  logger.always(`Health check: http://localhost:${PORT}/api/health`);
});

// Set server timeout to 1 hour (3600000 ms)
server.timeout = 3600000;

