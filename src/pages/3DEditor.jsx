import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { motion } from "framer-motion";
import { FaCubes } from "react-icons/fa";
import {
  Box,
  Circle,
  Cylinder,
  Move,
  RotateCcw,
  Scale,
  Grid,
  Download,
  Upload,
  Undo2,
  Redo2,
  MousePointer,
} from "lucide-react";
import Profile from "../assets/Yonas.png";
import ThreeImage from "../assets/3dimage.png";
import { Link } from "react-router-dom";

export default function ThreeDEditor() {
  // Canvas mount point
  const mountRef = useRef(null);

  // Mutable refs for Three.js objects
  const sceneRef = useRef();
  const cameraRef = useRef();
  const rendererRef = useRef();
  const orbitRef = useRef();
  const transformRef = useRef();
  const raycasterRef = useRef();
  const mouseRef = useRef(new THREE.Vector2());
  const selectedRef = useRef(null);
  const snapEnabledRef = useRef(false);

  // History (undo/redo)
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  // Local UI state to re-render labels/sliders
  const [ui, setUi] = useState({
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    dim: { w: 1, h: 1, d: 1 },
    sidebar: false,
    canUndo: false,
    canRedo: false,
    snap: false,
    mode: "translate",
  });

  // --- Lifecycle: init Three.js scene ---
  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;

    const transform = new TransformControls(camera, renderer.domElement);
    transform.addEventListener("change", () => {
      if (selectedRef.current) {
        updatePanelFromObject();
        // Save a state once per drag stroke
        transform.addEventListener("mouseUp", () => saveState(), {
          once: true,
        });
      }
    });
    transform.addEventListener("dragging-changed", (e) => {
      orbit.enabled = !e.value;
    });
    scene.add(transform);

    const raycaster = new THREE.Raycaster();

    // Lights & helpers
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 20, 15);
    dir.castShadow = true;
    scene.add(dir);

    const grid = new THREE.GridHelper(20, 20);
    scene.add(grid);

    const axes = new THREE.AxesHelper(5);
    scene.add(axes);

    // Store refs
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    orbitRef.current = orbit;
    transformRef.current = transform;
    raycasterRef.current = raycaster;

    // Events
    function onResize() {
      const el = mountRef.current;
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    }
    window.addEventListener("resize", onResize);

    function onCanvasClick(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseRef.current, camera);

      // Only test Meshes that have userData.type
      const intersects = raycaster
        .intersectObjects(scene.children, true)
        .filter(
          (it) => it.object instanceof THREE.Mesh && it.object.userData?.type
        );

      if (intersects.length > 0) {
        selectObject(intersects[0].object);
      } else {
        deselectObject();
      }
    }
    renderer.domElement.addEventListener("click", onCanvasClick);

    // Kick things off
    saveState();

    // Animation loop
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      orbit.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      mountRef.current && mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  function addShape(type) {
    const scene = sceneRef.current;
    let geometry;
    if (type === "box") geometry = new THREE.BoxGeometry(2, 2, 2);
    if (type === "sphere") geometry = new THREE.SphereGeometry(1, 32, 32);
    if (type === "cylinder") geometry = new THREE.CylinderGeometry(1, 1, 2, 32);

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(Math.random(), Math.random(), Math.random()),
      metalness: 0.3,
      roughness: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );
    mesh.userData.type = type;

    scene.add(mesh);
    selectObject(mesh);
    toast(`${capitalize(type)} added`);
    saveState();
    return mesh;
  }

  function selectObject(object) {
    const transform = transformRef.current;
    // Restore previous
    if (selectedRef.current) {
      const prev = selectedRef.current;
      if (prev.userData.originalMaterial)
        prev.material = prev.userData.originalMaterial;
      selectedRef.current = null;
    }
    selectedRef.current = object;
    if (object) {
      object.userData.originalMaterial = object.material;
      object.material = object.material.clone();
      if (object.material.emissive)
        object.material.emissive = new THREE.Color(0.3, 0.3, 0.3);
      transform.attach(object);
      updatePanelFromObject();
      setUi((s) => ({ ...s, sidebar: true }));
    } else {
      transform.detach();
    }
  }

  function deselectObject() {
    const transform = transformRef.current;
    const obj = selectedRef.current;
    if (obj && obj.userData.originalMaterial)
      obj.material = obj.userData.originalMaterial;
    selectedRef.current = null;
    transform.detach();
    setUi((s) => ({ ...s, sidebar: false }));
  }

  function setTransformMode(mode) {
    transformRef.current.setMode(mode);
    setUi((s) => ({ ...s, mode }));
  }

  function toggleSnap() {
    const on = !snapEnabledRef.current;
    snapEnabledRef.current = on;
    transformRef.current.setTranslationSnap(on ? 1 : null);
    transformRef.current.setRotationSnap(on ? Math.PI / 18 : null); // 10°
    setUi((s) => ({ ...s, snap: on }));
  }

  function updatePanelFromObject() {
    const o = selectedRef.current;
    if (!o) return;
    // Position
    const pos = { x: o.position.x, y: o.position.y, z: o.position.z };
    // Rotation (deg)
    const rot = {
      x: THREE.MathUtils.radToDeg(o.rotation.x),
      y: THREE.MathUtils.radToDeg(o.rotation.y),
      z: THREE.MathUtils.radToDeg(o.rotation.z),
    };
    // Scale
    const scale = { x: o.scale.x, y: o.scale.y, z: o.scale.z };
    // Dimensions (simple heuristic like original)
    const dim = { w: 1, h: 1, d: 1 };
    if (o.geometry instanceof THREE.BoxGeometry) {
      dim.w = o.scale.x * 2;
      dim.h = o.scale.y * 2;
      dim.d = o.scale.z * 2;
    } else if (o.geometry instanceof THREE.SphereGeometry) {
      const r = o.scale.x;
      dim.w = r * 2;
      dim.h = r * 2;
      dim.d = r * 2;
    } else if (o.geometry instanceof THREE.CylinderGeometry) {
      dim.w = o.scale.x * 2;
      dim.h = o.scale.y * 2;
      dim.d = o.scale.z * 2;
    }
    setUi((s) => ({ ...s, pos, rot, scale, dim }));
  }

  function updateObjectFromSliders(next) {
    const o = selectedRef.current;
    if (!o) return;
    // Position
    o.position.x = next.pos.x;
    o.position.y = next.pos.y;
    o.position.z = next.pos.z;
    // Rotation (deg -> rad)
    o.rotation.x = THREE.MathUtils.degToRad(next.rot.x);
    o.rotation.y = THREE.MathUtils.degToRad(next.rot.y);
    o.rotation.z = THREE.MathUtils.degToRad(next.rot.z);
    // Scale
    o.scale.x = next.scale.x;
    o.scale.y = next.scale.y;
    o.scale.z = next.scale.z;
    updatePanelFromObject();
  }

  function deleteSelected() {
    const scene = sceneRef.current;
    const o = selectedRef.current;
    if (!o) return;
    scene.remove(o);
    deselectObject();
    saveState();
    toast("Object deleted");
  }

  function exportScene() {
    const scene = sceneRef.current;
    const data = { objects: [] };
    scene.children.forEach((child) => {
      if (child instanceof THREE.Mesh && child.userData?.type) {
        data.objects.push({
          type: child.userData.type,
          position: {
            x: child.position.x,
            y: child.position.y,
            z: child.position.z,
          },
          rotation: {
            x: child.rotation.x,
            y: child.rotation.y,
            z: child.rotation.z,
          },
          scale: { x: child.scale.x, y: child.scale.y, z: child.scale.z },
          color: child.material.color.getHex(),
          material: {
            metalness: child.material.metalness,
            roughness: child.material.roughness,
          },
        });
      }
    });
    const json = JSON.stringify(data);
    const a = document.createElement("a");
    a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    a.download = "scene.json";
    a.click();
    toast("Scene exported");
  }

  function importScene(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const scene = sceneRef.current;
        // Clear meshes
        [...scene.children].forEach((child) => {
          if (child instanceof THREE.Mesh && child.userData?.type)
            scene.remove(child);
        });
        // Recreate
        data.objects.forEach((obj) => {
          let geometry;
          if (obj.type === "box") geometry = new THREE.BoxGeometry(2, 2, 2);
          if (obj.type === "sphere")
            geometry = new THREE.SphereGeometry(1, 32, 32);
          if (obj.type === "cylinder")
            geometry = new THREE.CylinderGeometry(1, 1, 2, 32);
          const material = new THREE.MeshStandardMaterial({
            color: obj.color ?? 0x049ef4,
            metalness: obj.material?.metalness ?? 0.3,
            roughness: obj.material?.roughness ?? 0.7,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
          mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
          mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
          mesh.userData.type = obj.type;
          scene.add(mesh);
        });
        deselectObject();
        saveState();
        toast("Scene imported");
      } catch (e) {
        console.error("Import error", e);
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  // --- Undo / Redo ---
  function serializeScene() {
    const scene = sceneRef.current;
    const data = { objects: [] };
    scene.children.forEach((child) => {
      if (child instanceof THREE.Mesh && child.userData?.type) {
        data.objects.push({
          type: child.userData.type,
          position: {
            x: child.position.x,
            y: child.position.y,
            z: child.position.z,
          },
          rotation: {
            x: child.rotation.x,
            y: child.rotation.y,
            z: child.rotation.z,
          },
          scale: { x: child.scale.x, y: child.scale.y, z: child.scale.z },
          color: child.material.color.getHex(),
          material: {
            metalness: child.material.metalness,
            roughness: child.material.roughness,
          },
        });
      }
    });
    return JSON.stringify(data);
  }

  function applySerialized(json) {
    const data = JSON.parse(json);
    const scene = sceneRef.current;
    // remove existing meshes
    [...scene.children].forEach((child) => {
      if (child instanceof THREE.Mesh && child.userData?.type)
        scene.remove(child);
    });
    data.objects.forEach((obj) => {
      let geometry;
      if (obj.type === "box") geometry = new THREE.BoxGeometry(2, 2, 2);
      if (obj.type === "sphere") geometry = new THREE.SphereGeometry(1, 32, 32);
      if (obj.type === "cylinder")
        geometry = new THREE.CylinderGeometry(1, 1, 2, 32);
      const material = new THREE.MeshStandardMaterial({
        color: obj.color ?? 0x049ef4,
        metalness: obj.material?.metalness ?? 0.3,
        roughness: obj.material?.roughness ?? 0.7,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
      mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
      mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
      mesh.userData.type = obj.type;
      scene.add(mesh);
    });
    deselectObject();
  }

  function saveState() {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(
        0,
        historyIndexRef.current + 1
      );
    }
    historyRef.current.push(serializeScene());
    historyIndexRef.current = historyRef.current.length - 1;
    setUi((s) => ({
      ...s,
      canUndo: historyIndexRef.current > 0,
      canRedo: false,
    }));
  }

  function restoreState() {
    if (
      historyIndexRef.current < 0 ||
      historyIndexRef.current >= historyRef.current.length
    )
      return;
    applySerialized(historyRef.current[historyIndexRef.current]);
    setUi((s) => ({
      ...s,
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    }));
  }

  function undo() {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      restoreState();
      toast("Undo");
    }
  }
  function redo() {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      restoreState();
      toast("Redo");
    }
  }

  // --- Small toast helper ---
  const [toastMsg, setToastMsg] = useState("");
  function toast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 1800);
  }

  // --- UI Handlers ---
  const handleSlider = (group, key) => (e) => {
    const value = parseFloat(e.target.value);
    const next = {
      ...ui,
      [group]: { ...ui[group], [key]: value },
    };
    setUi(next);
    updateObjectFromSliders(next);
  };
  const handleSliderCommit = () => saveState();

  return (
    <div className="flex flex-col h-screen">
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="fixed top-0 left-0 right-0 z-50 flex flex-wrap items-center justify-between w-full
             bg-gradient-to-br from-green-900 via-green-700 to-green-400
             text-white px-3 py-3 shadow-2xl border-b border-emerald-700 backdrop-blur-sm"
      >
        {/* Left Logo + Title */}
        <div className="flex items-center gap-2">
          <img src={ThreeImage} alt="Logo" className="w-7 h-7 drop-shadow-md" />
          <h1 className="text-xl font-extrabold tracking-wide">
            3D CAD <span className="text-emerald-300">Editor</span>
          </h1>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center justify-center">
          {/* Shapes */}
          <div className="flex items-center gap-2 pr-6 border-r border-emerald-700">
            <button
              onClick={() => addShape("box")}
              className="px-3 py-2 rounded-lg flex items-center gap-1 bg-emerald-800 hover:bg-emerald-600 hover:shadow-md transition"
            >
              <Box size={18} /> Box
            </button>
            <button
              onClick={() => addShape("sphere")}
              className="px-3 py-2 rounded-lg flex items-center gap-1 bg-emerald-800 hover:bg-emerald-600 hover:shadow-md transition"
            >
              <Circle size={18} /> Sphere
            </button>
            <button
              onClick={() => addShape("cylinder")}
              className="px-3 py-2 rounded-lg flex items-center gap-1 bg-emerald-800 hover:bg-emerald-600 hover:shadow-md transition"
            >
              <Cylinder size={18} /> Cylinder
            </button>
          </div>

          {/* Transform */}
          <div className="flex items-center gap-2 pr-6 border-r border-emerald-700">
            <button
              onClick={() => setTransformMode("translate")}
              className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                ui.mode === "translate"
                  ? "bg-emerald-600 shadow-md"
                  : "bg-emerald-800 hover:bg-emerald-600"
              }`}
            >
              <Move size={18} /> Move
            </button>
            <button
              onClick={() => setTransformMode("rotate")}
              className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                ui.mode === "rotate"
                  ? "bg-emerald-600 shadow-md"
                  : "bg-emerald-800 hover:bg-emerald-600"
              }`}
            >
              <RotateCcw size={18} /> Rotate
            </button>
            <button
              onClick={() => setTransformMode("scale")}
              className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                ui.mode === "scale"
                  ? "bg-emerald-600 shadow-md"
                  : "bg-emerald-800 hover:bg-emerald-600"
              }`}
            >
              <Scale size={18} /> Scale
            </button>
            <button
              onClick={toggleSnap}
              className={`px-3 py-2 rounded-lg flex items-center gap-1 ${
                ui.snap
                  ? "bg-lime-600 shadow-md"
                  : "bg-emerald-800 hover:bg-lime-600"
              }`}
            >
              <Grid size={18} /> Snap: {ui.snap ? "On" : "Off"}
            </button>
          </div>

          {/* Scene Controls */}
          <div className="flex items-center gap-2 pr-6 border-r border-emerald-700">
            <button
              onClick={exportScene}
              className="px-3 py-2 rounded-lg flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 shadow-sm transition"
            >
              <Download size={18} /> Export
            </button>
            <label className="px-3 py-2 rounded-lg flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 cursor-pointer shadow-sm transition">
              <Upload size={18} /> Import
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => importScene(e.target.files?.[0])}
              />
            </label>
            <button
              onClick={undo}
              disabled={!ui.canUndo}
              className={`px-3 py-2 rounded-lg flex items-center gap-1 ${
                ui.canUndo
                  ? "bg-emerald-800 hover:bg-emerald-700"
                  : "bg-emerald-900/50 cursor-not-allowed"
              }`}
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={redo}
              disabled={!ui.canRedo}
              className={`px-3 py-2 rounded-lg flex items-center gap-1 ${
                ui.canRedo
                  ? "bg-emerald-800 hover:bg-emerald-700"
                  : "bg-emerald-900/50 cursor-not-allowed"
              }`}
            >
              <Redo2 size={18} />
            </button>

            {/* 2D Mode Button */}
            <Link
              to="/2d-editor"
              className="px-3 py-2 rounded-lg flex items-center gap-1 bg-lime-500 hover:bg-lime-400 shadow-md transition"
              title="Switch to 2D Editor"
            >
              <MousePointer size={18} /> 2D Mode
            </Link>
          </div>
        </div>

        {/* Right Profile / User */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-sm font-semibold">Yonas E.</span>
            <span className="text-xs text-sky-600">Designer</span>
          </div>
          <img
            src={Profile}
            alt="User profile"
            className="w-10 h-10 rounded-full border-2 border-emerald-400 shadow-md cursor-pointer hover:scale-105 transition"
          />
        </div>
      </motion.div>
      {/* Canvas + Sidebar */}
      <div className="relative flex-1 bg-slate-950" ref={mountRef}>
        {/* Toggle Sidebar */}
        <button
          onClick={() => setUi((s) => ({ ...s, sidebar: !s.sidebar }))}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-medium shadow-lg hover:from-sky-500 hover:to-indigo-500 transition"
        >
          ⚙️ Properties
        </button>

        {/* Sidebar */}
        <div
          className={`fixed top-24 right-0 h-[calc(100vh-6rem)] w-80 max-w-[90vw] bg-gradient-to-br from-green-900 via-green-700 to-green-400 text-white p-6 shadow-2xl overflow-y-auto z-50 transform transition-transform duration-300 ease-in-out
          ${ui.sidebar ? "translate-x-0" : "translate-x-full"}`}
        >
          <h2 className="text-2xl font-bold mb-6 tracking-wide border-b border-slate-700 pb-3">
            Object Properties
          </h2>

          {/* Position */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 text-sky-400">
              Position
            </h3>
            {["x", "y", "z"].map((k) => (
              <div key={`pos-${k}`} className="flex items-center gap-3 mb-3">
                <span className="w-8 font-medium">{k.toUpperCase()}:</span>
                <span className="ml-auto w-16 text-right text-sky-300">
                  {ui.pos[k].toFixed(2)}
                </span>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={0.1}
                  value={ui.pos[k]}
                  onChange={handleSlider("pos", k)}
                  onMouseUp={handleSliderCommit}
                  className="flex-1 accent-sky-500"
                />
              </div>
            ))}
          </div>

          {/* Rotation */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 text-indigo-400">
              Rotation
            </h3>
            {["x", "y", "z"].map((k) => (
              <div key={`rot-${k}`} className="flex items-center gap-3 mb-3">
                <span className="w-8 font-medium">{k.toUpperCase()}:</span>
                <span className="ml-auto w-16 text-right text-indigo-300">
                  {ui.rot[k].toFixed(0)}
                </span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={ui.rot[k]}
                  onChange={handleSlider("rot", k)}
                  onMouseUp={handleSliderCommit}
                  className="flex-1 accent-indigo-500"
                />
              </div>
            ))}
          </div>

          {/* Scale */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 text-emerald-400">
              Scale
            </h3>
            {["x", "y", "z"].map((k) => (
              <div key={`scale-${k}`} className="flex items-center gap-3 mb-3">
                <span className="w-8 font-medium">{k.toUpperCase()}:</span>
                <span className="ml-auto w-16 text-right text-emerald-300">
                  {ui.scale[k].toFixed(2)}
                </span>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={ui.scale[k]}
                  onChange={handleSlider("scale", k)}
                  onMouseUp={handleSliderCommit}
                  className="flex-1 accent-emerald-500"
                />
              </div>
            ))}
          </div>

          {/* Dimensions */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 text-amber-400">
              Dimensions
            </h3>
            <div className="flex justify-between py-1">
              <span>Width:</span>
              <span className="text-amber-300">{ui.dim.w.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Height:</span>
              <span className="text-amber-300">{ui.dim.h.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Depth:</span>
              <span className="text-amber-300">{ui.dim.d.toFixed(2)}</span>
            </div>
          </div>

          {/* Delete Button */}
          <button
            className="w-full mt-2 px-4 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold tracking-wide shadow-md transition"
            onClick={deleteSelected}
          >
            🗑 Delete Object
          </button>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-pulse">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}

// --- utils ---
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
