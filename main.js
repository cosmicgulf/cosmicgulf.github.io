import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { MTLLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { RoomEnvironment } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js";
import { VRButton } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/webxr/VRButton.js";

const MODEL_OBJ = "./model.obj";
const MODEL_MTL = "./material.mtl";

// ✅ Only this text
const BIRTHDAY_TEXT = "Happy Birthday";

// ✅ Zoom limits (edit these)
const ZOOM_IN_LIMIT  = 3.00; // minDistance (can't zoom in closer than this)
const ZOOM_OUT_LIMIT = 4.00; // maxDistance

// Sparkle tuning (safe knobs)
const SPARKLE_COUNT = 100;
const SPARKLE_SIZE  = 6.5;
const SPARKLE_ALPHA = 0.30;

// --- Basic scene setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.045);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0.7, 0.55, 1.6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ✅ VR
renderer.xr.enabled = true;

document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// --- Environment lighting ---
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

// --- Orbit controls + zoom limits ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

controls.minDistance = ZOOM_IN_LIMIT;
controls.maxDistance = ZOOM_OUT_LIMIT;

// Optional: prevent panning
// controls.enablePan = false;

// --- Lights (bright & clean) ---
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
scene.add(new THREE.HemisphereLight(0xe8f2ff, 0x0b0b12, 1.1));

const key = new THREE.DirectionalLight(0xffffff, 3.1);
key.position.set(2.5, 4.0, 2.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 30;
key.shadow.camera.left = -5;
key.shadow.camera.right = 5;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -5;
key.shadow.bias = -0.0001;
scene.add(key);

const rim = new THREE.DirectionalLight(0xbad7ff, 1.6);
rim.position.set(-3.2, 2.2, -2.5);
scene.add(rim);

const fillA = new THREE.PointLight(0xffffff, 1.5, 25);
fillA.position.set(1.6, 1.3, 1.6);
scene.add(fillA);

const fillB = new THREE.PointLight(0xffe0c2, 1.2, 25);
fillB.position.set(-1.6, 1.0, 1.1);
scene.add(fillB);

// --- Floor ---
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x0a0b14, roughness: 0.9, metalness: 0.0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// --- Crisp text sprite (no bloom; outlined; always readable) ---
function makeTextSprite(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 2048;  // high res = sharp
  canvas.height = 512;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // No giant blur (keeps crisp)
  ctx.shadowBlur = 0;

  const x = canvas.width / 2;
  const y = canvas.height / 2;

  // Outline first
  ctx.font = "900 170px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.lineWidth = 22;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, x, y);

  // Fill text
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.fillText(text, x, y);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.25, 0.32, 1); // wide single-line sign
  sprite.renderOrder = 999;
  return sprite;
}

const birthdaySprite = makeTextSprite(BIRTHDAY_TEXT);
scene.add(birthdaySprite);

// --- Sparkles (subtle + clear zones so model/text remain visible) ---
function createSparkles(bounds, count, textY) {
  const size = new THREE.Vector3();
  bounds.getSize(size);

  const center = new THREE.Vector3();
  bounds.getCenter(center);

  const radius = Math.max(size.x, size.y, size.z) * 0.95 + 0.25;

  // Keep center clear (so face stays visible)
  const clearCylinderR = radius * 0.35;
  const clearY0 = center.y - size.y * 0.10;
  const clearY1 = center.y + size.y * 0.90;

  // Keep text area clear
  const textClearY0 = textY - 0.18;
  const textClearY1 = textY + 0.25;
  const textClearR  = radius * 0.75;

  const positions = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  const jitter = new Float32Array(count);

  let i = 0;
  let tries = 0;

  while (i < count && tries < count * 35) {
    tries++;

    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * Math.pow(Math.random(), 0.55);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * 0.85;
    const z = r * Math.sin(phi) * Math.sin(theta);

    const px = center.x + x;
    const py = center.y + y + 0.2;
    const pz = center.z + z;

    const dx = px - center.x;
    const dz = pz - center.z;
    const radial = Math.sqrt(dx * dx + dz * dz);

    if ((radial < clearCylinderR) && (py > clearY0) && (py < clearY1)) continue;
    if ((py > textClearY0 && py < textClearY1) && (radial < textClearR)) continue;

    positions[i * 3 + 0] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.8 + Math.random() * 1.4;
    jitter[i] = Math.random();

    i++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  geo.setAttribute("aJit", new THREE.BufferAttribute(jitter, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uSize: { value: SPARKLE_SIZE },
      uAlpha: { value: SPARKLE_ALPHA },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uSize;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aJit;
      varying float vTwinkle;

      void main() {
        vec3 p = position;
        float t = uTime * 0.55 * aSpeed;

        p.y += sin(t + aPhase) * (0.018 + 0.022 * aJit);
        p.x += cos(t * 0.9 + aPhase) * (0.012 + 0.018 * aJit);
        p.z += sin(t * 1.1 + aPhase) * (0.012 + 0.018 * aJit);

        vTwinkle = 0.5 + 0.5 * sin(uTime * aSpeed * 2.1 + aPhase);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        float dist = max(0.8, -mv.z);
        float ps = (uSize * uPixelRatio) * (1.0 / dist);
        ps = clamp(ps, 1.0, 10.0); // prevent huge blobs
        gl_PointSize = ps * (0.65 + 0.75 * vTwinkle);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uAlpha;
      varying float vTwinkle;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;

        float core = smoothstep(0.22, 0.0, d);
        float glow = smoothstep(0.5, 0.12, d);
        float a = uAlpha * (0.25 * core + 0.75 * glow) * (0.35 + 0.65 * vTwinkle);

        vec3 cool = vec3(0.65, 0.85, 1.0);
        vec3 warm = vec3(1.0, 0.78, 0.55);
        vec3 col = mix(cool, warm, vTwinkle);

        gl_FragColor = vec4(col, a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.renderOrder = 2;
  return points;
}

// --- Model loading ---
let sparklePoints = null;
const modelRoot = new THREE.Group();
scene.add(modelRoot);

const mtlLoader = new MTLLoader();
mtlLoader.setPath("./");

mtlLoader.load(
  MODEL_MTL,
  (materials) => {
    materials.preload();

    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);

    objLoader.load(
      MODEL_OBJ,
      (obj) => {
        obj.traverse((c) => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });

        // Center + scale
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);

        const center = new THREE.Vector3();
        box.getCenter(center);
        obj.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const desired = 0.7;
        const s = desired / (maxDim || 1);
        obj.scale.setScalar(s);

        // ✅ IMPORTANT: lift to sit on floor (fixes “only head visible”)
        const boxAfter = new THREE.Box3().setFromObject(obj);
        obj.position.y -= boxAfter.min.y;
        obj.position.y += 0.005;

        modelRoot.add(obj);

        // Bounds after scaling + lifting
        const scaledBox = new THREE.Box3().setFromObject(modelRoot);
        const newCenter = new THREE.Vector3();
        scaledBox.getCenter(newCenter);

        const newSize = new THREE.Vector3();
        scaledBox.getSize(newSize);

        controls.target.copy(newCenter).add(new THREE.Vector3(0, newSize.y * 0.25, 0));
        controls.update();

        // Place text above model
        birthdaySprite.position
          .copy(newCenter)
          .add(new THREE.Vector3(0, newSize.y * 0.92 + 0.35, 0));

        // Sparkles
        sparklePoints = createSparkles(scaledBox, SPARKLE_COUNT, birthdaySprite.position.y);
        scene.add(sparklePoints);

        // Set camera distance nicely + sync UI slider
        setCameraDistance(clampDistance(1.6));
      },
      undefined,
      (err) => console.error("OBJ load error:", err)
    );
  },
  undefined,
  (err) => console.error("MTL load error:", err)
);

// --- Zoom bar (slider) ---
const ui = document.getElementById("ui");
const zoom = document.getElementById("zoom");
const zoomVal = document.getElementById("zoomVal");

function clampDistance(d) {
  return Math.min(ZOOM_OUT_LIMIT, Math.max(ZOOM_IN_LIMIT, d));
}

function currentDistance() {
  return camera.position.distanceTo(controls.target);
}

function setCameraDistance(d) {
  d = clampDistance(d);
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target.clone().add(dir.multiplyScalar(d)));
  controls.update();

  zoom.value = String(d);
  zoomVal.textContent = d.toFixed(2);
}

// init slider limits + value
zoom.min = String(ZOOM_IN_LIMIT);
zoom.max = String(ZOOM_OUT_LIMIT);
zoom.value = String(clampDistance(parseFloat(zoom.value || "1.6")));
zoomVal.textContent = parseFloat(zoom.value).toFixed(2);

// slider -> camera
zoom.addEventListener("input", () => {
  setCameraDistance(parseFloat(zoom.value));
});

// camera -> slider (when user scroll zooms)
controls.addEventListener("change", () => {
  const d = clampDistance(currentDistance());
  zoom.value = String(d);
  zoomVal.textContent = d.toFixed(2);
});

// Hide UI in VR (since VR has its own controls)
renderer.xr.addEventListener("sessionstart", () => { if (ui) ui.style.display = "none"; });
renderer.xr.addEventListener("sessionend",   () => { if (ui) ui.style.display = "flex"; });

// --- Render loop (VR + normal) ---
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  controls.update();

  // Subtle sign pulse (still crisp)
  const pulse = 1.0 + 0.02 * Math.sin(t * 2.0);
  birthdaySprite.scale.set(1.25 * pulse, 0.32 * pulse, 1);

  // Gentle model motion
  modelRoot.rotation.y = 0.08 * Math.sin(t * 0.35);

  // Sparkle time
  if (sparklePoints?.material?.uniforms?.uTime) {
    sparklePoints.material.uniforms.uTime.value = t;
  }

  renderer.render(scene, camera);
});

// --- Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (sparklePoints?.material?.uniforms?.uPixelRatio) {
    sparklePoints.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
});
