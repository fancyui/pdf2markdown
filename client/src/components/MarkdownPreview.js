import React from 'react';
import { Paper, Box, Tabs, Tab } from '@mui/material';
import MarkdownPreview from '@uiw/react-markdown-preview';

const MarkdownPreviewComponent = ({ content }) => {
  const [viewMode, setViewMode] = React.useState('preview');

  return (
    <Paper
      elevation={1}
      sx={{
        overflow: 'hidden',
        backgroundColor: '#fff'
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={viewMode} onChange={(e, v) => setViewMode(v)} size="small">
          <Tab value="preview" label="预览" />
          <Tab value="source" label="源码" />
        </Tabs>
      </Box>

      {viewMode === 'preview' ? (
        <Box
          sx={{
            maxHeight: 600,
            overflow: 'auto',
            p: 2,
            '& .wmde-markdown': {
              backgroundColor: 'transparent',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            },
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
              margin: '16px 0',
            },
            '& th, & td': {
              border: '1px solid #ddd',
              padding: '8px 12px',
              textAlign: 'left',
            },
            '& th': {
              backgroundColor: '#f5f5f5',
              fontWeight: 600,
            },
            '& tr:nth-of-type(even)': {
              backgroundColor: '#fafafa',
            },
            '& tr:hover': {
              backgroundColor: '#f0f0f0',
            },
          }}
        >
          <MarkdownPreview
            source={content}
            rehypeRewrite={(node, index, parent) => {
              // Allow raw HTML (like tables)
              if (node.tagName === 'a') {
                node.properties = { ...node.properties, target: '_blank', rel: 'noopener noreferrer' };
              }
            }}
            wrapperElement={{
              'data-color-mode': 'light'
            }}
          />
        </Box>
      ) : (
        <Box
          component="pre"
          sx={{
            maxHeight: 600,
            overflow: 'auto',
            p: 2,
            m: 0,
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '13px',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </Box>
      )}
    </Paper>
  );
};

export default MarkdownPreviewComponent;
