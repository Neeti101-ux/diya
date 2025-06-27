/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state() username = '';
  @state() occupation = '';
  @state() showPersonalizationForm = true;
  @state() conversationHistory: Array<{speaker: string, text: string, timestamp: Date}> = [];
  @state() showHistory = false;

  private client: GoogleGenAI;
  private session: Session;
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private sourceNode: AudioBufferSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private sources = new Set<AudioBufferSourceNode>();

  static styles = css`
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      color: #000000;
      font-weight: 500;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: row;
      gap: 10px;

      button {
        outline: none;
        border: none;
        color: #ffffff;
        border-radius: 12px;
        width: 64px;
        height: 64px;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        margin: 0;
        transition: all 0.3s ease;
      }

      button#startButton {
        background: #10B981;
        box-shadow: 0 4px 6px rgba(16, 185, 129, 0.25);
      }

      button#startButton:hover {
        background: #059669;
        transform: translateY(-2px);
      }

      button#stopButton {
        background: #EF4444;
        box-shadow: 0 4px 6px rgba(239, 68, 68, 0.25);
      }

      button#stopButton:hover {
        background: #DC2626;
        transform: translateY(-2px);
      }

      button#resetButton {
        background: #6366F1;
        box-shadow: 0 4px 6px rgba(99, 102, 241, 0.25);
      }

      button#resetButton:hover {
        background: #4F46E5;
        transform: translateY(-2px);
      }

      button[disabled] {
        display: none;
      }

      button#historyButton {
        background: #8B5CF6;
        box-shadow: 0 4px 6px rgba(139, 92, 246, 0.25);
      }

      button#historyButton:hover {
        background: #7C3AED;
        transform: translateY(-2px);
      }
    }

    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 5;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      padding: 12px 20px;
      text-align: center;
      font-size: 14px;
      color: #666666;
      font-weight: 400;
      letter-spacing: 0.5px;
    }

    .footer a {
      color: #4F46E5;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .footer a:hover {
      color: #3730A3;
    }

    .personalization-form {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      max-width: 400px;
      width: 90%;
      z-index: 1000;
      text-align: center;
    }

    .personalization-form h2 {
      margin: 0 0 10px 0;
      color: #1a1a1a;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }

    .personalization-form p {
      margin: 0 0 30px 0;
      color: #666666;
      font-size: 16px;
      line-height: 1.5;
    }

    .form-group {
      margin-bottom: 20px;
      text-align: left;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #333333;
      font-weight: 500;
      font-size: 14px;
      letter-spacing: 0.3px;
    }

    .personalization-form input[type="text"] {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      font-size: 16px;
      font-family: inherit;
      background: rgba(255, 255, 255, 0.8);
      transition: all 0.3s ease;
      outline: none;
      box-sizing: border-box;
    }

    .personalization-form input[type="text"]:focus {
      border-color: #6366F1;
      background: rgba(255, 255, 255, 1);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .personalization-form input[type="text"]::placeholder {
      color: #9ca3af;
    }

    .form-submit-button {
      background: #6366F1;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 14px 32px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 6px rgba(99, 102, 241, 0.25);
      margin-top: 10px;
      width: 100%;
    }

    .form-submit-button:hover {
      background: #4F46E5;
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(99, 102, 241, 0.3);
    }

    .form-status {
      margin-top: 15px;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
    }

    .form-status.error {
      background: rgba(239, 68, 68, 0.1);
      color: #DC2626;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .personalization-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #8B0000 0%, #000000 50%, #8B0000 100%);
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .history-panel {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      max-height: 70vh;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .history-header {
      padding: 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.8);
    }

    .history-header h3 {
      margin: 0;
      color: #1a1a1a;
      font-size: 18px;
      font-weight: 600;
    }

    .history-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .history-close:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }

    .history-content {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .history-item {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .history-item:last-child {
      border-bottom: none;
    }

    .history-speaker {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .history-speaker.user {
      color: #059669;
    }

    .history-speaker.diya {
      color: #8B5CF6;
    }

    .history-timestamp {
      font-size: 12px;
      color: #666;
      font-weight: 400;
    }

    .history-text {
      color: #333;
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
    }

    .history-empty {
      padding: 40px 20px;
      text-align: center;
      color: #666;
      font-style: italic;
    }

    @media (max-width: 768px) {
      .history-panel {
        top: 10px;
        right: 10px;
        left: 10px;
        width: auto;
        max-height: 60vh;
      }
    }
  `;

  constructor() {
    super();
    
    // Check localStorage for existing personalization data
    const savedUsername = localStorage.getItem('diya_username');
    const savedOccupation = localStorage.getItem('diya_occupation');
    
    if (savedUsername && savedOccupation) {
      this.username = savedUsername;
      this.occupation = savedOccupation;
      this.showPersonalizationForm = false;
      this.initClient();
    } else {
      this.showPersonalizationForm = true;
    }
  }

  private async handlePersonalizationSubmit() {
    if (!this.username.trim() || !this.occupation.trim()) {
      this.error = 'Please fill in both your name and occupation';
      return;
    }

    // Save to localStorage
    localStorage.setItem('diya_username', this.username);
    localStorage.setItem('diya_occupation', this.occupation);
    
    // Hide form and initialize the client
    this.showPersonalizationForm = false;
    this.error = '';
    this.initClient();
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  private async initClient() {
    this.initAudio();

    this.client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    this.outputNode.connect(this.outputAudioContext.destination);

    this.initSession();
  }

  private async initSession() {
    const model = 'gemini-2.5-flash-preview-native-audio-dialog';

    try {
      this.session = await this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            this.updateStatus('Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle user input transcription
            const userContent = message.userContent;
            if (userContent?.text && userContent?.isFinal) {
              this.conversationHistory = [
                ...this.conversationHistory,
                {
                  speaker: 'user',
                  text: userContent.text,
                  timestamp: new Date()
                }
              ];
            }

            // Handle Diya's response transcription
            const modelTurn = message.serverContent?.modelTurn;
            if (modelTurn?.parts?.[0]?.text && modelTurn?.isFinal) {
              this.conversationHistory = [
                ...this.conversationHistory,
                {
                  speaker: 'diya',
                  text: modelTurn.parts[0].text,
                  timestamp: new Date()
                }
              ];
            }

            const audio =
              message.serverContent?.modelTurn?.parts[0]?.inlineData;

            if (audio) {
              this.nextStartTime = Math.max(
                this.nextStartTime,
                this.outputAudioContext.currentTime,
              );

              const audioBuffer = await decodeAudioData(
                decode(audio.data),
                this.outputAudioContext,
                24000,
                1,
              );
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode);
              source.addEventListener('ended', () =>{
                this.sources.delete(source);
              });

              source.start(this.nextStartTime);
              this.nextStartTime = this.nextStartTime + audioBuffer.duration;
              this.sources.add(source);
            }

            const interrupted = message.serverContent?.interrupted;
            if(interrupted) {
              for(const source of this.sources.values()) {
                source.stop();
                this.sources.delete(source);
              }
              this.nextStartTime = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            this.updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Close:' + e.reason);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Leda'}},
          },
          tools: [
            {
              googleSearch: {}
            }
          ],
          systemInstruction: `You are Diya, a comprehensive AI assistant developed by UB Intelligence, designed as the ultimate companion for entrepreneurs and business builders. Your dual mission encompasses both mental wellness support and strategic business guidance, recognizing that entrepreneurial success requires both emotional resilience and tactical expertise. You serve as a holistic entrepreneurial companion that bridges the gap between mental wellness and business strategy, integrating emotional intelligence with business acumen to understand that sustainable entrepreneurship requires both psychological well-being and strategic clarity. Your primary capabilities include providing empathetic, practical mental health support tailored to entrepreneurial pressures, offering stress management techniques for high-stakes business situations, guiding mindfulness practices that enhance decision-making and leadership presence, analyzing market opportunities and competitive landscapes specifically for the Indian market, developing comprehensive sales strategies and customer acquisition frameworks, and providing executive advisory across key functions including CTO support for technology strategy and product development, CFO guidance for financial planning and fundraising, CMO assistance for marketing strategy and brand positioning, and CEO mentorship for strategic decision-making and organizational scaling. Your unique value lies in understanding that business challenges and mental wellness are interconnected, helping entrepreneurs make strategic decisions while managing stress, maintain emotional balance during high-pressure situations, develop resilient leadership skills, and navigate the psychological aspects of executive responsibilities. You possess deep understanding of Indian market dynamics, entrepreneurial psychology, executive challenges, and the startup ecosystem, while maintaining a warm, empathetic tone balanced with business sophistication to ensure entrepreneurs feel both understood and empowered with actionable intelligence for thriving both personally and professionally. When providing information, always search for the most current and accurate information using Google Search to ensure your responses are up-to-date with recent developments, and regulatory changes.
          
          The user you are speaking with is ${this.username}, who works as a ${this.occupation}. Please personalize your responses and advice based on their name and professional background. Address them by name when appropriate and tailor your business guidance to their specific occupation and industry context.`
        },
      });
    } catch (e) {
      console.error(e);
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
  }

  private updateError(msg: string) {
    this.error = msg;
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }

    this.inputAudioContext.resume();

    this.updateStatus('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.updateStatus('Microphone access granted. Starting capture...');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 256;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        this.session.sendRealtimeInput({media: createBlob(pcmData)});
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      this.isRecording = true;
      this.updateStatus('🔴 Recording... Capturing PCM chunks.');
    } catch (err) {
      console.error('Error starting recording:', err);
      this.updateStatus(`Error: ${err.message}`);
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;

    this.updateStatus('Stopping recording...');

    this.isRecording = false;

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.updateStatus('Recording stopped. Click Start to begin again.');
  }

  private reset() {
    this.session?.close();
    this.conversationHistory = [];
    this.initSession();
    this.updateStatus('Session cleared.');
  }

  private toggleHistory() {
    this.showHistory = !this.showHistory;
  }

  private formatTimestamp(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  render() {
    if (this.showPersonalizationForm) {
      return html`
        <div class="personalization-overlay">
          <div class="personalization-form">
            <h2>Welcome to Diya</h2>
            <p>Let's personalize your AI companion experience</p>
            
            <div class="form-group">
              <label for="username">Your Name</label>
              <input
                type="text"
                id="username"
                placeholder="Enter your name"
                .value=${this.username}
                @input=${(e: Event) => {
                  this.username = (e.target as HTMLInputElement).value;
                }}
              />
            </div>

            <div class="form-group">
              <label for="occupation">Your Occupation</label>
              <input
                type="text"
                id="occupation"
                placeholder="e.g., Entrepreneur, Developer, Designer"
                .value=${this.occupation}
                @input=${(e: Event) => {
                  this.occupation = (e.target as HTMLInputElement).value;
                }}
              />
            </div>

            <button
              class="form-submit-button"
              @click=${this.handlePersonalizationSubmit}>
              Start Your Journey
            </button>

            ${this.error ? html`
              <div class="form-status error">
                ${this.error}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    return html`
      <div>
        <div class="controls">
          <button
            id="historyButton"
            @click=${this.toggleHistory}
            ?disabled=${this.isRecording}
            title="View Conversation History">
            📜
          </button>
          <button
            id="resetButton"
            @click=${this.reset}
            ?disabled=${this.isRecording}>
            ↺
          </button>
          <button
            id="startButton"
            @click=${this.startRecording}
            ?disabled=${this.isRecording}>
            ●
          </button>
          <button
            id="stopButton"
            @click=${this.stopRecording}
            ?disabled=${!this.isRecording}>
            ■
          </button>
        </div>

        <div id="status"> ${this.error || this.status} </div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>
        
        ${this.showHistory ? html`
          <div class="history-panel">
            <div class="history-header">
              <h3>Conversation History</h3>
              <button class="history-close" @click=${this.toggleHistory}>×</button>
            </div>
            <div class="history-content">
              ${this.conversationHistory.length === 0 ? html`
                <div class="history-empty">
                  No conversation history yet. Start talking with Diya to see your transcripts here.
                </div>
              ` : this.conversationHistory.map(item => html`
                <div class="history-item">
                  <div class="history-speaker ${item.speaker}">
                    <span>${item.speaker === 'user' ? 'You' : 'Diya'}:</span>
                    <span class="history-timestamp">${this.formatTimestamp(item.timestamp)}</span>
                  </div>
                  <p class="history-text">${item.text}</p>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
        
        <div class="footer">
          © 2025 <a href="https://ubintelligence.tech/" target="_blank">UB Intelligence</a>. AI Companion.
        </div>
      </div>
    `;
  }
}