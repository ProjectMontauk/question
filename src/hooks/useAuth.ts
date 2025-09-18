import { useActiveAccount } from 'thirdweb/react';
import { useState, useEffect, useCallback } from 'react';
import { signMessage } from 'thirdweb/utils';

const API_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://mvpshell.vercel.app' : '';

// This hook manages the user's "nightclub experience"
export const useAuth = () => {
  const account = useActiveAccount();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check if user is authenticated by making a request to the server
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/check`, {
          credentials: 'include', // Include cookies in the request
        });
        
        if (response.ok) {
          const data = await response.json();
          setToken(data.token);
          setIsAuthenticated(true);
        }
      } catch (error) {
        // User is not authenticated
        setToken(null);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // The "authentication process" - like going through the door and bouncer
  const login = useCallback(async () => {
    if (!account?.address) {
      setAuthError('Please connect your wallet first');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      console.log('Step 1: Getting challenge from door...');
      
      // Step 1: Get a challenge from the door
      const nonceResponse = await fetch(`${API_BASE_URL}/api/auth/nonce?walletAddress=${account.address}`);
      if (!nonceResponse.ok) {
        const errorData = await nonceResponse.json();
        throw new Error(errorData.error || 'Failed to get challenge');
      }
      const { nonce } = await nonceResponse.json();
      console.log('Received nonce:', nonce);

      console.log('Step 2: Signing challenge with wallet...');
      
      // Step 2: Sign the challenge with your wallet (like showing ID)
      const message = `Authenticate to MVP Shell: ${nonce}`;
      
      console.log('Account object:', account);
      console.log('Message to sign:', message);
      
      const signature = await signMessage({
        message: message,
        account: account,
      });
      
      console.log('Generated signature:', signature);

      console.log('Step 3: Getting wristband from bouncer...');
      
      // Step 3: Send signature to bouncer and get wristband (now stored in cookie)
      const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies in the request
        body: JSON.stringify({ walletAddress: account.address, signature, message }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const data = await loginResponse.json();
      
      // Token is now stored in HTTP-only cookie, so we just mark as authenticated
      setToken('cookie-stored'); // Placeholder since we can't access the cookie directly
      setIsAuthenticated(true);
      
      console.log('✅ Authentication successful! You now have a wristband.');

    } catch (err: any) {
      console.error('Authentication failed:', err);
      setAuthError(err.message || 'Authentication failed');
      setToken(null);
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }, [account?.address]);

  // Remove wristband (like leaving the club)
  const logout = useCallback(async () => {
    try {
      // Call logout endpoint to clear the cookie
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setIsAuthenticated(false);
      console.log('Logged out - wristband removed');
    }
  }, []);

  // Make authenticated API calls (show wristband at each area)
  const authenticatedFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    if (!isAuthenticated) {
      throw new Error('No wristband - please authenticate first');
    }

    const defaultHeaders = {
      'Content-Type': 'application/json',
      // No need to manually add token - it's automatically included in cookies
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include', // Include cookies in the request
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // If wristband is invalid, remove it
    if (response.status === 401) {
      logout();
      throw new Error('Wristband expired - please get a new one');
    }

    return response;
  }, [isAuthenticated, logout]);

  return { 
    token, 
    isAuthenticated, 
    authLoading, 
    authError, 
    login, 
    logout, 
    authenticatedFetch 
  };
};
