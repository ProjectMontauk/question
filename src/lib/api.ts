// API utility functions with authentication
const API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://question-ochre.vercel.app' : '';

// Get API key from environment (this should be set in your build process)
const getApiKey = (): string => {
  // In production, this should be set as an environment variable
  // For now, we'll use a placeholder - you'll need to set this properly
  return process.env.NEXT_PUBLIC_API_KEY || 'your-api-key-here';
};

// Make authenticated API calls
export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const apiKey = getApiKey();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  };
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  return fetch(url, config);
};

// Make authenticated API calls for file uploads
export const apiCallWithFormData = async (endpoint: string, formData: FormData) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const apiKey = getApiKey();
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: formData,
  });
};
