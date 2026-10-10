import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { ProductMesh } from './ProductMesh';
import { Carton } from './Carton';
import { DimensionLabels } from './DimensionLabels';
function SceneContents({ carton, items, transparent, showLabels, customGeometries }) {
    return (<group>
      <Grid args={[carton.length * 3, carton.width * 3]} position={[carton.length / 2, -0.01, carton.width / 2]} cellSize={Math.max(carton.length, carton.width) * 0.05} cellThickness={0.5} cellColor="#cbd5e1" sectionSize={Math.max(carton.length, carton.width) * 0.25} sectionThickness={1} sectionColor="#94a3b8" fadeDistance={Math.max(carton.length, carton.width) * 3} fadeStrength={1} infiniteGrid={false}/>
      <Carton carton={carton} transparent={transparent} showLabels={showLabels}/>
      {items.map((item, i) => (<ProductMesh key={`${item.typeId}-${i}`} item={item} customGeometry={customGeometries?.get(item.typeId)}/>))}
      {showLabels && <DimensionLabels carton={carton}/>}
    </group>);
}
/** Positions the active camera based on the view type and resets on trigger */
function OrthoCameraController({ view, carton, resetTrigger, }) {
    const { camera } = useThree();
    const cameraConfig = {
        top: {
            position: [carton.length / 2, carton.height * 3, carton.width / 2],
            up: [0, 0, -1],
            target: [carton.length / 2, 0, carton.width / 2],
        },
        front: {
            position: [carton.length / 2, carton.height / 2, carton.width * 3],
            up: [0, 1, 0],
            target: [carton.length / 2, carton.height / 2, carton.width / 2],
        },
        side: {
            position: [carton.length * 3, carton.height / 2, carton.width / 2],
            up: [0, 1, 0],
            target: [carton.length / 2, carton.height / 2, carton.width / 2],
        },
    };
    const config = cameraConfig[view];
    useEffect(() => {
        camera.position.set(...config.position);
        camera.up.set(...config.up);
        if ('zoom' in camera) {
            camera.zoom = 1;
            camera.updateProjectionMatrix();
        }
        camera.lookAt(...config.target);
    }, [camera, config, resetTrigger]);
    return null;
}
function PerspectiveCameraController({ carton, resetTrigger, }) {
    const { camera } = useThree();
    const initialPos = [
        carton.length * 1.8,
        carton.height * 1.8,
        carton.width * 2.2,
    ];
    const target = [
        carton.length / 2,
        carton.height / 2,
        carton.width / 2,
    ];
    useEffect(() => {
        camera.position.set(...initialPos);
        camera.up.set(0, 1, 0);
        camera.lookAt(...target);
    }, [camera, resetTrigger]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}
function OrthoView({ view, carton, items, transparent, showLabels, resetTrigger, customGeometries, }) {
    const maxDim = Math.max(carton.length, carton.width, carton.height);
    const padding = maxDim * 0.3;
    const viewSize = maxDim * 2 + padding * 2;
    const target = view === 'top'
        ? [carton.length / 2, 0, carton.width / 2]
        : [carton.length / 2, carton.height / 2, carton.width / 2];
    return (<Canvas shadows orthographic camera={{
            position: [carton.length / 2, carton.height * 3, carton.width / 2],
            zoom: 1,
            near: -1000,
            far: 5000,
            left: -viewSize / 2,
            right: viewSize / 2,
            top: viewSize / 2,
            bottom: -viewSize / 2,
        }} style={{ width: '100%', height: '100%' }} gl={{ antialias: true, alpha: true }}>
      <OrthoCameraController view={view} carton={carton} resetTrigger={resetTrigger}/>
      <ambientLight intensity={0.6}/>
      <directionalLight position={[carton.length, carton.height * 2, carton.width]} intensity={0.8} castShadow/>
      <directionalLight position={[-carton.length, carton.height, -carton.width]} intensity={0.3}/>
      <SceneContents carton={carton} items={items} transparent={transparent} showLabels={showLabels} customGeometries={customGeometries}/>
      <OrbitControls enableRotate={false} enablePan={true} enableZoom={true} target={target}/>
    </Canvas>);
}
function PerspectiveView({ carton, items, transparent, showLabels, resetTrigger, customGeometries, }) {
    const controlsRef = useRef(null);
    const maxDim = Math.max(carton.length, carton.width, carton.height);
    useEffect(() => {
        if (controlsRef.current) {
            controlsRef.current.reset();
        }
    }, [resetTrigger]);
    return (<Canvas shadows camera={{
            position: [carton.length * 1.8, carton.height * 1.8, carton.width * 2.2],
            fov: 45,
            near: 0.1,
            far: 10000,
        }} style={{ width: '100%', height: '100%' }} gl={{ antialias: true, alpha: true }}>
      <PerspectiveCameraController carton={carton} resetTrigger={resetTrigger}/>
      <ambientLight intensity={0.5}/>
      <directionalLight position={[carton.length * 1.5, carton.height * 3, carton.width * 1.5]} intensity={0.9} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-carton.length * 2} shadow-camera-right={carton.length * 2} shadow-camera-top={carton.height * 2} shadow-camera-bottom={-carton.height} shadow-camera-near={0.1} shadow-camera-far={carton.length * 5}/>
      <directionalLight position={[-carton.length, carton.height * 2, -carton.width]} intensity={0.3}/>
      <Environment preset="warehouse" background={false}/>

      <SceneContents carton={carton} items={items} transparent={transparent} showLabels={showLabels} customGeometries={customGeometries}/>

      <OrbitControls ref={controlsRef} enableRotate={true} enablePan={true} enableZoom={true} target={[carton.length / 2, carton.height / 2, carton.width / 2]} minDistance={maxDim * 0.3} maxDistance={maxDim * 8} makeDefault/>
    </Canvas>);
}
export function Viewport({ view, carton, result, transparent, showLabels, resetTrigger, customGeometries, }) {
    const { items } = result;
    if (view === '3d') {
        return (<PerspectiveView carton={carton} items={items} transparent={transparent} showLabels={showLabels} resetTrigger={resetTrigger} customGeometries={customGeometries}/>);
    }
    return (<OrthoView view={view} carton={carton} items={items} transparent={transparent} showLabels={showLabels} resetTrigger={resetTrigger} customGeometries={customGeometries}/>);
}
