export type RotationVelocity = { yaw: number; pitch: number };

export function decayRotationVelocity(velocity: RotationVelocity, factor = 0.93): RotationVelocity {
  return { yaw: velocity.yaw * factor, pitch: velocity.pitch * factor };
}

export function hasVisibleInertia(velocity: RotationVelocity, threshold = 0.03) {
  return Math.abs(velocity.yaw) >= threshold || Math.abs(velocity.pitch) >= threshold;
}
