import * as THREE from 'three';
import * as YUKA from 'yuka';
import { GUI as DatGUI } from 'dat.gui'; // Keep for potential advanced debug, but primary UI will be custom
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';
import { YukaNavMeshHelper } from './yukaNavMeshHelper'; // For interacting with NavMesh
import { yukaEntityManager, yukaTime, getIsYukaSystemPaused, setIsYukaSystemPaused } from './yukaManager'; // To get entities and time, and pause state accessors
import { toggleNavMeshVisibility, regenerateNavMesh, setAgentDestination, setAgentAIControlled } from './yukaController'; // Import controller functions

// --- NEW IMPORTS ---
import { createStyledButton, BUTTON_STYLE } from './yukaUICommon';
import { visualizeNavMeshPolygons, visualizePath, visualizePoint, clearNavMeshDebug } from './navMeshDebugger';

export interface YukaAIControlsOptions {
    container?: HTMLElement; // Where to append the panel
    enableDebugger?: boolean; // General toggle for the whole debugger UI
    enableNavMeshDebug?: boolean; // Initial state for NavMesh visualization
    defaultAgent?: IsolatedYukaCharacter | null;
}

export class YukaAIControls {
    public agent: IsolatedYukaCharacter | null;
    public navMesh: YUKA.NavMesh | null;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer; // Assuming WebGLRenderer for screen coords
    private options: YukaAIControlsOptions;

    private panelElement: HTMLDivElement;
    private datGui: DatGUI | null = null; // Optional dat.gui for advanced/raw property editing

    // --- UI Element References ---
    // Agent Info
    private agentNameDisplay: HTMLElement | null = null;
    private agentPositionDisplay: HTMLElement | null = null;
    private agentVelocityDisplay: HTMLElement | null = null;
    private agentMaxSpeedInput: HTMLInputElement | null = null;
    private agentMassInput: HTMLInputElement | null = null;
    private agentAnimationDisplay: HTMLElement | null = null;
    private agentStateDisplay: HTMLElement | null = null; // For StateMachine state
    private agentControlledByDisplay: HTMLElement | null = null;

    // NavMesh Info & Controls
    private navMeshRegionsDisplay: HTMLElement | null = null;
    private showNavMeshPolygonsBtn: HTMLButtonElement | null = null;
    private navMeshPolygonsVisible: boolean = false;

    // Path Info & Controls
    private pathPointsDisplay: HTMLElement | null = null;
    private showPathBtn: HTMLButtonElement | null = null;
    private pathVisible: boolean = false;
    private setDestinationBtn: HTMLButtonElement | null = null;
    private targetPointMarker: THREE.Mesh | null = null;
    private clickToMoveActive: boolean = false;

    // Steering Info
    private steeringBehaviorsDisplay: HTMLElement | null = null;

    // General Controls
    private pauseResumeBtn: HTMLButtonElement | null = null;
    private toggleAIPlayerBtn: HTMLButtonElement | null = null;
    private spawnAgentBtn: HTMLButtonElement | null = null; // If we want to spawn from here


    constructor(
        agent: IsolatedYukaCharacter | null,
        scene: THREE.Scene,
        navMesh: YUKA.NavMesh | null,
        camera: THREE.Camera,
        renderer: THREE.WebGLRenderer,
        options: YukaAIControlsOptions = {}
    ) {
        this.agent = agent || options.defaultAgent || null;
        this.scene = scene;
        this.navMesh = navMesh;
        this.camera = camera;
        this.renderer = renderer;
        this.options = { enableDebugger: true, enableNavMeshDebug: false, ...options };

        this.panelElement = this.createPanelContainer();
        if (this.options.container) {
            this.options.container.appendChild(this.panelElement);
        } else {
            document.body.appendChild(this.panelElement);
        }

        if (this.options.enableDebugger) {
            this.buildPanelUI();
        }
        this.update(); // Initial update
    }

    private createPanelContainer(): HTMLDivElement {
        const panel = document.createElement('div');
        panel.id = 'yuka-ai-controls-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 350px;
            max-height: 90vh;
            overflow-y: auto;
            background: rgba(25, 28, 32, 0.9);
            color: #e0e0e0;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            font-family: 'Roboto Mono', monospace, sans-serif;
            font-size: 13px;
            line-height: 1.6;
            z-index: 1001;
            border: 1px solid rgba(70,80,90,0.8);
        `;
        return panel;
    }

    private createSection(title: string): { sectionDiv: HTMLDivElement, contentDiv: HTMLDivElement } {
        const sectionDiv = document.createElement('div');
        sectionDiv.style.marginBottom = '15px';
        sectionDiv.style.paddingBottom = '10px';
        sectionDiv.style.borderBottom = '1px solid rgba(70,80,90,0.5)';

        const titleEl = document.createElement('h3');
        titleEl.innerText = title;
        titleEl.style.cssText = `
            margin: 0 0 10px 0;
            color: #66fcf1; /* Cyan accent */
            font-size: 16px;
            border-bottom: 1px solid #45a29e; /* Darker cyan */
            padding-bottom: 5px;
        `;
        sectionDiv.appendChild(titleEl);

        const contentDiv = document.createElement('div');
        contentDiv.style.paddingLeft = '5px';
        sectionDiv.appendChild(contentDiv);
        this.panelElement.appendChild(sectionDiv);
        return { sectionDiv, contentDiv };
    }

    private createInfoDisplay(label: string, parent: HTMLElement): HTMLElement {
        const p = document.createElement('p');
        p.style.margin = '2px 0';
        const strong = document.createElement('strong');
        strong.innerText = label + ": ";
        const span = document.createElement('span');
        span.innerText = "N/A";
        p.appendChild(strong);
        p.appendChild(span);
        parent.appendChild(p);
        return span;
    }

    // NEW: Helper for creating an input field with a label
    private createInputDisplay(label: string, type: string, parent: HTMLElement, initialValue: any, onChange: (value: any) => void): HTMLInputElement {
        const p = document.createElement('p');
        p.style.margin = '5px 0';
        p.style.display = 'flex';
        p.style.justifyContent = 'space-between';
        p.style.alignItems = 'center';

        const strong = document.createElement('strong');
        strong.innerText = label + ": ";
        strong.style.color = '#a7c0c9';
        strong.style.marginRight = '8px';
        p.appendChild(strong);

        const input = document.createElement('input');
        input.type = type;
        input.value = String(initialValue);
        input.style.cssText = BUTTON_STYLE + ' width: 50%; padding: 4px; background-color: #2a2f33; color: #e0e0e0; border: 1px solid #555;';
        if (type === 'number') {
            input.step = '0.1';
        }
        input.onchange = (e) => onChange(type === 'number' ? parseFloat((e.target as HTMLInputElement).value) : (e.target as HTMLInputElement).value);
        input.oninput = (e) => { // Live update for numbers if desired, but onChange is safer for Yuka properties
            if (type === 'number') {
                 onChange(parseFloat((e.target as HTMLInputElement).value));
            }
        };

        p.appendChild(input);
        parent.appendChild(p);
        return input;
    }

    private buildPanelUI() {
        this.panelElement.innerHTML = ''; // Clear previous UI

        // --- General Controls Section ---
        const generalControls = this.createSection('General Controls');
        this.pauseResumeBtn = createStyledButton(getIsYukaSystemPaused() ? 'Resume System' : 'Pause System', () => {
            const currentPauseState = getIsYukaSystemPaused();
            setIsYukaSystemPaused(!currentPauseState);
            console.log(`YUKA system ${!currentPauseState ? 'paused' : 'resumed'}.`);
            this.update(); // Update button text
        });
        generalControls.contentDiv.appendChild(this.pauseResumeBtn);

        this.toggleAIPlayerBtn = createStyledButton(this.agent?.isUnderAIControl() ? 'Set Player Control' : 'Set AI Control', () => {
            if (this.agent) {
                setAgentAIControlled(this.agent.uuid, !this.agent.isUnderAIControl());
            }
            setTimeout(() => this.update(), 50); 
        });
        this.toggleAIPlayerBtn.disabled = !this.agent;
        generalControls.contentDiv.appendChild(this.toggleAIPlayerBtn);
        
        this.spawnAgentBtn = createStyledButton('Spawn New Agent', () => {
            import('./yukaController').then(controller => {
                const newAgent = controller.spawnYukaAgent();
                if (newAgent && !this.agent) { 
                    this.selectAgent(newAgent);
                } else {
                    this.buildPanelUI(); // Rebuild to include new agent in selector if one was already selected
                }
            });
        });
        generalControls.contentDiv.appendChild(this.spawnAgentBtn);


        // --- Agent Selection (if multiple agents) ---
        const agents = yukaEntityManager.entities.filter(e => e instanceof IsolatedYukaCharacter) as IsolatedYukaCharacter[];
        if (agents.length > 0) {
            const agentSelection = this.createSection('Select Agent');
            const selectEl = document.createElement('select');
            selectEl.style.cssText = BUTTON_STYLE + ' width: 100%; padding: 6px; background-color: #333; color: #fff; border: 1px solid #555;';
            
            const noAgentOption = document.createElement('option');
            noAgentOption.value = "__none__"; // Use a distinct value for no selection
            noAgentOption.text = "-- Select an Agent --";
            selectEl.appendChild(noAgentOption);
            if (!this.agent) noAgentOption.selected = true;

            agents.forEach(ag => {
                const option = document.createElement('option');
                option.value = ag.uuid;
                option.text = ag.name;
                if (this.agent && ag.uuid === this.agent.uuid) {
                    option.selected = true;
                }
                selectEl.appendChild(option);
            });
            selectEl.onchange = (e) => {
                const selectedAgentUUID = (e.target as HTMLSelectElement).value;
                if (selectedAgentUUID === "__none__") {
                    this.selectAgent(null);
                } else {
                    const selectedAgent = agents.find(ag => ag.uuid === selectedAgentUUID);
                    this.selectAgent(selectedAgent || null); // Ensure it passes null if not found
                }
            };
            agentSelection.contentDiv.appendChild(selectEl);
        } else {
            const agentSelection = this.createSection('Select Agent');
            const noAgentsMsg = document.createElement('p');
            noAgentsMsg.innerText = "No agents spawned yet.";
            noAgentsMsg.style.color = '#888';
            agentSelection.contentDiv.appendChild(noAgentsMsg);
        }


        // --- Agent Info Section ---
        const agentInfo = this.createSection('Agent Info');
        this.agentNameDisplay = this.createInfoDisplay('Name', agentInfo.contentDiv);
        this.agentPositionDisplay = this.createInfoDisplay('Position', agentInfo.contentDiv);
        this.agentVelocityDisplay = this.createInfoDisplay('Velocity', agentInfo.contentDiv);
        
        // Editable fields
        if (this.agent) {
            this.agentMaxSpeedInput = this.createInputDisplay('Max Speed', 'number', agentInfo.contentDiv, this.agent.maxSpeed.toFixed(2), (value) => {
                if (this.agent && !isNaN(value)) this.agent.maxSpeed = value;
            });
            this.agentMassInput = this.createInputDisplay('Mass', 'number', agentInfo.contentDiv, this.agent.mass.toFixed(2), (value) => {
                if (this.agent && !isNaN(value) && value > 0) this.agent.mass = value; // Mass should be positive
            });
        } else {
            this.createInfoDisplay('Max Speed', agentInfo.contentDiv); // Show as N/A if no agent
            this.createInfoDisplay('Mass', agentInfo.contentDiv);
        }

        this.agentAnimationDisplay = this.createInfoDisplay('Animation', agentInfo.contentDiv);
        this.agentStateDisplay = this.createInfoDisplay('SM State', agentInfo.contentDiv);
        this.agentControlledByDisplay = this.createInfoDisplay('Controlled By', agentInfo.contentDiv);

        // --- NavMesh Section ---
        const navMeshControls = this.createSection('Navigation Mesh');
        this.navMeshRegionsDisplay = this.createInfoDisplay('Regions', navMeshControls.contentDiv);
        
        this.showNavMeshPolygonsBtn = createStyledButton(this.navMeshPolygonsVisible ? 'Hide Polygons' : 'Show Polygons', () => {
            this.navMeshPolygonsVisible = !this.navMeshPolygonsVisible;
            if (this.navMeshPolygonsVisible && this.navMesh) {
                visualizeNavMeshPolygons(this.scene, this.navMesh);
            } else {
                const debugGroup = this.scene.getObjectByName('NavMeshDebugObjects');
                if (debugGroup) {
                    const toRemove: THREE.Object3D[] = [];
                    debugGroup.children.forEach(child => {
                        if (child.userData.type === 'navMeshPolygon') toRemove.push(child);
                    });
                    toRemove.forEach(child => {
                        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                            (child as any).geometry?.dispose();
                            if (Array.isArray((child as any).material)) {
                                (child as any).material.forEach((m: THREE.Material) => m.dispose());
                            } else {
                                (child as any).material?.dispose();
                            }
                        }
                        debugGroup.remove(child);
                    });
                }
            }
            this.update();
        });
        navMeshControls.contentDiv.appendChild(this.showNavMeshPolygonsBtn);

        const regenerateBtn = createStyledButton('Regenerate NavMesh', () => {
            regenerateNavMesh();
        });
        navMeshControls.contentDiv.appendChild(regenerateBtn);

        // --- Path Section ---
        const pathControls = this.createSection('Path Following');
        this.pathPointsDisplay = this.createInfoDisplay('Path Data', pathControls.contentDiv);
        
        this.setDestinationBtn = createStyledButton(this.clickToMoveActive ? 'Cancel Set Dest.' : 'Set Destination', () => {
            if (this.clickToMoveActive) {
                this.disableClickToMove();
            } else {
                this.enableClickToMove();
            }
        });
        this.setDestinationBtn.disabled = !this.agent;
        pathControls.contentDiv.appendChild(this.setDestinationBtn);
        
        this.showPathBtn = createStyledButton(this.pathVisible ? 'Hide Path Viz' : 'Show Path Viz', () => {
            this.pathVisible = !this.pathVisible;
            this.updatePathVisualization();
            this.update();
        });
        this.showPathBtn.disabled = !this.agent;
        pathControls.contentDiv.appendChild(this.showPathBtn);


        // --- Steering Behaviors Section ---
        const steeringInfo = this.createSection('Steering Behaviors');
        this.steeringBehaviorsDisplay = document.createElement('div');
        this.steeringBehaviorsDisplay.style.maxHeight = '200px'; // Increased max height
        this.steeringBehaviorsDisplay.style.overflowY = 'auto';
        this.steeringBehaviorsDisplay.style.padding = '5px';
        this.steeringBehaviorsDisplay.style.background = 'rgba(0,0,0,0.1)';
        this.steeringBehaviorsDisplay.style.borderRadius = '4px';
        steeringInfo.contentDiv.appendChild(this.steeringBehaviorsDisplay);
        // Populate steering behaviors in the update method as they can change dynamically

        this.update(); 
    }
    
    private updatePathVisualization() {
        const debugGroup = this.scene.getObjectByName('NavMeshDebugObjects');
        if (debugGroup) {
            const toRemove: THREE.Object3D[] = [];
            debugGroup.children.forEach(child => {
                if (child.userData.type === 'navPathLine' || child.userData.type === 'navPathPoint') {
                    toRemove.push(child);
                }
            });
            toRemove.forEach(child => {
                if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                    (child as any).geometry?.dispose();
                    if (Array.isArray((child as any).material)) {
                        (child as any).material.forEach((m: THREE.Material) => m.dispose());
                    } else {
                        (child as any).material?.dispose();
                    }
                }
                debugGroup.remove(child);
            });
        }

        if (this.agent && this.pathVisible) {
            try {
                const pathData = (this.agent as any)._currentYukaPathData;
                if (pathData && pathData.path && pathData.path.length > 0) {
                    visualizePath(this.scene, pathData.path.map((p: YUKA.Vector3) => new THREE.Vector3(p.x, p.y, p.z)));
                }
            } catch (e) {
                console.warn("Could not get path data for visualization", e);
            }
        }
    }

    private clickToMoveHandler = (event: MouseEvent) => {
        if (!this.agent || !this.camera || !this.renderer || !this.clickToMoveActive) return;

        const pointer = new THREE.Vector2();
        pointer.x = (event.clientX / this.renderer.domElement.clientWidth) * 2 - 1;
        pointer.y = -(event.clientY / this.renderer.domElement.clientHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, this.camera);

        const terrainObjects: THREE.Object3D[] = [];
        this.scene.traverseVisible(obj => {
            if (obj.name.startsWith('terrain_') || obj.name.startsWith('ai_chunk_') || obj.userData.isTerrain) {
                terrainObjects.push(obj);
            }
        });
        
        if (terrainObjects.length === 0) {
            console.warn("[YukaAIControls] No terrain objects found for click-to-move raycast.");
            this.disableClickToMove();
            return;
        }
        const intersects = raycaster.intersectObjects(terrainObjects, false);

        if (intersects.length > 0) {
            const targetPoint = intersects[0].point;
            
            if (this.targetPointMarker && this.targetPointMarker.parent) this.targetPointMarker.parent.remove(this.targetPointMarker);
            const markerGeom = new THREE.SphereGeometry(0.25, 16, 16);
            const markerMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: false, transparent: true, opacity: 0.7 });
            this.targetPointMarker = new THREE.Mesh(markerGeom, markerMat);
            this.targetPointMarker.position.copy(targetPoint).setY(targetPoint.y + 0.25);
            this.scene.add(this.targetPointMarker);
            visualizePoint(this.scene, targetPoint.clone().setY(targetPoint.y + 0.1), 0xff00ff, 0.15, true, 'clickTarget');

            setTimeout(() => { 
                if(this.targetPointMarker && this.targetPointMarker.parent) this.targetPointMarker.parent.remove(this.targetPointMarker);
                this.targetPointMarker = null;
                const debugGroup = this.scene.getObjectByName('NavMeshDebugObjects');
                if(debugGroup) {
                    const pointToRemove = debugGroup.children.find(c => c.userData.type === 'clickTarget');
                    if(pointToRemove) {
                         if (pointToRemove instanceof THREE.Mesh) {
                            pointToRemove.geometry?.dispose();
                            (pointToRemove.material as THREE.Material)?.dispose();
                        }
                        debugGroup.remove(pointToRemove);
                    }
                }
            }, 2500);

            setAgentDestination(this.agent.uuid, targetPoint);
        }
        this.disableClickToMove();
    };

    private enableClickToMove() {
        if (!this.renderer || !this.agent) return;
        console.log(`[YukaAIControls] Click on terrain to set destination for agent: ${this.agent.name}`);
        this.clickToMoveActive = true;
        this.renderer.domElement.addEventListener('pointerdown', this.clickToMoveHandler);
        this.renderer.domElement.style.cursor = 'crosshair';
        if (this.setDestinationBtn) this.setDestinationBtn.innerText = 'Cancel Set Dest.';
        if (this.setDestinationBtn) this.setDestinationBtn.style.background = '#d66';
    }

    private disableClickToMove() {
        if (!this.renderer) return;
        this.clickToMoveActive = false;
        this.renderer.domElement.removeEventListener('pointerdown', this.clickToMoveHandler);
        this.renderer.domElement.style.cursor = 'default';
        if (this.setDestinationBtn) this.setDestinationBtn.innerText = 'Set Destination';
        if (this.setDestinationBtn) this.setDestinationBtn.style.background = '';
    }
    
    public selectAgent(agent: IsolatedYukaCharacter | null) {
        console.log(`[YukaAIControls] Selected agent: ${agent ? agent.name : 'None'}`);
        if (this.clickToMoveActive) this.disableClickToMove();
        this.agent = agent;
        this.pathVisible = false;
        this.updatePathVisualization();
        this.buildPanelUI(); 
    }

    public update() {
        if (!this.options.enableDebugger || !this.panelElement.isConnected) return;

        if (this.pauseResumeBtn) this.pauseResumeBtn.innerText = getIsYukaSystemPaused() ? 'Resume System' : 'Pause System';
        if (this.toggleAIPlayerBtn) {
            this.toggleAIPlayerBtn.innerText = this.agent?.isUnderAIControl() ? 'Set Player Control' : 'Set AI Control';
            this.toggleAIPlayerBtn.disabled = !this.agent;
        }
        if (this.showNavMeshPolygonsBtn) this.showNavMeshPolygonsBtn.innerText = this.navMeshPolygonsVisible ? 'Hide Polygons' : 'Show Polygons';
        if (this.showPathBtn) {
            this.showPathBtn.innerText = this.pathVisible ? 'Hide Path Viz' : 'Show Path Viz';
            this.showPathBtn.disabled = !this.agent;
        }
        if (this.setDestinationBtn) {
            this.setDestinationBtn.innerText = this.clickToMoveActive ? 'Cancel Set Dest.' : 'Set Destination';
            this.setDestinationBtn.disabled = !this.agent;
        }

        if (this.agent) {
            if (this.agentNameDisplay) this.agentNameDisplay.innerText = this.agent.name;
            if (this.agentPositionDisplay) this.agentPositionDisplay.innerText = `(${this.agent.position.x.toFixed(2)}, ${this.agent.position.y.toFixed(2)}, ${this.agent.position.z.toFixed(2)})`;
            if (this.agentVelocityDisplay) this.agentVelocityDisplay.innerText = `(${this.agent.velocity.x.toFixed(2)}, ${this.agent.velocity.y.toFixed(2)}, ${this.agent.velocity.z.toFixed(2)}) (len: ${this.agent.velocity.length().toFixed(2)})`;
            if (this.agentAnimationDisplay) this.agentAnimationDisplay.innerText = (this.agent.sketchbookCharacter as any)?.currentAnimation || 'N/A';
            if (this.agentStateDisplay) this.agentStateDisplay.innerText = this.agent.stateMachine.currentState?.constructor.name || 'N/A';
            if (this.agentControlledByDisplay) this.agentControlledByDisplay.innerText = this.agent.isUnderAIControl() ? 'AI' : 'Player';

            if (this.pathPointsDisplay) {
                const pathData = (this.agent as any).activePathData;
                if (pathData && Array.isArray(pathData.path) && pathData.path.length > 0) {
                    this.pathPointsDisplay.innerText = `${pathData.path.length} points (target: ${pathData.currentIndex + 1})`;
                } else {
                     this.pathPointsDisplay.innerText = "N/A";
                }
            }

            // Update Steering Behaviors Display
            if (this.steeringBehaviorsDisplay) {
                this.steeringBehaviorsDisplay.innerHTML = ''; 
                const agentToCheck = this.agent!; // Ensure agent is non-null for this block

                // Access steering and check for null/empty behaviors in the if condition directly
                if (agentToCheck.steering && agentToCheck.steering.behaviors.length > 0) {
                    const steeringManager = agentToCheck.steering; // Now known to be non-null here
                    steeringManager.behaviors.forEach((behavior: YUKA.SteeringBehavior, index: number) => {
                        const behaviorDiv = document.createElement('div');
                        behaviorDiv.style.marginBottom = '8px';
                        behaviorDiv.style.padding = '5px';
                        behaviorDiv.style.border = '1px solid #333a40';
                        behaviorDiv.style.borderRadius = '3px';

                        const title = document.createElement('strong');
                        title.innerText = behavior.constructor.name;
                        title.style.color = '#b0c4de';
                        behaviorDiv.appendChild(title);

                        const activeLabel = document.createElement('label');
                        activeLabel.style.display = 'block';
                        activeLabel.style.marginTop = '3px';
                        activeLabel.style.fontSize = '12px';
                        const activeCheckbox = document.createElement('input');
                        activeCheckbox.type = 'checkbox';
                        activeCheckbox.checked = behavior.active;
                        activeCheckbox.style.marginRight = '5px';
                        activeCheckbox.onchange = () => {
                            behavior.active = activeCheckbox.checked;
                        };
                        activeLabel.appendChild(activeCheckbox);
                        activeLabel.appendChild(document.createTextNode('Active'));
                        behaviorDiv.appendChild(activeLabel);

                        const weightContainer = document.createElement('div');
                        weightContainer.style.display = 'flex';
                        weightContainer.style.alignItems = 'center';
                        weightContainer.style.fontSize = '12px';
                        weightContainer.style.marginTop = '3px';

                        const weightLabel = document.createElement('span');
                        weightLabel.innerText = 'Weight: ';
                        weightLabel.style.marginRight = '5px';
                        weightContainer.appendChild(weightLabel);

                        const weightInput = document.createElement('input');
                        weightInput.type = 'number';
                        weightInput.step = '0.05';
                        weightInput.value = behavior.weight.toFixed(2);
                        weightInput.style.cssText = BUTTON_STYLE + ' width: 70px; padding: 2px 4px; font-size: 12px; background-color: #2a2f33;';
                        weightInput.onchange = () => {
                            const newWeight = parseFloat(weightInput.value);
                            if (!isNaN(newWeight)) {
                                behavior.weight = newWeight;
                            }
                        };
                        weightInput.oninput = () => { 
                                 const newWeight = parseFloat(weightInput.value);
                                if (!isNaN(newWeight)) {
                                    behavior.weight = newWeight;
                                }
                        };
                        weightContainer.appendChild(weightInput);
                        behaviorDiv.appendChild(weightContainer);

                        this.steeringBehaviorsDisplay.appendChild(behaviorDiv);
                    });
                } else {
                    // This covers agentToCheck.steering being null (according to types) OR having no behaviors
                    this.steeringBehaviorsDisplay.innerHTML = '<span style="color: #888;">No active behaviors or steering manager unavailable</span>';
                }
            }

            // Update editable fields if they exist and their values differ (to avoid cursor jumping during input)
            if (this.agentMaxSpeedInput && parseFloat(this.agentMaxSpeedInput.value) !== this.agent.maxSpeed) {
                this.agentMaxSpeedInput.value = this.agent.maxSpeed.toFixed(2);
            }
            if (this.agentMassInput && parseFloat(this.agentMassInput.value) !== this.agent.mass) {
                this.agentMassInput.value = this.agent.mass.toFixed(2);
            }

        } else {
            if (this.agentNameDisplay) this.agentNameDisplay.innerText = "No agent selected";
            const fieldsToClearText = [this.agentPositionDisplay, this.agentVelocityDisplay, this.agentAnimationDisplay, this.agentStateDisplay, this.agentControlledByDisplay, this.pathPointsDisplay];
            fieldsToClearText.forEach(field => { if(field) field.innerText = "N/A"; });

            // Also clear/reset input fields if they exist (or hide them)
            if (this.agentMaxSpeedInput) this.agentMaxSpeedInput.value = "N/A"; // Or disable them
            if (this.agentMassInput) this.agentMassInput.value = "N/A";
            if(this.steeringBehaviorsDisplay) this.steeringBehaviorsDisplay.innerHTML = '<span style="color: #888;">No agent selected</span>';
        }

        if (this.navMeshRegionsDisplay) {
            this.navMeshRegionsDisplay.innerText = this.navMesh ? `${this.navMesh.regions.length}` : "N/A";
        }
    }

    public setNavMesh(navMesh: YUKA.NavMesh | null) {
        this.navMesh = navMesh;
        if (this.navMeshPolygonsVisible) {
            visualizeNavMeshPolygons(this.scene, this.navMesh);
        }
        this.update();
    }
    
    public setActiveAgent(agent: IsolatedYukaCharacter | null) {
        this.selectAgent(agent);
    }

    public dispose() {
        if (this.panelElement.parentElement) {
            this.panelElement.parentElement.removeChild(this.panelElement);
        }
        this.disableClickToMove();
        if (this.targetPointMarker && this.targetPointMarker.parent) this.targetPointMarker.parent.remove(this.targetPointMarker);

        clearNavMeshDebug(this.scene);
        console.log('[YukaAIControls] Disposed.');
    }
}

/**
 * Helper function to initialize the YukaAIControls panel.
 */
export function setupYukaAIControls(
    agent: IsolatedYukaCharacter | null,
    scene: THREE.Scene,
    navMesh: YUKA.NavMesh | null,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    options?: YukaAIControlsOptions
): YukaAIControls {
    return new YukaAIControls(agent, scene, navMesh, camera, renderer, options);
} 