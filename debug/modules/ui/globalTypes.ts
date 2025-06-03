import * as THREE from 'three';
import { MiningPanelUtils } from './types';

declare global {
    interface Window {
        currentNoiseLayers?: any;
        currentSeed?: any;
        currentCompInfo?: any;
        currentNoiseScale?: number;
        currentPlanetOffset?: THREE.Vector3;
        miningPanelTabUtils?: MiningPanelUtils;
    }
} 