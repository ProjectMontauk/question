// API Authentication utilities
export function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key');
  const validApiKey = process.env.API_SECRET_KEY;
  
  if (!validApiKey) {
    console.error('API_SECRET_KEY not configured');
    return false;
  }
  
  return apiKey === validApiKey;
}

export function getApiKeyFromRequest(request: Request): string | null {
  return request.headers.get('x-api-key');
}

// For Pages API routes (legacy)
export function validateApiKeyPages(req: any): boolean {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_SECRET_KEY;
  
  if (!validApiKey) {
    console.error('API_SECRET_KEY not configured');
    return false;
  }
  
  return apiKey === validApiKey;
}
