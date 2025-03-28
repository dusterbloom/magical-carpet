import { PlaneGeometry, Vector2, Vector3 } from 'three';
import { useEffect, useMemo } from 'react';
import { extend, useThree } from '@react-three/fiber';
import { Water } from 'three/examples/jsm/objects/Water2';

extend({ Water });

type Props = {
  children?: React.ReactNode;
  position?: [number, number, number];
  width?: number;
  length?: number;
  color?: number | string;
  scale?: number;
  flowDirection?: Vector2 | [number, number];
  flowSpeed?: number;
  dimensions?: number;
  reflectivity?: number;
  fxDistortionFactor?: number;
  fxDisplayColorAlpha?: number;
};

export function WaterSurfaceComplex({
  children,
  position = [0, 0, 0],
  width = 1000,
  length = 1000,
  color = 0x3399ff,
  scale = 3,
  flowDirection = [1, 1],
  flowSpeed = 0.15,
  dimensions = 512,
  reflectivity = 0.02,
  fxDistortionFactor = 0.05,
  fxDisplayColorAlpha = 0.2,
}: Props) {
  const { scene, gl } = useThree();

  const waterGeometry = useMemo(() => new PlaneGeometry(width, length), [width, length]);
  
  const params = useMemo(
    () => ({
      color: color,
      scale: scale,
      flowDirection: new Vector2(...(Array.isArray(flowDirection) ? flowDirection : [flowDirection.x, flowDirection.y])),
      flowSpeed: flowSpeed,
      textureWidth: dimensions,
      textureHeight: dimensions,
      reflectivity: reflectivity,
    }),
    [color, scale, flowDirection, flowSpeed, dimensions, reflectivity]
  );

  const water = useMemo(() => new Water(waterGeometry, params), [waterGeometry, params]);

  useEffect(() => {
    water.position.set(...position);
    water.rotation.x = -Math.PI / 2;
  }, [water, position]);

  return (
    <primitive object={water}>
      {children}
    </primitive>
  );
}
