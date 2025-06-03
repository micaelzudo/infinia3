/**
 * Advanced AI Features Example
 * 
 * This file demonstrates how to use the enhanced AI system with YUKA integration.
 * It shows practical examples of:
 * - Vision and Memory systems
 * - Fuzzy Logic decision making
 * - Advanced Steering behaviors
 * - Spatial optimization with BVH
 * - Event-driven AI communication
 * - Goal-oriented behavior trees
 * - Graph-based pathfinding
 */

import * as THREE from 'three';
import * as YUKA from 'yuka';
import { AdvancedAIFeatures, AdvancedAIConfig } from './advancedAIFeatures';
import { EnhancedAIAgent } from './enhancedAIAgent';

// Example: Creating and configuring an advanced AI agent
export class AdvancedAIExample {
    private scene: THREE.Scene;
    private aiManager: AdvancedAIFeatures;
    private agents: Map<string, EnhancedAIAgent> = new Map();
    private entityManager: YUKA.EntityManager;

    constructor(scene: THREE.Scene, entityManager: YUKA.EntityManager) {
        this.scene = scene;
        this.entityManager = entityManager;
        this.aiManager = AdvancedAIFeatures.getInstance();
        
        this.setupExampleScenario();
    }

    private setupExampleScenario() {
        // Create multiple AI agents with different configurations
        this.createGuardAgent();
        this.createPatrolAgent();
        this.createScoutAgent();
        this.createLeaderAgent();
        
        // Setup inter-agent communication
        this.setupAgentCommunication();
        
        // Create environmental triggers
        this.setupEnvironmentalTriggers();
    }

    /**
     * Guard Agent: High perception, defensive behavior
     */
    private createGuardAgent() {
        const guardConfig: AdvancedAIConfig = {
            enableVision: true,
            enableMemory: true,
            enableFuzzyLogic: true,
            enableSpatialOptimization: true,
            enableAdvancedSteering: true,
            enableGraphPathfinding: true,
            enableTriggers: true,
            enableTaskScheduling: true,
            enableMessaging: true
        };

        // Create character mesh
        const guardMesh = this.createAgentMesh(0xff0000); // Red guard
        guardMesh.position.set(0, 0, 0);
        this.scene.add(guardMesh);

        // Create YUKA vehicle
        const guardVehicle = new YUKA.Vehicle();
        guardVehicle.position.copy(guardMesh.position as any);
        guardVehicle.maxSpeed = 2;
        guardVehicle.maxForce = 5;
        this.entityManager.add(guardVehicle);

        // Create enhanced AI agent
        const guardAgent = new EnhancedAIAgent(guardMesh, guardVehicle, guardConfig);
        
        // Configure guard-specific settings
        guardAgent.visionSystem.setRange(15); // Long sight range
        guardAgent.visionSystem.setFieldOfView(Math.PI * 0.8); // Wide FOV
        
        // Set up fuzzy logic for threat assessment
        this.setupGuardFuzzyLogic(guardAgent);
        
        // Add defensive steering behaviors
        this.setupGuardSteering(guardAgent);
        
        this.agents.set('guard', guardAgent);
        console.log('🛡️ Guard agent created with enhanced perception');
    }

    /**
     * Patrol Agent: Balanced capabilities, route following
     */
    private createPatrolAgent() {
        const patrolConfig: AdvancedAIConfig = {
            enableVision: true,
            enableMemory: true,
            enableFuzzyLogic: true,
            enableSpatialOptimization: true,
            enableAdvancedSteering: true,
            enableGraphPathfinding: true,
            enableTriggers: false, // Patrol doesn't need triggers
            enableTaskScheduling: true,
            enableMessaging: true
        };

        const patrolMesh = this.createAgentMesh(0x00ff00); // Green patrol
        patrolMesh.position.set(10, 0, 0);
        this.scene.add(patrolMesh);

        const patrolVehicle = new YUKA.Vehicle();
        patrolVehicle.position.copy(patrolMesh.position as any);
        patrolVehicle.maxSpeed = 3;
        patrolVehicle.maxForce = 4;
        this.entityManager.add(patrolVehicle);

        const patrolAgent = new EnhancedAIAgent(patrolMesh, patrolVehicle, patrolConfig);
        
        // Configure patrol route
        this.setupPatrolRoute(patrolAgent);
        
        this.agents.set('patrol', patrolAgent);
        console.log('🚶 Patrol agent created with route following');
    }

    /**
     * Scout Agent: High mobility, exploration focus
     */
    private createScoutAgent() {
        const scoutConfig: AdvancedAIConfig = {
            enableVision: true,
            enableMemory: true,
            enableFuzzyLogic: true,
            enableSpatialOptimization: true,
            enableAdvancedSteering: true,
            enableGraphPathfinding: true,
            enableTriggers: true,
            enableTaskScheduling: true,
            enableMessaging: true
        };

        const scoutMesh = this.createAgentMesh(0x0000ff); // Blue scout
        scoutMesh.position.set(-10, 0, 0);
        this.scene.add(scoutMesh);

        const scoutVehicle = new YUKA.Vehicle();
        scoutVehicle.position.copy(scoutMesh.position as any);
        scoutVehicle.maxSpeed = 5; // Fastest agent
        scoutVehicle.maxForce = 6;
        this.entityManager.add(scoutVehicle);

        const scoutAgent = new EnhancedAIAgent(scoutMesh, scoutVehicle, scoutConfig);
        
        // Configure for exploration
        scoutAgent.visionSystem.setRange(20); // Longest sight range
        scoutAgent.visionSystem.setFieldOfView(Math.PI); // Nearly 180° FOV
        
        // Set up exploration behavior
        this.setupScoutBehavior(scoutAgent);
        
        this.agents.set('scout', scoutAgent);
        console.log('🔍 Scout agent created with exploration capabilities');
    }

    /**
     * Leader Agent: Command and coordination
     */
    private createLeaderAgent() {
        const leaderConfig: AdvancedAIConfig = {
            enableVision: true,
            enableMemory: true,
            enableFuzzyLogic: true,
            enableSpatialOptimization: true,
            enableAdvancedSteering: true,
            enableGraphPathfinding: true,
            enableTriggers: true,
            enableTaskScheduling: true,
            enableMessaging: true
        };

        const leaderMesh = this.createAgentMesh(0xffff00); // Yellow leader
        leaderMesh.position.set(0, 0, 10);
        this.scene.add(leaderMesh);

        const leaderVehicle = new YUKA.Vehicle();
        leaderVehicle.position.copy(leaderMesh.position as any);
        leaderVehicle.maxSpeed = 3;
        leaderVehicle.maxForce = 4;
        this.entityManager.add(leaderVehicle);

        const leaderAgent = new EnhancedAIAgent(leaderMesh, leaderVehicle, leaderConfig);
        
        // Set up command and control
        this.setupLeaderBehavior(leaderAgent);
        
        this.agents.set('leader', leaderAgent);
        console.log('👑 Leader agent created with command capabilities');
    }

    private createAgentMesh(color: number): THREE.Mesh {
        const geometry = new THREE.CapsuleGeometry(0.5, 2, 4, 8);
        const material = new THREE.MeshLambertMaterial({ color });
        return new THREE.Mesh(geometry, material);
    }

    private setupGuardFuzzyLogic(agent: EnhancedAIAgent) {
        // Example: Threat assessment using fuzzy logic
        // This would be implemented in the fuzzy logic system
        console.log('🧠 Setting up guard fuzzy logic for threat assessment');
    }

    private setupGuardSteering(agent: EnhancedAIAgent) {
        // Add defensive behaviors
        console.log('🛡️ Setting up guard defensive steering behaviors');
    }

    private setupPatrolRoute(agent: EnhancedAIAgent) {
        // Create patrol waypoints
        const waypoints = [
            new THREE.Vector3(10, 0, 0),
            new THREE.Vector3(10, 0, 10),
            new THREE.Vector3(-10, 0, 10),
            new THREE.Vector3(-10, 0, 0)
        ];
        
        console.log('🚶 Setting up patrol route with', waypoints.length, 'waypoints');
    }

    private setupScoutBehavior(agent: EnhancedAIAgent) {
        // Configure exploration and reporting
        console.log('🔍 Setting up scout exploration behavior');
    }

    private setupLeaderBehavior(agent: EnhancedAIAgent) {
        // Configure command and coordination
        console.log('👑 Setting up leader command behavior');
    }

    private setupAgentCommunication() {
        // Set up message passing between agents
        this.aiManager.eventDispatcher.addEventListener('threat-detected', (event: any) => {
            console.log('🚨 Threat detected, alerting all agents:', event.data);
            
            // Broadcast to all agents
            this.agents.forEach((agent, id) => {
                if (id !== event.source) {
                    // Send alert message
                    console.log(`📢 Alerting ${id} about threat`);
                }
            });
        });

        this.aiManager.eventDispatcher.addEventListener('area-clear', (event: any) => {
            console.log('✅ Area cleared, resuming normal operations');
        });
    }

    private setupEnvironmentalTriggers() {
        // Create trigger zones
        const alertZone = new YUKA.SphericalTriggerRegion(new YUKA.Vector3(0, 0, 0), 5);
        const trigger = new YUKA.Trigger(alertZone);
        
        trigger.addEventListener('enter', (entity: YUKA.GameEntity) => {
            console.log('🚨 Entity entered alert zone:', entity);
            this.aiManager.eventDispatcher.dispatchEvent({
                type: 'threat-detected',
                data: { entity, position: entity.position }
            });
        });

        trigger.addEventListener('exit', (entity: YUKA.GameEntity) => {
            console.log('✅ Entity left alert zone:', entity);
            this.aiManager.eventDispatcher.dispatchEvent({
                type: 'area-clear',
                data: { entity }
            });
        });

        this.entityManager.add(trigger);
    }

    /**
     * Update all AI agents
     */
    public update(deltaTime: number) {
        // Update the AI manager (handles regulators, spatial optimization, etc.)
        this.aiManager.update(deltaTime);
        
        // Update individual agents
        this.agents.forEach((agent, id) => {
            try {
                agent.update(deltaTime);
            } catch (error) {
                console.warn(`Failed to update agent ${id}:`, error);
            }
        });
    }

    /**
     * Demonstrate specific AI features
     */
    public demonstrateFeatures() {
        console.log('🎯 Demonstrating Advanced AI Features:');
        
        // Vision system demo
        const guard = this.agents.get('guard');
        if (guard) {
            console.log('👁️ Guard vision range:', guard.visionSystem.range);
            console.log('👁️ Guard field of view:', guard.visionSystem.fieldOfView);
        }
        
        // Memory system demo
        const scout = this.agents.get('scout');
        if (scout) {
            console.log('🧠 Scout memory records:', scout.memorySystem.records.length);
        }
        
        // Spatial optimization demo
        console.log('🌐 Spatial optimizer entities:', this.aiManager.spatialOptimizer.entities.length);
        
        // Event system demo
        this.aiManager.eventDispatcher.dispatchEvent({
            type: 'demo-event',
            data: { message: 'This is a demo event!' }
        });
    }

    /**
     * Clean up resources
     */
    public dispose() {
        this.agents.forEach((agent, id) => {
            agent.dispose();
            console.log(`🗑️ Disposed agent: ${id}`);
        });
        this.agents.clear();
    }
}

// Usage example:
/*
const scene = new THREE.Scene();
const entityManager = new YUKA.EntityManager();
const aiExample = new AdvancedAIExample(scene, entityManager);

// In your game loop:
function animate() {
    const deltaTime = clock.getDelta();
    
    // Update AI
    aiExample.update(deltaTime);
    
    // Update YUKA
    entityManager.update(deltaTime);
    
    // Render
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Demonstrate features
aiExample.demonstrateFeatures();
*/