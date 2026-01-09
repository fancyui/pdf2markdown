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
      timeout: 300000,
    });

    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(error.response?.data?.error || 'API request failed');
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
