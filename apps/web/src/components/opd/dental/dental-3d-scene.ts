import * as THREE from 'three';
import type { DentitionType, HistoricalToothFinding, ToothFinding } from '../../../api/opd';
import { isUpperArch } from '../../../pages/dental-utils';
import { buildToothMesh, type ToothMesh } from './tooth-3d';

export type CameraPreset = 'clinical' | 'upper' | 'lower' | 'anterior' | 'occlusal' | 'right' | 'left';

export interface AnatomicalCallout {
  id: string;
  label: string;
  worldPosition: THREE.Vector3;
  screenX: number;
  screenY: number;
  visible: boolean;
  side: 'left' | 'right';
}

export interface OralCavity3DController {
  setTeethData: (teeth: ToothFinding[], historicalTeeth: HistoricalToothFinding[], selectedTooth: number | null) => void;
  setDentition: (dentition: DentitionType) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  resetView: () => void;
  rotate: (deltaYaw: number, deltaPitch: number) => void;
  zoom: (deltaZoom: number) => void;
  pan: (deltaX: number, deltaY: number) => void;
  getToothScreenCoordinates: () => Map<number, { x: number; y: number; visible: boolean }>;
  getAnatomicalCallouts: () => AnatomicalCallout[];
  pickTooth: (clientX: number, clientY: number) => number | null;
  resize: () => void;
  dispose: () => void;
}

// FDI Arch Lists
const PERMANENT_TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

const PRIMARY_TEETH = [
  55, 54, 53, 52, 51, 61, 62, 63, 64, 65,
  85, 84, 83, 82, 81, 71, 72, 73, 74, 75,
];

// Helper to determine clinical condition key
function getCondition(finding?: ToothFinding): string {
  if (!finding) return 'unrecorded';
  if (finding.status === 'MISSING' || finding.status === 'EXTRACTED' || finding.conditions.includes('MISSING')) return 'missing';
  if (finding.conditions.includes('CARIOUS')) return 'caries';
  if (finding.conditions.includes('FILLED')) return 'filled';
  if (finding.conditions.includes('CROWN')) return 'crown';
  if (finding.conditions.includes('ROOT_PIECE')) return 'root';
  if (finding.conditions.some((c) => ['FRACTURED', 'PULPITIC', 'PERIAPICAL_LESION'].includes(c))) return 'attention';
  if (finding.conditions.includes('HEALTHY')) return 'healthy';
  return 'unrecorded';
}

// 3D Spatial positions of teeth along maxillary (upper) and mandibular (lower) dental arches
function getToothArchTransform(toothNumber: number): { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 } {
  const isUpper = isUpperArch(toothNumber);
  const isPrimary = toothNumber >= 50;
  const positionIndex = toothNumber % 10; // 1 to 8 (or 1 to 5)
  const quadrant = Math.floor(toothNumber / 10);
  const isRightSide = [1, 4, 5, 8].includes(quadrant); // Patient Right = Viewer Left

  const maxPos = isPrimary ? 5 : 8;
  const t = (positionIndex - 1) / (maxPos - 1 || 1); // 0 (central incisor) to 1 (wisdom tooth)

  // Arch curvature parameters matching human clinical dental arch anatomy
  const archRadiusX = isUpper ? 3.32 : 3.08;
  const archDepthZ = isUpper ? 3.35 : 3.15;

  const angle = (t * 0.95 + 0.08) * (Math.PI / 2); // 0 to ~PI/2
  const rawX = Math.sin(angle) * archRadiusX;
  const rawZ = 2.12 - (1 - Math.cos(angle)) * archDepthZ;

  const posX = isRightSide ? -rawX : rawX;
  // Position crowns so they face into the oral cavity with complete clinical visibility
  const posY = isUpper ? 1.30 - (1 - t) * 0.06 : -1.30 + (1 - t) * 0.06;
  const posZ = rawZ;

  const normX = (isRightSide ? -1 : 1) * Math.sin(angle);
  const normZ = Math.cos(angle);

  const mat = new THREE.Matrix4();
  if (isUpper) {
    // Upper teeth: crown points DOWN (-Y) into oral cavity, occlusal/incisal tables tilted toward viewer
    const yAxis = new THREE.Vector3(0, -1, 0);
    const zAxis = new THREE.Vector3(normX, 0.15 * (1 - t * 0.5), normZ).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();
    mat.makeBasis(xAxis, yAxis, zAxis);
  } else {
    // Lower teeth: crown points UP (+Y) into oral cavity, occlusal/incisal tables tilted toward viewer
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3(normX, -0.10 * (1 - t * 0.5), normZ).normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();
    mat.makeBasis(xAxis, yAxis, zAxis);
  }

  const euler = new THREE.Euler().setFromRotationMatrix(mat, 'YXZ');
  const scaleVal = isPrimary ? 0.88 : 1.0;
  return {
    position: new THREE.Vector3(posX, posY, posZ),
    rotation: euler,
    scale: new THREE.Vector3(scaleVal, scaleVal, scaleVal),
  };
}

export function createOralCavity3DScene(container: HTMLCanvasElement): OralCavity3DController {
  let disposed = false;

  // 1. Scene, Camera, Renderer Setup
  const scene = new THREE.Scene();
  scene.background = null; // Transparent background allowing realistic vector oral cavity to show through

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 8.8);

  const renderer = new THREE.WebGLRenderer({
    canvas: container,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // 2. High-Fidelity Studio & Clinical Lighting
  const ambientLight = new THREE.AmbientLight(0xfff5f0, 0.85);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 4, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffebe5, 0.9);
  fillLight.position.set(-3, -2, 5);
  scene.add(fillLight);

  const topRimLight = new THREE.DirectionalLight(0xf0f4ff, 0.7);
  topRimLight.position.set(0, 5, 2);
  scene.add(topRimLight);

  const rearShadowLight = new THREE.DirectionalLight(0xd4a0a5, 0.4);
  rearShadowLight.position.set(0, 0, -4);
  scene.add(rearShadowLight);

  // 3. Realistic Biological Materials
  const materials = {
    enamel: new THREE.MeshPhysicalMaterial({
      color: 0xfaf8f4,
      roughness: 0.28,
      metalness: 0.0,
      clearcoat: 0.40,
      clearcoatRoughness: 0.15,
    }),
    healthy: new THREE.MeshPhysicalMaterial({
      color: 0xfcfbf7,
      roughness: 0.28,
      clearcoat: 0.35,
      clearcoatRoughness: 0.15,
    }),
    unrecorded: new THREE.MeshPhysicalMaterial({
      color: 0xf5f0e6,
      roughness: 0.32,
      clearcoat: 0.25,
      clearcoatRoughness: 0.20,
    }),
    caries: new THREE.MeshStandardMaterial({
      color: 0xd94444,
      roughness: 0.45,
    }),
    filled: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.35,
      metalness: 0.1,
    }),
    crown: new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.25,
      metalness: 0.6,
    }),
    root: new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      roughness: 0.55,
    }),
    missing: new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.8,
      transparent: true,
      opacity: 0.25,
    }),
    attention: new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.4,
    }),
    selected: new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.3,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4,
    }),
  };

  // 4. Tooth Meshes Storage & Loading Pipeline (Clinical Locked Layer)
  const toothMeshesMap = new Map<number, THREE.Mesh>();
  const toothGroup = new THREE.Group();
  scene.add(toothGroup);

  // Cache parsed geometries
  const geometryCache = new Map<number, THREE.BufferGeometry>();

  function createBufferGeometryFromToothMesh(meshData: ToothMesh): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function getToothGeometry(fdi: number): THREE.BufferGeometry {
    if (geometryCache.has(fdi)) return geometryCache.get(fdi)!;
    // Build pristine clinical crown geometry with sealed cervical base (zero root spikes)
    const meshData = buildToothMesh(fdi, { crownOnly: true });
    const geo = createBufferGeometryFromToothMesh(meshData);
    geometryCache.set(fdi, geo);
    return geo;
  }

  let currentDentition: DentitionType = 'PERMANENT';
  let currentTeethFindings: ToothFinding[] = [];
  let currentHistorical: HistoricalToothFinding[] = [];
  let currentSelectedTooth: number | null = null;

  function rebuildToothMeshes() {
    // Clear old meshes safely
    toothGroup.clear();
    toothMeshesMap.clear();

    const teethList = currentDentition === 'PERMANENT' ? PERMANENT_TEETH : PRIMARY_TEETH;

    for (const fdi of teethList) {
      const geo = getToothGeometry(fdi);
      const finding = currentTeethFindings.find((t) => t.tooth_number === fdi);
      const cond = getCondition(finding);

      let mat: THREE.Material = materials.enamel;
      if (currentSelectedTooth === fdi) {
        mat = materials.selected;
      } else if (cond === 'caries') mat = materials.caries;
      else if (cond === 'filled') mat = materials.filled;
      else if (cond === 'crown') mat = materials.crown;
      else if (cond === 'root') mat = materials.root;
      else if (cond === 'missing') mat = materials.missing;
      else if (cond === 'attention') mat = materials.attention;
      else if (cond === 'healthy') mat = materials.healthy;
      else mat = materials.unrecorded;

      const mesh = new THREE.Mesh(geo, mat);
      const transform = getToothArchTransform(fdi);
      mesh.position.copy(transform.position);
      mesh.rotation.copy(transform.rotation);
      mesh.scale.copy(transform.scale);

      mesh.userData = { fdi };
      toothGroup.add(mesh);
      toothMeshesMap.set(fdi, mesh);
    }
  }

  // 6. Camera Orbit & Transformation State
  let targetYaw = 0;
  let targetPitch = 0;
  let currentYaw = 0;
  let currentPitch = 0;
  let targetZoom = 8.8;
  let currentZoom = 8.8;
  let panOffset = new THREE.Vector3(0, 0, 0);

  const presetPositions: Record<CameraPreset, { pos: THREE.Vector3; target: THREE.Vector3; yaw: number; pitch: number; zoom: number }> = {
    clinical: { pos: new THREE.Vector3(0, 0, 8.8), target: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0, zoom: 8.8 },
    upper: { pos: new THREE.Vector3(0, -3.2, 7.0), target: new THREE.Vector3(0, 1.3, 0), yaw: 0, pitch: -0.42, zoom: 7.2 },
    lower: { pos: new THREE.Vector3(0, 3.2, 7.0), target: new THREE.Vector3(0, -1.3, 0), yaw: 0, pitch: 0.42, zoom: 7.2 },
    anterior: { pos: new THREE.Vector3(0, 0, 6.2), target: new THREE.Vector3(0, 0, 1.8), yaw: 0, pitch: 0, zoom: 6.2 },
    occlusal: { pos: new THREE.Vector3(0, 6.5, 3.5), target: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0.95, zoom: 7.5 },
    right: { pos: new THREE.Vector3(-6.5, 0, 4.2), target: new THREE.Vector3(-1.8, 0, 0), yaw: 0.85, pitch: 0.05, zoom: 7.2 },
    left: { pos: new THREE.Vector3(6.5, 0, 4.2), target: new THREE.Vector3(1.8, 0, 0), yaw: -0.85, pitch: 0.05, zoom: 7.2 },
  };

  function updateCameraTransform() {
    currentYaw += (targetYaw - currentYaw) * 0.15;
    currentPitch += (targetPitch - currentPitch) * 0.15;
    currentZoom += (targetZoom - currentZoom) * 0.15;

    const distance = currentZoom;
    const x = distance * Math.sin(currentYaw) * Math.cos(currentPitch);
    const y = distance * Math.sin(currentPitch);
    const z = distance * Math.cos(currentYaw) * Math.cos(currentPitch);

    camera.position.set(x + panOffset.x, y + panOffset.y, z + panOffset.z);
    camera.lookAt(panOffset);
  }

  // 7. Raycasting for Accurate Tooth Selection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function pickTooth(clientX: number, clientY: number): number | null {
    const rect = container.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(toothGroup.children, true);

    const firstHit = intersects[0];
    if (firstHit) {
      let obj: THREE.Object3D | null = firstHit.object;
      while (obj && !obj.userData?.fdi && obj !== toothGroup) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.fdi) {
        return obj.userData.fdi;
      }
    }
    return null;
  }

  // 8. Screen Coordinates Projection for Dynamic Callouts
  function projectWorldToScreen(worldPos: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const v = worldPos.clone().project(camera);
    const rect = container.getBoundingClientRect();
    const x = ((v.x + 1) / 2) * rect.width;
    const y = ((-v.y + 1) / 2) * rect.height;
    const visible = v.z < 1.0 && x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
    return { x, y, visible };
  }

  function getToothScreenCoordinates(): Map<number, { x: number; y: number; visible: boolean }> {
    const coords = new Map<number, { x: number; y: number; visible: boolean }>();
    for (const [fdi, mesh] of toothMeshesMap.entries()) {
      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);
      coords.set(fdi, projectWorldToScreen(worldPos));
    }
    return coords;
  }

  // Anatomical Callout Landmarks
  const calloutLandmarks: Array<{ id: string; label: string; getPos: () => THREE.Vector3; side: 'left' | 'right' }> = [
    { id: 'central-incisor', label: 'Central Incisor', getPos: () => new THREE.Vector3(-0.35, 0.85, 2.15), side: 'left' },
    { id: 'lateral-incisor', label: 'Lateral Incisor', getPos: () => new THREE.Vector3(-1.00, 0.85, 2.05), side: 'left' },
    { id: 'canine', label: 'Canine', getPos: () => new THREE.Vector3(-1.75, 0.85, 1.80), side: 'left' },
    { id: 'premolar', label: 'Premolar', getPos: () => new THREE.Vector3(-2.45, 0.85, 1.25), side: 'left' },
    { id: 'molar', label: 'Molar', getPos: () => new THREE.Vector3(-3.05, 0.85, 0.45), side: 'left' },
    { id: 'uvula', label: 'Uvula', getPos: () => new THREE.Vector3(0, 0.20, -0.2), side: 'left' },
    { id: 'cheek', label: 'Cheek', getPos: () => new THREE.Vector3(-3.45, 0, 0.2), side: 'left' },
    { id: 'retromolar-trigone', label: 'Retromolar Trigone', getPos: () => new THREE.Vector3(-2.95, -0.9, -0.6), side: 'left' },
    { id: 'tongue', label: 'Tongue', getPos: () => new THREE.Vector3(0, -0.65, 0.2), side: 'left' },
    { id: 'gum', label: 'Gum', getPos: () => new THREE.Vector3(-0.4, 1.45, 2.15), side: 'left' },

    { id: 'upper-lip', label: 'Upper Lip', getPos: () => new THREE.Vector3(0, 2.30, 2.1), side: 'right' },
    { id: 'hard-palate', label: 'Hard Palate', getPos: () => new THREE.Vector3(0, 1.25, 0.1), side: 'right' },
    { id: 'soft-palate', label: 'Soft Palate', getPos: () => new THREE.Vector3(0, 0.65, -0.5), side: 'right' },
    { id: 'fauces', label: 'Fauces', getPos: () => new THREE.Vector3(2.5, 0.1, -0.4), side: 'right' },
    { id: 'palatine-tonsil', label: 'Palatine Tonsil', getPos: () => new THREE.Vector3(2.7, 0.05, -0.5), side: 'right' },
    { id: 'floor-of-mouth', label: 'Floor Of Mouth', getPos: () => new THREE.Vector3(0, -1.25, 0.3), side: 'right' },
    { id: 'lower-lip', label: 'Lower Lip', getPos: () => new THREE.Vector3(0, -2.30, 2.1), side: 'right' },
  ];

  function getAnatomicalCallouts(): AnatomicalCallout[] {
    return calloutLandmarks.map((c) => {
      const worldPos = c.getPos();
      const proj = projectWorldToScreen(worldPos);
      return {
        id: c.id,
        label: c.label,
        worldPosition: worldPos,
        screenX: proj.x,
        screenY: proj.y,
        visible: proj.visible,
        side: c.side,
      };
    });
  }

  // 9. Animation & Render Loop
  let animId: number;
  function animate() {
    if (disposed) return;
    animId = requestAnimationFrame(animate);
    updateCameraTransform();
    renderer.render(scene, camera);
  }
  animate();

  // Initial build
  rebuildToothMeshes();

  return {
    setTeethData(teeth, historicalTeeth, selectedTooth) {
      currentTeethFindings = teeth;
      currentHistorical = historicalTeeth;
      currentSelectedTooth = selectedTooth;
      rebuildToothMeshes();
    },
    setDentition(dentition) {
      currentDentition = dentition;
      rebuildToothMeshes();
    },
    setCameraPreset(_preset) {
      // Fixed anatomical view: lock camera to clinical front perspective to align with mouth artwork
      const targetConfig = presetPositions.clinical;
      targetYaw = targetConfig.yaw;
      targetPitch = targetConfig.pitch;
      targetZoom = targetConfig.zoom;
      panOffset.copy(targetConfig.target);
    },
    resetView() {
      targetYaw = 0;
      targetPitch = 0;
      targetZoom = 8.8;
      panOffset.set(0, 0, 0);
    },
    rotate(_deltaYaw, _deltaPitch) {
      // Fixed anatomical view: rotation disabled to keep teeth locked in mouth artwork
    },
    zoom(_deltaZoom) {
      // Fixed anatomical view: zoom disabled to keep teeth locked in mouth artwork
    },
    pan(_deltaX, _deltaY) {
      // Fixed anatomical view: pan disabled to keep teeth locked in mouth artwork
    },
    getToothScreenCoordinates,
    getAnatomicalCallouts,
    pickTooth,
    resize() {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animId);
      renderer.dispose();
      scene.clear();
    },
  };
}
