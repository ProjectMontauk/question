// Stripe configuration that automatically switches between test and live keys
// based on environment

// Helper function to get the correct environment variable
const getEnvVar = (name: string): string | undefined => {
  const key = process.env.NODE_ENV === 'production' ? name : `Test_${name}`;
  return process.env[key];
};

// Get the correct keys based on environment
export const STRIPE_SECRET_KEY = getEnvVar('STRIPE_SECRET_KEY');
export const STRIPE_PUBLISHABLE_KEY = getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
export const STRIPE_WEBHOOK_SECRET = getEnvVar('STRIPE_WEBHOOK_SECRET');