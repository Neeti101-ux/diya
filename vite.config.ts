import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Collect all API keys from environment variables
    const apiKeys = [];
    let keyIndex = 1;
    
    // Check for numbered API keys (VITE_GEMINI_API_KEY_1, VITE_GEMINI_API_KEY_2, etc.)
    while (env[`VITE_GEMINI_API_KEY_${keyIndex}`]) {
      apiKeys.push(env[`VITE_GEMINI_API_KEY_${keyIndex}`]);
      keyIndex++;
    }
    
    // If no numbered keys found, fall back to single VITE_GEMINI_API_KEY
    if (apiKeys.length === 0 && env.VITE_GEMINI_API_KEY) {
      apiKeys.push(env.VITE_GEMINI_API_KEY);
    }
    
    return {
      define: {
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'import.meta.env.VITE_GEMINI_API_KEYS_JSON': JSON.stringify(JSON.stringify(apiKeys))
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
