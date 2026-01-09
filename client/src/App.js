import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Tab,
  Tabs
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Description as PDFIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import FileUpload from './components/FileUpload';
import MarkdownPreview from './components/MarkdownPreview';
import { convertFile } from './services/api';
import { PROVIDER_MODELS, DEFAULT_PROMPT } from './config';

function App() {
  const [activeTab, setActiveTab] = useState('pdf');
  const [markdown, setMarkdown] = useState('');
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('novita');
  const [selectedModel, setSelectedModel] = useState(PROVIDER_MODELS.novita[1].value); // deepseek-ocr
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleProviderChange = (e) => {
    const provider = e.target.value;
    setSelectedProvider(provider);
    setSelectedModel(PROVIDER_MODELS[provider][0].value);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleFileSelect = async (file) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await convertFile(file, activeTab, prompt, selectedModel, selectedProvider);
      setMarkdown(result.markdown);
      setSuccess('转换成功！');
    } catch (err) {
      setError(err.message || '转换失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUrlConvert = async () => {
    if (!imageUrl) {
      setError('请输入图片URL');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:3001/api/convert/image-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          prompt,
          model: selectedModel,
          provider: selectedProvider
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMarkdown(data.markdown);
        setSuccess('转换成功！');
      } else {
        setError(data.error || '转换失败');
      }
    } catch (err) {
      setError(err.message || '转换失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          PDF/Image to Markdown Converter
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
          使用 DeepSeek OCR 将文件转换为 Markdown 格式
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange} centered>
            <Tab
              value="pdf"
              label="PDF 文件"
              icon={<PDFIcon />}
              iconPosition="start"
            />
            <Tab
              value="image"
              label="图片文件"
              icon={<ImageIcon />}
              iconPosition="start"
            />
            <Tab
              value="imageUrl"
              label="图片 URL"
              icon={<ImageIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <TextField
            select
            label="选择服务商"
            value={selectedProvider}
            onChange={handleProviderChange}
            disabled={loading}
            sx={{ minWidth: 150 }}
            SelectProps={{
              native: true,
            }}
          >
            <option value="novita">Novita AI</option>
            <option value="openrouter">OpenRouter</option>
          </TextField>
          <TextField
            select
            label="选择模型"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={loading}
            sx={{ minWidth: 200 }}
            SelectProps={{
              native: true,
            }}
          >
            {PROVIDER_MODELS[selectedProvider].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="自定义提示词（可选）"
            placeholder="例如：请识别图片中的文字内容，并以Markdown格式输出..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            multiline
            rows={2}
            sx={{ flexBasis: '100%' }}
          />
        </Box>

        {activeTab === 'imageUrl' ? (
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="图片 URL"
              placeholder="例如：https://example.com/image.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleImageUrlConvert}
              disabled={loading || !imageUrl}
              sx={{ mt: 2 }}
              fullWidth
            >
              开始转换
            </Button>
          </Box>
        ) : (
          <FileUpload
            onFileSelect={handleFileSelect}
            accept={activeTab === 'pdf' ? '.pdf' : 'image/*'}
            loading={loading}
          />
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 3 }}>
            {success}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {markdown && !loading && (
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Markdown 预览</Typography>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
              >
                下载 Markdown
              </Button>
            </Box>
            <MarkdownPreview content={markdown} />
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default App;
