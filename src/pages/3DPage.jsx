import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';

const ThreeJsCadEditor = () => {
  // Refs
  const canvasRef = useRef(null);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const transformControlsRef = useRef(null);
  const selectedObjectRef = useRef(null);
  
  // State
  const [selectedObject, setSelectedObject] = useState(null);
  const [objects, setObjects] = useState([]);
  const [mode, setMode] = useState('view'); // view, translate, rotate, scale, sketch
  const [sketchType, setSketchType] = useState('rectangle'); // rectangle, circle
  const [extrusionHeight, setExtrusionHeight] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPreview, setCurrentPreview] = useState(null);

  // Initialize the scene
  useEffect(() => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    
    // Set up camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x222222);
    rendererRef.current = renderer;
    
    // Set up orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;
    
    // Set up transform controls
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value;
    });
    transformControls.addEventListener('change', () => {
      if (selectedObjectRef.current) {
        updateObjectProperties(selectedObjectRef.current);
      }
    });
    scene.add(transformControls);
    transformControlsRef.current = transformControls;
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Add helpers
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    
    // Event listeners
    window.addEventListener('resize', handleResize);
    renderer.domElement.addEventListener('click', handleCanvasClick);
    renderer.domElement.addEventListener('mousedown', handleCanvasMouseDown);
    renderer.domElement.addEventListener('mousemove', handleCanvasMouseMove);
    renderer.domElement.addEventListener('mouseup', handleCanvasMouseUp);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.domElement.removeEventListener('mousedown', handleCanvasMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleCanvasMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleCanvasMouseUp);
      renderer.dispose();
    };
  }, []);

  // Handle window resize
  const handleResize = () => {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // Handle canvas click for object selection
  const handleCanvasClick = (event) => {
    if (mode !== 'view' && mode !== 'sketch') return;
    
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Filter out helpers and controls
    const validIntersects = intersects.filter(item => 
      !(item.object instanceof THREE.GridHelper) &&
      !(item.object instanceof THREE.AxesHelper) &&
      !(item.object instanceof TransformControls)
    );
    
    if (validIntersects.length > 0) {
      selectObject(validIntersects[0].object);
    } else {
      deselectObject();
    }
  };

  // Handle mouse events for sketching
  const handleCanvasMouseDown = (event) => {
    if (mode !== 'sketch') return;
    
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Intersect with the XZ plane (y=0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);
    
    // Snap to grid
    intersectionPoint.x = Math.round(intersectionPoint.x);
    intersectionPoint.z = Math.round(intersectionPoint.z);
    
    setIsDrawing(true);
    setStartPoint(intersectionPoint.clone());
  };

  const handleCanvasMouseMove = (event) => {
    if (mode !== 'sketch' || !isDrawing || !startPoint) return;
    
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Intersect with the XZ plane (y=0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const currentPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, currentPoint);
    
    // Snap to grid
    currentPoint.x = Math.round(currentPoint.x);
    currentPoint.z = Math.round(currentPoint.z);
    
    // Remove previous preview
    if (currentPreview) {
      scene.remove(currentPreview);
      currentPreview.geometry.dispose();
      currentPreview.material.dispose();
    }
    
    // Create preview based on sketch type
    let previewGeometry;
    let previewMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    
    if (sketchType === 'rectangle') {
      const width = Math.abs(currentPoint.x - startPoint.x);
      const height = Math.abs(currentPoint.z - startPoint.z);
      const minX = Math.min(startPoint.x, currentPoint.x);
      const minZ = Math.min(startPoint.z, currentPoint.z);
      
      const shape = new THREE.Shape();
      shape.moveTo(minX, minZ);
      shape.lineTo(minX + width, minZ);
      shape.lineTo(minX + width, minZ + height);
      shape.lineTo(minX, minZ + height);
      shape.lineTo(minX, minZ);
      
      previewGeometry = new THREE.ShapeGeometry(shape);
    } else if (sketchType === 'circle') {
      const radius = Math.sqrt(
        Math.pow(currentPoint.x - startPoint.x, 2) + 
        Math.pow(currentPoint.z - startPoint.z, 2)
      );
      
      const circleShape = new THREE.Shape();
      circleShape.absarc(startPoint.x, startPoint.z, radius, 0, Math.PI * 2, false);
      previewGeometry = new THREE.ShapeGeometry(circleShape);
    }
    
    const preview = new THREE.Line(previewGeometry, previewMaterial);
    preview.rotation.x = -Math.PI / 2; // Rotate to XZ plane
    scene.add(preview);
    setCurrentPreview(preview);
  };

  const handleCanvasMouseUp = () => {
    if (mode !== 'sketch' || !isDrawing || !startPoint || !currentPreview) return;
    
    setIsDrawing(false);
    
    // Create the final sketch shape
    const shapeGroup = new THREE.Group();
    shapeGroup.userData = { type: 'sketch', sketchType };
    
    if (sketchType === 'rectangle') {
      const bounds = currentPreview.geometry.boundingBox;
      const width = bounds.max.x - bounds.min.x;
      const depth = bounds.max.y - bounds.min.y;
      
      shapeGroup.userData.width = width;
      shapeGroup.userData.depth = depth;
      shapeGroup.userData.position = {
        x: bounds.min.x + width / 2,
        y: 0,
        z: bounds.min.y + depth / 2
      };
    } else if (sketchType === 'circle') {
      // For circle, we need to calculate radius from the shape
      const bounds = currentPreview.geometry.boundingBox;
      const radius = Math.max(
        Math.abs(bounds.max.x - bounds.min.x),
        Math.abs(bounds.max.y - bounds.min.y)
      ) / 2;
      
      shapeGroup.userData.radius = radius;
      shapeGroup.userData.position = {
        x: (bounds.max.x + bounds.min.x) / 2,
        y: 0,
        z: (bounds.max.y + bounds.min.y) / 2
      };
    }
    
    // Add the sketch to the scene
    sceneRef.current.add(shapeGroup);
    
    // Add to objects list
    setObjects(prev => [...prev, shapeGroup]);
    
    // Clean up preview
    sceneRef.current.remove(currentPreview);
    currentPreview.geometry.dispose();
    currentPreview.material.dispose();
    setCurrentPreview(null);
    setStartPoint(null);
  };

  // Object selection
  const selectObject = (object) => {
    // Deselect current object
    if (selectedObjectRef.current) {
      selectedObjectRef.current.material.emissive.setHex(selectedObjectRef.current.userData.originalEmissive);
    }
    
    // Select new object
    selectedObjectRef.current = object;
    setSelectedObject(object);
    
    // Store original emissive and highlight
    if (object.material) {
      object.userData.originalEmissive = object.material.emissive.getHex();
      object.material.emissive.setHex(0x888888);
    }
    
    // Attach transform controls
    transformControlsRef.current.attach(object);
    transformControlsRef.current.setMode(mode);
  };

  const deselectObject = () => {
    if (selectedObjectRef.current) {
      // Restore original emissive
      if (selectedObjectRef.current.material) {
        selectedObjectRef.current.material.emissive.setHex(selectedObjectRef.current.userData.originalEmissive);
      }
      
      // Detach transform controls
      transformControlsRef.current.detach();
      
      selectedObjectRef.current = null;
      setSelectedObject(null);
    }
  };

  // Update object properties in state
  const updateObjectProperties = (object) => {
    if (object.userData.type === 'sketch') {
      // For sketches, update from transform
      object.userData.position.x = object.position.x;
      object.userData.position.y = object.position.y;
      object.userData.position.z = object.position.z;
    }
    
    // Force update
    setObjects([...objects]);
  };

  // Create 3D shapes
  const createBox = () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x4682B4 });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Random position within 10x10x10
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );
    
    mesh.userData = { type: 'box', width: 1, height: 1, depth: 1 };
    sceneRef.current.add(mesh);
    setObjects(prev => [...prev, mesh]);
  };

  const createSphere = () => {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0xFF6347 });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Random position within 10x10x10
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );
    
    mesh.userData = { type: 'sphere', radius: 0.5 };
    sceneRef.current.add(mesh);
    setObjects(prev => [...prev, mesh]);
  };

  const createCylinder = () => {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x32CD32 });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Random position within 10x10x10
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );
    
    mesh.userData = { type: 'cylinder', radiusTop: 0.5, radiusBottom: 0.5, height: 1 };
    sceneRef.current.add(mesh);
    setObjects(prev => [...prev, mesh]);
  };

  // Extrude sketch
  const extrudeSketch = () => {
    if (!selectedObject || selectedObject.userData.type !== 'sketch') return;
    
    const sketchData = selectedObject.userData;
    let shape;
    
    if (sketchData.sketchType === 'rectangle') {
      const shape = new THREE.Shape();
      const halfWidth = sketchData.width / 2;
      const halfDepth = sketchData.depth / 2;
      
      shape.moveTo(-halfWidth, -halfDepth);
      shape.lineTo(halfWidth, -halfDepth);
      shape.lineTo(halfWidth, halfDepth);
      shape.lineTo(-halfWidth, halfDepth);
      shape.lineTo(-halfWidth, -halfDepth);
      
      const extrudeSettings = {
        depth: extrusionHeight,
        bevelEnabled: false
      };
      
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const material = new THREE.MeshStandardMaterial({ color: 0x6495ED });
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(
        sketchData.position.x,
        extrusionHeight / 2,
        sketchData.position.z
      );
      
      mesh.userData = { 
        type: 'extruded', 
        originalType: 'rectangle',
        width: sketchData.width,
        depth: sketchData.depth,
        height: extrusionHeight
      };
      
      sceneRef.current.add(mesh);
      setObjects(prev => [...prev, mesh]);
      
    } else if (sketchData.sketchType === 'circle') {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, sketchData.radius, 0, Math.PI * 2, false);
      
      const extrudeSettings = {
        depth: extrusionHeight,
        bevelEnabled: false
      };
      
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const material = new THREE.MeshStandardMaterial({ color: 0x6495ED });
      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.set(
        sketchData.position.x,
        extrusionHeight / 2,
        sketchData.position.z
      );
      
      mesh.userData = { 
        type: 'extruded', 
        originalType: 'circle',
        radius: sketchData.radius,
        height: extrusionHeight
      };
      
      sceneRef.current.add(mesh);
      setObjects(prev => [...prev, mesh]);
    }
    
    // Remove the original sketch
    sceneRef.current.remove(selectedObject);
    setObjects(prev => prev.filter(obj => obj !== selectedObject));
    deselectObject();
  };

  // Scene persistence
  const exportScene = () => {
    const sceneData = objects.map(obj => {
      const data = { ...obj.userData };
      
      // Add transform data
      data.position = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      data.rotation = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
      data.scale = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
      
      return data;
    });
    
    const dataStr = JSON.stringify(sceneData);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'scene.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importScene = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new JSON.FileReader();
    reader.onload = function(e) {
      try {
        const sceneData = JSON.parse(e.target.result);
        
        // Clear current scene
        objects.forEach(obj => sceneRef.current.remove(obj));
        setObjects([]);
        deselectObject();
        
        // Recreate objects
        sceneData.forEach(data => {
          let geometry, material, mesh;
          
          if (data.type === 'box') {
            geometry = new THREE.BoxGeometry(data.width, data.height, data.depth);
            material = new THREE.MeshStandardMaterial({ color: 0x4682B4 });
            mesh = new THREE.Mesh(geometry, material);
            mesh.userData = data;
          } else if (data.type === 'sphere') {
            geometry = new THREE.SphereGeometry(data.radius, 32, 32);
            material = new THREE.MeshStandardMaterial({ color: 0xFF6347 });
            mesh = new THREE.Mesh(geometry, material);
            mesh.userData = data;
          } else if (data.type === 'cylinder') {
            geometry = new THREE.CylinderGeometry(
              data.radiusTop, 
              data.radiusBottom, 
              data.height, 
              32
            );
            material = new THREE.MeshStandardMaterial({ color: 0x32CD32 });
            mesh = new THREE.Mesh(geometry, material);
            mesh.userData = data;
          } else if (data.type === 'extruded') {
            let shape;
            
            if (data.originalType === 'rectangle') {
              shape = new THREE.Shape();
              const halfWidth = data.width / 2;
              const halfDepth = data.depth / 2;
              
              shape.moveTo(-halfWidth, -halfDepth);
              shape.lineTo(halfWidth, -halfDepth);
              shape.lineTo(halfWidth, halfDepth);
              shape.lineTo(-halfWidth, halfDepth);
              shape.lineTo(-halfWidth, -halfDepth);
            } else if (data.originalType === 'circle') {
              shape = new THREE.Shape();
              shape.absarc(0, 0, data.radius, 0, Math.PI * 2, false);
            }
            
            const extrudeSettings = {
              depth: data.height,
              bevelEnabled: false
            };
            
            geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            material = new THREE.MeshStandardMaterial({ color: 0x6495ED });
            mesh = new THREE.Mesh(geometry, material);
            mesh.userData = data;
          }
          
          // Apply transforms
          if (data.position) {
            mesh.position.set(data.position.x, data.position.y, data.position.z);
          }
          
          if (data.rotation) {
            mesh.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
          }
          
          if (data.scale) {
            mesh.scale.set(data.scale.x, data.scale.y, data.scale.z);
          }
          
          sceneRef.current.add(mesh);
          setObjects(prev => [...prev, mesh]);
        });
      } catch (error) {
        console.error('Error parsing scene file:', error);
        alert('Failed to import scene: Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  // Change transform mode
  const changeMode = (newMode) => {
    setMode(newMode);
    if (transformControlsRef.current && selectedObjectRef.current) {
      transformControlsRef.current.setMode(newMode);
    }
  };

  // Enter sketch mode
  const enterSketchMode = (type) => {
    setMode('sketch');
    setSketchType(type);
    deselectObject();
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 p-4 flex flex-col space-y-6 overflow-y-auto">
        <h1 className="text-xl font-bold">3D CAD Editor</h1>
        
        {/* Mode Selection */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Transform Mode</h2>
          <div className="grid grid-cols-2 gap-2">
            <button 
              className={`p-2 rounded ${mode === 'view' ? 'bg-blue-600' : 'bg-gray-700'}`}
              onClick={() => changeMode('view')}
            >
              View
            </button>
            <button 
              className={`p-2 rounded ${mode === 'translate' ? 'bg-blue-600' : 'bg-gray-700'}`}
              onClick={() => changeMode('translate')}
            >
              Move
            </button>
            <button 
              className={`p-2 rounded ${mode === 'rotate' ? 'bg-blue-600' : 'bg-gray-700'}`}
              onClick={() => changeMode('rotate')}
            >
              Rotate
            </button>
            <button 
              className={`p-2 rounded ${mode === 'scale' ? 'bg-blue-600' : 'bg-gray-700'}`}
              onClick={() => changeMode('scale')}
            >
              Scale
            </button>
          </div>
        </div>
        
        {/* Create 3D Objects */}
        <div>
          <h2 className="text-lg font-semibold mb-2">3D Objects</h2>
          <div className="grid grid-cols-3 gap-2">
            <button 
              className="p-2 bg-green-700 rounded"
              onClick={createBox}
            >
              Box
            </button>
            <button 
              className="p-2 bg-green-700 rounded"
              onClick={createSphere}
            >
              Sphere
            </button>
            <button 
              className="p-2 bg-green-700 rounded"
              onClick={createCylinder}
            >
              Cylinder
            </button>
          </div>
        </div>
        
        {/* Sketch Tools */}
        <div>
          <h2 className="text-lg font-semibold mb-2">2D Sketch</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button 
              className={`p-2 rounded ${mode === 'sketch' && sketchType === 'rectangle' ? 'bg-purple-600' : 'bg-purple-700'}`}
              onClick={() => enterSketchMode('rectangle')}
            >
              Rectangle
            </button>
            <button 
              className={`p-2 rounded ${mode === 'sketch' && sketchType === 'circle' ? 'bg-purple-600' : 'bg-purple-700'}`}
              onClick={() => enterSketchMode('circle')}
            >
              Circle
            </button>
          </div>
          
          {selectedObject && selectedObject.userData.type === 'sketch' && (
            <div className="mt-4">
              <h2 className="text-lg font-semibold mb-2">Extrude Sketch</h2>
              <div className="flex items-center space-x-2 mb-2">
                <span>Height:</span>
                <input 
                  type="number" 
                  min="0.1" 
                  step="0.1"
                  value={extrusionHeight}
                  onChange={(e) => setExtrusionHeight(parseFloat(e.target.value))}
                  className="w-20 p-1 bg-gray-700 rounded"
                />
              </div>
              <button 
                className="w-full p-2 bg-blue-600 rounded"
                onClick={extrudeSketch}
              >
                Extrude
              </button>
            </div>
          )}
        </div>
        
        {/* Object Properties */}
        {selectedObject && (
          <div>
            <h2 className="text-lg font-semibold mb-2">Properties</h2>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Type: </span>
                <span>{selectedObject.userData.type}</span>
              </div>
              
              <div>
                <span className="font-medium">Position: </span>
                <span>
                  {selectedObject.position.x.toFixed(2)}, 
                  {selectedObject.position.y.toFixed(2)}, 
                  {selectedObject.position.z.toFixed(2)}
                </span>
              </div>
              
              {selectedObject.userData.type === 'box' && (
                <>
                  <div>
                    <span className="font-medium">Width: </span>
                    <span>{selectedObject.userData.width}</span>
                  </div>
                  <div>
                    <span className="font-medium">Height: </span>
                    <span>{selectedObject.userData.height}</span>
                  </div>
                  <div>
                    <span className="font-medium">Depth: </span>
                    <span>{selectedObject.userData.depth}</span>
                  </div>
                </>
              )}
              
              {selectedObject.userData.type === 'sphere' && (
                <div>
                  <span className="font-medium">Radius: </span>
                  <span>{selectedObject.userData.radius}</span>
                </div>
              )}
              
              {selectedObject.userData.type === 'cylinder' && (
                <>
                  <div>
                    <span className="font-medium">Radius Top: </span>
                    <span>{selectedObject.userData.radiusTop}</span>
                  </div>
                  <div>
                    <span className="font-medium">Radius Bottom: </span>
                    <span>{selectedObject.userData.radiusBottom}</span>
                  </div>
                  <div>
                    <span className="font-medium">Height: </span>
                    <span>{selectedObject.userData.height}</span>
                  </div>
                </>
              )}
              
              {selectedObject.userData.type === 'sketch' && (
                <>
                  <div>
                    <span className="font-medium">Shape: </span>
                    <span>{selectedObject.userData.sketchType}</span>
                  </div>
                  {selectedObject.userData.sketchType === 'rectangle' && (
                    <>
                      <div>
                        <span className="font-medium">Width: </span>
                        <span>{selectedObject.userData.width}</span>
                      </div>
                      <div>
                        <span className="font-medium">Depth: </span>
                        <span>{selectedObject.userData.depth}</span>
                      </div>
                    </>
                  )}
                  {selectedObject.userData.sketchType === 'circle' && (
                    <div>
                      <span className="font-medium">Radius: </span>
                      <span>{selectedObject.userData.radius}</span>
                    </div>
                  )}
                </>
              )}
              
              {selectedObject.userData.type === 'extruded' && (
                <>
                  <div>
                    <span className="font-medium">Original: </span>
                    <span>{selectedObject.userData.originalType}</span>
                  </div>
                  <div>
                    <span className="font-medium">Height: </span>
                    <span>{selectedObject.userData.height}</span>
                  </div>
                  {selectedObject.userData.originalType === 'rectangle' && (
                    <>
                      <div>
                        <span className="font-medium">Width: </span>
                        <span>{selectedObject.userData.width}</span>
                      </div>
                      <div>
                        <span className="font-medium">Depth: </span>
                        <span>{selectedObject.userData.depth}</span>
                      </div>
                    </>
                  )}
                  {selectedObject.userData.originalType === 'circle' && (
                    <div>
                      <span className="font-medium">Radius: </span>
                      <span>{selectedObject.userData.radius}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Scene Persistence */}
        <div className="mt-auto">
          <h2 className="text-lg font-semibold mb-2">Scene</h2>
          <div className="grid grid-cols-2 gap-2">
            <button 
              className="p-2 bg-yellow-600 rounded"
              onClick={exportScene}
            >
              Export
            </button>
            <label className="p-2 bg-yellow-700 rounded text-center cursor-pointer">
              Import
              <input 
                type="file" 
                accept=".json"
                onChange={importScene}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
      
      {/* Main Canvas */}
      <div className="flex-1 relative">
        <canvas 
          ref={canvasRef}
          className="max-w-6xl h-full"
        />
        {/* Sketch Mode Indicator */}
        {mode === 'sketch' && (
          <div className="absolute top-4 left-4 bg-purple-700 bg-opacity-80 p-2 rounded">
            Sketch Mode: {sketchType}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreeJsCadEditor;