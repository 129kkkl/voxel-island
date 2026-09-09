// ============================================================
//  空島禅寺 — Voxel Zen Temple on a Floating Island
//  Three.js / InstancedMesh voxel engine
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- color palette ----------
const C = {
  GRASS1:      0x6B8E23,
  GRASS2:      0x558B2F,
  MOSS:        0x7CB342,
  DIRT:        0x6D4C41,
  STONE:       0x757575,
  STONE_L:     0x9E9E9E,
  STONE_D:     0x4E4E4E,
  PATH:        0xD7CCC8,
  PATH_D:      0xBCAAA4,
  SAND:        0xEFEBE9,
  SAND_D:      0xD7CCC8,
  WOOD:        0x8D6E63,
  WOOD_D:      0x5D4037,
  WOOD_L:      0xA1887F,
  WALL:        0xF2EDE4,
  WALL_D:      0xE0D8CC,
  VERM:        0xC62828,
  VERM_L:      0xD32F2F,
  ROOF:        0x455A64,
  ROOF_L:      0x546E7A,
  ROOF_E:      0x263238,
  GOLD:        0xFFC107,
  GOLD_D:      0xFF8F00,
  WATER:       0x4FC3F7,
  CHERRY1:     0xF8BBD0,
  CHERRY2:     0xF48FB1,
  CHERRY3:     0xFCE4EC,
  PINE1:       0x2E7D32,
  PINE2:       0x1B5E20,
  PINE3:       0x388E3C,
  TRUNK:       0x4E342E,
  GLOW:        0xFFE082,
  CLOUD:       0xFFFFFF,
};

// ============================================================
//  Renderer / Scene / Camera
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// sunset fog
scene.fog = new THREE.FogExp2(0xC9A88B, 0.0062);

// gradient sky via large backside sphere
{
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      void main(){
        float h = normalize(vPos).y;
        vec3 zenith  = vec3(0.28, 0.22, 0.42);   // deep purple-blue
        vec3 mid     = vec3(0.62, 0.45, 0.62);   // lavender
        vec3 horizon = vec3(0.96, 0.62, 0.38);   // warm orange
        vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.35, h));
        col = mix(col, zenith, smoothstep(0.30, 0.85, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(42, 30, 48);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 12;
controls.maxDistance = 110;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;

// ============================================================
//  Lights — warm sunset key + cool ambient fill
// ============================================================
const hemi = new THREE.HemisphereLight(0xD4B896, 0x3A2E4A, 0.7);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0x8E7AA8, 0.25);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xFFB366, 1.35);
sun.position.set(-34, 30, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 130;
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.bias = -0.0006;
scene.add(sun);

// subtle cool rim light from opposite side
const rim = new THREE.DirectionalLight(0x6E7FB8, 0.35);
rim.position.set(30, 18, -28);
scene.add(rim);

// ============================================================
//  Voxel core — collect positions per color, build InstancedMesh
// ============================================================
const voxelMap = new Map();

function addV(x, y, z, color) {
  const key = x + ',' + y + ',' + z;
  if (voxelMap.has(key)) return;
  voxelMap.set(key, color);
}

// box fill helper
function addBox(x0, y0, z0, x1, y1, z1, color) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        addV(x, y, z, color);
}

// flat plane (top face) helper
function addPlane(x0, z0, x1, z1, y, color) {
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++)
      addV(x, y, z, color);
}

function buildVoxelMeshes() {
  const groups = {};
  for (const [key, color] of voxelMap) {
    if (!groups[color]) groups[color] = [];
    const p = key.split(',');
    groups[color].push([+p[0], +p[1], +p[2]]);
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  let total = 0;
  for (const [color, positions] of Object.entries(groups)) {
    const mat = new THREE.MeshLambertMaterial({ color: +color });
    const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      dummy.position.set(positions[i][0], positions[i][1], positions[i][2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    total += positions.length;
  }
  console.log('[voxel] total voxels:', total);
  return total;
}

// ============================================================
//  Noise utility
// ============================================================
function hash2(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function smoothNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz;
}
function fbm(x, z) {
  return smoothNoise(x * 0.18, z * 0.18) * 0.65
       + smoothNoise(x * 0.42, z * 0.42) * 0.30
       + smoothNoise(x * 0.9, z * 0.9) * 0.10;
}

// ============================================================
//  Floating island terrain
// ============================================================
const ISLAND_R = 26;

function islandTop(x, z) {
  const r = Math.sqrt(x * x + z * z);
  if (r > ISLAND_R + 1) return -999;
  // edge falloff — keeps centre flat for buildings
  const edge = Math.max(0, 1 - Math.pow(r / ISLAND_R, 2.2));
  const flat = r < 15 ? 1.0 : Math.max(0, 1 - (r - 15) / (ISLAND_R - 15));
  const n = fbm(x + 100, z + 100);
  let h = n * 4.5 * edge + flat * 0.6;
  // carve a gentle depression for the main courtyard
  const court = Math.exp(-(x * x + (z + 2) * (z + 2)) / 120);
  h -= court * 0.8;
  return Math.floor(h);
}

function islandBottom(x, z) {
  const r = Math.sqrt(x * x + z * z);
  if (r > ISLAND_R) return 0;
  const t = 1 - Math.pow(r / ISLAND_R, 1.8);
  return -Math.floor(t * 11 + 2 + fbm(x - 50, z - 50) * 2);
}

function buildIsland() {
  for (let x = -ISLAND_R - 2; x <= ISLAND_R + 2; x++) {
    for (let z = -ISLAND_R - 2; z <= ISLAND_R + 2; z++) {
      const top = islandTop(x, z);
      if (top < -10) continue;
      const r = Math.sqrt(x * x + z * z);
      if (r > ISLAND_R + 0.5) continue;

      const bot = islandBottom(x, z);
      // fill solid from bot to top (island is small enough)
      for (let y = bot; y <= top; y++) {
        let col;
        if (y === top) {
          col = (hash2(x, z) > 0.82) ? C.MOSS : (hash2(x * 2, z * 2) > 0.5 ? C.GRASS1 : C.GRASS2);
        } else if (y >= top - 2) {
          col = C.DIRT;
        } else {
          col = (hash2(x * 3, z * 3) > 0.5) ? C.STONE : C.STONE_D;
        }
        addV(x, y, z, col);
      }
    }
  }

  // stalactites on the underside near the rim
  for (let i = 0; i < 70; i++) {
    const ang = hash2(i, 7) * Math.PI * 2;
    const rad = ISLAND_R * (0.55 + hash2(i, 13) * 0.4);
    const sx = Math.round(Math.cos(ang) * rad);
    const sz = Math.round(Math.sin(ang) * rad);
    const sy = islandBottom(sx, sz);
    const len = 2 + Math.floor(hash2(i, 21) * 5);
    for (let d = 0; d < len; d++) {
      addV(sx, sy - d, sz, d % 3 === 0 ? C.STONE_L : C.STONE);
    }
  }

  // scattered surface rocks
  for (let i = 0; i < 24; i++) {
    const ang = hash2(i, 99) * Math.PI * 2;
    const rad = 6 + hash2(i, 88) * 18;
    const rx = Math.round(Math.cos(ang) * rad);
    const rz = Math.round(Math.sin(ang) * rad);
    const ry = islandTop(rx, rz);
    if (ry < -10) continue;
    const s = 1 + Math.floor(hash2(i, 77) * 2);
    addBox(rx - s, ry + 1, rz - s, rx + s, ry + s, rz + s, C.ROCK);
  }
}

// ============================================================
//  Roof helpers (voxel Japanese roofs)
// ============================================================

// Hip roof (寄栋造) — four sloping sides, stepped pyramid to a ridge
// cx,cz center; baseY = y of lowest eave layer; halfW/halfD footprint;
// layers = roof height; eave = overhang in blocks
function addHipRoof(cx, baseY, cz, halfW, halfD, layers, roofCol, edgeCol, eave) {
  eave = eave ?? 2;
  for (let h = 0; h < layers; h++) {
    const sh = Math.min(h, halfW + eave - 1);
    const sd = Math.min(h, halfD + eave - 1);
    const x0 = cx - halfW - eave + sh;
    const x1 = cx + halfW + eave - sh;
    const z0 = cz - halfD - eave + sd;
    const z1 = cz + halfD + eave - sd;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const isEdge = (x === x0 || x === x1 || z === z0 || z === z1);
        addV(x, baseY + h, z, isEdge && h === 0 ? edgeCol : roofCol);
      }
    }
  }
}

// Gable roof (切妻造) — ridge runs along X axis; slopes on ±Z
function addGableRoofX(cx, baseY, cz, halfW, halfD, layers, roofCol, edgeCol, eave) {
  eave = eave ?? 2;
  for (let h = 0; h < layers; h++) {
    const sd = Math.min(h, halfD + eave - 1);
    const z0 = cz - halfD - eave + sd;
    const z1 = cz + halfD + eave - sd;
    const x0 = cx - halfW - eave;
    const x1 = cx + halfW + eave;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const isEdge = (z === z0 || z === z1 || x === x0 || x === x1);
        addV(x, baseY + h, z, isEdge && h === 0 ? edgeCol : roofCol);
      }
    }
  }
}

// upturned eave corners — add small lifted blocks at four corners
function addEaveCorners(cx, baseY, cz, halfW, halfD, eave, col) {
  const y = baseY + 1;
  const x0 = cx - halfW - eave, x1 = cx + halfW + eave;
  const z0 = cz - halfD - eave, z1 = cz + halfD + eave;
  addV(x0, y, z0, col); addV(x1, y, z0, col);
  addV(x0, y, z1, col); addV(x1, y, z1, col);
  addV(x0, y + 1, z0, col); addV(x1, y + 1, z0, col);
  addV(x0, y + 1, z1, col); addV(x1, y + 1, z1, col);
}

// ============================================================
//  Building parts
// ============================================================

// vermillion pillar column
function addPillar(x, y0, z, h, col) {
  for (let y = y0; y < y0 + h; y++) addV(x, y, z, col || C.VERM);
}

// stone lantern (tōrō)
function addStoneLantern(cx, cy, cz) {
  addV(cx, cy, cz, C.STONE_D);           // base
  addV(cx, cy + 1, cz, C.STONE);         // post
  addV(cx, cy + 2, cz, C.STONE_L);       // platform
  addBox(cx - 1, cy + 3, cz - 1, cx + 1, cy + 4, cz + 1, C.STONE); // light box
  addV(cx, cy + 3, cz, C.GLOW);          // glow center
  addBox(cx - 1, cy + 5, cz - 1, cx + 1, cy + 5, cz + 1, C.STONE_D); // cap
  addV(cx, cy + 6, cz, C.STONE_L);       // jewel top
}

// ============================================================
//  1. Main Hall 本堂 (入母屋造 hip-and-gable)
// ============================================================
function buildMainHall(cx, cz) {
  const y0 = islandTop(cx, cz) + 1;
  const W = 15, D = 11;          // footprint half-dimensions
  const hx = Math.floor(W / 2), hz = Math.floor(D / 2);

  // stone platform (kidan)
  addBox(cx - hx - 1, y0, cz - hz - 1, cx + hx + 1, y0 + 1, cz + hz + 1, C.STONE_D);
  addBox(cx - hx - 1, y0 + 1, cz - hz - 1, cx + hx + 1, y0 + 1, cz + hz + 1, C.STONE_L);
  // dark wood floor
  addBox(cx - hx, y0 + 2, cz - hz, cx + hx, y0 + 2, cz + hz, C.WOOD_D);

  const baseY = y0 + 3;         // pillar base level
  const pH = 6;                 // pillar height

  // perimeter pillars — vermillion, evenly spaced
  const pStep = 3;
  for (let x = -hx; x <= hx; x += pStep) {
    addPillar(cx + x, baseY, cz - hz, pH);
    addPillar(cx + x, baseY, cz + hz, pH);
  }
  for (let z = -hz + pStep; z < hz; z += pStep) {
    addPillar(cx - hx, baseY, cz + z, pH);
    addPillar(cx + hx, baseY, cz + z, pH);
  }

  // white walls between pillars (土壁) — fill bays, leave central door
  for (let x = -hx; x <= hx; x++) {
    for (let y = 0; y < pH - 1; y++) {
      // front wall with central opening
      if (Math.abs(x) > 1 || y < 2) {
        addV(cx + x, baseY + y, cz - hz, C.WALL);
      }
      addV(cx + x, baseY + y, cz + hz, C.WALL);
    }
  }
  for (let z = -hz + 1; z < hz; z++) {
    for (let y = 0; y < pH - 1; y++) {
      addV(cx - hx, baseY + y, cz + z, C.WALL);
      addV(cx + hx, baseY + y, cz + z, C.WALL);
    }
  }
  // lattice suggestion (dark wood strips on front)
  for (let x = -hx; x <= hx; x += 2) {
    if (Math.abs(x) <= 1) continue;
    addV(cx + x, baseY + pH - 2, cz - hz, C.WOOD_D);
  }

  // interior floor (dark wood) & ceiling beam
  addBox(cx - hx + 1, baseY, cz - hz + 1, cx + hx - 1, baseY, cz + hz - 1, C.WOOD_D);
  addBox(cx - hx, baseY + pH - 1, cz - hz, cx + hx, baseY + pH - 1, cz + hz, C.WOOD);

  // bracket complexes (组物) under eaves — small blocks
  const eaveY = baseY + pH;
  for (let x = -hx - 1; x <= hx + 1; x += 2) {
    addV(cx + x, eaveY, cz - hz - 1, C.WOOD_D);
    addV(cx + x, eaveY, cz + hz + 1, C.WOOD_D);
  }
  for (let z = -hz; z <= hz; z += 2) {
    addV(cx - hx - 1, eaveY, cz + z, C.WOOD_D);
    addV(cx + hx + 1, eaveY, cz + z, C.WOOD_D);
  }

  // main hip roof (lower, broad)
  const roofY = eaveY + 1;
  addHipRoof(cx, roofY, cz, hx, hz, 6, C.ROOF, C.ROOF_E, 3);
  addEaveCorners(cx, roofY, cz, hx, hz, 3, C.ROOF_L);

  // upper gable section (入母屋造 gable on top of hip)
  const gableY = roofY + 4;
  const gW = hx - 3, gD = 2;
  for (let h = 0; h < 3; h++) {
    const z0 = cz - gD - h;
    const z1 = cz + gD + h;
    for (let x = cx - gW; x <= cx + gW; x++) {
      for (let z = z0; z <= z1; z++) {
        addV(x, gableY + h, z, h === 0 ? C.ROOF_E : C.ROOF);
      }
    }
  }
  // ridge tile
  addBox(cx - gW, gableY + 3, cz - 1, cx + gW, gableY + 3, cz + 1, C.ROOF_E);
  // ridge ornaments (shibi)
  addV(cx - gW, gableY + 4, cz, C.ROOF_L);
  addV(cx + gW, gableY + 4, cz, C.ROOF_L);

  // entrance steps
  for (let s = 0; s < 3; s++) {
    addBox(cx - 2 - s, y0 + 1 - s, cz - hz - 2 - s, cx + 2 + s, y0 + 1 - s, cz - hz - 2 - s, C.STONE_L);
  }
}

// ============================================================
//  2. Three-tier Pagoda 三重塔
// ============================================================
function buildPagoda(cx, cz) {
  let y = islandTop(cx, cz) + 1;

  // stone base
  addBox(cx - 4, y, cz - 4, cx + 4, y + 1, cz + 4, C.STONE_D);
  addBox(cx - 3, y + 1, cz - 3, cx + 3, y + 1, cz + 3, C.STONE_L);
  y += 2;

  const tiers = [
    { half: 3, wallH: 4, roofH: 3, eave: 3 },
    { half: 2, wallH: 3, roofH: 2, eave: 3 },
    { half: 1, wallH: 3, roofH: 2, eave: 2 },
  ];

  for (let t = 0; t < tiers.length; t++) {
    const cfg = tiers[t];
    const hx = cfg.half;

    // four corner pillars
    addPillar(cx - hx, y, cz - hx, cfg.wallH);
    addPillar(cx + hx, y, cz - hx, cfg.wallH);
    addPillar(cx - hx, y, cz + hx, cfg.wallH);
    addPillar(cx + hx, y, cz + hx, cfg.wallH);

    // walls between pillars
    for (let i = -hx + 1; i <= hx - 1; i++) {
      for (let wy = 0; wy < cfg.wallH - 1; wy++) {
        addV(cx + i, y + wy, cz - hx, C.WALL);
        addV(cx + i, y + wy, cz + hx, C.WALL);
        addV(cx - hx, y + wy, cz + i, C.WALL);
        addV(cx + hx, y + wy, cz + i, C.WALL);
      }
    }
    // floor / ceiling
    addBox(cx - hx, y, cz - hx, cx + hx, y, cz + hx, C.WOOD_D);
    addBox(cx - hx, y + cfg.wallH - 1, cz - hx, cx + hx, y + cfg.wallH - 1, cz + hx, C.WOOD);

    // railing (handrail) around tier
    if (t > 0) {
      for (let i = -hx - 1; i <= hx + 1; i++) {
        addV(cx + i, y - 1, cz - hx - 1, C.VERM);
        addV(cx + i, y - 1, cz + hx + 1, C.VERM);
        addV(cx - hx - 1, y - 1, cz + i, C.VERM);
        addV(cx + hx + 1, y - 1, cz + i, C.VERM);
      }
    }

    // square hip roof with deep eaves
    const roofY = y + cfg.wallH;
    addHipRoof(cx, roofY, cz, hx, hx, cfg.roofH, C.ROOF, C.ROOF_E, cfg.eave);
    addEaveCorners(cx, roofY, cz, hx, hx, cfg.eave, C.ROOF_L);

    y = roofY + cfg.roofH;
  }

  // golden sōrin (塔刹)
  addV(cx, y, cz, C.GOLD_D);
  addV(cx, y + 1, cz, C.GOLD);
  // rings (kurin)
  for (let r = 0; r < 4; r++) {
    const ry = y + 2 + r;
    const rad = 1 - Math.floor(r / 2);
    for (let dx = -rad; dx <= rad; dx++)
      for (let dz = -rad; dz <= rad; dz++)
        if (Math.abs(dx) === rad || Math.abs(dz) === rad)
          addV(cx + dx, ry, cz + dz, r % 2 ? C.GOLD : C.GOLD_D);
  }
  // water-flame & jewel
  addV(cx, y + 6, cz, C.GOLD);
  addV(cx, y + 7, cz, C.GOLD_D);
  addV(cx, y + 8, cz, C.GOLD);
}

// ============================================================
//  3. Side Hall 配殿 (切妻造 gable roof, symmetric pair)
// ============================================================
function buildSideHall(cx, cz) {
  const y0 = islandTop(cx, cz) + 1;
  const hx = 4, hz = 3;

  // platform
  addBox(cx - hx - 1, y0, cz - hz - 1, cx + hx + 1, y0 + 1, cz + hz + 1, C.STONE_D);
  addBox(cx - hx, y0 + 1, cz - hz, cx + hx, y0 + 1, cz + hz, C.WOOD_D);

  const baseY = y0 + 2;
  const pH = 4;

  // pillars
  addPillar(cx - hx, baseY, cz - hz, pH);
  addPillar(cx + hx, baseY, cz - hz, pH);
  addPillar(cx - hx, baseY, cz + hz, pH);
  addPillar(cx + hx, baseY, cz + hz, pH);
  addPillar(cx, baseY, cz - hz, pH);
  addPillar(cx, baseY, cz + hz, pH);

  // walls
  for (let x = -hx; x <= hx; x++) {
    for (let wy = 0; wy < pH - 1; wy++) {
      if (x !== 0 || wy < 2) addV(cx + x, baseY + wy, cz - hz, C.WALL);
      addV(cx + x, baseY + wy, cz + hz, C.WALL);
    }
  }
  for (let z = -hz + 1; z < hz; z++) {
    for (let wy = 0; wy < pH - 1; wy++) {
      addV(cx - hx, baseY + wy, cz + z, C.WALL);
      addV(cx + hx, baseY + wy, cz + z, C.WALL);
    }
  }
  addBox(cx - hx, baseY + pH - 1, cz - hz, cx + hx, baseY + pH - 1, cz + hz, C.WOOD);

  // gable roof (ridge along X, facing the courtyard)
  const roofY = baseY + pH;
  addGableRoofX(cx, roofY, cz, hx, hz, 4, C.ROOF, C.ROOF_E, 2);
  addEaveCorners(cx, roofY, cz, hx, hz, 2, C.ROOF_L);
  // ridge
  addBox(cx - hx - 2, roofY + 3, cz - 1, cx + hx + 2, roofY + 3, cz + 1, C.ROOF_E);

  // small step
  addBox(cx - 1, y0, cz - hz - 1, cx + 1, y0, cz - hz - 1, C.STONE_L);
}

// ============================================================
//  4. Sanmon 山门 (two-storey gate with karahafu)
// ============================================================
function buildSanmon(cx, cz) {
  const y0 = islandTop(cx, cz) + 1;
  const hx = 4, hz = 2;

  // stone base
  addBox(cx - hx - 1, y0, cz - hz - 1, cx + hx + 1, y0 + 1, cz + hz + 1, C.STONE_D);
  addBox(cx - hx, y0 + 1, cz - hz, cx + hx, y0 + 1, cz + hz, C.STONE_L);

  const baseY = y0 + 2;
  const pH = 5;

  // eight pillars (4 front, 4 back) — 八脚門 style
  for (let x = -hx; x <= hx; x += 2) {
    addPillar(cx + x, baseY, cz - hz, pH);
    addPillar(cx + x, baseY, cz + hz, pH);
  }
  // side walls (leave central passage open on ±Z)
  for (let z = -hz; z <= hz; z++) {
    for (let wy = 0; wy < pH - 1; wy++) {
      addV(cx - hx, baseY + wy, cz + z, C.WALL);
      addV(cx + hx, baseY + wy, cz + z, C.WALL);
    }
  }
  // upper floor walls (second storey)
  for (let x = -hx + 1; x <= hx - 1; x++) {
    for (let wy = 2; wy < pH - 1; wy++) {
      addV(cx + x, baseY + wy, cz - hz, C.WALL);
      addV(cx + x, baseY + wy, cz + hz, C.WALL);
    }
  }
  // beams
  addBox(cx - hx, baseY + pH - 1, cz - hz, cx + hx, baseY + pH - 1, cz + hz, C.WOOD);
  addBox(cx - hx, baseY + 1, cz - hz, cx + hx, baseY + 1, cz + hz, C.WOOD_D);

  // lower hip roof
  const roofY = baseY + pH;
  addHipRoof(cx, roofY, cz, hx, hz, 3, C.ROOF, C.ROOF_E, 2);

  // karahafu (唐破风) — curved arched gable on front (cz - hz side)
  const kfY = roofY;
  const kfZ = cz - hz - 2;
  const kfW = 3;
  for (let x = -kfW; x <= kfW; x++) {
    const archH = Math.round(2.5 * Math.cos((x / kfW) * Math.PI / 2));
    for (let dy = 0; dy <= archH; dy++) {
      addV(cx + x, kfY + dy, kfZ, dy === archH ? C.ROOF_E : C.ROOF);
    }
  }
  // karahafu eave lip
  addBox(cx - kfW, kfY, kfZ - 1, cx + kfW, kfY, kfZ - 1, C.ROOF_E);
  addV(cx, kfY + 3, kfZ, C.ROOF_L);

  // upper roof (smaller gable on top)
  const uY = roofY + 3;
  addGableRoofX(cx, uY, cz, hx - 1, 1, 2, C.ROOF, C.ROOF_E, 1);
  addBox(cx - hx, uY + 2, cz - 1, cx + hx, uY + 2, cz + 1, C.ROOF_E);
}

// ============================================================
//  5. Chōzuya 手水舍 (water ablution pavilion)
// ============================================================
function buildChozuya(cx, cz) {
  const y0 = islandTop(cx, cz) + 1;
  const hx = 2, hz = 2;

  // stone platform
  addBox(cx - hx - 1, y0, cz - hz - 1, cx + hx + 1, y0 + 1, cz + hz + 1, C.STONE_D);
  addBox(cx - hx, y0 + 1, cz - hz, cx + hx, y0 + 1, cz + hz, C.STONE_L);

  const baseY = y0 + 2;
  const pH = 3;

  // four pillars
  addPillar(cx - hx, baseY, cz - hz, pH, C.WOOD);
  addPillar(cx + hx, baseY, cz - hz, pH, C.WOOD);
  addPillar(cx - hx, baseY, cz + hz, pH, C.WOOD);
  addPillar(cx + hx, baseY, cz + hz, pH, C.WOOD);

  // open on all sides; low rail
  addBox(cx - hx, baseY, cz - hz, cx + hx, baseY, cz + hz, C.WOOD_D);
  for (let x = -hx; x <= hx; x++) {
    addV(cx + x, baseY, cz - hz, C.WOOD);
    addV(cx + x, baseY, cz + hz, C.WOOD);
  }
  addBox(cx - hx, baseY + pH - 1, cz - hz, cx + hx, baseY + pH - 1, cz + hz, C.WOOD);

  // small hip roof
  const roofY = baseY + pH;
  addHipRoof(cx, roofY, cz, hx, hz, 2, C.ROOF_L, C.ROOF_E, 1);

  // water basin (chōzubachi) in center
  addBox(cx - 1, baseY + 1, cz - 1, cx + 1, baseY + 1, cz + 1, C.STONE_D);
  addV(cx, baseY + 2, cz, C.WATER);
  // bamboo ladle suggestion
  addV(cx + 1, baseY + 2, cz, C.WOOD_L);
}

// ============================================================
//  Path & garden
// ============================================================
function buildPath() {
  // sandō (参道) from sanmon (z=+20) to main hall (z=-4), 3 wide
  for (let z = -3; z <= 20; z++) {
    for (let x = -1; x <= 1; x++) {
      const y = islandTop(x, z);
      if (y < -10) continue;
      // don't overwrite building platforms; only place on grass
      const key = x + ',' + (y + 1) + ',' + z;
      if (voxelMap.has(key)) continue;
      addV(x, y + 1, z, (x + z) % 2 === 0 ? C.PATH : C.PATH_D);
    }
  }
  // stepping stones leading off the path edges
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = 2 + i * 1.5;
    const x = side * (3 + (i % 3));
    const y = islandTop(Math.round(x), Math.round(z));
    if (y > -10) addV(Math.round(x), y + 1, Math.round(z), C.STONE_L);
  }
}

// karesansui (枯山水) raked garden beside east side hall
function buildKaresansui(cx, cz) {
  const y0 = islandTop(cx, cz) + 1;
  for (let x = -4; x <= 4; x++) {
    for (let z = -3; z <= 3; z++) {
      const d = Math.sqrt(x * x + z * z);
      if (d > 4.5) continue;
      // raked pattern — concentric rings via alternating shades
      const ring = Math.floor(d * 2) % 2;
      addV(cx + x, y0, cz + z, ring ? C.SAND : C.SAND_D);
    }
  }
  // rock groupings
  addBox(cx - 2, y0 + 1, cz - 1, cx - 1, y0 + 2, cz, C.STONE_D);
  addV(cx - 1, y0 + 3, cz - 1, C.STONE);
  addBox(cx + 2, y0 + 1, cz + 1, cx + 3, y0 + 1, cz + 2, C.STONE);
  addV(cx + 2, y0 + 2, cz + 1, C.STONE_L);
  addV(cx, y0 + 1, cz + 2, C.STONE_D);
  // moss patch
  addV(cx + 1, y0 + 1, cz - 2, C.MOSS);
  addV(cx, y0 + 1, cz - 2, C.MOSS);
}

// ============================================================
//  Torii 鳥居 (vermillion shrine gate at island edge)
// ============================================================
function addTorii(cx, cz) {
  const y0 = islandTop(cx, cz) + 1;
  const h = 7;
  // two pillars
  for (let y = 0; y < h; y++) {
    addV(cx - 2, y0 + y, cz, C.VERM);
    addV(cx + 2, y0 + y, cz, C.VERM);
  }
  // upper beam (kasagi) with upturned ends
  addBox(cx - 4, y0 + h, cz - 1, cx + 4, y0 + h, cz + 1, C.VERM);
  addBox(cx - 4, y0 + h + 1, cz, cx - 3, y0 + h + 1, cz, C.VERM_L);
  addBox(cx + 3, y0 + h + 1, cz, cx + 4, y0 + h + 1, cz, C.VERM_L);
  addV(cx - 4, y0 + h + 2, cz, C.VERM_L);
  addV(cx + 4, y0 + h + 2, cz, C.VERM_L);
  // second beam (nuki)
  addBox(cx - 3, y0 + h - 2, cz, cx + 3, y0 + h - 2, cz, C.VERM);
  // central plaque
  addBox(cx - 1, y0 + h - 1, cz, cx + 1, y0 + h - 1, cz, C.WALL);
}

// ============================================================
//  Trees
// ============================================================
function addCherryTree(cx, cz, scale) {
  scale = scale || 1;
  const y0 = islandTop(cx, cz) + 1;
  const trunkH = 4 + Math.floor(scale);
  // trunk
  for (let y = 0; y < trunkH; y++) addV(cx, y0 + y, cz, C.TRUNK);
  addV(cx + 1, y0 + trunkH - 1, cz, C.TRUNK);
  // canopy — roundish blob of pink voxels
  const cy = y0 + trunkH;
  const R = 3 + Math.floor(scale);
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -1; dy <= R - 1; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        const d = Math.sqrt(dx * dx + dy * dy * 1.1 + dz * dz);
        if (d > R - 0.3) continue;
        if (d > R - 1.3 && hash2(cx + dx * 7, cz + dz * 13 + dy) > 0.55) continue;
        const r = hash2(cx + dx, cz + dz + dy * 3);
        const col = r > 0.7 ? C.CHERRY3 : r > 0.35 ? C.CHERRY1 : C.CHERRY2;
        addV(cx + dx, cy + dy, cz + dz, col);
      }
    }
  }
}

function addPineTree(cx, cz, scale) {
  scale = scale || 1;
  const y0 = islandTop(cx, cz) + 1;
  const trunkH = 5 + Math.floor(scale * 2);
  for (let y = 0; y < trunkH; y++) addV(cx, y0 + y, cz, C.TRUNK);
  // conical layered canopy
  for (let layer = 0; layer < 4; layer++) {
    const ly = y0 + trunkH - 2 + layer;
    const R = 3 - layer + Math.floor(scale * 0.5);
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > R) continue;
        if (d > R - 1 && hash2(cx + dx + layer, cz + dz) > 0.5) continue;
        const col = layer % 2 ? C.PINE1 : C.PINE2;
        addV(cx + dx, ly, cz + dz, col);
      }
    }
  }
  addV(cx, y0 + trunkH + 2, cz, C.PINE3);
}

// ============================================================
//  Build everything
// ============================================================
buildIsland();

// buildings
buildMainHall(0, -4);
buildPagoda(15, -8);
buildSideHall(-10, 3);
buildSideHall(10, 3);
buildSanmon(0, 19);
buildChozuya(-6, 12);

// path & garden
buildPath();
buildKaresansui(14, 6);

// torii at island edges
addTorii(-18, -10);
addTorii(19, 12);

// stone lanterns along the sandō
addStoneLantern(-3, islandTop(-3, 8) + 1, 8);
addStoneLantern(3, islandTop(3, 8) + 1, 8);
addStoneLantern(-4, islandTop(-4, 15) + 1, 15);
addStoneLantern(4, islandTop(4, 15) + 1, 15);
addStoneLantern(-12, islandTop(-12, -2) + 1, -2);
addStoneLantern(12, islandTop(12, -2) + 1, -2);
addStoneLantern(0, islandTop(0, -14) + 1, -14);

// warm glow point lights at a couple of lanterns
function addLanternGlow(x, y, z) {
  const pl = new THREE.PointLight(0xFFB74D, 0.7, 10, 2);
  pl.position.set(x + 0.5, y + 3.5, z + 0.5);
  scene.add(pl);
}
addLanternGlow(-3, islandTop(-3, 8), 8);
addLanternGlow(3, islandTop(3, 8), 8);

// trees — cherry & pine scattered around the island
const treeSpots = [
  [-16, 4, 'c', 1], [-20, -4, 'p', 1], [12, -16, 'c', 1],
  [-8, -16, 'p', 1], [20, 0, 'c', 0], [-22, 8, 'p', 1],
  [6, 16, 'c', 0], [-14, 14, 'p', 0], [16, 8, 'c', 1],
  [-6, -12, 'c', 1], [10, -18, 'p', 1], [-18, -16, 'c', 0],
  [22, -6, 'p', 0], [-24, 0, 'c', 0], [0, -22, 'p', 1],
  [8, -10, 'c', 0], [-12, 8, 'c', 0],
];
for (const [tx, tz, type, sc] of treeSpots) {
  if (type === 'c') addCherryTree(tx, tz, sc);
  else addPineTree(tx, tz, sc);
}

// small pond behind main hall
{
  const px = 0, pz = -16;
  const py = islandTop(px, pz) + 1;
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -1; dz <= 1; dz++)
      if (dx * dx + dz * dz * 2 <= 5)
        addV(px + dx, py, pz + dz, C.WATER);
  // pond edge stones
  addV(px - 3, py, pz, C.STONE_D);
  addV(px + 3, py, pz, C.STONE_D);
  addV(px, py, pz - 2, C.STONE);
  addV(px, py, pz + 2, C.STONE);
}

// build all instanced meshes
const voxelCount = buildVoxelMeshes();

// ============================================================
//  Cloud sea (particles below the island)
// ============================================================
const CLOUD_COUNT = 2600;
const cloudGeo = new THREE.BufferGeometry();
const cloudPos = new Float32Array(CLOUD_COUNT * 3);
const cloudSpeed = new Float32Array(CLOUD_COUNT);
for (let i = 0; i < CLOUD_COUNT; i++) {
  const ang = Math.random() * Math.PI * 2;
  const rad = 10 + Math.random() * 70;
  cloudPos[i * 3]     = Math.cos(ang) * rad;
  cloudPos[i * 3 + 1] = -12 - Math.random() * 28;
  cloudPos[i * 3 + 2] = Math.sin(ang) * rad;
  cloudSpeed[i] = 0.15 + Math.random() * 0.35;
}
cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
const cloudMat = new THREE.PointsMaterial({
  color: 0xFFFFFF, size: 2.2, transparent: true, opacity: 0.55,
  depthWrite: false, sizeAttenuation: true,
});
const clouds = new THREE.Points(cloudGeo, cloudMat);
scene.add(clouds);

// a few larger cloud puffs (soft sprites)
function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  g.addColorStop(0, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.5, 'rgba(255,250,245,0.35)');
  g.addColorStop(1, 'rgba(255,250,245,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const cloudTex = makeCloudTexture();
const cloudPuffs = [];
for (let i = 0; i < 28; i++) {
  const mat = new THREE.SpriteMaterial({
    map: cloudTex, transparent: true, opacity: 0.5 + Math.random() * 0.25,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  const ang = Math.random() * Math.PI * 2;
  const rad = 15 + Math.random() * 50;
  sp.position.set(Math.cos(ang) * rad, -14 - Math.random() * 18, Math.sin(ang) * rad);
  const s = 14 + Math.random() * 18;
  sp.scale.set(s, s * 0.55, 1);
  sp.userData.speed = 0.08 + Math.random() * 0.12;
  scene.add(sp);
  cloudPuffs.push(sp);
}

// ============================================================
//  Cherry blossom petal particles
// ============================================================
const PETAL_COUNT = 350;
const petalGeo = new THREE.BufferGeometry();
const petalPos = new Float32Array(PETAL_COUNT * 3);
const petalData = [];
for (let i = 0; i < PETAL_COUNT; i++) {
  petalPos[i * 3]     = (Math.random() - 0.5) * 70;
  petalPos[i * 3 + 1] = 4 + Math.random() * 22;
  petalPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  petalData.push({
    fall: 0.18 + Math.random() * 0.3,
    sway: 0.4 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
  });
}
petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));

function makePetalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#F8BBD0';
  ctx.beginPath();
  ctx.ellipse(16, 16, 7, 4, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F48FB1';
  ctx.beginPath();
  ctx.ellipse(16, 16, 3, 1.5, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}
const petalMat = new THREE.PointsMaterial({
  map: makePetalTexture(), size: 0.7, transparent: true, opacity: 0.9,
  depthWrite: false, sizeAttenuation: true, alphaTest: 0.1,
});
const petals = new THREE.Points(petalGeo, petalMat);
scene.add(petals);

// ============================================================
//  Distant misty mountain silhouettes
// ============================================================
{
  const shape = new THREE.Shape();
  shape.moveTo(-200, -5);
  const peaks = [
    [-160, 22], [-130, 8], [-100, 30], [-65, 12], [-30, 26],
    [0, 6], [35, 24], [70, 10], [110, 28], [150, 9], [190, 20],
  ];
  for (const [px, py] of peaks) shape.lineTo(px, py);
  shape.lineTo(200, -5);
  shape.lineTo(-200, -5);
  const mGeo = new THREE.ShapeGeometry(shape);
  const mMat = new THREE.MeshBasicMaterial({ color: 0x6B5A7A, transparent: true, opacity: 0.35, depthWrite: false, fog: true });
  const mountains = new THREE.Mesh(mGeo, mMat);
  mountains.position.set(0, -6, -90);
  scene.add(mountains);

  const m2Mat = new THREE.MeshBasicMaterial({ color: 0x8B7A9A, transparent: true, opacity: 0.22, depthWrite: false, fog: true });
  const mountains2 = new THREE.Mesh(mGeo, m2Mat);
  mountains2.position.set(0, -9, -130);
  mountains2.scale.set(1.3, 0.7, 1);
  scene.add(mountains2);
}

// ============================================================
//  UI buttons
// ============================================================
let autoRotate = true;
let petalsOn = true;
const btnRot = document.getElementById('btnRotate');
const btnPet = document.getElementById('btnPetals');
btnRot.addEventListener('click', () => {
  autoRotate = !autoRotate;
  controls.autoRotate = autoRotate;
  btnRot.textContent = '自动旋转: ' + (autoRotate ? '开' : '关');
});
btnPet.addEventListener('click', () => {
  petalsOn = !petalsOn;
  petals.visible = petalsOn;
  btnPet.textContent = '樱花: ' + (petalsOn ? '开' : '关');
});

// ============================================================
//  Resize
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
//  Animation loop
// ============================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  controls.update();

  // cherry petals fall + sway
  if (petalsOn) {
    const arr = petalGeo.attributes.position.array;
    for (let i = 0; i < PETAL_COUNT; i++) {
      const d = petalData[i];
      arr[i * 3 + 1] -= d.fall * dt * 3;
      arr[i * 3] += Math.sin(t * d.sway + d.phase) * dt * 0.6;
      arr[i * 3 + 2] += Math.cos(t * d.sway * 0.7 + d.phase) * dt * 0.4;
      if (arr[i * 3 + 1] < -8) {
        arr[i * 3]     = (Math.random() - 0.5) * 70;
        arr[i * 3 + 1] = 20 + Math.random() * 10;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 70;
      }
    }
    petalGeo.attributes.position.needsUpdate = true;
  }

  // cloud sea drift
  const cArr = cloudGeo.attributes.position.array;
  for (let i = 0; i < CLOUD_COUNT; i++) {
    cArr[i * 3] += cloudSpeed[i] * dt;
    cArr[i * 3 + 1] += Math.sin(t * 0.2 + i) * dt * 0.15;
    if (cArr[i * 3] > 80) cArr[i * 3] = -80;
  }
  cloudGeo.attributes.position.needsUpdate = true;

  for (const sp of cloudPuffs) {
    sp.position.x += sp.userData.speed * dt * 3;
    if (sp.position.x > 75) sp.position.x = -75;
  }

  renderer.render(scene, camera);
}

// hide loading screen then start
const loadingEl = document.getElementById('loading');
setTimeout(() => {
  loadingEl.style.opacity = '0';
  setTimeout(() => loadingEl.remove(), 800);
}, 300);

animate();
