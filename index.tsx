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

interface ConversationMessage {
  speaker: string;
  text: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  topic: string;
  startTime: Date;
  messages: ConversationMessage[];
}

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state() username = '';
  @state() occupation = '';
  @state() companyWebsite = '';
  @state() linkedinProfile = '';
  @state() showPersonalizationForm = true;
  @state() conversationHistory: ConversationMessage[] = [];
  @state() showHistory = false;
  @state() allConversations: Conversation[] = [];
  @state() currentConversationId: string | null = null;
  @state() viewingPastConversation = false;
  @state() selectedConversationId: string | null = null;

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
        width: 48px;
        height: 48px;
        cursor: pointer;
        font-size: 18px;
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

       button#userButton {
         background: #F59E0B;
         box-shadow: 0 4px 6px rgba(245, 158, 11, 0.25);
       }

       button#userButton:hover {
         background: #D97706;
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

    .conversation-list {
      padding: 10px;
    }

    .conversation-item {
      padding: 16px;
      margin-bottom: 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .conversation-item:hover {
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.3);
      transform: translateY(-1px);
    }

    .conversation-item.active {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.4);
    }

    .conversation-topic {
      font-weight: 600;
      font-size: 14px;
      color: #1a1a1a;
      margin-bottom: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .conversation-time {
      font-size: 12px;
      color: #666;
    }

    .conversation-messages {
      padding: 0 10px 10px 10px;
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

    .history-actions {
      padding: 15px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      gap: 10px;
      background: rgba(255, 255, 255, 0.8);
    }

    .history-action-btn {
      flex: 1;
      padding: 8px 16px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .history-action-btn:hover {
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.3);
    }

    .history-action-btn.primary {
      background: #6366F1;
      color: white;
      border-color: #6366F1;
    }

    .history-action-btn.primary:hover {
      background: #4F46E5;
    }

    .history-action-btn.danger {
      background: #EF4444;
      color: white;
      border-color: #EF4444;
    }

    .history-action-btn.danger:hover {
      background: #DC2626;
    }

    .back-button {
      padding: 10px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      background: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      color: #6366F1;
      font-weight: 500;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .back-button:hover {
      background: rgba(99, 102, 241, 0.1);
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
    const savedCompanyWebsite = localStorage.getItem('diya_company_website');
    const savedLinkedinProfile = localStorage.getItem('diya_linkedin_profile');
    
    if (savedUsername && savedOccupation) {
      this.username = savedUsername;
      this.occupation = savedOccupation;
      this.companyWebsite = savedCompanyWebsite || '';
      this.linkedinProfile = savedLinkedinProfile || '';
      this.showPersonalizationForm = false;
      this.loadConversations();
      this.initClient();
    } else {
      this.showPersonalizationForm = true;
    }
  }

  private loadConversations() {
    // Load all conversations from localStorage
    const savedConversations = localStorage.getItem('diya_all_conversations');
    if (savedConversations) {
      try {
        const parsedConversations = JSON.parse(savedConversations);
        // Convert timestamp strings back to Date objects
        this.allConversations = parsedConversations.map((conv: any) => ({
          ...conv,
          startTime: new Date(conv.startTime),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
      } catch (error) {
        console.error('Error loading conversations:', error);
        localStorage.removeItem('diya_all_conversations');
        this.allConversations = [];
      }
    }

    // Load current conversation ID
    const savedCurrentId = localStorage.getItem('diya_current_conversation_id');
    if (savedCurrentId && this.allConversations.find(c => c.id === savedCurrentId)) {
      this.currentConversationId = savedCurrentId;
      const currentConv = this.allConversations.find(c => c.id === savedCurrentId);
      if (currentConv) {
        this.conversationHistory = currentConv.messages;
      }
    } else {
      this.startNewConversation();
    }
  }

  private startNewConversation() {
    const newId = Date.now().toString();
    const newConversation: Conversation = {
      id: newId,
      topic: 'New Conversation',
      startTime: new Date(),
      messages: []
    };

    this.allConversations = [...this.allConversations, newConversation];
    this.currentConversationId = newId;
    this.conversationHistory = newConversation.messages;
    this.viewingPastConversation = false;

    this.saveConversations();
    localStorage.setItem('diya_current_conversation_id', newId);
  }

  private saveConversations() {
    localStorage.setItem('diya_all_conversations', JSON.stringify(this.allConversations));
  }

  private selectConversation(id: string) {
    const conversation = this.allConversations.find(c => c.id === id);
    if (conversation) {
      this.selectedConversationId = id;
      this.conversationHistory = conversation.messages;
      this.viewingPastConversation = id !== this.currentConversationId;
    }
  }

  private returnToCurrentConversation() {
    if (this.currentConversationId) {
      this.selectConversation(this.currentConversationId);
      this.selectedConversationId = null;
    }
  }

  private clearAllHistory() {
    this.allConversations = [];
    this.conversationHistory = [];
    this.currentConversationId = null;
    this.selectedConversationId = null;
    this.viewingPastConversation = false;
    
    localStorage.removeItem('diya_all_conversations');
    localStorage.removeItem('diya_current_conversation_id');
    
    this.startNewConversation();
  }

  private addMessageToCurrentConversation(speaker: string, text: string) {
    if (!this.currentConversationId) return;

    const message: ConversationMessage = {
      speaker,
      text,
      timestamp: new Date()
    };

    // Find current conversation and add message
    const convIndex = this.allConversations.findIndex(c => c.id === this.currentConversationId);
    if (convIndex !== -1) {
      this.allConversations[convIndex].messages.push(message);
      
      // Update topic if this is the first user message
      if (speaker === 'user' && 
          this.allConversations[convIndex].messages.length === 1 && 
          this.allConversations[convIndex].topic === 'New Conversation') {
        this.allConversations[convIndex].topic = text.length > 50 ? text.substring(0, 50) + '...' : text;
      }

      // Update conversation history if we're viewing the current conversation
      if (!this.viewingPastConversation) {
        this.conversationHistory = [...this.allConversations[convIndex].messages];
      }

      this.saveConversations();
    }
  }

  private async handlePersonalizationSubmit() {
    if (!this.username.trim() || !this.occupation.trim()) {
      this.error = 'Please fill in both your name and occupation';
      return;
    }

    // Validate URLs if provided
    if (this.companyWebsite.trim() && !this.isValidUrl(this.companyWebsite.trim())) {
      this.error = 'Please enter a valid company website URL (e.g., https://example.com)';
      return;
    }

    if (this.linkedinProfile.trim() && !this.isValidLinkedInUrl(this.linkedinProfile.trim())) {
      this.error = 'Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)';
      return;
    }
    // Save to localStorage
    localStorage.setItem('diya_username', this.username);
    localStorage.setItem('diya_occupation', this.occupation);
    localStorage.setItem('diya_company_website', this.companyWebsite);
    localStorage.setItem('diya_linkedin_profile', this.linkedinProfile);
    
    // Hide form and initialize the client
    this.showPersonalizationForm = false;
    this.error = '';
    this.loadConversations();
    this.initClient();
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private isValidLinkedInUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (urlObj.hostname === 'linkedin.com' || urlObj.hostname === 'www.linkedin.com') &&
             (urlObj.pathname.startsWith('/in/') || urlObj.pathname.startsWith('/company/'));
    } catch {
      return false;
    }
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
              this.addMessageToCurrentConversation('user', userContent.text);
            }

            // Handle Diya's response transcription
            const modelTurn = message.serverContent?.modelTurn;
            if (modelTurn?.parts?.[0]?.text && modelTurn?.isFinal) {
              this.addMessageToCurrentConversation('diya', modelTurn.parts[0].text);
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
          
          The user you are speaking with is ${this.username}, who works as a ${this.occupation}. Please personalize your responses and advice based on their name and professional background. Address them by name when appropriate and tailor your business guidance to their specific occupation and industry context.
          
          ${this.companyWebsite ? `Their company website is: ${this.companyWebsite}. You can reference this to understand their business better and provide more contextual advice.` : ''}
          
          ${this.linkedinProfile ? `Their LinkedIn profile is: ${this.linkedinProfile}. This can help you understand their professional background and network.` : ''}
          
          When relevant to the conversation, you may suggest searching for information about their company or industry to provide more targeted advice. Use the provided context to make your guidance more specific and actionable for their particular business situation.`
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
    this.startNewConversation();
    this.initSession();
    this.updateStatus('New conversation started.');
  }

  private toggleHistory() {
    this.showHistory = !this.showHistory;
    if (!this.showHistory && this.viewingPastConversation) {
      this.returnToCurrentConversation();
    }
  }

  private togglePersonalizationForm() {
    this.showPersonalizationForm = true;
    this.showHistory = false;
  }

  private formatTimestamp(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
      return `Today, ${this.formatTimestamp(date)}`;
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
      return `Yesterday, ${this.formatTimestamp(date)}`;
    } else {
      return date.toLocaleDateString() + ', ' + this.formatTimestamp(date);
    }
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

            <div class="form-group">
              <label for="companyWebsite">Company Website <span style="color: #666; font-weight: 400;">(Optional)</span></label>
              <input
                type="text"
                id="companyWebsite"
                placeholder="https://yourcompany.com"
                .value=${this.companyWebsite}
                @input=${(e: Event) => {
                  this.companyWebsite = (e.target as HTMLInputElement).value;
                }}
              />
            </div>

            <div class="form-group">
              <label for="linkedinProfile">LinkedIn Profile <span style="color: #666; font-weight: 400;">(Optional)</span></label>
              <input
                type="text"
                id="linkedinProfile"
                placeholder="https://linkedin.com/in/yourprofile"
                .value=${this.linkedinProfile}
                @input=${(e: Event) => {
                  this.linkedinProfile = (e.target as HTMLInputElement).value;
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
            id="userButton"
            @click=${this.togglePersonalizationForm}
            ?disabled=${this.isRecording || this.showPersonalizationForm}
            title="Update Profile">
            👤
          </button>
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
              <h3>${this.selectedConversationId ? 'Conversation' : 'Conversation History'}</h3>
              <button class="history-close" @click=${this.toggleHistory}>×</button>
            </div>
            
            ${this.selectedConversationId ? html`
              <div class="back-button" @click=${() => {
                this.selectedConversationId = null;
                if (this.viewingPastConversation) {
                  this.returnToCurrentConversation();
                }
              }}>
                ← Back to Conversations
              </div>
            ` : ''}

            <div class="history-content">
              ${this.selectedConversationId ? html`
                <div class="conversation-messages">
                  ${this.conversationHistory.length === 0 ? html`
                    <div class="history-empty">
                      No messages in this conversation yet.
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
              ` : html`
                <div class="conversation-list">
                  ${this.allConversations.length === 0 ? html`
                    <div class="history-empty">
                      No conversations yet. Start talking with Diya to create your first conversation.
                    </div>
                  ` : this.allConversations
                    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
                    .map(conv => html`
                    <div 
                      class="conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}"
                      @click=${() => this.selectConversation(conv.id)}>
                      <div class="conversation-topic">${conv.topic}</div>
                      <div class="conversation-time">${this.formatDate(conv.startTime)}</div>
                    </div>
                  `)}
                </div>
              `}
            </div>

            ${!this.selectedConversationId ? html`
              <div class="history-actions">
                ${this.viewingPastConversation ? html`
                  <button class="history-action-btn primary" @click=${this.returnToCurrentConversation}>
                    Return to Current
                  </button>
                ` : ''}
                <button class="history-action-btn danger" @click=${this.clearAllHistory}>
                  Clear All History
                </button>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <div class="footer">
          © 2025 <a href="https://ubintelligence.tech/" target="_blank">UB Intelligence</a>. AI Companion.
        </div>
      </div>
    `;
  }
}