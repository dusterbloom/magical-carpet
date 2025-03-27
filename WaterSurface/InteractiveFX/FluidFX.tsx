import { Vector2, Vector3 } from 'three';
import { useFluid } from '@funtech-inc/use-shader-fx';
import { useFrame } from '@react-three/fiber';

type Props = {
  densityDissipation?: number;
  velocityDissipation?: number;
  velocityAcceleration?: number;
  pressureDissipation?: number;
  splatRadius?: number;
  curlStrength?: number;
  pressureIterations?: number;
  fluidColor?: (velocity: Vector2) => Vector3;
};

export function FluidFX({
  densityDissipation = 0.97,
  velocityDissipation = 0.98,
  velocityAcceleration = 10,
  pressureDissipation = 0.8,
  splatRadius = 0.15,
  curlStrength = 35,
  pressureIterations = 20,
  fluidColor = (velocity: Vector2) => 
    new Vector3(
      Math.min(Math.abs(velocity.x) * 0.5, 1),
      Math.min(Math.abs(velocity.y) * 0.5, 1),
      0.5
    ),
}: Props) {
  const { ref, update } = useFluid({
    densityDissipation,
    velocityDissipation,
    velocityAcceleration,
    pressureDissipation,
    splatRadius,
    curlStrength,
    pressureIterations,
    fluidColor,
  });

  useFrame((state) => {
    update();
  });

  return <primitive ref={ref} object={new Object3D()} />;
}
