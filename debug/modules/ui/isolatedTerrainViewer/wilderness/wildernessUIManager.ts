import * as THREE from 'three';
import { WildernessController } from './wildernessController';
import { WildernessInventorySystem } from './wildernessInventorySystem';
import { WildernessCraftingSystem } from './wildernessCraftingSystem';
import { WildernessBuildingSystem } from './wildernessBuildingSystem';
import { WildernessUpgradeSystem } from './wildernessUpgradeSystem';
import { WildernessResourceSystem } from './wildernessResourceSystem';
import { WildernessAlienSystem } from './wildernessAlienSystem';
import { WildernessDayNightCycle } from './wildernessDayNightCycle';
import { UpgradeData } from './upgradeTypes';

export class WildernessUIManager {
    private controller: WildernessController;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    private mainContainer: HTMLElement;

    // Subsystem UI containers
    private inventoryContainer: HTMLElement;
    private craftingContainer: HTMLElement;
    private buildingContainer: HTMLElement;
    private upgradeContainer: HTMLElement;
    private resourceContainer: HTMLElement;
    private alienContainer: HTMLElement;
    private dayNightContainer: HTMLElement;

    constructor(
        controller: WildernessController, 
        scene: THREE.Scene, 
        camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
        mainContainer: HTMLElement
    ) {
        this.controller = controller;
        this.scene = scene;
        this.camera = camera;
        this.mainContainer = mainContainer;

        this.createUIStructure();
    }

    private createUIStructure(): void {
        const uiPanel = document.createElement('div');
        uiPanel.classList.add('wilderness-ui-panel');

        this.inventoryContainer = this.createSubsystemContainer('Inventory');
        this.craftingContainer = this.createSubsystemContainer('Crafting');
        this.buildingContainer = this.createSubsystemContainer('Building');
        this.upgradeContainer = this.createSubsystemContainer('Upgrades');
        this.resourceContainer = this.createSubsystemContainer('Resources');
        this.alienContainer = this.createSubsystemContainer('Alien Encounters');
        this.dayNightContainer = this.createSubsystemContainer('Day/Night Cycle');

        uiPanel.appendChild(this.inventoryContainer);
        uiPanel.appendChild(this.craftingContainer);
        uiPanel.appendChild(this.buildingContainer);
        uiPanel.appendChild(this.upgradeContainer);
        uiPanel.appendChild(this.resourceContainer);
        uiPanel.appendChild(this.alienContainer);
        uiPanel.appendChild(this.dayNightContainer);

        this.mainContainer.appendChild(uiPanel);
    }

    private createSubsystemContainer(title: string): HTMLElement {
        const container = document.createElement('div');
        container.classList.add('subsystem-container');
        
        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        container.appendChild(titleElement);

        return container;
    }

    public initializeSubsystemUIs(
        inventorySystem: WildernessInventorySystem,
        craftingSystem: WildernessCraftingSystem,
        buildingSystem: WildernessBuildingSystem,
        upgradeSystem: WildernessUpgradeSystem,
        resourceSystem: WildernessResourceSystem,
        alienSystem: WildernessAlienSystem,
        dayNightCycle: WildernessDayNightCycle
    ): void {
        this.initInventoryUI(inventorySystem);
        this.initCraftingUI(craftingSystem);
        this.initBuildingUI(buildingSystem);
        this.initUpgradeUI(upgradeSystem);
        this.initResourceUI(resourceSystem);
        this.initAlienUI(alienSystem);
        this.initDayNightUI(dayNightCycle);
    }

    private initInventoryUI(inventorySystem: WildernessInventorySystem): void {
        const inventoryGrid = document.createElement('div');
        inventoryGrid.classList.add('inventory-grid');
        
        for (let i = 0; i < 50; i++) {
            const slot = document.createElement('div');
            slot.classList.add('inventory-slot');
            slot.dataset.slotIndex = i.toString();
            inventoryGrid.appendChild(slot);
        }

        this.inventoryContainer.appendChild(inventoryGrid);
    }

    private initCraftingUI(craftingSystem: WildernessCraftingSystem): void {
        const recipeList = document.createElement('div');
        recipeList.classList.add('crafting-recipes');

        craftingSystem.getCraftableRecipes().forEach(recipe => {
            const recipeElement = document.createElement('div');
            recipeElement.classList.add('recipe-item');
            recipeElement.innerHTML = `
                <span>${recipe.name}</span>
                <button onclick="craftItem('${recipe.id}')">Craft</button>
            `;
            recipeList.appendChild(recipeElement);
        });

        this.craftingContainer.appendChild(recipeList);
    }

    private initBuildingUI(buildingSystem: WildernessBuildingSystem): void {
        const buildingMenu = document.createElement('div');
        buildingMenu.classList.add('building-menu');

        Object.entries(buildingSystem.getBuildingTypes()).forEach(([key, buildingType]) => {
            const buildButton = document.createElement('button');
            buildButton.textContent = `${buildingType} (${key})`;
            buildButton.onclick = () => buildingSystem.selectBuildingType(buildingType);
            buildingMenu.appendChild(buildButton);
        });

        this.buildingContainer.appendChild(buildingMenu);
    }

    private initUpgradeUI(upgradeSystem: WildernessUpgradeSystem): void {
        const upgradeList = document.createElement('div');
        upgradeList.classList.add('upgrade-list');

        const renderUpgrades = (upgrades: UpgradeData[]) => {
            upgrades.forEach(upgrade => {
                const upgradeElement = document.createElement('div');
                upgradeElement.classList.add('upgrade-item');
                upgradeElement.innerHTML = `
                    <h4>${upgrade.name}</h4>
                    <p>${upgrade.description}</p>
                    <span>Level: ${upgrade.level}/${upgrade.maxLevel}</span>
                    <button onclick="performUpgrade('${upgrade.id}')">Upgrade</button>
                `;
                upgradeList.appendChild(upgradeElement);
            });
        };

        upgradeSystem.setRenderCallback(renderUpgrades);
        renderUpgrades(upgradeSystem.getAvailableUpgrades());

        this.upgradeContainer.appendChild(upgradeList);
    }

    private initResourceUI(resourceSystem: WildernessResourceSystem): void {
        const interactionPrompt = document.createElement('div');
        interactionPrompt.classList.add('resource-interaction-prompt');
        resourceSystem.setInteractionPrompt(interactionPrompt);

        this.resourceContainer.appendChild(interactionPrompt);
    }

    private initAlienUI(alienSystem: WildernessAlienSystem): void {
        const encounterLog = document.createElement('div');
        encounterLog.classList.add('encounter-log');
        alienSystem.setEncounterLog(encounterLog);

        this.alienContainer.appendChild(encounterLog);
    }

    private initDayNightUI(dayNightCycle: WildernessDayNightCycle): void {
        const timeDisplay = document.createElement('div');
        timeDisplay.classList.add('time-display');
        dayNightCycle.setTimeDisplay(timeDisplay);

        this.dayNightContainer.appendChild(timeDisplay);
    }

    public updateUI(): void {
        // Periodic UI updates can be implemented here
        this.updateInventoryDisplay();
        this.updateCraftingAvailability();
        this.updateBuildingOptions();
    }

    private updateInventoryDisplay(): void {
        // Placeholder for inventory update logic
    }

    private updateCraftingAvailability(): void {
        // Placeholder for crafting availability update
    }

    private updateBuildingOptions(): void {
        // Placeholder for building options update
    }
}
