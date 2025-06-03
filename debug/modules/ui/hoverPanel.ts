import * as THREE from 'three';

interface VolumeData {
    materialCounts: {
        [key: string]: {
            percentage: number;
            materialName: string;
            materialSymbol: string;
            materialColor: THREE.Color;
        };
    };
    totalPoints: number;
}

interface BrushInfo {
    shape: string;
    radius: number;
}

export function updateHoverPanel(
    position: THREE.Vector3,
    volumeData: VolumeData,
    brushInfo: BrushInfo,
    hoverPanel: HTMLElement
) {
    let totalCompositionHtml = '';
    let internalGridsHtml = '';

    if (volumeData && volumeData.materialCounts) {
        try {
            // Sort materials by percentage for surface composition
            const surfaceMaterials = Object.values(volumeData.materialCounts)
                .sort((a, b) => b.percentage - a.percentage);

            // Calculate total voxels for a 32³ grid
            const totalVoxels = 32768; // 32^3

            // Generate HTML for each material
            surfaceMaterials.forEach(material => {
                const estimatedUnits = Math.round((material.percentage / 100) * totalVoxels);
                const colorHex = '#' + material.materialColor.getHexString();

                totalCompositionHtml += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; align-items: center;">
                        <div style="display: flex; align-items: center;">
                            <span style="display: inline-block; width: 15px; height: 15px; background-color: ${colorHex}; margin-right: 8px; border: 1px solid #666;"></span>
                            <span style="color: ${colorHex}; font-weight: bold;">${material.materialSymbol}</span>
                            <span style="margin-left: 5px; color: #ccc;">${material.materialName}</span>
                        </div>
                        <div>
                            <span style="color: #aaa;">${material.percentage.toFixed(1)}%</span>
                            <span style="margin-left: 5px; color: #ffcc00; font-weight: bold;">~${estimatedUnits.toLocaleString()} units</span>
                        </div>
                    </div>
                `;
            });

            // Calculate surface vs internal grid distribution
            const surfacePoints = Math.round(volumeData.totalPoints / 9);
            const internalPoints = volumeData.totalPoints - surfacePoints;

            internalGridsHtml = `
                <div style="margin-top: 10px; padding: 5px; background-color: rgba(50, 50, 50, 0.5); border-radius: 3px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Surface Layer:</span>
                        <span style="color: #8aff8a;">${surfacePoints.toLocaleString()} points</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Internal Grid Layers:</span>
                        <span style="color: #8aff8a;">${internalPoints.toLocaleString()} points</span>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error("[HoverPanel] Error formatting materials:", error);
            totalCompositionHtml = `<div style="color: red;">Error formatting materials: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
        }
    } else {
        totalCompositionHtml = `<div style="color: yellow;">No material data available</div>`;
    }

    hoverPanel.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
            MINING COMPOSITION
        </div>

        <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Position:</span>
                <span style="color: #8aff8a;">X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Brush:</span>
                <span style="color: #8aff8a;">${brushInfo.shape}, Radius: ${brushInfo.radius}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Total Points:</span>
                <span style="color: #8aff8a;">${volumeData.totalPoints.toLocaleString()}</span>
            </div>
        </div>

        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; margin-bottom: 5px; color: #ffcc00; border-bottom: 1px solid #ffcc00; padding-bottom: 3px;">
                Total Volume Composition (Surface + Internal)
            </div>
            ${totalCompositionHtml}
        </div>

        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; margin-bottom: 5px; color: #ffcc00; border-bottom: 1px solid #ffcc00; padding-bottom: 3px;">
                Distribution
            </div>
            ${internalGridsHtml}
        </div>

        <div style="font-size: 11px; color: #999; margin-top: 10px; text-align: center; font-style: italic;">
            Last updated: ${new Date().toLocaleTimeString()}
        </div>
    `;

    hoverPanel.style.display = 'block';
}