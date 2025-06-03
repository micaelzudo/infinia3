                    </div>
                    <div class="space-y-2">
                        <button id="isolated-editor-reset-button" class="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out">Reset View</button>
                        <button id="isolated-editor-spawn-button" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out">Spawn on Terrain</button>
                    </div>

                    <!-- Brush Controls -->
                    ${createSlider('Brush_Size', 'Brush Size', 1, 20, 0.1, 3)}
                    ${createSlider('Strength', 'Strength', 0.1, 1, 0.05, 0.5)}
                    ${createSlider('Verticality', 'Verticality', 1, 50, 1, 20)}
                    ${createDropdown('Brush_Shape', 'Brush Shape', ['sphere', 'cube', 'cylinder'], 'sphere')}
                    <button id="mining-mode-button" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out mt-2">Mode: Add</button>
                    <button id="internal-grid-button" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out mt-2">Show Internal Grid</button>

                    <!-- Grid Size Controls -->
                    <div class="flex space-x-2 mt-4">
                        <button id="isolated-grid-decrease-button" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out">- Grid Size</button>
                        <button id="isolated-grid-increase-button" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out">+ Grid Size</button>
                    </div>

                </div>
            </div> 