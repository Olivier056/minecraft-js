const overlay = document.getElementById("overlay");
const status = document.getElementById("status");
const inventoryBar = document.getElementById("inventory");
const crosshair = document.createElement("div");
crosshair.id = "crosshair";
document.body.appendChild(crosshair);

let gameMode = "survival"; // "survival" or "creative"
let health = 20;
let hunger = 20;
let showInventory = false;
let timeOfDay = 6000; // 0-24000 (0=midnight, 6000=sunrise, 12000=noon, 18000=sunset)
let difficulty = 1; // 1=easy, 2=normal, 3=hard

const mobs = [];
const terrain = {};

class Mob {
  constructor(x, y, z, type = "cow") {
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3();
    this.type = type;
    this.health = type === "zombie" ? 20 : 10;
    this.maxHealth = this.health;
    this.speed = type === "zombie" ? 2.5 : 2;
    
    // Colors et propriétés par type
    const colors = { cow: 0x8B4513, pig: 0xFF69B4, sheep: 0xFFFFFF, zombie: 0x228B22 };
    const color = colors[type] || 0x8B4513;
    
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.2, 0.9),
      new THREE.MeshStandardMaterial({ color })
    );
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    
    this.direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    this.changeDirectionTime = 0;
    this.attackCooldown = 0;
  }

  getMobAABB() {
    const radius = 0.4;
    return {
      minX: this.position.x - radius,
      maxX: this.position.x + radius,
      minY: this.position.y,
      maxY: this.position.y + 1.2,
      minZ: this.position.z - radius,
      maxZ: this.position.z + radius,
    };
  }

  isMobColliding(position) {
    const aabb = this.getMobAABB();
    const testAABB = { ...aabb };
    testAABB.minX = position.x - 0.4;
    testAABB.maxX = position.x + 0.4;
    testAABB.minY = position.y;
    testAABB.maxY = position.y + 1.2;
    testAABB.minZ = position.z - 0.4;
    testAABB.maxZ = position.z + 0.4;
    
    for (let x = Math.floor(aabb.minX); x <= Math.floor(aabb.maxX); x++) {
      for (let y = Math.floor(aabb.minY); y <= Math.floor(aabb.maxY); y++) {
        for (let z = Math.floor(aabb.minZ); z <= Math.floor(aabb.maxZ); z++) {
          if (world.has(`${x},${y},${z}`)) return true;
        }
      }
    }
    return false;
  }

  update(delta) {
    this.changeDirectionTime -= delta;
    this.attackCooldown -= delta;
    
    // AI: zombies hunt at night
    const isNight = timeOfDay > 13500 || timeOfDay < 9500;
    const targetPlayer = this.type === "zombie" && isNight;
    
    if (this.type === "zombie" && targetPlayer) {
      const playerPos = controls.getObject().position;
      const dir = new THREE.Vector3().subVectors(playerPos, this.position);
      dir.y = 0;
      if (dir.lengthSq() > 0) {
        dir.normalize();
        this.direction.lerp(dir, 0.1);
      }
      // Attack player if close
      if (dir.length() < 2 && this.attackCooldown <= 0 && gameMode === "survival") {
        health -= 0.5 * difficulty;
        this.attackCooldown = 1;
      }
    } else if (this.changeDirectionTime <= 0) {
      this.direction.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      this.changeDirectionTime = 2 + Math.random() * 3;
    }
    
    const newPos = this.position.clone();
    newPos.addScaledVector(this.direction, this.speed * delta);
    
    if (!this.isMobColliding(newPos)) {
      this.position.copy(newPos);
    } else {
      this.direction.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      this.changeDirectionTime = 0;
    }
    
    this.mesh.position.copy(this.position);
  }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new THREE.PointerLockControls(camera, document.body);
controls.getObject().position.set(0, 5, 10);
scene.add(controls.getObject());

const light = new THREE.HemisphereLight(0xffffff, 0x888888, 1.0);
scene.add(light);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

const blockSize = 1;
const world = new Map();
const cubes = [];
const blockTypes = [
  { type: "grass", label: "Herbe" },
  { type: "dirt", label: "Terre" },
  { type: "stone", label: "Pierre" },
  { type: "wood", label: "Bois" },
  { type: "leaves", label: "Feuilles" },
  { type: "sand", label: "Sable" },
  { type: "cobblestone", label: "Pierre taillée" },
  { type: "planks", label: "Planches" },
  { type: "water", label: "Eau" },
  { type: "bedrock", label: "Bedrock" },
  { type: "diamond_ore", label: "Minerai de diamant" },
  { type: "gold_ore", label: "Minerai d'or" },
  { type: "iron_ore", label: "Minerai de fer" },
  { type: "coal_ore", label: "Minerai de charbon" },
  { type: "obsidian", label: "Obsidienne" },
  { type: "netherrack", label: "Netherrack" },
  { type: "soul_sand", label: "Sable des âmes" },
  { type: "glowstone", label: "Glowstone" },
  { type: "apple", label: "Pomme", isFood: true, hungerRestore: 4 },
  { type: "bread", label: "Pain", isFood: true, hungerRestore: 5 },
  { type: "carrot", label: "Carotte", isFood: true, hungerRestore: 3 },
  
];
const inventory = {
  grass: 24,
  dirt: 24,
  stone: 12,
  wood: 12,
  leaves: 12,
  sand: 12,
  cobblestone: 12,
  planks: 12,
  water: 12,
  bedrock: 0,
  diamond_ore: 0,
  gold_ore: 0,
  iron_ore: 0,
  coal_ore: 0,
  obsidian: 0,
  netherrack: 0,
  soul_sand: 0,
  glowstone: 0,
  apple: 5,
  bread: 5,
  carrot: 5,
};
let selectedIndex = 0;

function createTexture(baseColor, detailColor) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = detailColor;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = size * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo((x + length) % size, (y + length * 0.15) % size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

const materials = {
  grass: new THREE.MeshStandardMaterial({
    map: createTexture("#6cae47", "#518e34"),
    roughness: 0.8,
  }),
  dirt: new THREE.MeshStandardMaterial({
    map: createTexture("#8c6239", "#6f4d2e"),
    roughness: 0.9,
  }),
  stone: new THREE.MeshStandardMaterial({
    map: createTexture("#7a7a7a", "#5c5c5c"),
    roughness: 0.85,
  }),
  wood: new THREE.MeshStandardMaterial({
    map: createTexture("#8B4513", "#654321"),
    roughness: 0.8,
  }),
  leaves: new THREE.MeshStandardMaterial({
    map: createTexture("#228B22", "#32CD32"),
    roughness: 0.9,
    transparent: true,
    opacity: 0.8,
  }),
  sand: new THREE.MeshStandardMaterial({
    map: createTexture("#F4A460", "#D2B48C"),
    roughness: 0.7,
  }),
  cobblestone: new THREE.MeshStandardMaterial({
    map: createTexture("#696969", "#808080"),
    roughness: 0.9,
  }),
  planks: new THREE.MeshStandardMaterial({
    map: createTexture("#DEB887", "#D2691E"),
    roughness: 0.8,
  }),
  water: new THREE.MeshStandardMaterial({
    map: createTexture("#4169E1", "#1E90FF"),
    roughness: 0.0,
    transparent: true,
    opacity: 0.6,
  }),
  bedrock: new THREE.MeshStandardMaterial({
    map: createTexture("#2F2F2F", "#1C1C1C"),
    roughness: 0.9,
  }),
  diamond_ore: new THREE.MeshStandardMaterial({
    map: createTexture("#7A7A7A", "#B9F2FF"),
    roughness: 0.8,
  }),
  gold_ore: new THREE.MeshStandardMaterial({
    map: createTexture("#7A7A7A", "#FFD700"),
    roughness: 0.8,
  }),
  iron_ore: new THREE.MeshStandardMaterial({
    map: createTexture("#7A7A7A", "#D3D3D3"),
    roughness: 0.8,
  }),
  coal_ore: new THREE.MeshStandardMaterial({
    map: createTexture("#7A7A7A", "#2F2F2F"),
    roughness: 0.8,
  }),
  obsidian: new THREE.MeshStandardMaterial({
    map: createTexture("#0F0F23", "#1C1C3A"),
    roughness: 0.7,
  }),
  netherrack: new THREE.MeshStandardMaterial({
    map: createTexture("#853232", "#6B2424"),
    roughness: 0.9,
  }),
  soul_sand: new THREE.MeshStandardMaterial({
    map: createTexture("#4B2F20", "#3D2418"),
    roughness: 0.8,
  }),
  glowstone: new THREE.MeshStandardMaterial({
    map: createTexture("#FFDF00", "#FFD700"),
    roughness: 0.5,
    emissive: 0x444400,
  }),
  apple: new THREE.MeshStandardMaterial({
    map: createTexture("#FF0000", "#8B0000"),
    roughness: 0.8,
  }),
  bread: new THREE.MeshStandardMaterial({
    map: createTexture("#D2691E", "#A0522D"),
    roughness: 0.7,
  }),
  carrot: new THREE.MeshStandardMaterial({
    map: createTexture("#FF8C00", "#FF4500"),
    roughness: 0.8,
  }),
};

function addBlock(x, y, z, type) {
  const key = `${x},${y},${z}`;
  if (world.has(key)) return;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(blockSize, blockSize, blockSize),
    materials[type]
  );
  mesh.position.set(x * blockSize, y * blockSize + blockSize / 2, z * blockSize);
  mesh.userData = { x, y, z, type };
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  scene.add(mesh);
  world.set(key, mesh);
  cubes.push(mesh);
}

function removeBlockAt(x, y, z) {
  const key = `${x},${y},${z}`;
  const mesh = world.get(key);
  if (!mesh) return null;

  const type = mesh.userData.type;
  scene.remove(mesh);
  world.delete(key);
  const index = cubes.indexOf(mesh);
  if (index >= 0) cubes.splice(index, 1);
  return type;
}

function createTerrain() {
  const radius = 8;
  generateTerrainChunk(0, 0, radius);
}

function generateTerrainChunk(centerX, centerZ, radius) {
  for (let x = centerX - radius; x <= centerX + radius; x++) {
    for (let z = centerZ - radius; z <= centerZ + radius; z++) {
      const chunkKey = `chunk_${Math.floor(x/16)}_${Math.floor(z/16)}`;
      if (terrain[chunkKey]) continue; // Already generated
      
      terrain[chunkKey] = true;
      
      // Procedural generation with noise
      const height = Math.floor(
        2 + 
        Math.sin(x * 0.1) * 2 + 
        Math.cos(z * 0.1) * 2 + 
        Math.sin(x * 0.05) * Math.cos(z * 0.05) * 3 +
        Math.random() * 1
      );
      
      const surface = Math.max(height, 1);
      
      for (let y = 0; y < surface; y++) {
        let blockType = "stone";
        if (y === surface - 1) {
          blockType = Math.random() > 0.7 ? "sand" : "grass";
        } else if (y === surface - 2) {
          blockType = "dirt";
        } else if (Math.random() > 0.95) {
          if (Math.random() > 0.7) blockType = "coal_ore";
          else if (Math.random() > 0.8) blockType = "iron_ore";
          else if (Math.random() > 0.9) blockType = "gold_ore";
          else if (Math.random() > 0.95) blockType = "diamond_ore";
        }
        addBlock(x, y, z, blockType);
      }
    }
  }
  
  // Add trees and other structures
  for (let x = centerX - radius; x <= centerX + radius; x += 3) {
    for (let z = centerZ - radius; z <= centerZ + radius; z += 3) {
      if (Math.random() > 0.7) {
        const blockKey = `${x},surface,${z}`;
        let y = 1;
        for (let key of world.keys()) {
          const [bx, by, bz] = key.split(",").map(Number);
          if (bx === x && bz === z && by > y) y = by + 1;
        }
        
        // Add tree
        const trunkHeight = 3 + Math.floor(Math.random() * 2);
        for (let ty = y; ty < y + trunkHeight; ty++) {
          addBlock(x, ty, z, "wood");
        }
        // Leaves
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            for (let dy = 0; dy <= 2; dy++) {
              if (dx * dx + dz * dz <= 4 && !(dx === 0 && dz === 0 && dy === 0)) {
                addBlock(x + dx, y + trunkHeight + dy - 1, z + dz, "leaves");
              }
            }
          }
        }
      }
    }
  }
}

createTerrain();

const planeGeo = new THREE.PlaneGeometry(200, 200);
const planeMat = new THREE.MeshBasicMaterial({ visible: false });
const ground = new THREE.Mesh(planeGeo, planeMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let prevTime = performance.now();
let isLocked = false;
const raycaster = new THREE.Raycaster();
const targetBox = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(blockSize, blockSize, blockSize)), 0xffffff);
targetBox.visible = false;
scene.add(targetBox);

function updateInventoryUI() {
  const inventoryMenu = document.getElementById("inventory-menu");
  const inventoryItems = document.getElementById("inventory-items");
  
  if (showInventory) {
    inventoryBar.innerHTML = "";
    inventoryItems.innerHTML = "";
    
    blockTypes.forEach((block, index) => {
      const slot = document.createElement("div");
      slot.className = `slot${index === selectedIndex ? " selected" : ""}`;
      slot.innerHTML = `
        <div class="icon" style="background-image: url(${materials[block.type].map.image.toDataURL()})"></div>
        <div>${block.label}</div>
        <div class="count">${gameMode === "creative" ? "∞" : inventory[block.type]}</div>
      `;
      inventoryBar.appendChild(slot);
      
      // Add to inventory menu
      const item = document.createElement("div");
      item.className = "inventory-item";
      item.innerHTML = `
        <div class="inventory-item-name">${block.label}</div>
        <div class="inventory-item-count">${gameMode === "creative" ? "∞" : inventory[block.type]}</div>
      `;
      inventoryItems.appendChild(item);
    });
    
    inventoryBar.style.display = "flex";
    inventoryMenu.classList.add("open");
  } else {
    inventoryBar.style.display = "none";
    inventoryMenu.classList.remove("open");
  }
}

function selectBlockIndex(index) {
  selectedIndex = (index + blockTypes.length) % blockTypes.length;
  updateInventoryUI();
  status.textContent = `Bloc sélectionné : ${blockTypes[selectedIndex].label}`;
}

function createBlockTextureIcon(type) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = type === "grass" ? "#6cae47" : type === "dirt" ? "#8c6239" : "#7a7a7a";
  ctx.fillRect(0, 0, 32, 32);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.strokeRect(0, 0, 32, 32);
  return canvas.toDataURL();
}

function updateDayNight() {
  timeOfDay += 0.005; // Advance time
  if (timeOfDay >= 24000) timeOfDay = 0;
  
  // Calculate light intensity and color based on time of day
  const normalizedTime = timeOfDay / 24000;
  let intensity = 0.75;
  let color = 0xffffff;
  
  if (normalizedTime < 0.25) { // 0:00 - 6:00 (night)
    intensity = 0.2 + normalizedTime * 1.6;
    color = 0x1a1a2e; // Dark blue
  } else if (normalizedTime < 0.5) { // 6:00 - 12:00 (day)
    intensity = 0.6 + (normalizedTime - 0.25) * 0.6;
    color = 0xffffff; // White
  } else if (normalizedTime < 0.75) { // 12:00 - 18:00 (afternoon)
    intensity = 1 - (normalizedTime - 0.5) * 0.6;
    color = 0xffb366; // Orange
  } else { // 18:00 - 24:00 (night)
    intensity = 0.4 - (normalizedTime - 0.75) * 1.6;
    color = 0x1a1a2e; // Dark blue
  }
  
  dirLight.intensity = Math.max(0.15, intensity);
  dirLight.color.setHex(color);
  scene.background.setHex(normalizedTime > 0.25 && normalizedTime < 0.75 ? 0x87ceeb : 0x1a1a2e);
}

function updateBars() {
  const healthBar = document.getElementById("health-bar");
  const hungerBar = document.getElementById("hunger-bar");
  if (gameMode === "creative") {
    healthBar.style.display = "none";
    hungerBar.style.display = "none";
  } else {
    healthBar.style.display = "block";
    hungerBar.style.display = "block";
    healthBar.style.setProperty("--health", `${(health / 20) * 100}%`);
    hungerBar.style.setProperty("--hunger", `${(hunger / 20) * 100}%`);
  }
}

function selectBlockSlotFromKey(key) {
  if (key >= 1 && key <= blockTypes.length) {
    selectBlockIndex(key - 1);
  }
}

function getPlayerAABB(position) {
  const radius = 0.25;
  const height = 1.7;
  return {
    minX: position.x - radius,
    maxX: position.x + radius,
    minY: position.y,
    maxY: position.y + height,
    minZ: position.z - radius,
    maxZ: position.z + radius,
  };
}

function isPlayerColliding(position) {
  const aabb = getPlayerAABB(position);
  const minX = Math.floor(aabb.minX);
  const maxX = Math.floor(aabb.maxX - 1e-6);
  const minY = Math.floor(aabb.minY);
  const maxY = Math.floor(aabb.maxY - 1e-6);
  const minZ = Math.floor(aabb.minZ);
  const maxZ = Math.floor(aabb.maxZ - 1e-6);

  // Check block collisions
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (world.has(`${x},${y},${z}`)) {
          return true;
        }
      }
    }
  }

  // Check mob collisions
  for (let mob of mobs) {
    const mobAABB = mob.getMobAABB();
    if (!(aabb.maxX < mobAABB.minX || aabb.minX > mobAABB.maxX ||
          aabb.maxY < mobAABB.minY || aabb.minY > mobAABB.maxY ||
          aabb.maxZ < mobAABB.minZ || aabb.minZ > mobAABB.maxZ)) {
      return true;
    }
  }

  return false;
}

function moveWithCollision(delta) {
  const player = controls.getObject();
  const oldPosition = player.position.clone();

  if (delta.x !== 0) {
    player.position.x += delta.x;
    if (isPlayerColliding(player.position)) {
      player.position.x = oldPosition.x;
    }
  }

  if (delta.z !== 0) {
    player.position.z += delta.z;
    if (isPlayerColliding(player.position)) {
      player.position.z = oldPosition.z;
    }
  }
}

function onKeyDown(event) {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      moveLeft = true;
      break;
    case "ArrowDown":
    case "KeyS":
      moveBackward = true;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = true;
      break;
    case "Space":
      if (canJump) {
        velocity.y = 12;
        canJump = false;
      }
      break;
    case "Digit1":
    case "Digit2":
    case "Digit3":
    case "Digit4":
    case "Digit5":
    case "Digit6":
    case "Digit7":
    case "Digit8":
    case "Digit9":
      selectBlockSlotFromKey(Number(event.code.slice(5)));
      break;
    case "KeyE":
      showInventory = !showInventory;
      updateInventoryUI();
      break;
    case "KeyM":
      gameMode = gameMode === "survival" ? "creative" : "survival";
      updateInventoryUI();
      updateBars();
      status.textContent = `Mode : ${gameMode}`;
      break;
    case "KeyD":
      difficulty = (difficulty % 3) + 1;
      status.textContent = `Difficulté : ${difficulty === 1 ? "Facile" : difficulty === 2 ? "Normal" : "Difficile"}`;
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      moveLeft = false;
      break;
    case "ArrowDown":
    case "KeyS":
      moveBackward = false;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = false;
      break;
  }
}

function updateTarget() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(cubes, false);
  if (intersects.length > 0 && intersects[0].distance < 6) {
    const hit = intersects[0];
    const block = hit.object;
    const { x, y, z } = block.userData;
    targetBox.setFromObject(block);
    targetBox.visible = true;
    return { block, hit, coord: { x, y, z } };
  }

  targetBox.visible = false;
  return null;
}

function placeBlockAt(x, y, z) {
  const selected = blockTypes[selectedIndex].type;
  if (gameMode === "survival" && inventory[selected] <= 0) {
    status.textContent = `Pas assez de blocs ${blockTypes[selectedIndex].label}`;
    return;
  }
  if (world.has(`${x},${y},${z}`)) return;
  addBlock(x, y, z, selected);
  if (gameMode === "survival") {
    inventory[selected] -= 1;
    updateInventoryUI();
  }
}

function onMouseDown(event) {
  if (!isLocked) return;
  event.preventDefault();
  const selected = blockTypes[selectedIndex];
  if (event.button === 2 && selected.isFood && gameMode === "survival") {
    // Eat
    if (inventory[selected.type] > 0) {
      hunger = Math.min(20, hunger + selected.hungerRestore);
      inventory[selected.type] -= 1;
      updateInventoryUI();
      updateBars();
      status.textContent = `Mangé ${selected.label}`;
    }
    return;
  }
  const found = updateTarget();
  if (!found) return;
  if (event.button === 0) {
    if (event.shiftKey) {
      const normal = found.hit.face.normal;
      const nx = found.coord.x + Math.round(normal.x);
      const ny = found.coord.y + Math.round(normal.y);
      const nz = found.coord.z + Math.round(normal.z);
      placeBlockAt(nx, ny, nz);
    } else {
      const removed = removeBlockAt(found.coord.x, found.coord.y, found.coord.z);
      if (removed && inventory[removed] !== undefined && gameMode === "survival") {
        inventory[removed] += 1;
        updateInventoryUI();
      }
    }
  }
}

function animate() {
  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  const speed = 6;
  const input = new THREE.Vector3(
    Number(moveRight) - Number(moveLeft),
    0,
    Number(moveBackward) - Number(moveForward)
  );

  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;
  velocity.y -= 30.0 * delta;

  if (input.lengthSq() > 0) {
    input.normalize().multiplyScalar(speed * delta);
    const forward = new THREE.Vector3();
    controls.getDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const moveDelta = new THREE.Vector3();
    moveDelta.addScaledVector(forward, -input.z);
    moveDelta.addScaledVector(right, input.x);
    moveWithCollision(moveDelta);
  }

  const player = controls.getObject();
  const nextY = player.position.y + velocity.y * delta;
  const candidate = player.position.clone();
  candidate.y = nextY;

  if (nextY <= 2) {
    player.position.y = 2;
    velocity.y = 0;
    canJump = true;
  } else if (isPlayerColliding(candidate)) {
    if (velocity.y < 0) canJump = true;
    velocity.y = 0;
  } else {
    player.position.y = nextY;
    canJump = false;
  }

  const downCheck = player.position.clone();
  downCheck.y -= 0.05;
  canJump = canJump || player.position.y <= 2.001 || isPlayerColliding(downCheck);

  // Survival mechanics
  if (gameMode === "survival") {
    hunger -= delta * 0.1; // Decrease hunger over time
    if (hunger <= 0) {
      hunger = 0;
      health -= delta * 0.5; // Decrease health if hungry
      if (health <= 0) {
        health = 0;
        // Game over
        status.textContent = "Vous êtes mort !";
        controls.unlock();
      }
    }
    hunger = Math.max(0, hunger);
    health = Math.max(0, Math.min(20, health));
    updateBars();
  }

  // Update day/night cycle
  updateDayNight();

  // Generate terrain around player
  const playerPos = controls.getObject().position;
  const playerChunkX = Math.floor(playerPos.x / 16);
  const playerChunkZ = Math.floor(playerPos.z / 16);
  generateTerrainChunk(playerChunkX * 16, playerChunkZ * 16, 8);

  // Update mobs
  mobs.forEach(mob => mob.update(delta));

  updateTarget();
  renderer.render(scene, camera);
  prevTime = time;
  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

controls.addEventListener("lock", () => {
  isLocked = true;
  overlay.style.display = "none";
  status.textContent = "En jeu";
});

controls.addEventListener("unlock", () => {
  isLocked = false;
  overlay.style.display = "block";
  status.textContent = "Clique pour jouer";
});

window.addEventListener("resize", onResize);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("mousedown", onMouseDown);

selectBlockIndex(0);
updateInventoryUI();
updateBars();
status.textContent = "Clique pour jouer";

document.getElementById("start-btn").addEventListener("click", () => {
  difficulty = parseInt(document.getElementById("difficulty").value);
  overlay.style.display = "none";
  controls.lock();
});

document.getElementById("download-btn").addEventListener("click", () => {
  // Create a downloadable version of the game
  fetch(window.location.href)
    .then(response => response.text())
    .then(html => {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "minecraft-js.html";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => {
      status.textContent = "Impossible de télécharger le jeu";
    });
});

animate();