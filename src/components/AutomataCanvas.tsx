import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer, Variable } from 'three/examples/jsm/misc/GPUComputationRenderer';
import computeShader from '../shaders/compute.glsl?raw';
import displayShader from '../shaders/display.glsl?raw';
import { computeMetrics, ReactionDiffusionMetrics } from '../utils/metrics';

export interface ReactionDiffusionParams {
  du: number;
  dv: number;
  feed: number;
  kill: number;
  dt: number;
  threshold: number;
  contrast: number;
  gamma: number;
  invert: boolean;
}

interface AutomataCanvasProps {
  params: ReactionDiffusionParams;
  resolution: number;
  isRunning: boolean;
  stepsPerFrame: number;
}

export interface AutomataCanvasHandle {
  capture: () => string | null;
  collectMetrics: () => ReactionDiffusionMetrics | null;
  resetState: () => void;
}

const AutomataCanvas = forwardRef<AutomataCanvasHandle, AutomataCanvasProps>(
  ({ params, resolution, isRunning, stepsPerFrame }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const gpuComputeRef = useRef<GPUComputationRenderer | null>(null);
    const stateVariableRef = useRef<Variable | null>(null);
    const displayMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const frameRef = useRef<number>();
    const isRunningRef = useRef<boolean>(isRunning);
    const previousSampleRef = useRef<Float32Array | null>(null);
    const resetCounterRef = useRef(0);
    const stepsPerFrameRef = useRef<number>(Math.max(1, Math.floor(stepsPerFrame)));

    const seedCurrentState = useCallback(
      (targetTexture: THREE.DataTexture, size: number) => {
        const data = targetTexture.image.data as Float32Array;
        const cx = size / 2;
        const cy = size / 2;
        const radius = size * 0.12;
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            const idx = (x + y * size) * 4;
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const noise = Math.random() * 0.02;
            data[idx] = 1.0 - noise;
            data[idx + 1] = dist < radius ? 0.6 + Math.random() * 0.2 : noise;
            data[idx + 2] = 0.0;
            data[idx + 3] = 1.0;
          }
        }
        targetTexture.needsUpdate = true;
      },
      [],
    );

    useImperativeHandle(ref, () => ({
      capture: () => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!renderer || !scene || !camera) {
          return null;
        }
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      },
      collectMetrics: () => {
        const renderer = rendererRef.current as THREE.WebGLRenderer & {
          readRenderTargetPixels?: (
            target: THREE.WebGLRenderTarget,
            x: number,
            y: number,
            width: number,
            height: number,
            buffer: Float32Array,
          ) => void;
        };
        const compute = gpuComputeRef.current;
        const variable = stateVariableRef.current;
        if (!renderer || !compute || !variable || typeof renderer.readRenderTargetPixels !== 'function') {
          return null;
        }

        const renderTarget = compute.getCurrentRenderTarget(variable) as THREE.WebGLRenderTarget | null;
        if (!renderTarget) {
          return null;
        }

        const width = renderTarget.width ?? resolution;
        const height = renderTarget.height ?? resolution;
        const buffer = new Float32Array(width * height * 4);

        try {
          renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);
        } catch (error) {
          console.warn('Failed to read render target pixels', error);
          return null;
        }

        const result = computeMetrics(buffer, width, height, previousSampleRef.current);
        previousSampleRef.current = result.snapshot;
        return result.metrics;
      },
      resetState: () => {
        const compute = gpuComputeRef.current;
        const variable = stateVariableRef.current as Variable & {
          renderTargets?: THREE.WebGLRenderTarget[];
        };
        const renderer = rendererRef.current;
        if (!compute || !variable || !renderer) {
          return;
        }

        const freshTexture = compute.createTexture();
        seedCurrentState(freshTexture, resolution);

        const targets = variable.renderTargets ?? (variable as unknown as { renderTargets: THREE.WebGLRenderTarget[] }).renderTargets;
        if (targets) {
          for (let index = 0; index < targets.length; index += 1) {
            compute.renderTexture(freshTexture, targets[index]);
          }
        }

        if (typeof freshTexture.dispose === 'function') {
          freshTexture.dispose();
        }
        previousSampleRef.current = null;
        resetCounterRef.current += 1;
      },
    }));

    useEffect(() => {
      isRunningRef.current = isRunning;
    }, [isRunning]);

    useEffect(() => {
      stepsPerFrameRef.current = Math.max(1, Math.floor(stepsPerFrame));
    }, [stepsPerFrame]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(container.clientWidth || resolution, container.clientHeight || resolution);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';

      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      sceneRef.current = scene;
      cameraRef.current = camera;

      const gpuCompute = new GPUComputationRenderer(resolution, resolution, renderer);
      gpuComputeRef.current = gpuCompute;

      const texture = gpuCompute.createTexture();
      seedCurrentState(texture, resolution);

      const stateVariable = gpuCompute.addVariable('textureState', computeShader, texture);
      stateVariableRef.current = stateVariable;

      const stateUniforms = stateVariable.material.uniforms as Record<string, { value: any }>;
      stateUniforms.du = { value: 0 };
      stateUniforms.dv = { value: 0 };
      stateUniforms.feed = { value: 0 };
      stateUniforms.kill = { value: 0 };
      stateUniforms.dt = { value: 0 };

      gpuCompute.setVariableDependencies(stateVariable, [stateVariable]);
      const error = gpuCompute.init();
      if (error) {
        console.error('GPUComputationRenderer init error:', error);
      }

      const displayMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: displayShader,
        uniforms: {
          textureState: { value: gpuCompute.getCurrentRenderTarget(stateVariable).texture },
          threshold: { value: 0 },
          contrast: { value: 1 },
          gamma: { value: 1 },
          invert: { value: 0 },
        },
      });
      displayMaterialRef.current = displayMaterial;

      const geometry = new THREE.PlaneGeometry(2, 2);
      const quad = new THREE.Mesh(geometry, displayMaterial);
      scene.add(quad);

      const handleResize = () => {
        const width = container.clientWidth || resolution;
        const height = container.clientHeight || resolution;
        renderer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      const animate = () => {
        const currentRenderer = rendererRef.current;
        const compute = gpuComputeRef.current;
        const variable = stateVariableRef.current;
        const material = displayMaterialRef.current;
        const currentScene = sceneRef.current;
        const currentCamera = cameraRef.current;

        if (!currentRenderer || !compute || !variable || !material || !currentScene || !currentCamera) {
          return;
        }

        if (isRunningRef.current) {
          const iterations = stepsPerFrameRef.current;
          for (let index = 0; index < iterations; index += 1) {
            compute.compute();
          }
        }

        material.uniforms.textureState.value = compute.getCurrentRenderTarget(variable).texture;
        currentRenderer.render(currentScene, currentCamera);
        frameRef.current = requestAnimationFrame(animate);
      };

      frameRef.current = requestAnimationFrame(animate);

      return () => {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
        }
        window.removeEventListener('resize', handleResize);
        geometry.dispose();
        displayMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        if (typeof gpuCompute.dispose === 'function') {
          gpuCompute.dispose();
        }
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
        rendererRef.current = null;
        gpuComputeRef.current = null;
        stateVariableRef.current = null;
        displayMaterialRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        previousSampleRef.current = null;
      };
    }, [resolution]);

    useEffect(() => {
      const variable = stateVariableRef.current;
      if (!variable) {
        return;
      }
      const uniforms = variable.material.uniforms as Record<string, { value: any }>;
      if (uniforms.du) uniforms.du.value = params.du;
      if (uniforms.dv) uniforms.dv.value = params.dv;
      if (uniforms.feed) uniforms.feed.value = params.feed;
      if (uniforms.kill) uniforms.kill.value = params.kill;
      if (uniforms.dt) uniforms.dt.value = params.dt;
    }, [params.du, params.dv, params.feed, params.kill, params.dt]);

    useEffect(() => {
      const material = displayMaterialRef.current;
      if (!material) {
        return;
      }
      material.uniforms.threshold.value = params.threshold;
      material.uniforms.contrast.value = params.contrast;
      material.uniforms.gamma.value = params.gamma;
      material.uniforms.invert.value = params.invert ? 1.0 : 0.0;
    }, [params.threshold, params.contrast, params.gamma, params.invert]);

    return <div ref={containerRef} className="h-full w-full bg-black" />;
  },
);

AutomataCanvas.displayName = 'AutomataCanvas';

export default AutomataCanvas;
