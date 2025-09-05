export async function submitTestDeposit(walletAddress: string) {
  try {
    const res = await fetch('/api/submit-test-deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to submit test deposit');
    }
    
    const result = await res.json();
    return result.success ? result.data : result;
  } catch (error) {
    console.error('Failed to submit test deposit:', error);
    throw error;
  }
}
