# Diya - AI Companion

Diya is a comprehensive AI assistant developed by UB Intelligence, designed as the ultimate companion for entrepreneurs and business builders. Your dual mission encompasses both mental wellness support and strategic business guidance, recognizing that entrepreneurial success requires both emotional resilience and tactical expertise.

## Features

- 🎙️ Voice-based interaction with natural language processing
- 💬 Real-time responses to business and wellness queries
- 🧠 Mental wellness support tailored to entrepreneurial pressures
- 📈 Strategic business guidance and market analysis
- 🎨 Beautiful 3D visualization with dark red aesthetic
- 🔊 High-quality audio responses with natural voice
- 🔍 Real-time information search capabilities

## Core Capabilities

### Mental Wellness Support
- Empathetic, practical mental health support for entrepreneurs
- Stress management techniques for high-stakes business situations
- Mindfulness practices that enhance decision-making and leadership presence
- Emotional balance guidance during high-pressure situations

### Business Strategy & Advisory
- Market opportunity and competitive landscape analysis (Indian market focus)
- Comprehensive sales strategies and customer acquisition frameworks
- Executive advisory across key functions:
  - **CTO Support**: Technology strategy and product development
  - **CFO Guidance**: Financial planning and fundraising
  - **CMO Assistance**: Marketing strategy and brand positioning
  - **CEO Mentorship**: Strategic decision-making and organizational scaling

### Unique Value Proposition
- Understanding that business challenges and mental wellness are interconnected
- Helping entrepreneurs make strategic decisions while managing stress
- Developing resilient leadership skills
- Navigating psychological aspects of executive responsibilities

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
   VITE_GEMINI_API_KEY=your_api_key_here
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
3. Ask your business questions, seek wellness guidance, or request strategic advice
4. Click the red stop button (■) to end your query
5. Listen to Diya's comprehensive response

## Visual Design

- **Globe**: Dark red (0x8B0000) with metallic finish and emissive glow
- **Particles**: Dark red particle system with spherical distribution
- **Environment**: Studio lighting with procedural environment mapping
- **Effects**: Enhanced bloom and post-processing for premium visual experience

## Technical Details

- Built with Vite and TypeScript
- Uses Lit Elements for web components
- Three.js for 3D visualizations with custom shaders
- Google's Gemini AI for natural language processing
- Web Audio API for audio processing and visualization
- Real-time Google Search integration for up-to-date information

## About UB Intelligence

Diya is developed by UB Intelligence, focusing on creating AI solutions that bridge the gap between mental wellness and business strategy for entrepreneurs and business builders.

---

*Empowering entrepreneurs with both emotional resilience and strategic expertise.*