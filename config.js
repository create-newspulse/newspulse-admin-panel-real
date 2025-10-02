// IMPORTANT: Do NOT hardcode API keys in source. Read from environment variables.
// Example: set GOOGLE_API_KEY in your deployment environment or .env (server-side only).
const config = { apiKey: process.env.GOOGLE_API_KEY || '' };

if (!config.apiKey) {
	// In development, you may populate a local .env file. In production, ensure the env var is set.
	// This file intentionally avoids shipping any sensitive values.
	// If you need to fail fast in production, uncomment the following line:
	// if (process.env.NODE_ENV === 'production') throw new Error('Missing GOOGLE_API_KEY');
}
