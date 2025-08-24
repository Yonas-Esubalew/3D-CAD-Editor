import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Box, Circle, Shapes, Save } from "lucide-react";

export default function ExtrudeApp() {
  const mountRef = useRef(null);
  const [height, setHeight] = useState(2);
  const [shapeType, setShapeType] = useState("rect"); // rect | circle | polygon
  const meshRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111827");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);

    // lights
    scene.add(new THREE.DirectionalLight(0xffffff, 1).position.set(5, 10, 5));
    scene.add(new THREE.AmbientLight(0x404040, 1));

    // mesh
    const mesh = createMesh(shapeType, height);
    scene.add(mesh);
    meshRef.current = mesh;

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x222 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // drag rotation
    let isDragging = false;
    let prev = { x: 0, y: 0 };
    const onMouseDown = (e) => {
      isDragging = true;
      prev = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => (isDragging = false);
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prev.x;
      mesh.rotation.y += dx * 0.01;
      prev = { x: e.clientX, y: e.clientY };
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ✅ Rebuild mesh when height or shape changes
  useEffect(() => {
    if (!meshRef.current || !sceneRef.current) return;

    const scene = sceneRef.current;
    scene.remove(meshRef.current);
    meshRef.current.geometry.dispose();

    const newMesh = createMesh(shapeType, height);
    meshRef.current = newMesh;
    scene.add(newMesh);
  }, [height, shapeType]);

  // ✅ Export as .glb
  const saveAsGLB = () => {
    if (!meshRef.current) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      meshRef.current,
      (result) => {
        const blob = new Blob([result], { type: "model/gltf-binary" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "extrudedShape.glb";
        link.click();
      },
      { binary: true }
    );
  };

  return (
    <div className="w-screen h-screen bg-gray-900 text-white flex flex-col">
      {/* Toolbar */}
      <div className="p-4 bg-gray-800 flex items-center gap-4 shadow-md border-b border-gray-700">
        {/* Shape Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShapeType("rect")}
            className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
              shapeType === "rect"
                ? "bg-green-600 shadow"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            <Box size={18} /> Rect
          </button>
          <button
            onClick={() => setShapeType("circle")}
            className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
              shapeType === "circle"
                ? "bg-green-600 shadow"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            <Circle size={18} /> Circle
          </button>
          <button
            onClick={() => setShapeType("polygon")}
            className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
              shapeType === "polygon"
                ? "bg-green-600 shadow"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            <Shapes size={18} /> Polygon
          </button>
        </div>

        {/* Extrude height */}
        <div className="flex items-center gap-2 ml-6">
          <label className="font-semibold">Height:</label>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(parseFloat(e.target.value))}
            className="w-64 accent-green-500"
          />
          <span>{height.toFixed(1)}</span>
        </div>

        {/* Export */}
        <button
          onClick={saveAsGLB}
          className="ml-auto flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg shadow transition"
        >
          <Save size={18} /> Export .glb
        </button>
      </div>

      {/* Three.js Scene */}
      <div ref={mountRef} className="flex-1" />
    </div>
  );
}

// 🔨 Helper to create extruded mesh
function createMesh(type, height) {
  let shape = new THREE.Shape();

  if (type === "rect") {
    shape.moveTo(0, 0);
    shape.lineTo(2, 0);
    shape.lineTo(2, 2);
    shape.lineTo(0, 2);
    shape.lineTo(0, 0);
  } else if (type === "circle") {
    shape.absarc(0, 0, 1.5, 0, Math.PI * 2, false);
  } else if (type === "polygon") {
    shape.moveTo(0, 2);
    shape.lineTo(2, -2);
    shape.lineTo(-2, -2);
    shape.lineTo(0, 2);
  }

  const extrudeSettings = { depth: height, bevelEnabled: false };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const material = new THREE.MeshStandardMaterial({ color: 0x10b981 });
  return new THREE.Mesh(geometry, material);
}
