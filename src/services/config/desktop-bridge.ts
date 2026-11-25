type DesktopBridge = NonNullable<Window["aurolis"]>;

export function desktopBridge<K extends keyof DesktopBridge>(
  area: K,
  unavailableMessage: string,
): DesktopBridge[K] {
  const bridge = window.aurolis?.[area];
  if (!bridge) throw new Error(unavailableMessage);
  return bridge;
}
