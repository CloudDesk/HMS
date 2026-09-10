import type { ToothSurface } from '../../../api/opd';
import { getDentition, isUpperArch } from '../../../pages/dental-utils';

// These are render IDs only. Clinical values remain the existing ToothSurface enum.
export const RENDER_SURFACES: ToothSurface[] = ['OCCLUSAL', 'MESIAL', 'DISTAL', 'BUCCAL', 'LINGUAL'];
type Point = [number, number, number];
export type ToothMesh = { positions: Float32Array; normals: Float32Array; surfaces: Float32Array };

export function parseAnatomicalToothObj(source: string, toothNumber: number): ToothMesh {
  const vertices: Point[] = [];
  const vertexNormals: Point[] = [];
  const faces: Array<Array<{ vertex: number; normal: number }>> = [];
  for (const line of source.split(/\r?\n/)) {
    const values = line.trim().split(/\s+/);
    if (values[0] === 'v' && values.length >= 4) {
      vertices.push([Number(values[1]), Number(values[2]), Number(values[3])]);
    } else if (values[0] === 'vn' && values.length >= 4) {
      vertexNormals.push([Number(values[1]), Number(values[2]), Number(values[3])]);
    } else if (values[0] === 'f' && values.length >= 4) {
      faces.push(values.slice(1).map((value) => {
        const indices = value.split('/');
        return { vertex: Number(indices[0]) - 1, normal: Number(indices[2] || indices[0]) - 1 };
      }));
    }
  }
  if (!vertices.length || !faces.length) throw new Error('Anatomical tooth mesh is empty.');
  const bounds = (axis: number) => {
    const values = vertices.map((point) => point[axis] ?? 0);
    return [Math.min(...values), Math.max(...values)] as const;
  };
  const [minX, maxX] = bounds(0), [minDepth, maxDepth] = bounds(1), [minLength, maxLength] = bounds(2);
  const centerX = (minX + maxX) / 2, centerDepth = (minDepth + maxDepth) / 2;
  const length = maxLength - minLength || 1, scale = 2.85 / length;
  const upper = isUpperArch(toothNumber);
  const crownDistance = (point: Point) => upper ? point[2] - minLength : maxLength - point[2];
  // BodyParts3D stores teeth in skull coordinates. Derive the crown's principal
  // horizontal axis so the initial view is the broad facial view, independent
  // of how the source tooth is angled in the jaw.
  const crownVertices = vertices.filter((point) => crownDistance(point) <= length * 0.44);
  const crownCenterX = crownVertices.reduce((sum, point) => sum + point[0], 0) / crownVertices.length;
  const crownCenterDepth = crownVertices.reduce((sum, point) => sum + point[1], 0) / crownVertices.length;
  const crownCenterLength = crownVertices.reduce((sum, point) => sum + point[2], 0) / crownVertices.length;
  const rootVertices = vertices.filter((point) => crownDistance(point) >= length * 0.78);
  const rootCenterX = rootVertices.reduce((sum, point) => sum + point[0], 0) / rootVertices.length;
  const rootCenterDepth = rootVertices.reduce((sum, point) => sum + point[1], 0) / rootVertices.length;
  const rootCenterLength = rootVertices.reduce((sum, point) => sum + point[2], 0) / rootVertices.length;
  const covariance = crownVertices.reduce((value, point) => {
    const x = point[0] - crownCenterX, depth = point[1] - crownCenterDepth;
    value.xx += x * x; value.xy += x * depth; value.yy += depth * depth;
    return value;
  }, { xx: 0, xy: 0, yy: 0 });
  const facialAngle = 0.5 * Math.atan2(2 * covariance.xy, covariance.xx - covariance.yy);
  const facialCos = Math.cos(facialAngle), facialSin = Math.sin(facialAngle);
  const quadrant = Math.floor(toothNumber / 10);
  const anterior = toothNumber % 10 <= 3;
  const mesialSign = [1, 4, 5, 8].includes(quadrant) ? 1 : -1;
  const baseTransform = (point: Point): Point => [
    ((point[0] - centerX) * facialCos + (point[1] - centerDepth) * facialSin) * scale,
    (upper ? (minLength + maxLength) / 2 - point[2] : point[2] - (minLength + maxLength) / 2) * scale,
    (-(point[0] - centerX) * facialSin + (point[1] - centerDepth) * facialCos) * scale,
  ];
  const crownLocal = baseTransform([crownCenterX, crownCenterDepth, crownCenterLength]);
  const rootLocal = baseTransform([rootCenterX, rootCenterDepth, rootCenterLength]);
  const axisAngle = upper ? 0 : Math.atan2(crownLocal[0] - rootLocal[0], crownLocal[1] - rootLocal[1]);
  const axisCos = Math.cos(axisAngle), axisSin = Math.sin(axisAngle);
  const alignAxis = (point: Point): Point => [
    axisCos * point[0] - axisSin * point[1],
    axisSin * point[0] + axisCos * point[1],
    point[2],
  ];
  const transform = (point: Point): Point => alignAxis(baseTransform(point));
  const transformNormal = (normal: Point): Point => {
    const value = alignAxis([
      normal[0] * facialCos + normal[1] * facialSin,
      upper ? -normal[2] : normal[2],
      -normal[0] * facialSin + normal[1] * facialCos,
    ]);
    const magnitude = Math.hypot(...value) || 1;
    return value.map((part) => part / magnitude) as Point;
  };
  const positions: number[] = [], normals: number[] = [], surfaces: number[] = [];
  const surfaceId = (face: Array<{ vertex: number; normal: number }>) => {
    const points = face.map(({ vertex }) => vertices[vertex]).filter((point): point is Point => Boolean(point));
    const sourceCenter: Point = [0, 0, 0];
    for (const point of points) {
      sourceCenter[0] += point[0] / points.length;
      sourceCenter[1] += point[1] / points.length;
      sourceCenter[2] += point[2] / points.length;
    }
    const distanceFromCrown = crownDistance(sourceCenter);
    if (distanceFromCrown > length * 0.44) return 0;
    const averageNormal = face.reduce<Point>((sum, item) => {
      const normal = vertexNormals[item.normal] ?? [0, 0, 0];
      sum[0] += normal[0] / face.length;
      sum[1] += normal[1] / face.length;
      sum[2] += normal[2] / face.length;
      return sum;
    }, [0, 0, 0]);
    const normal = transformNormal(averageNormal);
    // Incisal enamel is a narrow anatomical cutting edge. Concave facial or
    // palatal triangles can also point upward, so normal direction alone must
    // not classify an anterior crown face as incisal. Posterior occlusal
    // tables, however, legitimately include upward-facing cusps and fossae.
    if (anterior
      ? distanceFromCrown <= length * 0.09
        || (distanceFromCrown <= length * 0.16 && normal[1] > 0.55)
      : distanceFromCrown <= length * 0.18
        || (distanceFromCrown <= length * 0.26 && normal[1] > 0.35)) return 1;
    const transformed = transform(sourceCenter);
    const x = transformed[0], depth = transformed[2];
    if (Math.abs(x) > Math.abs(depth)) return x * mesialSign > 0 ? 2 : 3;
    return depth < 0 ? 4 : 5;
  };
  for (const face of faces) {
    const id = surfaceId(face);
    for (let index = 1; index < face.length - 1; index++) {
      for (const item of [face[0], face[index], face[index + 1]]) {
        if (!item) continue;
        const point = vertices[item.vertex], normal = vertexNormals[item.normal];
        if (!point) continue;
        positions.push(...transform(point));
        normals.push(...transformNormal(normal ?? [0, 1, 0]));
        surfaces.push(id);
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), surfaces: new Float32Array(surfaces) };
}

export function buildToothMesh(toothNumber: number): ToothMesh {
  const tooth = toothNumber % 10;
  const anterior = tooth <= 3;
  const canine = tooth === 3;
  const molar = getDentition(toothNumber) === 'PRIMARY' ? tooth >= 4 : tooth >= 6;
  const quadrant = Math.floor(toothNumber / 10);
  // In the default facial view, the patient's right is on the viewer's left.
  const mesialSign = [1, 4, 5, 8].includes(quadrant) ? 1 : -1;
  const width = anterior ? canine ? 0.48 : tooth === 2 ? 0.49 : 0.57 : molar ? 0.76 : 0.59;
  const depth = anterior ? canine ? 0.40 : 0.38 : molar ? 0.58 : 0.43;
  const positions: number[] = [], normals: number[] = [], surfaces: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, id: number) => {
    const u = b.map((value, i) => value - (a[i] ?? 0));
    const v = c.map((value, i) => value - (a[i] ?? 0));
    const n: Point = [
      (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0),
      (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0),
      (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0),
    ];
    const length = Math.hypot(...n) || 1;
    for (const point of [a, b, c]) {
      positions.push(...point);
      normals.push(n[0] / length, n[1] / length, n[2] / length);
      surfaces.push(id);
    }
  };
  const signedPower = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), anterior && !canine ? 0.58 : 0.78);
  const profile = (values: number[], t: number) => {
    const p = Math.max(0, Math.min(1, t)) * (values.length - 1);
    const i = Math.min(values.length - 2, Math.floor(p)), f = p - i;
    const a = values[Math.max(0, i - 1)] ?? 0, b = values[i] ?? 0;
    const c = values[i + 1] ?? 0, d = values[Math.min(values.length - 1, i + 2)] ?? 0;
    return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  };
  const crownWidth = (t: number) => anterior && !canine
    ? profile([0.63, 0.76, 0.85, 0.92, 0.96, 0.99, 1, 0.99, 0.94], t)
    : profile([0.66, 0.82, 0.93, 1, 1.02, 1, 0.96, 0.91, 0.84], t);
  const crownDepth = (t: number) => anterior && !canine
    ? profile([0.70, 0.88, 0.93, 0.89, 0.77, 0.63, 0.48, 0.33, 0.20], t)
    : profile([0.72, 0.89, 0.99, 1.01, 1, 0.97, 0.93, 0.89, 0.84], t);
  const neckHeight = (x: number, z: number) => -0.12 + 0.08 * z * z - 0.045 * x * x;
  const capHeight = (x: number, z: number) => {
    if (canine) return 1.08 + 0.27 * (1 - Math.pow(Math.abs(x), 1.5)) - 0.045 * z * z;
    if (anterior) return 1.17 - 0.07 * Math.pow(Math.abs(x), 6) + 0.012 * Math.cos(x * Math.PI * 3);
    // Rounded cusps with a central depression; this is a schematic crown.
    const cusp = (cx: number, cz: number) => Math.exp(-10 * ((x - cx) ** 2 + (z - cz) ** 2));
    return 0.98 + 0.19 * (cusp(-0.55, 0.55) + cusp(0.55, 0.55) + cusp(-0.55, -0.55) + cusp(0.55, -0.55));
  };
  const sideId = (angle: number) => {
    const x = Math.cos(angle), z = Math.sin(angle);
    if (Math.abs(x) > Math.abs(z)) return x * mesialSign > 0 ? 2 : 3;
    return z > 0 ? 4 : 5;
  };
  const segments = 96;
  // Incisors widen towards the cutting edge and thin facial-to-lingual.
  // Posterior crowns retain fuller shoulders and distinct biting cusps.
  const crownPoint = (t: number, angle: number): Point => {
    const x = signedPower(Math.cos(angle)), z = signedPower(Math.sin(angle));
    const neck = neckHeight(x, z);
    const lobe = anterior ? 0.012 * Math.cos(x * Math.PI * 3) * Math.sin(Math.PI * t) : 0;
    return [x * width * crownWidth(t), neck + t * (capHeight(x, z) - neck), z * depth * (crownDepth(t) + lobe)];
  };
  for (let ring = 0; ring < 28; ring++) {
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
      const p = crownPoint(ring / 28, a), q = crownPoint(ring / 28, b);
      const r = crownPoint((ring + 1) / 28, a), s = crownPoint((ring + 1) / 28, b);
      const id = sideId((a + b) / 2);
      triangle(p, r, q, id); triangle(q, r, s, id);
    }
  }
  const capPoint = (radius: number, angle: number): Point => {
    const x = signedPower(Math.cos(angle)), z = signedPower(Math.sin(angle));
    return [x * width * crownWidth(1) * radius, capHeight(x * radius, z * radius), z * depth * crownDepth(1) * radius];
  };
  for (let ring = 0; ring < 20; ring++) {
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
      const p = capPoint(ring / 20, a), q = capPoint(ring / 20, b);
      const r = capPoint((ring + 1) / 20, a), s = capPoint((ring + 1) / 20, b);
      triangle(p, q, r, 1); triangle(q, s, r, 1);
    }
  }
  const rootCount = molar ? 2 : 1;
  for (let root = 0; root < rootCount; root++) {
    const rootPoint = (t: number, angle: number): Point => {
      const sign = rootCount === 1 ? 0 : root === 0 ? -1 : 1;
      const spread = sign * (0.23 + 0.17 * Math.sin(t * 1.7));
      const radius = Math.max(0, profile([1, 1, 0.98, 0.95, 0.90, 0.84, 0.75, 0.62, 0.43, 0], t));
      const rx = rootCount === 1 ? width * crownWidth(0) : width * 0.43;
      const x = signedPower(Math.cos(angle)) * (1 - t) + Math.cos(angle) * t;
      const z = signedPower(Math.sin(angle)) * (1 - t) + Math.sin(angle) * t;
      const neck = rootCount === 1 ? neckHeight(x, z) : -0.1;
      return [
        spread + x * rx * radius + 0.09 * t * t * t,
        neck * (1 - t) + (-1.60 - (canine ? 0.13 : 0)) * t,
        z * depth * crownDepth(0) * radius - 0.09 * t * t,
      ];
    };
    for (let ring = 0; ring < 28; ring++) {
      for (let i = 0; i < 64; i++) {
        const a = i * Math.PI / 32, b = (i + 1) * Math.PI / 32;
        const p = rootPoint(ring / 28, a), q = rootPoint(ring / 28, b);
        const r = rootPoint((ring + 1) / 28, a), s = rootPoint((ring + 1) / 28, b);
        triangle(p, q, r, 0); triangle(q, s, r, 0);
      }
    }
  }
  // Smooth shared vertices, including clinical region boundaries, so the
  // material reads as continuous enamel rather than individually lit facets.
  const sums = new Map<string, Point>();
  const keys: string[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const key = [positions[i], positions[i + 1], positions[i + 2]].map((value) => Math.round((value ?? 0) * 100000)).join(',');
    keys.push(key);
    const sum = sums.get(key) ?? [0, 0, 0];
    sum[0] += normals[i] ?? 0; sum[1] += normals[i + 1] ?? 0; sum[2] += normals[i + 2] ?? 0;
    sums.set(key, sum);
  }
  for (let i = 0; i < keys.length; i++) {
    const sum = sums.get(keys[i] ?? '');
    if (!sum) continue;
    const length = Math.hypot(...sum) || 1;
    normals[i * 3] = sum[0] / length;
    normals[i * 3 + 1] = sum[1] / length;
    normals[i * 3 + 2] = sum[2] / length;
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), surfaces: new Float32Array(surfaces) };
}

export interface ToothRenderer {
  setSurfaces: (surfaces: ToothSurface[]) => void;
  rotate: (yaw: number, pitch: number) => void;
  previewTurn: (progress: number) => void;
  zoom: (delta: number) => void;
  locate: (surface: ToothSurface) => { x: number; y: number } | null;
  face: (surface: ToothSurface | null) => void;
  pick: (x: number, y: number) => ToothSurface | undefined;
  resize: () => void;
  dispose: () => void;
}

function buildSurfaceBoundaryMesh(mesh: ToothMesh): ToothMesh {
  type Edge = { a: Point; b: Point; surface: number };
  const edges = new Map<string, Edge>();
  const positions: number[] = [], normals: number[] = [], surfaces: number[] = [];
  const pointAt = (index: number): Point => [
    mesh.positions[index * 3] ?? 0,
    mesh.positions[index * 3 + 1] ?? 0,
    mesh.positions[index * 3 + 2] ?? 0,
  ];
  const pointKey = (point: Point) => point.map((value) => Math.round(value * 100000)).join(',');
  for (let index = 0; index < mesh.surfaces.length; index += 3) {
    const points: [Point, Point, Point] = [pointAt(index), pointAt(index + 1), pointAt(index + 2)];
    const surface = mesh.surfaces[index] ?? 0;
    for (const [start, end] of [[0, 1], [1, 2], [2, 0]] as const) {
      const a = points[start], b = points[end];
      const aKey = pointKey(a), bKey = pointKey(b);
      const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
      const existing = edges.get(key);
      if (!existing) {
        edges.set(key, { a, b, surface });
        continue;
      }
      if (existing.surface === surface) continue;
      for (const boundarySurface of new Set([existing.surface, surface])) {
        if (boundarySurface <= 0) continue;
        positions.push(...existing.a, ...existing.b);
        normals.push(0, 0, 1, 0, 0, 1);
        surfaces.push(boundarySurface, boundarySurface);
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    surfaces: new Float32Array(surfaces),
  };
}

export function createToothRenderer(canvas: HTMLCanvasElement, toothNumber: number, anatomicalMesh?: ToothMesh): ToothRenderer | null {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const program = gl.createProgram();
  if (!program) return null;
  const shaders: WebGLShader[] = [];
  const buffers: WebGLBuffer[] = [];
  const dispose = () => {
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    for (const shader of shaders) gl.deleteShader(shader);
    gl.deleteProgram(program);
  };
  const shaderSources: [number, string][] = [
    [gl.VERTEX_SHADER, `
      attribute vec3 aPosition; attribute vec3 aNormal; attribute float aSurface;
      uniform float uYaw; uniform float uPitch; uniform float uAspect; uniform float uZoom;
      varying vec3 vNormal; varying vec3 vPosition; varying float vSurface;
      void main() {
        float c=cos(uYaw), s=sin(uYaw), cp=cos(uPitch), sp=sin(uPitch);
        mat3 ry=mat3(c,0.,-s, 0.,1.,0., s,0.,c);
        mat3 rx=mat3(1.,0.,0., 0.,cp,sp, 0.,-sp,cp);
        vec3 p=rx*ry*(aPosition+vec3(0.,.18,0.));
        vNormal=rx*ry*aNormal; vPosition=aPosition; vSurface=aSurface;
        gl_Position=vec4(p.x*uZoom/(1.85*uAspect),p.y*uZoom/1.85,-p.z/8.,1.);
      }`],
    [gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec4 uFlags; uniform float uLingual; uniform bool uPick; uniform bool uBoundary;
      varying vec3 vNormal; varying vec3 vPosition; varying float vSurface;
      void main() {
        if(uPick) { gl_FragColor=vec4(vSurface/255.,0.,0.,1.); return; }
        float selected=0.;
        if(vSurface>.5 && vSurface<1.5) selected=uFlags.x;
        else if(vSurface<2.5 && vSurface>1.5) selected=uFlags.y;
        else if(vSurface<3.5 && vSurface>2.5) selected=uFlags.z;
        else if(vSurface<4.5 && vSurface>3.5) selected=uFlags.w;
        else if(vSurface>4.5) selected=uLingual;
        if(uBoundary) {
          if(selected<.5) discard;
          gl_FragColor=vec4(.94,.97,1.,1.);
          return;
        }
        vec3 n=normalize(vNormal);
        if(!gl_FrontFacing) n=-n;
        vec3 light=normalize(vec3(-.7,1.1,1.6));
        float diffuse=max(dot(n,light),0.);
        float rim=pow(1.-abs(n.z),3.);
        float neck=1.-smoothstep(-.2,.85,vPosition.y);
        vec3 enamel=mix(vec3(.97,.97,.94),vec3(.88,.83,.69),neck*.32);
        vec3 root=mix(vec3(.90,.80,.61),vec3(.94,.86,.72),smoothstep(-1.7,0.,vPosition.y));
        vec3 material=vSurface<.5 ? root : enamel;
        // Use one restrained blue family with a distinct tone per clinical
        // surface. Adjacent selected regions therefore remain identifiable
        // when several—or all—surfaces are recorded at once.
        vec3 selectedColor=vec3(.05,.65,.91);
        if(vSurface>.5 && vSurface<1.5) selectedColor=vec3(.05,.65,.91);
        else if(vSurface>1.5 && vSurface<2.5) selectedColor=vec3(.23,.51,.96);
        else if(vSurface>2.5 && vSurface<3.5) selectedColor=vec3(.11,.31,.85);
        else if(vSurface>3.5 && vSurface<4.5) selectedColor=vec3(.31,.27,.90);
        else if(vSurface>4.5) selectedColor=vec3(.64,.25,1.00);
        material=mix(material,selectedColor,selected*.94);
        vec3 halfLight=normalize(light+vec3(0.,0.,1.));
        float spec=pow(max(dot(n,halfLight),0.),64.);
        float softSpec=pow(max(dot(n,halfLight),0.),12.);
        float fill=max(dot(n,normalize(vec3(1.,.3,.7))),0.);
        float micro=sin(vPosition.x*150.+sin(vPosition.y*24.))*0.003;
        vec3 color=material*(.79+.15*diffuse+.05*fill+micro);
        color+=vec3((vSurface<.5 ? .05 : .28)*spec+.055*softSpec+.025*rim);
        gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(.82)),1.);
      }`],
  ];
  for (const [type, source] of shaderSources) {
    const shader = gl.createShader(type);
    if (!shader) { dispose(); return null; }
    shaders.push(shader);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { dispose(); return null; }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { dispose(); return null; }
  gl.useProgram(program);
  const mesh = anatomicalMesh ?? buildToothMesh(toothNumber);
  const boundaryMesh = buildSurfaceBoundaryMesh(mesh);
  type AttributeBinding = { buffer: WebGLBuffer; location: number; size: number };
  const createAttributeBindings = (source: ToothMesh): AttributeBinding[] | null => {
    const bindings: AttributeBinding[] = [];
    for (const [name, values, size] of [
      ['aPosition', source.positions, 3], ['aNormal', source.normals, 3], ['aSurface', source.surfaces, 1],
    ] as const) {
      const buffer = gl.createBuffer();
      if (!buffer) return null;
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
      bindings.push({ buffer, location: gl.getAttribLocation(program, name), size });
    }
    return bindings;
  };
  const meshBindings = createAttributeBindings(mesh);
  const boundaryBindings = createAttributeBindings(boundaryMesh);
  if (!meshBindings || !boundaryBindings) { dispose(); return null; }
  const bindAttributes = (bindings: AttributeBinding[]) => {
    for (const binding of bindings) {
      gl.bindBuffer(gl.ARRAY_BUFFER, binding.buffer);
      gl.enableVertexAttribArray(binding.location);
      gl.vertexAttribPointer(binding.location, binding.size, gl.FLOAT, false, 0, 0);
    }
  };
  const uniforms = {
    yaw: gl.getUniformLocation(program, 'uYaw'), pitch: gl.getUniformLocation(program, 'uPitch'),
    aspect: gl.getUniformLocation(program, 'uAspect'), zoom: gl.getUniformLocation(program, 'uZoom'),
    flags: gl.getUniformLocation(program, 'uFlags'),
    lingual: gl.getUniformLocation(program, 'uLingual'), pick: gl.getUniformLocation(program, 'uPick'),
    boundary: gl.getUniformLocation(program, 'uBoundary'),
  };
  const position = toothNumber % 10;
  const primary = getDentition(toothNumber) === 'PRIMARY';
  const posteriorMolar = primary ? position >= 4 : position >= 6;
  const premolar = !primary && position >= 4 && position <= 5;
  const defaultYaw = posteriorMolar ? -0.42 : premolar ? -0.3 : -0.12;
  const defaultPitch = posteriorMolar ? 0.42 : premolar ? 0.34 : 0.18;
  let yaw = defaultYaw, pitch = defaultPitch, zoom = 1;
  const draw = (pick = false) => {
    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.DITHER);
    gl.clearColor(0.98, 0.985, 0.99, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(uniforms.yaw, yaw); gl.uniform1f(uniforms.pitch, pitch);
    gl.uniform1f(uniforms.aspect, canvas.width / canvas.height);
    gl.uniform1f(uniforms.zoom, zoom);
    gl.uniform1i(uniforms.pick, pick ? 1 : 0);
    gl.uniform1i(uniforms.boundary, 0);
    bindAttributes(meshBindings);
    if (!pick && boundaryMesh.surfaces.length > 0) {
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
    }
    gl.drawArrays(gl.TRIANGLES, 0, mesh.surfaces.length);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    if (!pick && boundaryMesh.surfaces.length > 0) {
      gl.uniform1i(uniforms.boundary, 1);
      bindAttributes(boundaryBindings);
      gl.lineWidth(1);
      gl.drawArrays(gl.LINES, 0, boundaryMesh.surfaces.length);
      gl.uniform1i(uniforms.boundary, 0);
    }
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    draw();
  };
  resize();
  return {
    resize, dispose,
    setSurfaces: (surfaces) => {
      gl.useProgram(program);
      gl.uniform4f(uniforms.flags, ...[
        surfaces.includes('OCCLUSAL') ? 1 : 0, surfaces.includes('MESIAL') ? 1 : 0,
        surfaces.includes('DISTAL') ? 1 : 0, surfaces.includes('BUCCAL') ? 1 : 0,
      ] as [number, number, number, number]);
      gl.uniform1f(uniforms.lingual, surfaces.includes('LINGUAL') ? 1 : 0);
      draw();
    },
    rotate: (dx, dy) => {
      yaw += dx; pitch = Math.max(-0.8, Math.min(1.5, pitch + dy)); draw();
    },
    previewTurn: (progress) => {
      yaw = defaultYaw + Math.max(0, Math.min(1, progress)) * Math.PI * 2;
      draw();
    },
    zoom: (delta) => {
      zoom = Math.max(0.72, Math.min(1.42, zoom + delta)); draw();
    },
    locate: (surface) => {
      const id = RENDER_SURFACES.indexOf(surface) + 1;
      let x = 0, y = 0, z = 0, count = 0;
      for (let index = 0; index < mesh.surfaces.length; index++) {
        if (mesh.surfaces[index] !== id) continue;
        x += mesh.positions[index * 3] ?? 0;
        y += mesh.positions[index * 3 + 1] ?? 0;
        z += mesh.positions[index * 3 + 2] ?? 0;
        count++;
      }
      if (!count) return null;
      x /= count; y = y / count + 0.18; z /= count;
      const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const rotatedX = c * x + s * z;
      const rotatedZ = -s * x + c * z;
      const rotatedY = cp * y - sp * rotatedZ;
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.width / 2 + rotatedX * zoom * rect.height / 3.7,
        y: rect.height / 2 - rotatedY * zoom * rect.height / 3.7,
      };
    },
    face: (surface) => {
      const mesialSign = [1, 4, 5, 8].includes(Math.floor(toothNumber / 10)) ? 1 : -1;
      pitch = surface === 'OCCLUSAL' ? 1.48 : defaultPitch;
      yaw = surface === 'MESIAL' ? -mesialSign * Math.PI / 2
        : surface === 'DISTAL' ? mesialSign * Math.PI / 2
        : surface === 'LINGUAL' ? Math.PI
        : surface === null ? defaultYaw : 0;
      if (surface === null) zoom = 1;
      draw();
    },
    pick: (x, y) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return undefined;
      draw(true);
      const pixel = new Uint8Array(4);
      const px = Math.min(canvas.width - 1, Math.max(0, Math.floor((x - rect.left) / rect.width * canvas.width)));
      const py = Math.min(canvas.height - 1, Math.max(0, Math.floor((rect.bottom - y) / rect.height * canvas.height)));
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      draw();
      const id = pixel[0] ?? 0;
      return id >= 1 && id <= 5 ? RENDER_SURFACES[id - 1] : undefined;
    },
  };
}
