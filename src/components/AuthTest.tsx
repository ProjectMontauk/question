import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function AuthTest() {
  const { isAuthenticated, authLoading, authError, login, logout, authenticatedFetch } = useAuth();

  const testHealthAPI = async () => {
    try {
      const response = await authenticatedFetch('/api/health');
      const data = await response.json();
      console.log('Health API response:', data);
      alert(`Health API Success: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('Health API error:', error);
      alert(`Health API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (authLoading) {
    return <div>Logging in...</div>;
  }

  if (authError) {
    return (
      <div>
        <p>Error: {authError}</p>
        <button onClick={login}>Try Again</button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div>
        <h3>JWT Authentication Test</h3>
        <p>Click the button below to test JWT authentication:</p>
        <button onClick={login}>Login with Wallet</button>
      </div>
    );
  }

  return (
    <div>
      <h3>JWT Authentication Test</h3>
      <p>✅ You are authenticated!</p>
      <button onClick={testHealthAPI}>Test Health API</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
