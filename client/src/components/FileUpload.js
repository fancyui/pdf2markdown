import React, { useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';

const FileUpload = ({ onFileSelect, accept, loading }) => {
  const fileInputRef = useRef(null);

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileSelect(file);
    }
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <Box>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        style={{ display: 'none' }}
        disabled={loading}
      />
      <Paper
        sx={{
          p: 6,
          border: '2px dashed #ccc',
          borderRadius: 2,
          textAlign: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          bgcolor: loading ? 'grey.100' : 'transparent',
          '&:hover': {
            bgcolor: loading ? 'grey.100' : 'action.hover',
            borderColor: loading ? '#ccc' : '#1976d2'
          }
        }}
        onClick={handleButtonClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              点击或拖拽文件到此处上传
            </Typography>
            <Typography variant="body2" color="text.secondary">
              支持格式: {accept}
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default FileUpload;
