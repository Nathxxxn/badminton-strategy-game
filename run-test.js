// On importe le générateur et toutes ses dépendances
import { KinematicEngine } from './src/js/logic/KinematicEngine.js';
import { PlacementEngine } from './src/js/logic/PlacementEngine.js';
import { TacticalEngine } from './src/js/logic/TacticalEngine.js';
import { AISpawnEngine } from './src/js/logic/AISpawnEngine.js'; // Ajuste le chemin si nécessaire
import { ScenarioGenerator } from './src/js/logic/ScenarioGenerator.js';

// 1. On instancie les moteurs dans le bon ordre
const kinematic = new KinematicEngine();
const tactical  = new TacticalEngine();
const placement = new PlacementEngine(kinematic);
const aiSpawn   = new AISpawnEngine(tactical, placement, kinematic);

// 2. On initialise le générateur avec ses dépendances
const generator = new ScenarioGenerator(tactical, placement, aiSpawn, kinematic);

console.log("=========================================");
console.log("TEST : generateTacticalScenario");
console.log("=========================================");
const tacticalResult = generator.generateTacticalScenario('right');
console.log(JSON.stringify(tacticalResult, null, 2));

console.log("\n=========================================");
console.log("🏃‍♂️ TEST : generatePlacementScenario");
console.log("=========================================");
const placementResult = generator.generatePlacementScenario();
console.log(JSON.stringify(placementResult, null, 2));