/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from './analyser';

import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
import {fs as backdropFS, vs as backdropVS} from './backdrop-shader';
import {vs as sphereVS} from './sphere-shader';

@customElement('gdm-live-audio-visuals-3d')
export class GdmLiveAudioVisuals3D extends LitElement {
  private inputAnalyser!: Analyser;
  private outputAnalyser!: Analyser;
  private camera!: THREE.PerspectiveCamera;
  private backdrop!: THREE.Mesh;
  private composer!: EffectComposer;
  private globe!: THREE.Mesh;
  private particles!: THREE.Points;
  private originalParticlePositions!: Float32Array;
  private prevTime = 0;
  private rotation = new THREE.Vector3(0, 0, 0);
  private baseScale = 1.0;

  private _outputNode!: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode!: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  get inputNode() {
    return this._inputNode;
  }

  private canvas!: HTMLCanvasElement;

  static styles = css`
    canvas {
      width: 100% !important;
      height: 100% !important;
      position: absolute;
      inset: 0;
      image-rendering: pixelated;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
  }

  private createEnvironmentMap(): THREE.CubeTexture {
    // Create a procedural environment map since we can't load external EXR files
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Create a studio lighting environment
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, '#e6f3ff');
    gradient.addColorStop(0.6, '#4a90e2');
    gradient.addColorStop(1, '#1a365d');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Add some highlights for more interesting reflections
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(size * 0.3, size * 0.2, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(size * 0.7, size * 0.8, size * 0.15, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    return new THREE.CubeTextureLoader().load([
      canvas.toDataURL(), canvas.toDataURL(), canvas.toDataURL(),
      canvas.toDataURL(), canvas.toDataURL(), canvas.toDataURL()
    ]);
  }

  private generateSpherePoints(count: number, radius: number): Float32Array {
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Use proper spherical coordinate distribution
      // This ensures even distribution across the sphere surface
      const u = Math.random();
      const v = Math.random();
      
      // Convert to spherical coordinates with proper distribution
      const theta = 2 * Math.PI * u; // Azimuthal angle (0 to 2π)
      const phi = Math.acos(2 * v - 1); // Polar angle (0 to π) with proper distribution
      
      // Convert spherical to cartesian coordinates
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    return positions;
  }

  private init() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const backdrop = new THREE.Mesh(
      new THREE.IcosahedronGeometry(10, 5),
      new THREE.RawShaderMaterial({
        uniforms: {
          resolution: {value: new THREE.Vector2(1, 1)},
          rand: {value: 0},
        },
        vertexShader: backdropVS,
        fragmentShader: backdropFS,
        glslVersion: THREE.GLSL3,
      }),
    );
    backdrop.material.side = THREE.BackSide;
    scene.add(backdrop);
    this.backdrop = backdrop;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(2, -2, 5);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Create environment map
    const envMap = this.createEnvironmentMap();
    scene.environment = envMap;

    // Create the enhanced globe with better materials
    const geometry = new THREE.IcosahedronGeometry(1, 12); // Higher detail
    const globeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00004b,
      metalness: 0.5, // Reduced from 0.9 for better balance
      roughness: 0.1,
      emissive: 0x00006b,
      emissiveIntensity: 0.8,
      envMap: envMap,
      envMapIntensity: 1.5
    });

    // Add custom shader for deformation
    globeMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.time = {value: 0};
      shader.uniforms.inputData = {value: new THREE.Vector4()};
      shader.uniforms.outputData = {value: new THREE.Vector4()};
      globeMaterial.userData.shader = shader;
      shader.vertexShader = sphereVS;
    };

    const globe = new THREE.Mesh(geometry, globeMaterial);
    scene.add(globe);
    this.globe = globe;

    // Fixed particle system with proper spherical distribution
    const particleCount = 2000; // Reduced count for better performance
    const particleGeometry = new THREE.BufferGeometry();
    
    // Create multiple layers with proper spherical distribution
    const layer1 = this.generateSpherePoints(Math.floor(particleCount * 0.4), 1.6); // Inner layer
    const layer2 = this.generateSpherePoints(Math.floor(particleCount * 0.35), 1.9); // Middle layer
    const layer3 = this.generateSpherePoints(Math.floor(particleCount * 0.25), 2.2); // Outer layer
    
    // Combine all layers
    const positions = new Float32Array(particleCount * 3);
    let offset = 0;
    
    // Copy layer1
    for (let i = 0; i < layer1.length; i++) {
      positions[offset + i] = layer1[i];
    }
    offset += layer1.length;
    
    // Copy layer2
    for (let i = 0; i < layer2.length; i++) {
      positions[offset + i] = layer2[i];
    }
    offset += layer2.length;
    
    // Copy layer3
    for (let i = 0; i < layer3.length; i++) {
      positions[offset + i] = layer3[i];
    }
    
    this.originalParticlePositions = positions.slice();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x000000, // Black color
      size: 0.04, // Updated from 0.03 to 0.04
      transparent: false,
      opacity: 1.0,
      sizeAttenuation: true,
      vertexColors: false
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(this.particles);

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x4a90e2, 1.5);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe6f3ff, 0.8);
    fillLight.position.set(-5, 2, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(0, -5, 0);
    scene.add(rimLight);

    // Enhanced post-processing
    const renderPass = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3, // Reduced bloom for better particle visibility
      0.4,
      0.85
    );

    const fxaaPass = new ShaderPass(FXAAShader);

    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(fxaaPass);

    this.composer = composer;

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const dPR = renderer.getPixelRatio();
      const w = window.innerWidth;
      const h = window.innerHeight;
      backdrop.material.uniforms.resolution.value.set(w * dPR, h * dPR);
      renderer.setSize(w, h);
      composer.setSize(w, h);
      fxaaPass.material.uniforms['resolution'].value.set(
        1 / (w * dPR),
        1 / (h * dPR),
      );
    }

    window.addEventListener('resize', onWindowResize);
    onWindowResize();

    this.animation();
  }

  private animation() {
    requestAnimationFrame(() => this.animation());

    this.inputAnalyser.update();
    this.outputAnalyser.update();

    const t = performance.now();
    const dt = (t - this.prevTime) / (1000 / 60);
    this.prevTime = t;

    // Enhanced particle animation with smoother wave patterns
    const positions = this.particles.geometry.attributes.position.array as Float32Array;
    const audioData = this.outputAnalyser.data;
    const inputData = this.inputAnalyser.data;
    
    for(let i = 0; i < positions.length; i += 3) {
      const originalX = this.originalParticlePositions[i];
      const originalY = this.originalParticlePositions[i + 1];
      const originalZ = this.originalParticlePositions[i + 2];
      
      const time = t * 0.001;
      
      // Audio response with smoother transitions
      const bassAmplitude = audioData[0] / 255;
      const midAmplitude = audioData[1] / 255;
      const highAmplitude = audioData[2] / 255;
      const inputAmplitude = inputData[0] / 255;
      
      // Smoother wave patterns
      const distance = Math.sqrt(originalX * originalX + originalY * originalY + originalZ * originalZ);
      const radialWave = Math.sin(time * 1.5 + distance * 2) * bassAmplitude * 0.3;
      
      const verticalWave = Math.sin(time * 2 + originalY * 3) * midAmplitude * 0.2;
      
      const angle = Math.atan2(originalY, originalX);
      const spiralWave = Math.sin(time * 2.5 + angle * 4 + distance * 1.5) * highAmplitude * 0.15;
      
      // Gentle breathing effect
      const breathingWave = Math.sin(time * 1.2) * 0.08 * (bassAmplitude + midAmplitude);
      
      // Combine effects with reduced intensity for smoother look
      const totalDisplacement = 
        radialWave +
        verticalWave +
        spiralWave +
        0.1 * inputAmplitude * Math.sin(time * 3 + originalZ * 2) +
        breathingWave;
      
      const scale = 1 + totalDisplacement;
      positions[i] = originalX * scale;
      positions[i + 1] = originalY * scale;
      positions[i + 2] = originalZ * scale;
    }
    
    this.particles.geometry.attributes.position.needsUpdate = true;

    // Enhanced globe pulsation and shader updates
    const material = this.globe.material as THREE.MeshStandardMaterial;
    if (material.userData.shader) {
      // More dynamic time progression
      const timeMultiplier = 1 + (audioData[0] / 255) * 1.5;
      material.userData.shader.uniforms.time.value += (dt * 0.08 * timeMultiplier);
      
      // Enhanced audio data mapping
      material.userData.shader.uniforms.inputData.value.set(
        (1.5 * inputData[0]) / 255,
        (0.12 * inputData[1]) / 255,
        (8 * inputData[2]) / 255,
        (inputData[3] || 0) / 255,
      );
      material.userData.shader.uniforms.outputData.value.set(
        (2 * audioData[0]) / 255,
        (0.15 * audioData[1]) / 255,
        (10 * audioData[2]) / 255,
        (audioData[3] || 0) / 255,
      );
    }

    // Globe pulsation based on AI voice intensity
    const voiceIntensity = (audioData[0] + audioData[1] + audioData[2]) / (3 * 255);
    const pulsationScale = this.baseScale + voiceIntensity * 0.12;
    this.globe.scale.setScalar(pulsationScale);

    // Enhanced camera movement with smoother transitions
    const f = 0.0006;
    this.rotation.x += (dt * f * audioData[1]) / 255;
    this.rotation.y += (dt * f * audioData[2]) / 255;
    this.rotation.z += (dt * f * inputData[1]) / 255;

    // Add subtle camera distance variation
    const cameraDistance = 5 + Math.sin(t * 0.0008) * 0.3 + voiceIntensity * 0.6;
    
    const euler = new THREE.Euler(
      this.rotation.x,
      this.rotation.y,
      this.rotation.z,
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    const vector = new THREE.Vector3(0, 0, cameraDistance);
    vector.applyQuaternion(quaternion);
    this.camera.position.copy(vector);
    this.camera.lookAt(this.globe.position);
    
    // Update backdrop animation
    this.backdrop.material.uniforms.rand.value = Math.sin(t * 0.0008) * 0.05;
    
    this.composer.render();
  }

  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    this.init();
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals-3d': GdmLiveAudioVisuals3D;
  }
}