import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export const convertFile = async (file, type, prompt = '', model = '', provider = 'novita') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('prompt', prompt);
  formData.append('model', model);
  formData.append('provider', provider);

  const endpoint = type === 'pdf' ? '/convert/pdf' : '/convert/image';

  try {
    const response = await axios.post(`${API_BASE_URL}${endpoint}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 3600000,
    });

    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(error.response?.data?.error || 'API request failed');
  }
};

export const convertFileStream = async (file, type, prompt = '', model = '', provider = 'novita', onStatus, appendContent = '') => {
  if (type !== 'pdf') {
    return convertFile(file, type, prompt, model, provider);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('prompt', prompt);
  formData.append('model', model);
  formData.append('provider', provider);
  formData.append('appendContent', appendContent);

  try {
    const response = await fetch(`${API_BASE_URL}/convert/pdf-stream`, {
      method: 'POST',
      body: formData,
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          const data = JSON.parse(line);
          if (data.type === 'progress') {
            onStatus(data);
          } else if (data.success) {
            return data;
          } else if (data.error) {
            throw new Error(data.error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream Error:', error);
    throw error;
  }
};

export const checkHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};
