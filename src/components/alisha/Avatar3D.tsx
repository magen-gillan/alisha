'use client';

/**
 * Avatar3D — "Galaxia anime girl" (Tatenashi, CC BY 4.0)
 * https://sketchfab.com/3d-models/galaxia-anime-girl-485f95459fa747fdbe42c87203e1a156
 *
 * LIVE-AVATAR MODE — deliberately NOT a free 3D viewer:
 *  - the camera is fixed; the user cannot drag, rotate or zoom the model,
 *  - all motion is generated in code on top of the model's 135 bones:
 *      · idle: breathing, slow head/neck/chest sway, eye drift + glances,
 *        light spring motion on the 35 hair + skirt joints,
 *      · idle showpieces (always running, speech or not): every 11-20s she
 *        turns around herself — a smooth full 360° spin or a half turn out
 *        and back — and every 7-14s she takes a step forward or backward,
 *        on top of a slow standing drift, a side weight shift and a
 *        breathing bob, all applied to the model root,
 *      · speaking: procedural hand gestures (waves, open palms, beat-synced
 *        emphasis) on top of the rhythmical head/neck/chest beats driven by
 *        a non-repeating pseudo-speech wave PLUS the real TTS word
 *        boundaries (`alisha:tts-boundary` events from lib/alisha/speech),
 *      · listening: soft head tilt toward the user, steadier gaze,
 *      · thinking: eyes and head lift slightly,
 *      · emotions (happy/sad/angry/surprised): short nod / head-shake
 *        gestures registered through onEmotionReady.
 *
 * The model has NO morph targets and NO jaw bone (verified), so there is
 * no lip movement — speech is expressed through body language instead.
 * All materials are converted to a 3-step toon ramp with an added rim
 * light; hair / eye materials get alphaTest cutouts (the GLB ships them
 * as OPAQUE even though their textures carry alpha).
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Emotion } from '@/lib/alisha/emotion';

interface Avatar3DProps {
  /** True while Web Speech API is reading the response out loud. */
  speaking: boolean;
  /** True while the microphone is open. */
  listening: boolean;
  /** True while waiting for the AI response. */
  thinking: boolean;
  /** Registers the emotion callback so chat buttons can trigger reactions. */
  onEmotionReady?: (setEmotion: (emotion: Emotion) => void) => void;
  /** URL of the .glb model (default: /models/alisha-3d.glb). */
  modelUrl?: string;
  /** Image shown when WebGL or the model fails (default: /alisha-new-icon.png). */
  fallbackImage?: string;
}

/** Verified against the GLB: every joint name carries a numeric suffix. */
const BONES = {
  head: /^J_Bip_C_Head_\d+$/,
  neck: /^J_Bip_C_Neck_\d+$/,
  chest: /^J_Bip_C_Chest_\d+$/,
  upperChest: /^J_Bip_C_UpperChest_\d+$/,
  hips: /^J_Bip_C_Hips_\d+$/,
  eyeL: /^J_Adj_L_FaceEye_\d+$/,
  eyeR: /^J_Adj_R_FaceEye_\d+$/,
  armUpperL: /^J_Bip_L_UpperArm_\d+$/,
  armUpperR: /^J_Bip_R_UpperArm_\d+$/,
  armLowerL: /^J_Bip_L_LowerArm_\d+$/,
  armLowerR: /^J_Bip_R_LowerArm_\d+$/,
  handL: /^J_Bip_L_Hand_\d+$/,
  handR: /^J_Bip_R_Hand_\d+$/,
} as const;

const AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
];

/**
 * The model ships in a bind T-pose. There are no animations to relax it,
 * so we rotate the upper arm in whichever local axis/sign lowers the hand
 * the most (auto-detected — bone axes differ between exporters), turning
 * the T-pose into a natural A-pose with a slight elbow bend.
 */
type Settle = { axis: THREE.Vector3; sign: number };

function settleArm(
  upper: THREE.Object3D | undefined,
  lower: THREE.Object3D | undefined,
  hand: THREE.Object3D | undefined,
): Settle | undefined {
  if (!upper || !hand) return undefined;
  const rest = upper.quaternion.clone();
  const y0 = hand.getWorldPosition(new THREE.Vector3()).y;
  let axis = AXES[2];
  let sign = 1;
  let bestDrop = -Infinity;
  for (const ax of AXES) {
    for (const s of [1, -1]) {
      tmpQ.setFromAxisAngle(ax, s * 0.5);
      upper.quaternion.copy(rest).multiply(tmpQ);
      upper.updateWorldMatrix(true, true);
      const drop = y0 - hand.getWorldPosition(new THREE.Vector3()).y;
      if (drop > bestDrop) {
        bestDrop = drop;
        axis = ax;
        sign = s;
      }
    }
  }
  upper.quaternion.copy(rest);
  tmpQ.setFromAxisAngle(axis, sign * 1.22);
  upper.quaternion.multiply(tmpQ);
  if (lower) {
    tmpQ.setFromAxisAngle(axis, sign * 0.14);
    lower.quaternion.multiply(tmpQ);
  }
  upper.updateWorldMatrix(true, true);
  return { axis: axis.clone(), sign };
}

/** 23 hair joints + 12 skirt joints — animated as light springs. */
const SWAY = /^(HairJoint-|J_Sec_[LR]_Skirt)/;

/** Materials whose textures need an alpha cutout (GLB ships them OPAQUE). */
const NEEDS_ALPHA = /_(HAIR|EYE)$/;

type Rig = { bone: THREE.Object3D; rest: THREE.Quaternion; phase: number };

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

function makeRig(bone: THREE.Object3D, phase = 0): Rig {
  return { bone, rest: bone.quaternion.clone(), phase };
}

function pose(rig: Rig | undefined, x: number, y: number, z: number) {
  if (!rig) return;
  tmpE.set(x, y, z);
  tmpQ.setFromEuler(tmpE);
  rig.bone.quaternion.copy(rig.rest).multiply(tmpQ);
}

/**
 * A posed arm: rest quaternions (captured AFTER the T-pose settle) plus the
 * settle axis/sign. Rotating OPPOSITE the settle axis opens/raises the arm,
 * rotating WITH it swings the forearm — this stays correct regardless of how
 * the exporter oriented the bone axes. `ortho` is perpendicular to `axis`
 * and is used for small variety twists.
 */
type ArmCtl = {
  upper: Rig;
  lower: Rig;
  hand: Rig;
  axis: THREE.Vector3;
  ortho: THREE.Vector3;
  sign: number;
};

function orthoOf(axis: THREE.Vector3): THREE.Vector3 {
  return Math.abs(axis.x) > 0.5
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
}

/**
 * One hand-gesture choreography slot. `p` is 0..1 through the gesture, `b`
 * the speech beat, `e` the attack/release envelope. Returns per-side euler
 * offsets [upperOpen, forearmSwing, upperTwist, handFlick] in radians.
 */
type Gesture = {
  dur: number;
  run: (p: number, b: number, e: number) => { L: number[]; R: number[] };
};

const NONE4 = [0, 0, 0, 0];

const GESTURES: Gesture[] = [
  // Right hand waves, wrist flicking — "hello / look at me".
  {
    dur: 2.8,
    run: (p, b, e) => ({
      L: NONE4,
      R: [
        0.18 * e,
        Math.sin(p * Math.PI * 5) * 0.5 * e * (0.35 + 0.65 * b),
        0.08 * e,
        Math.sin(p * Math.PI * 5 + 0.8) * 0.16 * e,
      ],
    }),
  },
  // Left hand waves.
  {
    dur: 2.8,
    run: (p, b, e) => ({
      L: [
        0.18 * e,
        Math.sin(p * Math.PI * 5 + 1) * 0.5 * e * (0.35 + 0.65 * b),
        -0.08 * e,
        Math.sin(p * Math.PI * 5 + 1.8) * 0.16 * e,
      ],
      R: NONE4,
    }),
  },
  // Both palms open outward with a gentle bob — "big explanation".
  {
    dur: 3.1,
    run: (p, b, e) => {
      const open = 0.16 * e + 0.05 * e * Math.sin(p * Math.PI * 2);
      const s = 0.14 * e * (0.3 + 0.7 * b) * Math.sin(p * Math.PI * 4);
      return { L: [open, s, 0.06 * e, 0], R: [open, s, -0.06 * e, 0] };
    },
  },
  // Right forearm pumps on every spoken beat — counting her points off.
  {
    dur: 2.6,
    run: (p, b, e) => ({
      L: NONE4,
      R: [
        0.1 * e,
        (0.22 * b + Math.sin(p * Math.PI * 4) * 0.18) * e,
        0.05 * e,
        0.1 * b * e,
      ],
    }),
  },
  // Both hands do small emphatic pumps together.
  {
    dur: 2.4,
    run: (p, b, e) => {
      const s = (0.2 * b + Math.sin(p * Math.PI * 6) * 0.1) * e;
      return {
        L: [0.08 * e, s, 0, 0.06 * b * e],
        R: [0.08 * e, s, 0, 0.06 * b * e],
      };
    },
  },
];

/** Applies one gesture frame to an arm chain (upper / forearm / hand). */
function gestureArm(c: ArmCtl | undefined, g: number[]) {
  if (!c) return;
  const [open, swing, twist, flick] = g;
  // Raise/open opposite the settle axis, with slight follow-through.
  tmpQ.setFromAxisAngle(c.axis, -c.sign * (open + swing * 0.15));
  c.upper.bone.quaternion.copy(c.upper.rest).multiply(tmpQ);
  if (twist) {
    tmpQ.setFromAxisAngle(c.ortho, twist);
    c.upper.bone.quaternion.multiply(tmpQ);
  }
  // Forearm swings WITH the settle axis (continues the natural bend).
  tmpQ.setFromAxisAngle(c.axis, c.sign * swing);
  c.lower.bone.quaternion.copy(c.lower.rest).multiply(tmpQ);
  tmpQ.setFromAxisAngle(c.axis, c.sign * flick);
  c.hand.bone.quaternion.copy(c.hand.rest).multiply(tmpQ);
}

/** 3-step ramp gives the cel-shaded lobby look. */
function makeToonRamp() {
  const data = new Uint8Array([150, 205, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function toToon(src: THREE.Material, ramp: THREE.Texture): THREE.Material {
  const old = src as THREE.MeshStandardMaterial;
  const cutout = NEEDS_ALPHA.test(old.name);
  const mat = new THREE.MeshToonMaterial({
    name: old.name,
    map: old.map ?? null,
    color: old.map ? 0xffffff : old.color,
    gradientMap: ramp,
    side: THREE.DoubleSide,
    alphaTest: cutout && old.map ? 0.35 : 0,
  });
  if (old.map) old.map.anisotropy = 4;

  // Rim light: brightens silhouette edges to lift her off the background.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(0x9ec5ff) };
    shader.uniforms.rimPower = { value: 3.0 };
    shader.uniforms.rimStrength = { value: 0.5 };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimStrength;\nvoid main() {',
      )
      .replace(
        '#include <dithering_fragment>',
        [
          'float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), rimPower);',
          'gl_FragColor.rgb += rimColor * rimF * rimStrength;',
          '#include <dithering_fragment>',
        ].join('\n'),
      );
  };
  mat.customProgramCacheKey = () => 'alisha-toon-rim';

  src.dispose();
  return mat;
}

export default function Avatar3D({
  speaking,
  listening,
  thinking,
  onEmotionReady,
  modelUrl = '/models/alisha-3d.glb',
  fallbackImage = '/alisha-new-icon.png',
}: Avatar3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(speaking);
  const listeningRef = useRef(listening);
  const thinkingRef = useRef(thinking);
  const emotionRef = useRef<Emotion | null>(null);
  const emotionStartRef = useRef(-1);
  const boundaryRef = useRef(0);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);
  useEffect(() => {
    thinkingRef.current = thinking;
  }, [thinking]);

  // Register the emotion gesture callback once.
  useEffect(() => {
    const setEmotion = (e: Emotion) => {
      emotionRef.current = e;
      emotionStartRef.current = -1; // stamped on the next rendered frame
    };
    onEmotionReady?.(setEmotion);
  }, [onEmotionReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;

    // NOTE: failed/ready are deliberately NOT reset here — a synchronous
    // setState inside the effect body is what react-hooks/set-state-in-
    // effect forbids. They only flip inside async callbacks below. The page
    // keeps `modelUrl` constant, and a fresh mount starts from fresh state.
    const makeRenderer = (): THREE.WebGLRenderer | null => {
      try {
        return new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });
      } catch {
        return null;
      }
    };
    const renderer = makeRenderer();
    if (!renderer) {
      queueMicrotask(() => setFailed(true));
      return;
    }

    // Weak-device adaptation: low deviceMemory or few CPU cores → render at
    // devicePixelRatio 1 to avoid memory-pressure kills in WebView on phones
    // like the Honor X6c. The flat toon look hides the resolution loss.
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak =
      (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) ||
      (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, weak ? 1 : isMobile ? 1.5 : 2),
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; // keeps flat anime colours true
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    // NOTE: no touch-action lock and no OrbitControls — nothing to drag,
    // touches pass through so the page keeps scrolling normally.

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

    // Lights: soft ambient + warm key from front-left + cool back light.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93c9, 1.6));
    const key = new THREE.DirectionalLight(0xfff1de, 2.4);
    key.position.set(1.5, 2.5, 3);
    scene.add(key);
    const back = new THREE.DirectionalLight(0x7aa8ff, 1.8);
    back.position.set(-2, 2, -3);
    scene.add(back);

    const ramp = makeToonRamp();
    const clock = new THREE.Clock();

    let head: Rig | undefined;
    let neck: Rig | undefined;
    let chest: Rig | undefined;
    let upperChest: Rig | undefined;
    let eyeL: Rig | undefined;
    let eyeR: Rig | undefined;
    let armUL: THREE.Object3D | undefined;
    let armUR: THREE.Object3D | undefined;
    let armLL: THREE.Object3D | undefined;
    let armLR: THREE.Object3D | undefined;
    let handL: THREE.Object3D | undefined;
    let handR: THREE.Object3D | undefined;
    const sway: Rig[] = [];
    let model: THREE.Object3D | null = null;
    let speak = 0; // smoothed 0..1
    let listen = 0;
    let think = 0;
    let hips: Rig | undefined;
    let ctlL: ArmCtl | undefined;
    let ctlR: ArmCtl | undefined;
    let basePos = new THREE.Vector3(); // framing position of the model root
    let modelH = 1.6; // model height in world units (from the bbox)

    // Idle-showpiece schedulers (all times are clock seconds).
    let turnNext = 5 + Math.random() * 4;
    let turnStart = -1;
    let turnDur = 3;
    let turnDir = 1;
    let turnFull = true;
    let stepNext = 3.5 + Math.random() * 4;
    let stepStart = -1;
    let stepDur = 2.6;
    let stepDir = 1;
    let stepAmp = 0;
    // Speaking-gesture scheduler.
    let gIdx = Math.floor(Math.random() * GESTURES.length);
    let gStart = 1.5;

    const frame = (obj: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const h = size.y;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      // Bust framing: head + shoulders + upper chest, headroom above the hair.
      const targetY = box.min.y + h * 0.78;
      const visH = h * 0.45;
      // On narrow phone screens the shoulder span limits how close we get.
      const needW = h * 0.3;
      const span = Math.max(visH, needW / camera.aspect);
      const dist = span / 2 / Math.tan(fov / 2);
      const center = box.getCenter(new THREE.Vector3());
      obj.position.x -= center.x;
      obj.position.z -= center.z;
      modelH = size.y;
      basePos.copy(obj.position);
      camera.position.set(0, targetY, dist);
      camera.lookAt(0, targetY, 0);
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (model) frame(model);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;

        model.traverse((o) => {
          const mesh = o as THREE.SkinnedMesh;
          if (mesh.isMesh) {
            mesh.frustumCulled = false; // skinned bounds are unreliable
            mesh.material = Array.isArray(mesh.material)
              ? mesh.material.map((m) => toToon(m, ramp))
              : toToon(mesh.material, ramp);
          }
          const n = o.name;
          if (BONES.head.test(n)) head = makeRig(o);
          else if (BONES.neck.test(n)) neck = makeRig(o);
          else if (BONES.chest.test(n)) chest = makeRig(o);
          else if (BONES.upperChest.test(n)) upperChest = makeRig(o);
          else if (BONES.hips.test(n)) hips = makeRig(o);
          else if (BONES.eyeL.test(n)) eyeL = makeRig(o);
          else if (BONES.eyeR.test(n)) eyeR = makeRig(o);
          else if (BONES.armUpperL.test(n)) armUL = o;
          else if (BONES.armUpperR.test(n)) armUR = o;
          else if (BONES.armLowerL.test(n)) armLL = o;
          else if (BONES.armLowerR.test(n)) armLR = o;
          else if (BONES.handL.test(n)) handL = o;
          else if (BONES.handR.test(n)) handR = o;
          else if (SWAY.test(n)) sway.push(makeRig(o, sway.length * 0.7));
        });

        // Relax the T-pose before the first frame, then capture the settled
        // pose as the rest pose for the gesture layer.
        model.updateMatrixWorld(true);
        const sL = settleArm(armUL, armLL, handL);
        const sR = settleArm(armUR, armLR, handR);
        if (armUL && armLL && handL && sL) {
          ctlL = {
            upper: makeRig(armUL),
            lower: makeRig(armLL),
            hand: makeRig(handL),
            axis: sL.axis,
            ortho: orthoOf(sL.axis),
            sign: sL.sign,
          };
        }
        if (armUR && armLR && handR && sR) {
          ctlR = {
            upper: makeRig(armUR),
            lower: makeRig(armLR),
            hand: makeRig(handR),
            axis: sR.axis,
            ortho: orthoOf(sR.axis),
            sign: sR.sign,
          };
        }

        scene.add(model);
        resize();
        // Read-only debug handle used by smoke tests.
        (window as unknown as Record<string, unknown>).__alisha3d = {
          yaw: () => (model ? model.rotation.y : 0),
          z: () => (model ? model.position.z - basePos.z : 0),
          armR: () =>
            ctlR ? ctlR.upper.bone.quaternion.angleTo(ctlR.upper.rest) : 0,
          turning: () => turnStart >= 0,
        };
        setReady(true);
      },
      undefined,
      (err) => {
        console.error('[Avatar3D] failed to load', err);
        if (!disposed) setFailed(true);
      },
    );

    // Real speech rhythm: every spoken word kicks the beat.
    const onBoundary = () => {
      boundaryRef.current = Math.min(boundaryRef.current + 0.5, 1);
    };
    window.addEventListener('alisha:tts-boundary', onBoundary);

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Smooth state transitions so nothing snaps.
      speak += ((speakingRef.current ? 1 : 0) - speak) * Math.min(1, dt * 6);
      listen += ((listeningRef.current ? 1 : 0) - listen) * Math.min(1, dt * 6);
      think += ((thinkingRef.current ? 1 : 0) - think) * Math.min(1, dt * 6);

      // Pseudo speech rhythm: two incommensurate waves never visibly loop.
      const talk =
        speak * (0.55 + 0.45 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1)));
      // Word-boundary kick decays exponentially (~1s tail) for per-word emphasis.
      boundaryRef.current *= Math.pow(0.02, dt);
      const beat = Math.min(1, talk + boundaryRef.current);

      const breathe = Math.sin(t * 1.6);

      // ————— Idle showpieces: she never stands frozen —————
      // Turn around herself: first spin 5-9s after load, then every 11-20s.
      // 60% of turns are a smooth full 360°, 40% a half turn out and back.
      // While listening she holds still and faces the user instead.
      if (turnStart < 0 && t >= turnNext && listen < 0.5) {
        turnStart = t;
        turnDur = 2.6 + Math.random() * 1.2;
        turnDir = Math.random() < 0.5 ? -1 : 1;
        turnFull = Math.random() < 0.6;
      }
      let yaw = 0;
      let turnLean = 0;
      let excite = 0;
      if (turnStart >= 0) {
        const u = (t - turnStart) / turnDur;
        if (u >= 1) {
          turnStart = -1;
          turnNext = t + 11 + Math.random() * 9;
        } else if (turnFull) {
          const s = u * u * (3 - 2 * u);
          yaw = Math.PI * 2 * turnDir * s;
          excite = Math.min(
            1.5,
            ((Math.PI * 2 * 6 * u * (1 - u)) / turnDur) * 0.3,
          );
          turnLean = Math.sin(u * Math.PI) * 0.03 * turnDir;
        } else {
          yaw = Math.PI * turnDir * Math.sin(u * Math.PI);
          excite = Math.min(
            1.5,
            (Math.abs(Math.cos(u * Math.PI)) / turnDur) * Math.PI * 0.3,
          );
          turnLean = Math.sin(u * Math.PI) * 0.03 * turnDir;
        }
      }

      // Step forward / backward every 7-14s (skipped mid-turn), plus a slow
      // standing drift, a side-to-side weight shift and a breathing bob.
      if (stepStart < 0 && t >= stepNext && turnStart < 0) {
        stepStart = t;
        stepDur = 2.2 + Math.random() * 1.6;
        stepDir = Math.random() < 0.5 ? -1 : 1;
        stepAmp = modelH * (0.03 + Math.random() * 0.025);
      }
      let zPulse = 0;
      if (stepStart >= 0) {
        const u = (t - stepStart) / stepDur;
        if (u >= 1) {
          stepStart = -1;
          stepNext = t + 7 + Math.random() * 7;
        } else {
          zPulse = stepAmp * stepDir * Math.sin(u * Math.PI);
        }
      }
      const zDrift =
        modelH * (0.012 * Math.sin(t * 0.21) + 0.009 * Math.sin(t * 0.13 + 1.7));
      const xShift = modelH * 0.011 * Math.sin(t * 0.29);
      const yBob = modelH * 0.006 * Math.sin(t * 1.6);
      if (model) {
        model.rotation.y = yaw;
        model.position.set(
          basePos.x + xShift,
          basePos.y + yBob,
          basePos.z +
            zDrift +
            zPulse +
            speak * modelH * 0.014 * (0.6 + 0.4 * Math.sin(t * 0.7)),
        );
      }

      // ————— Speaking hand gestures —————
      let gL: number[] = NONE4;
      let gR: number[] = NONE4;
      if (speak > 0.02) {
        if (t >= gStart + GESTURES[gIdx].dur) {
          gIdx =
            (gIdx + 1 + Math.floor(Math.random() * (GESTURES.length - 1))) %
            GESTURES.length;
          gStart = t;
        }
        const G = GESTURES[gIdx];
        const p = Math.min(1, Math.max(0, (t - gStart) / G.dur));
        const attack = Math.min(1, (t - gStart) / 0.3);
        const release = Math.min(1, (gStart + G.dur - t) / 0.35);
        const env = Math.max(0, Math.min(attack, release));
        const out = G.run(p, beat, env);
        gL = out.L.map((v) => v * speak);
        gR = out.R.map((v) => v * speak);
      }
      gestureArm(ctlL, gL);
      gestureArm(ctlR, gR);

      // Emotion gesture: nod for happy/surprised, shake for angry/sad.
      let nod = 0;
      let shake = 0;
      if (emotionRef.current) {
        if (emotionStartRef.current < 0) emotionStartRef.current = t;
        const age = t - emotionStartRef.current;
        if (age < 1.1) {
          const decay = 1 - age / 1.1;
          const osc = Math.sin(age * Math.PI * 4) * decay;
          if (emotionRef.current === 'happy' || emotionRef.current === 'surprised') {
            nod = osc * 0.09;
          } else if (emotionRef.current === 'angry' || emotionRef.current === 'sad') {
            shake = osc * 0.12;
          }
        } else {
          emotionRef.current = null;
          emotionStartRef.current = -1;
        }
      }

      pose(chest, breathe * 0.012 + beat * 0.012, turnLean * 0.6, turnLean);
      pose(upperChest, breathe * 0.016, Math.sin(t * 0.5) * 0.01, 0);
      pose(
        hips,
        breathe * 0.008 + beat * 0.008,
        0.02 * Math.sin(t * 0.5) * (0.4 + 0.6 * speak) + turnLean * 1.5,
        0,
      );
      pose(
        neck,
        Math.sin(t * 0.9) * 0.01 + talk * 0.045 + listen * -0.03 + think * 0.04,
        Math.sin(t * 0.45) * 0.03,
        listen * -0.07,
      );
      pose(
        head,
        Math.sin(t * 0.8 + 1) * 0.015 +
          talk * 0.065 +
          nod +
          think * 0.06 +
          listen * -0.02 -
          0.01,
        Math.sin(t * 0.4) * 0.05 + Math.sin(t * 2.3) * 0.02 * speak + shake,
        listen * -0.04,
      );

      // Eyes: slow drift with an occasional glance; steadier while listening,
      // lifted while thinking.
      const glance = Math.sin(t * 0.37) > 0.92 ? 0.08 : 0;
      const drift = (1 - listen) * Math.sin(t * 0.7) * 0.03 + glance;
      const lift = think * 0.07;
      pose(eyeL, lift, drift, 0);
      pose(eyeR, lift, drift, 0);

      // Hair + skirt springs: always alive, livelier while speaking and
      // flaring outward while she spins.
      const amp = Math.min(0.09, 0.025 * (1 + 0.9 * talk) * (1 + excite * 1.2));
      for (const s of sway) {
        const a = Math.sin(t * 1.3 + s.phase) * amp;
        pose(s, a * 0.6, 0, a);
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(tick);

    const onVisibility = () => {
      renderer.setAnimationLoop(document.hidden ? null : tick);
      if (!document.hidden) clock.getDelta();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('alisha:tts-boundary', onBoundary);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          (mat as THREE.MeshToonMaterial).map?.dispose();
          mat.dispose();
        });
      });
      ramp.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  if (failed) {
    return <img src={fallbackImage} alt="Alisha" className="h-full w-full object-contain" />;
  }

  return (
    <div
      ref={hostRef}
      aria-label="Alisha 3D avatar"
      className={`h-full w-full transition-opacity duration-700 ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
