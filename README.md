# Neeti - AI-Powered Legal Assistant

Neeti is an advanced AI-powered legal assistant trained on Indian laws, designed to assist Indian legal professionals during case preparation, court hearings, client consultations, and legal research.

## Features

- 🎙️ Voice-based interaction with natural language processing
- 💬 Real-time responses to legal queries
- 📚 Comprehensive knowledge of Indian laws and legal procedures
- 🎨 Beautiful 3D visualization of voice interactions
- 🔊 High-quality audio responses with natural voice

## Prerequisites

- Node.js (Latest LTS version recommended)
- A Gemini API key
- Modern web browser with microphone support

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root directory and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

## Running Locally

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage

1. Click the blue reset button (↺) to start a new session
2. Click the green record button (●) to start speaking
3. Ask your legal questions or request assistance
4. Click the red stop button (■) to end your query
5. Listen to Neeti's response

## Technical Details

- Built with Vite and TypeScript
- Uses Lit Elements for web components
- Three.js for 3D visualizations
- Google's Gemini AI for natural language processing
- Web Audio API for audio processing and visualization
