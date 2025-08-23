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
    if (!currentShape && shapes.length === 0) return;

    const shapeToExtrude = currentShape || shapes[shapes.length - 1];

    // Create a Three.js scene and extrude the shape
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Create shape geometry
    let shapeGeometry;

    if (shapeToExtrude.type === "rectangle") {
      const width = Math.abs(shapeToExtrude.endX - shapeToExtrude.startX);
      const height = Math.abs(shapeToExtrude.endY - shapeToExtrude.startY);

      const rectShape = new THREE.Shape();
      rectShape.moveTo(0, 0);
      rectShape.lineTo(width, 0);
      rectShape.lineTo(width, height);
      rectShape.lineTo(0, height);
      rectShape.lineTo(0, 0);

      const extrudeSettings = {
        depth: extrudeHeight,
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 2,
        bevelSegments: 3,
      };

      shapeGeometry = new THREE.ExtrudeGeometry(rectShape, extrudeSettings);
    } else if (shapeToExtrude.type === "circle") {
      const radius = Math.sqrt(
        Math.pow(shapeToExtrude.endX - shapeToExtrude.startX, 2) +
          Math.pow(shapeToExtrude.endY - shapeToExtrude.startY, 2)
      );

      const circleShape = new THREE.Shape();
      circleShape.absarc(0, 0, radius, 0, Math.PI * 2, false);

      const extrudeSettings = {
        depth: extrudeHeight,
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 2,
        bevelSegments: 16,
      };

      shapeGeometry = new THREE.ExtrudeGeometry(circleShape, extrudeSettings);
    }

    if (shapeGeometry) {
      const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(shapeGeometry, material);
      scene.add(mesh);

      camera.position.z = 50;

      // Add lights
      const ambientLight = new THREE.AmbientLight(0x404040);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // Render the scene
      renderer.render(scene, camera);

      // Open extrusion in new window
      const newWindow = window.open("", "_blank");
      newWindow.document.body.appendChild(renderer.domElement);
      newWindow.document.body.style.margin = "0";
      newWindow.document.body.style.overflow = "hidden";
    }
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
            <button className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition shadow-lg">
              <Save size={18} />
              <span className="font-medium">Save</span>
            </button>
            <button className="flex items-center space-x-1 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg transition shadow-lg">
              <Download size={18} />
              <span className="font-medium">Export</span>
            </button>

            {/* Undo / Redo */}
            <button
              className="flex items-center justify-center bg-green-800 hover:bg-green-700 p-2 rounded-lg transition shadow-md"
              title="Undo"
            >
              <RotateCcw size={18} />
            </button>
            <button
              className="flex items-center justify-center bg-green-800 hover:bg-green-700 p-2 rounded-lg transition shadow-md"
              title="Redo"
            >
              <RotateCw size={18} />
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
              to="/3d-editor"
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

            <div className="mb-6">
              <label className="block mb-2">
                Extrusion Height: {extrudeHeight}px
              </label>
              <input
                type="range"
                min="10"
                max="200"
                value={extrudeHeight}
                onChange={(e) => setExtrudeHeight(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <button
              className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold transition flex items-center justify-center"
              onClick={extrudeShape}
            >
              <Box className="mr-2" size={20} />
              Extrude to 3D
            </button>
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
            <div className="bg-gray-800 rounded-lg h-48 mb-6 flex items-center justify-center">
              <p className="text-gray-400 text-center px-2">
                3D preview will appear here after extrusion
              </p>
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
              <button className="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded-lg transition flex items-center justify-center shadow-md">
                <Download className="mr-2" size={18} />
                Export as PNG
              </button>
              <button className="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded-lg transition flex items-center justify-center shadow-md">
                <Upload className="mr-2" size={18} />
                Export as JSON
              </button>
              <button className="w-full bg-gray-800 hover:bg-gray-700 py-2 rounded-lg transition flex items-center justify-center shadow-md">
                <Box className="mr-2" size={18} />
                Export as STL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SketchApp;
