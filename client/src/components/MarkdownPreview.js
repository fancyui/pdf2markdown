import React from 'react';
import {
  Box,
  Paper,
  Typography
} from '@mui/material';
import ReactMarkdown from 'react-markdown';

const MarkdownPreview = ({ content }) => {
  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 3, 
        maxHeight: 600, 
        overflow: 'auto',
        backgroundColor: '#fafafa'
      }}
    >
      <ReactMarkdown
        components={{
          h1: ({node, ...props}) => <Typography variant="h4" gutterBottom {...props} />,
          h2: ({node, ...props}) => <Typography variant="h5" gutterBottom {...props} />,
          h3: ({node, ...props}) => <Typography variant="h6" gutterBottom {...props} />,
          p: ({node, ...props}) => <Typography paragraph {...props} />,
          ul: ({node, ...props}) => <Box component="ul" sx={{ pl: 4 }} {...props} />,
          ol: ({node, ...props}) => <Box component="ol" sx={{ pl: 4 }} {...props} />,
          li: ({node, ...props}) => <Typography component="li" {...props} />,
          code: ({node, inline, ...props}) => 
            inline 
              ? <Box component="code" sx={{ 
                  bgcolor: 'grey.200', 
                  px: 0.5, 
                  py: 0.25, 
                  borderRadius: 0.5,
                  fontFamily: 'monospace'
                }} {...props} />
              : <Box component="pre" sx={{ 
                  bgcolor: 'grey.900', 
                  color: 'white', 
                  p: 2, 
                  borderRadius: 1,
                  overflow: 'auto',
                  fontFamily: 'monospace'
                }} {...props} />,
          blockquote: ({node, ...props}) => (
            <Box sx={{ 
              borderLeft: 4, 
              borderColor: 'primary.main', 
              pl: 2, 
              my: 2,
              fontStyle: 'italic'
            }} {...props} />
          ),
          hr: ({node, ...props}) => <Box component="hr" sx={{ my: 2, border: 'none', borderTop: 1, borderColor: 'divider' }} {...props} />
        }}
      >
        {content}
      </ReactMarkdown>
    </Paper>
  );
};

export default MarkdownPreview;
