import * as THREE from 'three';

export interface StubbedVolumeCompositionResult {
    surfaceComposition: Record<string, number>;
    internalComposition: Record<string, number>;
    totalVolume: number;
    timestamp: number;
}

export interface MiningPanelUtils {
    updateHoverCompositionInfo: (composition: any | null, point: THREE.Vector3 | null, brushInfo: any | null) => void;
    updateBrushChunkCompositionInfo: (composition: StubbedVolumeCompositionResult | null) => void;
    getIsMiningTabActive: () => boolean;
    setMiningTabActiveStatus: (isActive: boolean) => void;
    updateMiningPanelWithCurrentChunkData: () => void;
    setEmergencyPanelVisible: (visible: boolean) => void;
} 