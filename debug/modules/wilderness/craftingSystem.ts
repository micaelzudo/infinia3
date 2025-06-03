import * as THREE from 'three';
import { InventorySystem } from './inventorySystem';

/**
 * Recipe class for the crafting system
 */
export class Recipe {
    public id: string;
    public name: string;
    public ingredients: { id: string, quantity: number }[];
    public result: { id: string, quantity: number };
    public icon: string;
    public description: string;

    /**
     * Constructor for the Recipe class
     * @param id The recipe ID
     * @param name The recipe name
     * @param ingredients The recipe ingredients
     * @param result The recipe result
     * @param icon The recipe icon
     * @param description The recipe description
     */
    constructor(
        id: string,
        name: string,
        ingredients: { id: string, quantity: number }[],
        result: { id: string, quantity: number },
        icon: string = '🔨',
        description: string = ''
    ) {
        this.id = id;
        this.name = name;
        this.ingredients = ingredients;
        this.result = result;
        this.icon = icon;
        this.description = description;
    }
}

/**
 * Crafting System for the Wilderness Survival Game
 * Handles crafting recipes and crafting UI
 */
export class CraftingSystem {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private contentArea: HTMLElement;
    private inventorySystem: InventorySystem;
    private craftingContainer: HTMLElement | null = null;
    private recipesContainer: HTMLElement | null = null;
    private recipes: Recipe[] = [];

    /**
     * Constructor for the CraftingSystem class
     * @param scene The THREE.js scene
     * @param camera The THREE.js camera
     * @param contentArea The HTML element to append UI elements to
     * @param inventorySystem The inventory system
     */
    constructor(
        scene: THREE.Scene,
        camera: THREE.Camera,
        contentArea: HTMLElement,
        inventorySystem: InventorySystem
    ) {
        this.scene = scene;
        this.camera = camera;
        this.contentArea = contentArea;
        this.inventorySystem = inventorySystem;
        
        // Initialize with some recipes
        this.initializeRecipes();
        
        // Create the crafting UI
        this.createCraftingUI();
        
        console.log("Crafting System initialized");
    }

    /**
     * Initialize the crafting recipes
     */
    private initializeRecipes(): void {
        this.recipes = [
            new Recipe(
                'axe',
                'Axe',
                [
                    { id: 'wood', quantity: 2 },
                    { id: 'stone', quantity: 3 }
                ],
                { id: 'axe', quantity: 1 },
                '🪓',
                'A tool for chopping wood'
            ),
            new Recipe(
                'pickaxe',
                'Pickaxe',
                [
                    { id: 'wood', quantity: 2 },
                    { id: 'stone', quantity: 3 }
                ],
                { id: 'pickaxe', quantity: 1 },
                '⛏️',
                'A tool for mining stone'
            ),
            new Recipe(
                'shelter',
                'Shelter',
                [
                    { id: 'wood', quantity: 10 },
                    { id: 'stone', quantity: 5 }
                ],
                { id: 'shelter', quantity: 1 },
                '🏠',
                'A basic shelter for protection'
            ),
            new Recipe(
                'fire',
                'Fire',
                [
                    { id: 'wood', quantity: 5 },
                    { id: 'stone', quantity: 2 }
                ],
                { id: 'fire', quantity: 1 },
                '🔥',
                'A fire for warmth and cooking'
            ),
            new Recipe(
                'medicine',
                'Medicine',
                [
                    { id: 'herb', quantity: 3 },
                    { id: 'water', quantity: 1 }
                ],
                { id: 'medicine', quantity: 1 },
                '💊',
                'Medicine for healing'
            ),
            new Recipe(
                'bow',
                'Bow',
                [
                    { id: 'wood', quantity: 3 },
                    { id: 'stone', quantity: 1 }
                ],
                { id: 'bow', quantity: 1 },
                '🏹',
                'A weapon for hunting'
            )
        ];
    }

    /**
     * Create the crafting UI
     */
    private createCraftingUI(): void {
        // Create the crafting section
        const craftingSection = document.createElement('div');
        craftingSection.className = 'wilderness-crafting-section';
        craftingSection.style.marginBottom = '20px';

        // Create the section title
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'Crafting';
        sectionTitle.style.margin = '0';
        sectionTitle.style.fontSize = '16px';
        sectionTitle.style.marginBottom = '10px';
        sectionTitle.style.borderBottom = '1px solid #4a5568';
        sectionTitle.style.paddingBottom = '5px';
        craftingSection.appendChild(sectionTitle);

        // Create the crafting container
        this.craftingContainer = document.createElement('div');
        this.craftingContainer.className = 'wilderness-crafting-container';
        this.craftingContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        this.craftingContainer.style.borderRadius = '4px';
        this.craftingContainer.style.padding = '10px';
        craftingSection.appendChild(this.craftingContainer);

        // Create the recipes container
        this.recipesContainer = document.createElement('div');
        this.recipesContainer.className = 'wilderness-recipes-container';
        this.recipesContainer.style.display = 'grid';
        this.recipesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
        this.recipesContainer.style.gap = '10px';
        this.craftingContainer.appendChild(this.recipesContainer);

        // Add the crafting section to the content area
        this.contentArea.appendChild(craftingSection);

        // Update the crafting UI
        this.updateCraftingUI();
    }

    /**
     * Update the crafting UI
     */
    private updateCraftingUI(): void {
        if (!this.recipesContainer) return;
        
        // Clear the recipes container
        this.recipesContainer.innerHTML = '';
        
        // Add each recipe to the container
        this.recipes.forEach(recipe => {
            const recipeElement = document.createElement('div');
            recipeElement.className = 'wilderness-recipe';
            recipeElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            recipeElement.style.borderRadius = '4px';
            recipeElement.style.padding = '10px';
            recipeElement.style.display = 'flex';
            recipeElement.style.flexDirection = 'column';
            recipeElement.style.cursor = 'pointer';
            
            // Check if the player has the required ingredients
            const canCraft = this.canCraftRecipe(recipe);
            
            // Add the recipe header
            const recipeHeader = document.createElement('div');
            recipeHeader.className = 'wilderness-recipe-header';
            recipeHeader.style.display = 'flex';
            recipeHeader.style.alignItems = 'center';
            recipeHeader.style.marginBottom = '5px';
            recipeElement.appendChild(recipeHeader);
            
            // Add the recipe icon
            const recipeIcon = document.createElement('div');
            recipeIcon.className = 'wilderness-recipe-icon';
            recipeIcon.textContent = recipe.icon;
            recipeIcon.style.fontSize = '24px';
            recipeIcon.style.marginRight = '10px';
            recipeHeader.appendChild(recipeIcon);
            
            // Add the recipe name
            const recipeName = document.createElement('div');
            recipeName.className = 'wilderness-recipe-name';
            recipeName.textContent = recipe.name;
            recipeName.style.fontSize = '16px';
            recipeName.style.fontWeight = 'bold';
            recipeHeader.appendChild(recipeName);
            
            // Add the recipe ingredients
            const recipeIngredients = document.createElement('div');
            recipeIngredients.className = 'wilderness-recipe-ingredients';
            recipeIngredients.style.fontSize = '12px';
            recipeIngredients.style.marginBottom = '5px';
            
            // Add each ingredient
            recipe.ingredients.forEach(ingredient => {
                const hasIngredient = this.inventorySystem.hasItem(ingredient.id, ingredient.quantity);
                
                const ingredientElement = document.createElement('div');
                ingredientElement.className = 'wilderness-recipe-ingredient';
                ingredientElement.textContent = `${ingredient.id}: ${this.inventorySystem.getItemQuantity(ingredient.id)}/${ingredient.quantity}`;
                ingredientElement.style.color = hasIngredient ? '#a0aec0' : '#fc8181';
                recipeIngredients.appendChild(ingredientElement);
            });
            
            recipeElement.appendChild(recipeIngredients);
            
            // Add the craft button
            const craftButton = document.createElement('button');
            craftButton.className = 'wilderness-craft-button';
            craftButton.textContent = 'Craft';
            craftButton.style.backgroundColor = canCraft ? '#4299e1' : '#718096';
            craftButton.style.color = 'white';
            craftButton.style.border = 'none';
            craftButton.style.borderRadius = '4px';
            craftButton.style.padding = '5px 10px';
            craftButton.style.cursor = canCraft ? 'pointer' : 'not-allowed';
            craftButton.style.marginTop = '5px';
            craftButton.style.opacity = canCraft ? '1' : '0.5';
            
            // Add click handler
            craftButton.addEventListener('click', () => {
                if (canCraft) {
                    this.craftRecipe(recipe);
                }
            });
            
            recipeElement.appendChild(craftButton);
            
            // Add hover effect
            recipeElement.addEventListener('mouseover', () => {
                recipeElement.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            });
            
            recipeElement.addEventListener('mouseout', () => {
                recipeElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            });
            
            // Add tooltip with description
            recipeElement.title = recipe.description;
            
            this.recipesContainer.appendChild(recipeElement);
        });
    }

    /**
     * Check if the player can craft a recipe
     * @param recipe The recipe to check
     * @returns Whether the player can craft the recipe
     */
    private canCraftRecipe(recipe: Recipe): boolean {
        // Check if the player has all the required ingredients
        return recipe.ingredients.every(ingredient => 
            this.inventorySystem.hasItem(ingredient.id, ingredient.quantity)
        );
    }

    /**
     * Craft a recipe
     * @param recipe The recipe to craft
     */
    private craftRecipe(recipe: Recipe): void {
        // Check if the player can craft the recipe
        if (!this.canCraftRecipe(recipe)) {
            console.warn(`Cannot craft ${recipe.name}: missing ingredients`);
            return;
        }
        
        // Remove the ingredients from the inventory
        recipe.ingredients.forEach(ingredient => {
            this.inventorySystem.removeItem(ingredient.id, ingredient.quantity);
        });
        
        // Add the result to the inventory
        this.inventorySystem.addItem(recipe.result.id, recipe.result.quantity);
        
        console.log(`Crafted ${recipe.name}`);
        
        // Update the crafting UI
        this.updateCraftingUI();
    }

    /**
     * Dispose of the crafting system
     */
    public dispose(): void {
        console.log("Crafting System disposed");
    }
}
