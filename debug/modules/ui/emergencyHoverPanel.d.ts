/**
 * TypeScript declarations for the emergency hover panel
 */

interface EmergencyHoverPanel {
    init: () => void;
    update: (position: THREE.Vector3, volumeData: any, brushInfo: { shape: string, radius: number }) => void;
    hide: () => void;
    show: (message: string) => void;
}

declare global {
    interface Window {
        emergencyHoverPanel: EmergencyHoverPanel;
    }
}
