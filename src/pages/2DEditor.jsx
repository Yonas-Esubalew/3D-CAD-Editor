import React, { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import {
  Save,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  RotateCw,
  Square,
  Circle,
  Type,
  Move,
  Minus,
  Sliders,
  ZoomIn,
  ZoomOut,
  Grid,
  Box,
  MousePointer,
} from "lucide-react";
import Profile from "../assets/Yonas.png";
import { Link } from "react-router-dom";

const SketchApp = () => {
  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const threeCanvasRef = useRef(null);

  // State
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [shapes, setShapes] = useState([]);
  const [currentShape, setCurrentShape] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [extrudeHeight, setExtrudeHeight] = useState(50);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
    radius: 0,
  });

  // Three.js references
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRef = useRef(null);
  const animationIdRef = useRef(null);

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set canvas dimensions based on container
    const resizeCanvas = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
        redrawCanvas();
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!threeCanvasRef.current) return;

    // Initialize scene with a more professional look
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c); // Darker background for better contrast
    sceneRef.current = scene;

    // Initialize camera with better positioning
    const camera = new THREE.PerspectiveCamera(
      60, // Wider field of view
      threeCanvasRef.current.clientWidth / threeCanvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 7);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Initialize renderer with higher quality settings
    const renderer = new THREE.WebGLRenderer({
      canvas: threeCanvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(
      threeCanvasRef.current.clientWidth,
      threeCanvasRef.current.clientHeight
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x7777ff, 0.3);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    // Enhanced grid with multiple sizes and colors
    const gridSize = 20;
    const gridDivisions = 20;

    // Major grid (darker)
    const gridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions / 2,
      0x444444,
      0x444444
    );
    gridHelper.position.y = -0.01; // Slightly below other objects
    scene.add(gridHelper);

    // Minor grid (lighter)
    const subGridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      0x222222,
      0x222222
    );
    subGridHelper.position.y = -0.02;
    scene.add(subGridHelper);

    // Enhanced axes with arrows
    const axesSize = 5;
    const axesHelper = new THREE.AxesHelper(axesSize);
    scene.add(axesHelper);

    // Add coordinate indicators using simple geometries
    const createAxisLabel = (text, position, color) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = 64;
      canvas.height = 64;

      context.fillStyle = "rgba(0, 0, 0, 0)";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.font = "48px Arial";
      context.fillStyle = color;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.set(2, 2, 1);
      scene.add(sprite);
    };

    createAxisLabel("X", new THREE.Vector3(axesSize + 1, 0, 0), "#ff0000");
    createAxisLabel("Y", new THREE.Vector3(0, axesSize + 1, 0), "#00ff00");
    createAxisLabel("Z", new THREE.Vector3(0, 0, axesSize + 1), "#0000ff");

    // Add a subtle floor plane for better visualization
    const planeGeometry = new THREE.PlaneGeometry(gridSize, gridSize);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -0.05;
    plane.receiveShadow = true;
    scene.add(plane);

    // Add a bounding box to show the extent of the canvas
    const boxGeometry = new THREE.BoxGeometry(gridSize, 6, gridSize);
    const boxEdges = new THREE.EdgesGeometry(boxGeometry);
    const boxLine = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
      })
    );
    boxLine.position.y = 2.5; // Center the box vertically
    scene.add(boxLine);

    // Animation loop with smoother rotation
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (meshRef.current) {
        meshRef.current.rotation.x += 0.005;
        meshRef.current.rotation.y += 0.007;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize with debounce for better performance
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!threeCanvasRef.current) return;

        camera.aspect =
          threeCanvasRef.current.clientWidth /
          threeCanvasRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(
          threeCanvasRef.current.clientWidth,
          threeCanvasRef.current.clientHeight
        );
      }, 250);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Drawing functions
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    setIsDrawing(true);

    if (tool === "pencil" || tool === "eraser") {
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = tool === "eraser" ? "white" : color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    } else if (["rectangle", "circle", "line"].includes(tool)) {
      setCurrentShape({
        type: tool,
        startX: snapToGrid ? Math.round(x / gridSize) * gridSize : x,
        startY: snapToGrid ? Math.round(y / gridSize) * gridSize : y,
        endX: snapToGrid ? Math.round(x / gridSize) * gridSize : x,
        endY: snapToGrid ? Math.round(y / gridSize) * gridSize : y,
        color: tool === "eraser" ? "white" : color,
        lineWidth: brushSize,
      });
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const ctx = canvas.getContext("2d");

    if (tool === "pencil" || tool === "eraser") {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (currentShape) {
      // Update current shape
      const updatedShape = {
        ...currentShape,
        endX: snapToGrid ? Math.round(x / gridSize) * gridSize : x,
        endY: snapToGrid ? Math.round(y / gridSize) * gridSize : y,
      };

      setCurrentShape(updatedShape);

      // Update dimensions
      if (tool === "rectangle") {
        setDimensions({
          width: Math.abs(updatedShape.endX - updatedShape.startX),
          height: Math.abs(updatedShape.endY - updatedShape.startY),
          radius: 0,
        });
      } else if (tool === "circle") {
        const radius = Math.sqrt(
          Math.pow(updatedShape.endX - updatedShape.startX, 2) +
            Math.pow(updatedShape.endY - updatedShape.startY, 2)
        );
        setDimensions({
          width: 0,
          height: 0,
          radius: Math.round(radius),
        });
      } else if (tool === "line") {
        setDimensions({
          width: Math.abs(updatedShape.endX - updatedShape.startX),
          height: Math.abs(updatedShape.endY - updatedShape.startY),
          radius: 0,
        });
      }

      // Redraw canvas with preview
      redrawCanvas();
      drawShapePreview(updatedShape);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    setIsDrawing(false);

    if (currentShape) {
      // Save to history
      const newHistory = history.slice(0, historyIndex + 1);
      setHistory([...newHistory, { shapes: [...shapes], currentShape: null }]);
      setHistoryIndex(newHistory.length);

      // Add shape to shapes array
      setShapes([...shapes, currentShape]);
      setCurrentShape(null);
    } else {
      // For freehand drawing, save canvas state
      saveCanvasState();
    }
  };

  const drawShapePreview = (shape) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.lineWidth;

    if (shape.type === "rectangle") {
      const width = shape.endX - shape.startX;
      const height = shape.endY - shape.startY;
      ctx.strokeRect(shape.startX, shape.startY, width, height);
    } else if (shape.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(shape.endX - shape.startX, 2) +
          Math.pow(shape.endY - shape.startY, 2)
      );
      ctx.arc(shape.startX, shape.startY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.type === "line") {
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid if enabled
    if (snapToGrid) {
      drawGrid();
    }

    // Draw all shapes
    shapes.forEach((shape) => {
      drawShapePreview(shape);
    });
  };

  const drawGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }

    // Draw horizontal lines
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }

    ctx.stroke();
  };

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, { shapes: [...shapes], currentShape: null }]);
    setHistoryIndex(newHistory.length);
  };

  const undo = () => {
    if (historyIndex <= 0) return;

    const prevState = history[historyIndex - 1];
    setShapes(prevState.shapes);
    setCurrentShape(prevState.currentShape);
    setHistoryIndex(historyIndex - 1);

    redrawCanvas();
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;

    const nextState = history[historyIndex + 1];
    setShapes(nextState.shapes);
    setCurrentShape(nextState.currentShape);
    setHistoryIndex(historyIndex + 1);

    redrawCanvas();
  };

  const clearCanvas = () => {
    setShapes([]);
    setCurrentShape(null);
    setHistory([...history, { shapes: [], currentShape: null }]);
    setHistoryIndex(historyIndex + 1);

    redrawCanvas();
  };

  const handleZoom = (direction) => {
    setZoom((prevZoom) => {
      const newZoom = direction === "in" ? prevZoom * 1.2 : prevZoom / 1.2;
      return Math.min(Math.max(newZoom, 0.5), 5);
    });
  };

  const startPanning = (e) => {
    setIsPanning(true);
  };

  const panCanvas = (e) => {
    if (!isPanning) return;

    setPan((prevPan) => ({
      x: prevPan.x + e.movementX,
      y: prevPan.y + e.movementY,
    }));
  };

  const stopPanning = () => {
    setIsPanning(false);
  };

  const extrudeShape = () => {
    if (!sceneRef.current) return;
    if (!currentShape && shapes.length === 0) return;

    const shapeToExtrude = currentShape || shapes[shapes.length - 1];
    let shape2D = null;

    // ✅ Rectangle → Extrude
    if (shapeToExtrude.type === "rectangle") {
      const width = Math.abs(shapeToExtrude.endX - shapeToExtrude.startX);
      const height = Math.abs(shapeToExtrude.endY - shapeToExtrude.startY);

      shape2D = new THREE.Shape();
      shape2D.moveTo(0, 0);
      shape2D.lineTo(width, 0);
      shape2D.lineTo(width, height);
      shape2D.lineTo(0, height);
      shape2D.lineTo(0, 0);
    }

    // ✅ Circle → Extrude
    else if (shapeToExtrude.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(shapeToExtrude.endX - shapeToExtrude.startX, 2) +
          Math.pow(shapeToExtrude.endY - shapeToExtrude.startY, 2)
      );
      shape2D = new THREE.Shape();
      shape2D.absarc(0, 0, radius, 0, Math.PI * 2, false);
    }

    // ❌ Skip Pencil / Line / Eraser
    else {
      alert("Only Rectangle and Circle can be extruded into 3D!");
      return;
    }

    // ✅ Build 3D mesh
    if (shape2D) {
      const extrudeSettings = {
        depth: extrudeHeight / 10, // Scale down for better visualization
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 2,
        bevelSegments: 3,
      };

      const geometry = new THREE.ExtrudeGeometry(shape2D, extrudeSettings);
      const material = new THREE.MeshPhongMaterial({
        color: 0x00ff88,
        specular: 0x111111,
        shininess: 100,
        side: THREE.DoubleSide,
      });

      // Remove previous mesh if exists
      if (meshRef.current) {
        sceneRef.current.remove(meshRef.current);
      }

      const mesh = new THREE.Mesh(geometry, material);
      meshRef.current = mesh;

      // Center the mesh
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      mesh.position.sub(center);

      sceneRef.current.add(mesh);
    }
  };

  // ✅ Save to localStorage (as image)
  const saveScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL("image/png");
    localStorage.setItem("myCanvas", dataURL);
    alert("✅ Canvas saved locally!");
  };

  // ✅ Export as file download (PNG)
  const exportScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "drawing.png";
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-700 to-green-400 text-white p-4">
      <div className="max-w-full mx-auto">
        <header className="fixed top-0 left-0 right-0 z-50 bg-green-900/90 backdrop-blur-md shadow-2xl p-4 flex justify-between items-center space-x-4">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <Box className="text-green-400" size={32} />
            <h1 className="text-2xl font-bold text-white tracking-wide">
              2D Sketcher
            </h1>
          </div>

          {/* Main Toolbar */}
          <div className="flex items-center space-x-3">
            {/* Save & Export */}
            <button
              onClick={saveScene}
              className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition shadow-lg"
            >
              <Save size={18} />
              <span className="font-medium">Save</span>
            </button>

            <button
              onClick={exportScene}
              className="flex items-center space-x-1 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg transition shadow-lg"
            >
              <Download size={18} />
              <span className="font-medium">Export</span>
            </button>

            {/* Additional Tools */}
            <button
              className="flex items-center justify-center bg-green-700 hover:bg-green-600 p-2 rounded-lg transition shadow-md"
              title="Drawing Settings"
            >
              <Sliders size={18} />
            </button>
            <button
              className="flex items-center justify-center bg-green-700 hover:bg-green-600 p-2 rounded-lg transition shadow-md"
              title="Grid Toggle"
            >
              <Grid size={18} />
            </button>

            {/* 3D Mode Button */}
            <Link
              className="flex items-center space-x-1 bg-green-400 hover:bg-green-500 px-3 py-2 rounded-lg transition shadow-lg"
              title="Switch to 3D Editor"
              to="/"
            >
              <Box size={18} />
              <span className="font-medium text-white">3D Mode</span>
            </Link>
          </div>

          {/* Profile Section */}
          <div className="flex items-center space-x-2">
            <span className="text-white text-sm hidden sm:block font-medium">
              Hello, Yonas
            </span>
            <img
              src={Profile}
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-white shadow-lg hover:ring-2 hover:ring-green-300 transition"
            />
          </div>
        </header>
        <br></br>
        <br></br>
        <br></br>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Tools */}
          <div className="lg:col-span-1 bg-black/30 rounded-xl p-4 h-[calc(100vh-6rem)] overflow-y-auto sticky top-24">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Sliders className="mr-2" size={20} />
              Drawing Tools
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                className={`p-3 rounded-lg flex flex-col items-center transition ${
                  tool === "pencil"
                    ? "bg-blue-600"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
                onClick={() => setTool("pencil")}
              >
                <MousePointer size={24} />
                <span className="mt-1 text-sm">Pencil</span>
              </button>
              <button
                className={`p-3 rounded-lg flex flex-col items-center transition ${
                  tool === "eraser"
                    ? "bg-blue-600"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
                onClick={() => setTool("eraser")}
              >
                <Square size={24} />
                <span className="mt-1 text-sm">Eraser</span>
              </button>
              <button
                className={`p-3 rounded-lg flex flex-col items-center transition ${
                  tool === "line"
                    ? "bg-blue-600"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
                onClick={() => setTool("line")}
              >
                <Minus size={24} />
                <span className="mt-1 text-sm">Line</span>
              </button>
              <button
                className={`p-3 rounded-lg flex flex-col items-center transition ${
                  tool === "rectangle"
                    ? "bg-blue-600"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
                onClick={() => setTool("rectangle")}
              >
                <Square size={24} />
                <span className="mt-1 text-sm">Rectangle</span>
              </button>
              <button
                className={`p-3 rounded-lg flex flex-col items-center transition ${
                  tool === "circle"
                    ? "bg-blue-600"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
                onClick={() => setTool("circle")}
              >
                <Circle size={24} />
                <span className="mt-1 text-sm">Circle</span>
              </button>
              <button
                className={`p-3 rounded-lg flex flex-col items-center transition ${
                  tool === "text"
                    ? "bg-blue-600"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
                onClick={() => setTool("text")}
              >
                <Type size={24} />
                <span className="mt-1 text-sm">Text</span>
              </button>
            </div>

            <div className="mb-6">
              <label className="block mb-2">Brush Size: {brushSize}px</label>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="mb-6">
              <label className="block mb-2">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={() => setSnapToGrid(!snapToGrid)}
                  className="rounded text-blue-500"
                />
                <Grid size={18} />
                <span>Snap to Grid</span>
              </label>
            </div>

            {snapToGrid && (
              <div className="mb-6">
                <label className="block mb-2">Grid Size: {gridSize}px</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            <div className="mb-6">
              <label className="block mb-2">
                Zoom: {Math.round(zoom * 100)}%
              </label>
              <div className="flex space-x-2">
                <button
                  className="flex-1 bg-gray-800 hover:bg-gray-700 p-2 rounded flex justify-center"
                  onClick={() => handleZoom("out")}
                >
                  <ZoomOut size={20} />
                </button>
                <button
                  className="flex-1 bg-gray-800 hover:bg-gray-700 p-2 rounded flex justify-center"
                  onClick={() => handleZoom("in")}
                >
                  <ZoomIn size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Main Canvas Area */}
          <div className="lg:col-span-2 bg-black/30 rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Canvas</h2>
              <div className="flex space-x-2">
                <button
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                >
                  <RotateCw size={18} />
                </button>
                <button
                  className="p-2 bg-red-600 hover:bg-red-700 rounded flex items-center space-x-1"
                  onClick={clearCanvas}
                >
                  <Trash2 size={18} />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div
              ref={containerRef}
              className="relative bg-white rounded-lg overflow-hidden"
              style={{ height: "600px" }}
            >
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                  cursor: isPanning
                    ? "grabbing"
                    : tool === "move"
                    ? "grab"
                    : "crosshair",
                }}
                onMouseDown={(e) =>
                  tool === "move" ? startPanning(e) : startDrawing(e)
                }
                onMouseMove={(e) => (tool === "move" ? panCanvas(e) : draw(e))}
                onMouseUp={tool === "move" ? stopPanning : stopDrawing}
                onMouseLeave={tool === "move" ? stopPanning : stopDrawing}
              />
            </div>

            <div className="mt-4 text-sm text-gray-300">
              <p>
                Current Tool: {tool} | Brush Size: {brushSize}px | Color:{" "}
                {color}
              </p>
              {dimensions.width > 0 && (
                <p>
                  Width: {dimensions.width}px | Height: {dimensions.height}px
                </p>
              )}
              {dimensions.radius > 0 && <p>Radius: {dimensions.radius}px</p>}
            </div>
          </div>

          {/* Right Sidebar - History & Export */}
          <div className="lg:col-span-1 bg-black/30 rounded-xl p-4 h-[calc(100vh-6rem)] overflow-y-auto sticky top-24">
            {/* Extrusion Preview */}
            <h2 className="text-lg font-semibold mb-4">Extrusion Preview</h2>
            <div className="bg-gray-800 rounded-lg h-60 mb-6 flex items-center justify-center overflow-hidden">
              <canvas ref={threeCanvasRef} className="w-full h-full" />
            </div>

            <div className="flex flex-col gap-3">
              <label className="font-semibold">
                Extrude Height: {extrudeHeight}px
              </label>
              <input
                type="range"
                min="10"
                max="200"
                value={extrudeHeight}
                onChange={(e) => setExtrudeHeight(Number(e.target.value))}
              />
              <button
                className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold transition flex items-center justify-center"
                onClick={extrudeShape}
              >
                <Box className="mr-2" size={20} />
                Extrude to 3D
              </button>
            </div>

            {/* Dimensions */}
            <h2 className="text-lg font-semibold mb-4">Dimensions</h2>
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Width</p>
                  <p className="text-lg">{dimensions.width}px</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Height</p>
                  <p className="text-lg">{dimensions.height}px</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Radius</p>
                  <p className="text-lg">{dimensions.radius}px</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Extrusion</p>
                  <p className="text-lg">{extrudeHeight}px</p>
                </div>
              </div>
            </div>

            {/* Export Options */}
            <h2 className="text-lg font-semibold mb-4">Export Options</h2>
            <div className="space-y-3">
              <button
                onClick={exportScene}
                className="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded-lg transition flex items-center justify-center shadow-md"
              >
                <Download className="mr-2" size={18} />
                Export as PNG
              </button>
              <button
                onClick={saveScene}
                className="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded-lg transition flex items-center justify-center shadow-md"
              >
                <Upload className="mr-2" size={18} />
                Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SketchApp;
