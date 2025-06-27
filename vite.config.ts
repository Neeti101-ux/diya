import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Collect all API keys from environment variables
    const apiKeys = [];
    let keyIndex = 1;
    
    // Check for numbered API keys (GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
    while (env[`GEMINI_API_KEY_${keyIndex}`]) {
      apiKeys.push(env[`GEMINI_API_KEY_${keyIndex}`]);
      keyIndex++;
    }
    
    // If no numbered keys found, fall back to single GEMINI_API_KEY
    if (apiKeys.length === 0 && env.GEMINI_API_KEY) {
      apiKeys.push(env.GEMINI_API_KEY);
    }
    
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEYS': JSON.stringify(apiKeys)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
