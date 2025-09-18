"use client";

import Navbar from "../../../components/Navbar";
import AuthTest from "../../components/AuthTest";

export default function TestPage() {
  return (
    <div>
      <Navbar />
      <div style={{ 
        minHeight: '100vh', 
        padding: '20px', 
        backgroundColor: '#f5f5f5',
        fontFamily: 'Arial, sans-serif'
      }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        backgroundColor: 'white', 
        padding: '30px', 
        borderRadius: '12px', 
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ 
          color: '#333', 
          marginBottom: '10px',
          fontSize: '2.5rem'
        }}>
          🔐 JWT Authentication Test
        </h1>
        
        <p style={{ 
          color: '#666', 
          marginBottom: '30px',
          fontSize: '1.1rem'
        }}>
          Test the JWT authentication system with wallet signing
        </p>
        
        <div style={{ 
          border: '2px solid #007bff', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f8f9fa'
        }}>
          <AuthTest />
        </div>
        
        <div style={{ 
          marginTop: '30px', 
          padding: '20px', 
          backgroundColor: '#e9ecef', 
          borderRadius: '8px'
        }}>
          <h3 style={{ color: '#495057', marginBottom: '15px' }}>How to Test:</h3>
          <ol style={{ color: '#6c757d', lineHeight: '1.6' }}>
            <li>Connect your wallet using the Navbar</li>
            <li>Click "Login with Wallet" button</li>
            <li>Sign the message in your wallet</li>
            <li>Click "Test Health API" to verify authentication</li>
            <li>Use "Logout" to clear your session</li>
          </ol>
        </div>
      </div>
    </div>
    </div>
  );
}
