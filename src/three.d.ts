declare namespace THREE {
  const SRGBColorSpace: unknown;

  interface WebGLRendererParameters {
    antialias?: boolean;
    alpha?: boolean;
    preserveDrawingBuffer?: boolean;
  }

  class WebGLRenderer {
    constructor(parameters?: WebGLRendererParameters);
    domElement: HTMLCanvasElement;
    outputColorSpace: unknown;
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number): void;
    render(scene: Scene, camera: Camera): void;
    dispose(): void;
    forceContextLoss(): void;
    getRenderTarget(): WebGLRenderTarget | null;
    readRenderTargetPixels(
      target: WebGLRenderTarget,
      x: number,
      y: number,
      width: number,
      height: number,
      buffer: Float32Array | Uint8Array,
    ): void;
  }

  class Scene {
    add(...objects: unknown[]): void;
  }

  class Camera {}

  class OrthographicCamera extends Camera {
    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number);
  }

  class ShaderMaterial {
    constructor(parameters?: { vertexShader?: string; fragmentShader?: string; uniforms?: Record<string, { value: unknown }> });
    uniforms: Record<string, { value: unknown }>;
    dispose(): void;
  }

  class PlaneGeometry {
    constructor(width: number, height: number);
    dispose(): void;
  }

  class Mesh<TGeometry = PlaneGeometry, TMaterial = ShaderMaterial> {
    constructor(geometry: TGeometry, material: TMaterial);
  }

  class Vector2 {
    constructor(x?: number, y?: number);
  }

  class DataTexture {
    image: { data: Float32Array };
    needsUpdate: boolean;
    dispose(): void;
  }

  class WebGLRenderTarget {
    width: number;
    height: number;
    texture: { [key: string]: unknown };
  }
}

declare module 'three' {
  export = THREE;
}

declare module 'three/examples/jsm/misc/GPUComputationRenderer' {
  import { DataTexture } from 'three';

  export class Variable {
    material: { uniforms: Record<string, { value: unknown }> };
  }

  export class GPUComputationRenderer {
    constructor(width: number, height: number, renderer: any);
    addVariable(name: string, fragmentShader: string, initialValueTexture: DataTexture): Variable;
    setVariableDependencies(variable: Variable, dependencies: Variable[]): void;
    init(): unknown;
    compute(): void;
    getCurrentRenderTarget(variable: Variable): { texture: unknown };
    createTexture(): DataTexture;
    renderTexture(input: DataTexture, target: THREE.WebGLRenderTarget): void;
    dispose?(): void;
  }
}
