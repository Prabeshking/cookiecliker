let energy = 0;
let eps = 0;

const clicker = document.getElementById("clicker");
const scoreText = document.getElementById("score");
const epsText = document.getElementById("eps");
const store = document.getElementById("store");

// 18 SCI-FI BUILDINGS (original & legal)
const buildings = [
    { name: "Nano Miner", baseCost: 15, eps: 0.1, count: 0 },
    { name: "Quantum Drone", baseCost: 100, eps: 1, count: 0 },
    { name: "Ion Reactor", baseCost: 500, eps: 5, count: 0 },
    { name: "Photon Collector", baseCost: 1200, eps: 12, count: 0 },
    { name: "Fusion Lab", baseCost: 5000, eps: 40, count: 0 },
    { name: "Stellar Extractor", baseCost: 15000, eps: 120, count: 0 },
    { name: "Asteroid Factory", baseCost: 50000, eps: 300, count: 0 },
    { name: "Warp Core Plant", baseCost: 120000, eps: 700, count: 0 },
    { name: "Hyperloop Refinery", baseCost: 300000, eps: 1500, count: 0 },
    { name: "Gravity Well Harvester", baseCost: 750000, eps: 3500, count: 0 },
    { name: "Antimatter Forge", baseCost: 2_000_000, eps: 9000, count: 0 },
    { name: "Void Engine", baseCost: 6_000_000, eps: 25000, count: 0 },
    { name: "Dimensional Siphon", baseCost: 12_000_000, eps: 70000, count: 0 },
    { name: "Star Core Drill", baseCost: 30_000_000, eps: 150000, count: 0 },
    { name: "Nebula Processor", baseCost: 80_000_000, eps: 400000, count: 0 },
    { name: "Galaxy Splitter", baseCost: 200_000_000, eps: 1000000, count: 0 },
    { name: "Time Rift Foundry", baseCost: 500_000_000, eps: 2500000, count: 0 },
    { name: "Singularity Reactor", baseCost: 1_200_000_000, eps: 6000000, count: 0 }
];

function updateUI() {
    scoreText.textContent = `Energy: ${Math.floor(energy)}`;
    epsText.textContent = `EPS: ${eps.toFixed(1)}`;
}

function renderStore() {
    store.innerHTML = "";
    buildings.forEach((b, i) => {
        const cost = Math.floor(b.baseCost * Math.pow(1.15, b.count));
        const item = document.createElement("div");
        item.className = "store-item";
        item.innerHTML = `
            <strong>${b.name}</strong>  
            <br>Cost: ${cost}  
            <br>Owned: ${b.count}
        `;

        item.onclick = () => buyBuilding(i);
        store.appendChild(item);
    });
}

function buyBuilding(i) {
    const b = buildings[i];
    const cost = Math.floor(b.baseCost * Math.pow(1.15, b.count));

    if (energy >= cost) {
        energy -= cost;
        b.count++;
        eps += b.eps;
        updateUI();
        renderStore();
    }
}

clicker.addEventListener("click", () => {
    energy++;
    updateUI();
});

setInterval(() => {
    energy += eps / 10;
    updateUI();
}, 100);

renderStore();
updateUI();
