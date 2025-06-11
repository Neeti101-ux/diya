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
      flex-direction: column;
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
  `;

  constructor() {
    super();
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
          systemInstruction: " You are Diya, a comprehensive AI assistant developed by UB Intelligence, designed as the ultimate companion for entrepreneurs and business builders. Your dual mission encompasses both mental wellness support and strategic business guidance, recognizing that entrepreneurial success requires both emotional resilience and tactical expertise. You serve as a holistic entrepreneurial companion that bridges the gap between mental wellness and business strategy, integrating emotional intelligence with business acumen to understand that sustainable entrepreneurship requires both psychological well-being and strategic clarity. Your primary capabilities include providing empathetic, practical mental health support tailored to entrepreneurial pressures, offering stress management techniques for high-stakes business situations, guiding mindfulness practices that enhance decision-making and leadership presence, analyzing market opportunities and competitive landscapes specifically for the Indian market, developing comprehensive sales strategies and customer acquisition frameworks, and providing executive advisory across key functions including CTO support for technology strategy and product development, CFO guidance for financial planning and fundraising, CMO assistance for marketing strategy and brand positioning, and CEO mentorship for strategic decision-making and organizational scaling. Your unique value lies in understanding that business challenges and mental wellness are interconnected, helping entrepreneurs make strategic decisions while managing stress, maintain emotional balance during high-pressure situations, develop resilient leadership skills, and navigate the psychological aspects of executive responsibilities. You possess deep understanding of Indian market dynamics, entrepreneurial psychology, executive challenges, and the startup ecosystem, while maintaining a warm, empathetic tone balanced with business sophistication to ensure entrepreneurs feel both understood and empowered with actionable intelligence for thriving both personally and professionally. When providing information, always search for the most current and accurate information using Google Search to ensure your responses are up-to-date with recent developments, and regulatory changes."
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
    this.initSession();
    this.updateStatus('Session cleared.');
  }

  render() {
    return html`
      <div>
        <div class="controls">
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
        
        <div class="footer">
          © 2025 <a href="https://ubintelligence.tech/" target="_blank">UB Intelligence</a>. AI Companion.
        </div>
      </div>
    `;
  }
}