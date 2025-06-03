import * as THREE from 'three';
import * as YUKA from 'yuka';
import { GUI as DatGUI } from 'dat.gui';

// Local implementation of createConvexRegionHelper
function createConvexRegionHelper(navMesh: YUKA.NavMesh): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const lineSegments = new THREE.LineSegments(geometry, material);
    
    // Update the geometry based on the navMesh
    const updateGeometry = () => {
        const vertices: number[] = [];
        const indices: number[] = [];
        
        // Get all regions from the navMesh
        const regions = (navMesh as any).regions || [];
        
        // For each region, create edges
        let edgeCount = 0;
        regions.forEach((region: any) => {
            const edges = region.edge || [];
            
            edges.forEach((edge: any) => {
                if (edge.midpoint && edge.adjacentRegion === null) {
                    const v1 = edge.vertex1;
                    const v2 = edge.vertex2;
                    
                    // Add vertices
                    vertices.push(v1.x, v1.y, v1.z);
                    vertices.push(v2.x, v2.y, v2.z);
                    
                    // Add indices
                    indices.push(edgeCount * 2, edgeCount * 2 + 1);
                    edgeCount++;
                }
            });
        });
        
        // Update the geometry
        geometry.setIndex(indices);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeBoundingSphere();
    };
    
    // Update the geometry initially and whenever the navMesh changes
    updateGeometry();
    
    // Return the line segments
    return lineSegments;
}

type GUI = InstanceType<typeof DatGUI>;

export class YukaDebugger {
    private gui: GUI;
    private agent: any;
    private navMesh: YUKA.NavMesh | null;
    private navMeshHelper: THREE.Mesh | null = null;
    private scene: THREE.Scene;
    private navMeshFolder?: GUI;
    private pathFolder?: GUI;
    private steeringFolder?: GUI;
    private iaPanel: HTMLDivElement;
    private camera: THREE.Camera | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private paused: boolean = false;
    private navMeshVisible: boolean = true;
    private datGuiVisible: boolean = true;
    private pauseBtn: HTMLButtonElement | null = null;
    private navMeshBtn: HTMLButtonElement | null = null;
    private datGuiBtn: HTMLButtonElement | null = null;
    private container: HTMLElement;

    constructor(agent: any, scene: THREE.Scene, navMesh: YUKA.NavMesh | null, camera?: THREE.Camera, renderer?: THREE.WebGLRenderer, container?: HTMLElement) {
        this.agent = agent;
        this.scene = scene;
        this.navMesh = navMesh;
        this.camera = camera || null;
        this.renderer = renderer || null;
        this.container = container || document.body;
        this.gui = new DatGUI({ width: 350 });
        this.setupAgentPanel();
        this.setupNavMeshPanel();
        this.setupPathPanel();
        this.setupSteeringPanel();
        this.visualizeNavMesh();
        this.iaPanel = this.createIAPanel();
        this.createPanelButtons();
    }

    setupAgentPanel() {
        const agentFolder = this.gui.addFolder('YUKA Agent');
        agentFolder.add(this.agent, 'maxSpeed', 0, 20).listen();
        agentFolder.add(this.agent, 'mass', 0, 10).listen();
        agentFolder.add(this.agent, 'boundingRadius', 0.1, 5).name('Bounding Radius');
        agentFolder.add(this.agent, 'currentAnimation').listen();
        agentFolder.add(this.agent, 'isAIControlled').listen();
        agentFolder.add(this.agent.position, 'x').name('pos.x').listen();
        agentFolder.add(this.agent.position, 'y').name('pos.y').listen();
        agentFolder.add(this.agent.position, 'z').name('pos.z').listen();
        
        // AI State controls
        if (this.agent.stateMachine) {
            const aiFolder = agentFolder.addFolder('AI State');
            const stateControls = {
                currentState: this.agent.stateMachine.currentState?.name || 'None',
                alertLevel: 0,
                isAIControlled: this.agent.isAIControlled
            };
            
            aiFolder.add(stateControls, 'currentState').name('Current State').listen();
            aiFolder.add(stateControls, 'alertLevel', 0, 1).name('Alert Level').listen();
            aiFolder.add(stateControls, 'isAIControlled').name('AI Controlled').onChange((value: boolean) => {
                this.agent.setAIControlled && this.agent.setAIControlled(value);
            });
        }
        
        // Perception controls
        if (this.agent.vision) {
            const perceptionFolder = agentFolder.addFolder('Perception');
            perceptionFolder.add(this.agent.vision, 'range', 1, 50).name('Vision Range');
            perceptionFolder.add(this.agent.vision, 'fieldOfView', 0, Math.PI).name('Field of View');
            
            const perceptionControls = {
                visibleEntitiesCount: 0,
                memoryRecordsCount: 0,
                showVision: false
            };
            
            perceptionFolder.add(perceptionControls, 'visibleEntitiesCount').name('Visible Entities').listen();
            perceptionFolder.add(perceptionControls, 'memoryRecordsCount').name('Memory Records').listen();
            perceptionFolder.add(perceptionControls, 'showVision').name('Show Vision').onChange((value: boolean) => {
                if (this.agent.visionHelper) {
                    this.agent.visionHelper.visible = value;
                }
            });
        }
        
        agentFolder.open();
    }

    setupNavMeshPanel() {
        if (!this.navMesh) return;
        this.navMeshFolder = this.gui.addFolder('NavMesh');
        this.navMeshFolder.add({ regions: this.navMesh.regions.length }, 'regions').listen();
        this.navMeshFolder.open();
    }

    setupPathPanel() {
        if (!this.agent.currentPath) return;
        this.pathFolder = this.gui.addFolder('Path');
        this.pathFolder.add({ points: this.agent.currentPath.points?.length || this.agent.currentPath.length || 0 }, 'points').listen();
        this.pathFolder.open();
    }

    setupSteeringPanel() {
        if (!this.agent.steering) return;
        this.steeringFolder = this.gui.addFolder('Steering');
        
        // Add controls for different steering behaviors
        const controls = {
            seek: false,
            flee: false,
            wander: false,
            obstacleAvoidance: true,
            targetX: 0,
            targetY: 0,
            targetZ: 0,
            wanderRadius: this.agent.wanderRadius || 10
        };
        
        this.steeringFolder.add(controls, 'seek').onChange((value: boolean) => {
            if (value) {
                const target = new YUKA.Vector3(controls.targetX, controls.targetY, controls.targetZ);
                this.agent.moveTo && this.agent.moveTo(new THREE.Vector3(target.x, target.y, target.z));
            }
        });
        
        this.steeringFolder.add(controls, 'wander').onChange((value: boolean) => {
            if (value) {
                this.agent.startWandering && this.agent.startWandering();
            } else {
                // Remove wander behavior but keep others
                if (this.agent.steering.behaviors) {
                    this.agent.steering.behaviors.forEach((behavior: any) => {
                        if (behavior.constructor.name === 'WanderBehavior') {
                            this.agent.steering.remove(behavior);
                        }
                    });
                }
            }
        });
        
        this.steeringFolder.add(controls, 'obstacleAvoidance').name('Obstacle Avoidance').onChange((value: boolean) => {
            if (this.agent.obstacleAvoidance) {
                if (value) {
                    if (!this.agent.steering.behaviors.includes(this.agent.obstacleAvoidance)) {
                        this.agent.steering.add(this.agent.obstacleAvoidance);
                    }
                } else {
                    this.agent.steering.remove(this.agent.obstacleAvoidance);
                }
            }
        });
        
        this.steeringFolder.add(controls, 'targetX', -50, 50).name('Target X');
        this.steeringFolder.add(controls, 'targetY', -10, 10).name('Target Y');
        this.steeringFolder.add(controls, 'targetZ', -50, 50).name('Target Z');
        this.steeringFolder.add(controls, 'wanderRadius', 1, 20).name('Wander Radius').onChange((value: number) => {
            if (this.agent.wanderRadius !== undefined) {
                this.agent.wanderRadius = value;
            }
        });
        
        // Show existing behaviors
        if (this.agent.steering.behaviors) {
            this.agent.steering.behaviors.forEach((b: any, i: number) => {
                this.steeringFolder?.add(b, 'weight').name(b.constructor.name + ' weight').listen();
            });
        }
        
        this.steeringFolder.open();
    }

    visualizeNavMesh() {
        if (!this.navMesh || !this.scene) return;
        if (this.navMeshHelper !== null) {
            this.scene.remove(this.navMeshHelper);
        }
        this.navMeshHelper = createConvexRegionHelper(this.navMesh);
        if (this.navMeshHelper) {
            this.scene.add(this.navMeshHelper);
        }
        this.navMeshVisible = true;
    }

    setNavMeshVisible(visible: boolean) {
        if (this.navMeshHelper) {
            this.navMeshHelper.visible = visible;
        }
        this.navMeshVisible = visible;
    }

    setDatGuiVisible(visible: boolean) {
        const guiDom = document.querySelector('.dg.main');
        if (guiDom instanceof HTMLElement) {
            guiDom.style.display = visible ? '' : 'none';
        }
        this.datGuiVisible = visible;
    }

    createIAPanel(): HTMLDivElement {
        const panel = document.createElement('div');
        panel.style.position = 'absolute';
        panel.style.background = 'rgba(30,30,40,0.95)';
        panel.style.color = '#fff';
        panel.style.padding = '10px 16px 16px 16px';
        panel.style.borderRadius = '10px';
        panel.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
        panel.style.fontFamily = 'monospace';
        panel.style.fontSize = '14px';
        panel.style.pointerEvents = 'auto';
        panel.style.zIndex = '10000';
        panel.style.minWidth = '260px';
        panel.style.transition = 'background 0.2s';
        this.container.appendChild(panel);
        return panel;
    }

    createPanelButtons() {
        // Style for buttons
        const btnStyle = 'margin: 0 6px 6px 0; padding: 4px 10px; border-radius: 6px; border: none; background: #444; color: #fff; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: background 0.2s;';
        // Pause/Resume
        this.pauseBtn = document.createElement('button');
        this.pauseBtn.innerText = 'Pause IA';
        this.pauseBtn.setAttribute('style', btnStyle);
        this.pauseBtn.onclick = () => {
            this.paused = !this.paused;
            this.pauseBtn!.innerText = this.paused ? 'Resume IA' : 'Pause IA';
            if (this.paused) {
                this.agent.maxSpeed = 0;
            } else {
                this.agent.maxSpeed = 4; // or restore previous value
            }
        };
        // NavMesh toggle
        this.navMeshBtn = document.createElement('button');
        this.navMeshBtn.innerText = 'Hide NavMesh';
        this.navMeshBtn.setAttribute('style', btnStyle);
        this.navMeshBtn.onclick = () => {
            this.setNavMeshVisible(!this.navMeshVisible);
            this.navMeshBtn!.innerText = this.navMeshVisible ? 'Hide NavMesh' : 'Show NavMesh';
        };
        // dat.GUI toggle
        this.datGuiBtn = document.createElement('button');
        this.datGuiBtn.innerText = 'Hide dat.GUI';
        this.datGuiBtn.setAttribute('style', btnStyle);
        this.datGuiBtn.onclick = () => {
            this.setDatGuiVisible(!this.datGuiVisible);
            this.datGuiBtn!.innerText = this.datGuiVisible ? 'Hide dat.GUI' : 'Show dat.GUI';
        };
        // Add to panel
        this.iaPanel.appendChild(this.pauseBtn);
        this.iaPanel.appendChild(this.navMeshBtn);
        this.iaPanel.appendChild(this.datGuiBtn);
    }

    updateIAPanel() {
        if (!this.agent || !this.camera || !this.renderer) return;
        // Project agent position to screen
        const pos = this.agent.position ? this.agent.position : (this.agent.sketchbookCharacter?.position || new THREE.Vector3());
        const screenPos = pos.clone().project(this.camera);
        const x = (screenPos.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth;
        const y = (-(screenPos.y * 0.5) + 0.5) * this.renderer.domElement.clientHeight;
        this.iaPanel.style.left = `${x + 30}px`;
        this.iaPanel.style.top = `${y - 80}px`;

        // Get YUKA info
        let regionFound = false;
        let currentState = 'N/A';
        let alertLevel = 0;
        let visibleEntitiesCount = 0;
        let memoryRecordsCount = 0;
        
        if (this.navMesh && this.agent.position) {
            const yukaPos = new YUKA.Vector3(pos.x, pos.y, pos.z);
            const region = this.navMesh.getClosestRegion(yukaPos);
            regionFound = !!region;
        }
        
        if (this.agent.stateMachine?.currentState) {
            currentState = this.agent.stateMachine.currentState.name;
        }
        
        if (this.agent.getAlertLevel) {
            alertLevel = this.agent.getAlertLevel();
        }
        
        if (this.agent.getVisibleEntities) {
            visibleEntitiesCount = this.agent.getVisibleEntities().size;
        }
        
        if (this.agent.memorySystem) {
            memoryRecordsCount = this.agent.memorySystem.records.length;
        }

        // Path visualization
        let pathHtml = '';
        if (this.agent.currentPath && Array.isArray(this.agent.currentPath.points)) {
            pathHtml += '<b>Path Points:</b><br><ol style="margin:0 0 0 18px;padding:0;">';
            this.agent.currentPath.points.forEach((pt: any, idx: number) => {
                const isTarget = (this.agent.currentPath._current !== undefined && idx === this.agent.currentPath._current);
                pathHtml += `<li style="color:${isTarget ? '#0ff' : '#fff'};font-weight:${isTarget ? 'bold' : 'normal'};">(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}, ${pt.z.toFixed(2)})${isTarget ? ' ← Target' : ''}</li>`;
            });
            pathHtml += '</ol>';
        } else {
            pathHtml += `<b>Path Points:</b> N/A`;
        }

        // Build info
        const info = [
            `<b>YUKA IA Debugger</b>`,
            `<hr style='border:1px solid #333;margin:4px 0;'>`,
            `<b>Position:</b> (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`,
            `<b>Velocity:</b> (${this.agent.velocity?.x?.toFixed(2)}, ${this.agent.velocity?.y?.toFixed(2)}, ${this.agent.velocity?.z?.toFixed(2)})`,
            `<b>Current Animation:</b> ${this.agent.currentAnimation || this.agent.sketchbookCharacter?.currentAnimation || 'N/A'}`,
            `<b>AI State:</b> ${this.agent.isAIControlled ? 'AI' : 'Player'}`,
            `<b>Current State:</b> ${currentState}`,
            `<b>Alert Level:</b> ${alertLevel.toFixed(2)}`,
            `<b>Visible Entities:</b> ${visibleEntitiesCount}`,
            `<b>Memory Records:</b> ${memoryRecordsCount}`,
            `<b>NavMesh Region:</b> ${regionFound ? 'Found' : 'Not found'}`,
            pathHtml
        ];
        // Keep buttons at the top, info below
        let btns = '';
        if (this.pauseBtn && this.navMeshBtn && this.datGuiBtn) {
            btns = this.pauseBtn.outerHTML + this.navMeshBtn.outerHTML + this.datGuiBtn.outerHTML;
        }
        this.iaPanel.innerHTML = btns + info.join('<br>');
        // Re-attach event listeners (since innerHTML resets them)
        this.createPanelButtons();
    }

    removeIAPanel() {
        if (this.iaPanel && this.iaPanel.parentElement) {
            this.iaPanel.parentElement.removeChild(this.iaPanel);
        }
    }

    dispose() {
        this.gui.destroy();
        if (this.navMeshHelper !== null && this.scene) {
            this.scene.remove(this.navMeshHelper);
        }
        this.removeIAPanel();
    }
}

// Helper to setup and update the debugger
export function setupYukaDebugger(agent: any, scene: THREE.Scene, navMesh: YUKA.NavMesh | null, camera?: THREE.Camera, renderer?: THREE.WebGLRenderer, container?: HTMLElement) {
    return new YukaDebugger(agent, scene, navMesh, camera, renderer, container);
}