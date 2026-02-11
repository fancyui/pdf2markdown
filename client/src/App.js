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
  Tabs,
  Switch,
  FormControlLabel,
  IconButton,
  Divider
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Description as PDFIcon,
  Image as ImageIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import FileUpload from './components/FileUpload';
import MarkdownPreview from './components/MarkdownPreview';
import { convertFile, convertFileStream, convertPDFParts } from './services/api';
import { PROVIDER_MODELS, DEFAULT_APPEND_CONTENT } from './config';

function App() {
  const [activeTab, setActiveTab] = useState('pdf');
  const [markdown, setMarkdown] = useState('');
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('novita');
  const [selectedModel, setSelectedModel] = useState(PROVIDER_MODELS.novita[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(null); // { current, total, status }
  const [appendContent, setAppendContent] = useState(DEFAULT_APPEND_CONTENT.trim()); // Content to append at end of PDF
  const [outputFormat, setOutputFormat] = useState('markdown'); // markdown | html | text
  const [enableAppend, setEnableAppend] = useState(false); // Enable/disable append content
  const [enablePostProcess, setEnablePostProcess] = useState(false); // Enable/disable AI post-processing

  // Part mode states
  const [enablePartMode, setEnablePartMode] = useState(false);
  const [parts, setParts] = useState([{ startPage: 1, endPage: 1, title: 'Part 1' }]);
  const [enableDirectory, setEnableDirectory] = useState(false);
  const [directoryPages, setDirectoryPages] = useState({ startPage: 1, endPage: 1 });

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
    setProgress(null);

    try {
      const onStatus = (statusData) => {
        setProgress(statusData);
      };

      let result;

      // Use part mode if enabled and activeTab is pdf
      if (activeTab === 'pdf' && enablePartMode) {
        result = await convertPDFParts(
          file,
          parts,
          enableDirectory ? directoryPages : null,
          {
            prompt,
            model: selectedModel,
            provider: selectedProvider,
            outputFormat,
            enablePostProcess,
            appendContent: enableAppend ? appendContent : ''
          },
          onStatus
        );
      } else {
        result = await convertFileStream(
          file,
          activeTab,
          prompt,
          selectedModel,
          selectedProvider,
          onStatus,
          enableAppend ? appendContent : '',
          outputFormat,
          enablePostProcess
        );
      }

      setMarkdown(result.markdown);
      setSuccess('转换成功！');
    } catch (err) {
      setError(err.message || '转换失败，请重试');
    } finally {
      setLoading(false);
      setProgress(null);
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
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const token = new URLSearchParams(window.location.search).get('token') || '';
      const response = await fetch(`${API_BASE_URL}/convert/image-url${token ? `?token=${token}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          prompt,
          model: selectedModel,
          provider: selectedProvider,
          outputFormat
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
    const formatConfig = {
      markdown: { ext: 'md', mime: 'text/markdown', label: 'Markdown' },
      html: { ext: 'html', mime: 'text/html', label: 'HTML' },
      text: { ext: 'txt', mime: 'text/plain', label: '纯文本' }
    };
    const config = formatConfig[outputFormat] || formatConfig.markdown;

    const blob = new Blob([markdown], { type: config.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted-${Date.now()}.${config.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Part management functions
  const addPart = () => {
    const lastPart = parts[parts.length - 1];
    setParts([...parts, {
      startPage: lastPart.endPage + 1,
      endPage: lastPart.endPage + 1,
      title: `Part ${parts.length + 1}`
    }]);
  };

  const removePart = (index) => {
    if (parts.length > 1) {
      setParts(parts.filter((_, i) => i !== index));
    }
  };

  const updatePart = (index, field, value) => {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], [field]: value };
    setParts(newParts);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          智能文档转换器
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
          使用 AI OCR 将 PDF 和图片转换为多种格式
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
            select
            label="输出格式"
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value)}
            disabled={loading}
            sx={{ minWidth: 120 }}
            SelectProps={{
              native: true,
            }}
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="text">纯文本</option>
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
          {activeTab === 'pdf' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexBasis: '100%' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableAppend}
                    onChange={(e) => setEnableAppend(e.target.checked)}
                  />
                }
                label="末尾追加内容"
              />
              {enableAppend && (
                <TextField
                  fullWidth
                  label="追加内容"
                  placeholder="例如：---\n\n本文档由 AI 自动识别生成"
                  value={appendContent}
                  onChange={(e) => setAppendContent(e.target.value)}
                  multiline
                  rows={6}
                />
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={enablePostProcess}
                    onChange={(e) => setEnablePostProcess(e.target.checked)}
                  />
                }
                label="AI 后处理（去页眉页脚、合并跨页表格）"
              />
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={
                  <Switch
                    checked={enablePartMode}
                    onChange={(e) => setEnablePartMode(e.target.checked)}
                  />
                }
                label="分Part模式（长图合并OCR，适合跨页内容）"
              />
              {enablePartMode && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    目录页配置（可选）
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={enableDirectory}
                        onChange={(e) => setEnableDirectory(e.target.checked)}
                      />
                    }
                    label="指定目录页范围"
                  />
                  {enableDirectory && (
                    <Box sx={{ display: 'flex', gap: 2, mt: 1, mb: 2 }}>
                      <TextField
                        type="number"
                        label="目录起始页"
                        value={directoryPages.startPage}
                        onChange={(e) => setDirectoryPages({ ...directoryPages, startPage: parseInt(e.target.value) || 1 })}
                        size="small"
                        inputProps={{ min: 1 }}
                        sx={{ width: 120 }}
                      />
                      <TextField
                        type="number"
                        label="目录结束页"
                        value={directoryPages.endPage}
                        onChange={(e) => setDirectoryPages({ ...directoryPages, endPage: parseInt(e.target.value) || 1 })}
                        size="small"
                        inputProps={{ min: 1 }}
                        sx={{ width: 120 }}
                      />
                    </Box>
                  )}

                  <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                    Part 配置
                  </Typography>
                  {parts.map((part, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                      <TextField
                        type="number"
                        label="起始页"
                        value={part.startPage}
                        onChange={(e) => updatePart(index, 'startPage', parseInt(e.target.value) || 1)}
                        size="small"
                        inputProps={{ min: 1 }}
                        sx={{ width: 100 }}
                      />
                      <TextField
                        type="number"
                        label="结束页"
                        value={part.endPage}
                        onChange={(e) => updatePart(index, 'endPage', parseInt(e.target.value) || 1)}
                        size="small"
                        inputProps={{ min: 1 }}
                        sx={{ width: 100 }}
                      />
                      <TextField
                        label="标题"
                        value={part.title}
                        onChange={(e) => updatePart(index, 'title', e.target.value)}
                        size="small"
                        sx={{ flex: 1 }}
                      />
                      <IconButton
                        onClick={() => removePart(index)}
                        disabled={parts.length === 1}
                        color="error"
                      >
                        <RemoveIcon />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addPart}
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    添加 Part
                  </Button>
                </Box>
              )}
            </Box>
          )}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3, gap: 2 }}>
            <CircularProgress />
            {progress && (
              <Typography variant="body2" color="text.secondary">
                {progress.status === 'splitting' && '正在对 PDF 进行分页...'}
                {progress.status === 'ocr' && `正在识别第 ${progress.current} 页 / 共 ${progress.total} 页...`}
                {progress.status === 'merging' && '正在合并页面...'}
                {progress.status === 'postprocess' && '正在进行 AI 审校（去除页眉页脚、合并跨页表格）...'}
              </Typography>
            )}
          </Box>
        )}

        {markdown && !loading && (
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {outputFormat === 'markdown' && 'Markdown 预览'}
                {outputFormat === 'html' && 'HTML 预览'}
                {outputFormat === 'text' && '纯文本预览'}
              </Typography>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
              >
                {outputFormat === 'markdown' && '下载 Markdown'}
                {outputFormat === 'html' && '下载 HTML'}
                {outputFormat === 'text' && '下载纯文本'}
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
