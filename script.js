const storyRaces = [
  { id: "dock-run", name: "Dockside Run", description: "A short rookie sprint through the harbor district. Clean driving matters more than top speed.", distance: 2400, payout: 240, xp: 90, aiCount: 3, difficulty: "rookie", unlockWins: 0 },
  { id: "neon-loop", name: "Neon Loop", description: "Traffic lights, tighter corners, and faster rivals start showing up here.", distance: 3200, payout: 340, xp: 130, aiCount: 4, difficulty: "pro", unlockWins: 1 },
  { id: "skyway-charge", name: "Skyway Charge", description: "Long straights reward big nitro pushes, but the walls punish every mistake.", distance: 4100, payout: 470, xp: 180, aiCount: 5, difficulty: "pro", unlockWins: 2 },
  { id: "midnight-crown", name: "Midnight Crown", description: "The story finale. Elite rivals, a packed circuit, and the toughest field in the league.", distance: 5200, payout: 680, xp: 250, aiCount: 5, difficulty: "elite", unlockWins: 3 },
];

const upgradeConfig = [
  { key: "topSpeed", label: "Engine Map", description: "Raises your max speed on the straights.", cost: 180, maxLevel: 5 },
  { key: "acceleration", label: "Turbo Spool", description: "Cuts launch time and improves recovery after bumps.", cost: 150, maxLevel: 5 },
  { key: "handling", label: "Grip Kit", description: "Tightens steering and reduces slide at high speed.", cost: 160, maxLevel: 5 },
  { key: "nitro", label: "Nitro Tank", description: "Adds a larger boost reserve for overtakes.", cost: 170, maxLevel: 5 },
];

const defaultSave = {
  credits: 260,
  wins: 0,
  xp: 0,
  car: { name: "Apex GT-1", topSpeed: 0, acceleration: 0, handling: 0, nitro: 0 },
  world: { currentNodeId: "franklin", completedQuestIds: [] },
};

const saveKey = "nightCircuitLegendsSave";
const roomKey = "nightCircuitLegendsRoom";
const roomChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel("night-circuit-legends") : null;
const road = {
  halfWidth: 360,
  shoulderWidth: 110,
  horizonY: 122,
  cameraDepth: 0.88,
  segmentLength: 180,
  visibleSegments: 22,
};

const cityNodes = [
  { id: "franklin", label: "Franklin", x: 56, y: 52, links: ["westgate", "river"] },
  { id: "westgate", label: "Westchester", x: 74, y: 220, links: ["franklin", "berwyn"] },
  { id: "river", label: "River Forest", x: 168, y: 94, links: ["franklin", "oak", "northline"] },
  { id: "oak", label: "Oak Park", x: 228, y: 120, links: ["river", "berwyn", "cicero"] },
  { id: "berwyn", label: "Berwyn", x: 212, y: 224, links: ["westgate", "oak", "cicero"] },
  { id: "cicero", label: "Cicero", x: 286, y: 222, links: ["oak", "berwyn", "ridge"] },
  { id: "northline", label: "Northline", x: 290, y: 70, links: ["river", "ridge"] },
  { id: "ridge", label: "Sky Ridge", x: 322, y: 150, links: ["northline", "cicero"] },
];

const questDefinitions = [
  { id: "quest-dock", nodeId: "westgate", raceId: "dock-run", title: "Harbor Warmup", reward: "Rookie purse + starter rep" },
  { id: "quest-neon", nodeId: "oak", raceId: "neon-loop", title: "Neon Loop Meet", reward: "District rep + higher traffic field" },
  { id: "quest-sky", nodeId: "northline", raceId: "skyway-charge", title: "Skyway Callout", reward: "Skyline sponsors + pro rivals" },
  { id: "quest-crown", nodeId: "ridge", raceId: "midnight-crown", title: "Midnight Crown Final", reward: "League title run" },
];

const storyList = document.querySelector("#storyList");
const upgradeList = document.querySelector("#upgradeList");
const carStats = document.querySelector("#carStats");
const driverLevel = document.querySelector("#driverLevel");
const creditsValue = document.querySelector("#creditsValue");
const winsValue = document.querySelector("#winsValue");
const carName = document.querySelector("#carName");
const messageStrip = document.querySelector("#messageStrip");
const menuButtons = document.querySelectorAll(".menu-button");
const contentViews = document.querySelectorAll(".content-view");

const canvas = document.querySelector("#raceCanvas");
const ctx = canvas.getContext("2d");
const raceOverlay = document.querySelector("#raceOverlay");
const overlayTag = document.querySelector("#overlayTag");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const overlayActionButton = document.querySelector("#overlayActionButton");

const hudEvent = document.querySelector("#hudEvent");
const hudProgress = document.querySelector("#hudProgress");
const hudPosition = document.querySelector("#hudPosition");
const hudSpeed = document.querySelector("#hudSpeed");
const hudNitro = document.querySelector("#hudNitro");

const createRoomButton = document.querySelector("#createRoomButton");
const joinRoomButton = document.querySelector("#joinRoomButton");
const joinCodeInput = document.querySelector("#joinCodeInput");
const roomCodeValue = document.querySelector("#roomCodeValue");
const roomStatus = document.querySelector("#roomStatus");
const hostReadyState = document.querySelector("#hostReadyState");
const guestReadyState = document.querySelector("#guestReadyState");
const toggleReadyButton = document.querySelector("#toggleReadyButton");
const startDuelButton = document.querySelector("#startDuelButton");
const cityMapCanvas = document.querySelector("#cityMapCanvas");
const cityMapCtx = cityMapCanvas ? cityMapCanvas.getContext("2d") : null;
const questList = document.querySelector("#questList");
const mapToggleButton = document.querySelector("#mapToggleButton");
const mapHint = document.querySelector("#mapHint");

const keys = { left: false, right: false, up: false, down: false, boost: false };

const state = {
  save: loadSave(),
  activeRace: null,
  mode: "free",
  messageTimeout: null,
  room: loadRoom(),
  hoveredNode: null,
};

const game = {
  running: false,
  finished: false,
  countdown: 0,
  startFlash: 0,
  lastTime: 0,
  player: null,
  rivals: [],
  trackSeed: 0,
  currentCurve: 0,
  currentHill: 0,
};

function cloneDefaultSave() {
  return JSON.parse(JSON.stringify(defaultSave));
}

function loadSave() {
  const raw = localStorage.getItem(saveKey);
  if (!raw) return cloneDefaultSave();

  try {
    const parsed = JSON.parse(raw);
    return {
      credits: Number.isFinite(parsed.credits) ? parsed.credits : defaultSave.credits,
      wins: Number.isFinite(parsed.wins) ? parsed.wins : defaultSave.wins,
      xp: Number.isFinite(parsed.xp) ? parsed.xp : defaultSave.xp,
      car: { ...defaultSave.car, ...(parsed.car || {}) },
      world: {
        ...defaultSave.world,
        ...(parsed.world || {}),
        completedQuestIds: Array.isArray(parsed.world?.completedQuestIds) ? parsed.world.completedQuestIds : defaultSave.world.completedQuestIds,
      },
    };
  } catch {
    return cloneDefaultSave();
  }
}

function saveProgress() {
  localStorage.setItem(saveKey, JSON.stringify(state.save));
}

function loadRoom() {
  const raw = localStorage.getItem(roomKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveRoom() {
  if (!state.room) {
    localStorage.removeItem(roomKey);
    return;
  }
  localStorage.setItem(roomKey, JSON.stringify(state.room));
}

function getDriverLevel() {
  return Math.floor(state.save.xp / 220) + 1;
}

function getCarPerformance() {
  const upgrades = state.save.car;
  return {
    maxSpeed: 215 + upgrades.topSpeed * 22,
    acceleration: 128 + upgrades.acceleration * 20,
    turnRate: 1.95 + upgrades.handling * 0.24,
    grip: 0.84 + upgrades.handling * 0.028,
    driftControl: 0.76 + upgrades.handling * 0.036,
    nitroMax: 100 + upgrades.nitro * 18,
  };
}

function setMessage(text) {
  messageStrip.textContent = text;
  clearTimeout(state.messageTimeout);
  state.messageTimeout = setTimeout(() => {
    if (!game.running) {
      messageStrip.textContent = "Welcome to Night Circuit Legends. Start your first race from story mode.";
    }
  }, 5000);
}

function showOverlay(tag, title, text, buttonText = "Back To Story") {
  overlayTag.textContent = tag;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayActionButton.textContent = buttonText;
  raceOverlay.classList.remove("is-hidden");
}

function hideOverlay() {
  raceOverlay.classList.add("is-hidden");
}

function renderProfile() {
  driverLevel.textContent = String(getDriverLevel());
  creditsValue.textContent = `${state.save.credits}`;
  winsValue.textContent = `${state.save.wins}`;
  carName.textContent = state.save.car.name;
}

function renderStory() {
  storyList.innerHTML = "";
  const currentNode = getNodeById(state.save.world.currentNodeId);

  storyRaces.forEach((race) => {
    const quest = getQuestByRaceId(race.id);
    const questNode = quest ? getNodeById(quest.nodeId) : null;
    const unlocked = quest ? isQuestUnlocked(quest) : state.save.wins >= race.unlockWins;
    const inDistrict = !questNode || questNode.id === currentNode.id;
    const article = document.createElement("article");
    article.className = `story-card ${unlocked ? "" : "locked"}`;
    article.innerHTML = `
      <div class="story-head">
        <div>
          <p class="eyebrow">Story Event</p>
          <h3>${race.name}</h3>
        </div>
        <span class="story-difficulty difficulty-${race.difficulty}">${race.difficulty}</span>
      </div>
      <p class="story-meta">${race.description}</p>
      <p class="support-copy">${questNode ? `District: ${questNode.label}` : "District: Open event"}</p>
      <div class="story-tags">
        <div class="story-tag"><span>Distance</span><strong>${Math.round(race.distance / 100)} km</strong></div>
        <div class="story-tag"><span>Payout</span><strong>${race.payout} cr</strong></div>
        <div class="story-tag"><span>Rivals</span><strong>${race.aiCount}</strong></div>
      </div>
      <div class="story-foot">
        <button class="button button-primary story-button" ${unlocked ? "" : "disabled"}>${!unlocked ? "Locked Quest" : inDistrict ? "Start Race" : "Go To District"}</button>
        <button class="button button-secondary story-button" data-preview="true">Preview</button>
      </div>
    `;

    const buttons = article.querySelectorAll("button");
    const startButton = buttons[0];
    const previewButton = buttons[1];

    if (startButton) {
      startButton.addEventListener("click", () => {
        if (!unlocked) return;
        if (!inDistrict && questNode) {
          switchView("mapView");
          setMessage(`Open the map and drive to ${questNode.label} to start ${race.name}.`);
          return;
        }
        startRace(race, "story");
      });
    }

    if (previewButton) {
      previewButton.addEventListener("click", () => {
        showOverlay("Story Preview", race.name, `${race.description} Win this event to earn ${race.payout} credits and ${race.xp} XP.`, "Back To Story");
      });
    }

    storyList.appendChild(article);
  });
}

function renderGarage() {
  const stats = getCarPerformance();
  const statRows = [
    { label: "Top Speed", value: stats.maxSpeed, max: 340 },
    { label: "Acceleration", value: stats.acceleration, max: 240 },
    { label: "Grip Control", value: stats.grip * 100, max: 110 },
    { label: "Nitro Reserve", value: stats.nitroMax, max: 220 },
  ];

  carStats.innerHTML = statRows.map((item) => `
    <div class="bar-group">
      <div class="bar-label"><span>${item.label}</span><strong>${Math.round((item.value / item.max) * 100)}%</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width: ${Math.min((item.value / item.max) * 100, 100)}%"></div></div>
    </div>
  `).join("");

  upgradeList.innerHTML = "";

  upgradeConfig.forEach((upgrade) => {
    const level = state.save.car[upgrade.key];
    const cost = upgrade.cost + level * 60;
    const atMax = level >= upgrade.maxLevel;
    const canAfford = state.save.credits >= cost;
    const article = document.createElement("article");
    article.className = "upgrade-item";
    article.innerHTML = `
      <div class="upgrade-head">
        <div>
          <p class="eyebrow">Level ${level}/${upgrade.maxLevel}</p>
          <h3>${upgrade.label}</h3>
        </div>
        <div><p class="upgrade-cost">${atMax ? "Maxed" : `${cost} credits`}</p></div>
      </div>
      <p class="upgrade-copy">${upgrade.description}</p>
      <button class="button ${canAfford && !atMax ? "button-primary" : "button-secondary"} upgrade-button" ${canAfford && !atMax ? "" : "disabled"}>
        ${atMax ? "Installed" : "Upgrade Part"}
      </button>
    `;

    const button = article.querySelector("button");
    if (button) {
      button.addEventListener("click", () => purchaseUpgrade(upgrade.key));
    }
    upgradeList.appendChild(article);
  });
}

function purchaseUpgrade(key) {
  const upgrade = upgradeConfig.find((item) => item.key === key);
  if (!upgrade) return;

  const currentLevel = state.save.car[key];
  if (currentLevel >= upgrade.maxLevel) {
    setMessage(`${upgrade.label} is already maxed out.`);
    return;
  }

  const cost = upgrade.cost + currentLevel * 60;
  if (state.save.credits < cost) {
    setMessage("Not enough credits. Win another story race first.");
    return;
  }

  state.save.credits -= cost;
  state.save.car[key] += 1;
  saveProgress();
  renderAllPanels();
  setMessage(`${upgrade.label} upgraded. Your car feels stronger already.`);
}

function renderOnlinePanel() {
  if (!state.room) {
    roomCodeValue.textContent = "No active room";
    roomStatus.textContent = "Create a room, share the code, then have the other player join from another tab or browser window.";
    hostReadyState.textContent = "Waiting";
    guestReadyState.textContent = "Waiting";
    return;
  }

  roomCodeValue.textContent = state.room.code;
  roomStatus.textContent = state.room.statusText;
  hostReadyState.textContent = state.room.hostReady ? "Ready" : "Waiting";
  guestReadyState.textContent = state.room.guestReady ? "Ready" : "Waiting";
}

function getNodeById(nodeId) {
  return cityNodes.find((node) => node.id === nodeId) || cityNodes[0];
}

function getQuestByRaceId(raceId) {
  return questDefinitions.find((quest) => quest.raceId === raceId) || null;
}

function isQuestUnlocked(quest) {
  const questIndex = questDefinitions.findIndex((item) => item.id === quest.id);
  if (questIndex <= 0) return true;
  const previousQuest = questDefinitions[questIndex - 1];
  return state.save.world.completedQuestIds.includes(previousQuest.id);
}

function isQuestCompleted(questId) {
  return state.save.world.completedQuestIds.includes(questId);
}

function getNodeDistance(a, b) {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y));
}

function travelToNode(nodeId) {
  const currentNode = getNodeById(state.save.world.currentNodeId);
  const targetNode = getNodeById(nodeId);

  if (currentNode.id === targetNode.id) {
    setMessage(`Already in ${targetNode.label}.`);
    return;
  }

  if (!currentNode.links.includes(targetNode.id)) {
    setMessage(`You can only free roam to connected districts from ${currentNode.label}.`);
    return;
  }

  state.save.world.currentNodeId = targetNode.id;
  saveProgress();
  renderAllPanels();
  setMessage(`Cruised from ${currentNode.label} to ${targetNode.label}.`);
}

function renderQuestList() {
  if (!questList) return;
  const currentNode = getNodeById(state.save.world.currentNodeId);

  questList.innerHTML = "";

  questDefinitions.forEach((quest) => {
    const race = storyRaces.find((item) => item.id === quest.raceId);
    const node = getNodeById(quest.nodeId);
    const unlocked = isQuestUnlocked(quest);
    const completed = isQuestCompleted(quest.id);
    const active = currentNode.id === quest.nodeId;
    const article = document.createElement("article");
    article.className = `quest-item ${active ? "is-active" : ""}`;
    article.innerHTML = `
      <div class="quest-row">
        <div>
          <p class="eyebrow">${node.label}</p>
          <h3>${quest.title}</h3>
        </div>
        <span class="quest-distance">${getNodeDistance(currentNode, node)} m</span>
      </div>
      <p class="upgrade-copy">${race.description}</p>
      <p class="support-copy">${completed ? "Completed" : unlocked ? quest.reward : "Locked until the previous quest is cleared."}</p>
      <div class="story-foot">
        <button class="button button-secondary quest-travel-button" ${active ? "disabled" : ""}>${active ? "Here Now" : "Drive Here"}</button>
        <button class="button ${active && unlocked ? "button-primary" : "button-secondary"} quest-start-button" ${(active && unlocked) ? "" : "disabled"}>${completed ? "Replay Quest" : "Start Quest"}</button>
      </div>
    `;

    const buttons = article.querySelectorAll("button");
    const travelButton = buttons[0];
    const startButton = buttons[1];

    travelButton?.addEventListener("click", () => travelToNode(node.id));
    startButton?.addEventListener("click", () => {
      if (active && unlocked) startRace(race, "story");
    });

    questList.appendChild(article);
  });
}

function drawCityMap() {
  if (!cityMapCtx || !cityMapCanvas) return;

  cityMapCtx.clearRect(0, 0, cityMapCanvas.width, cityMapCanvas.height);
  cityMapCtx.fillStyle = "#e8efe7";
  cityMapCtx.fillRect(0, 0, cityMapCanvas.width, cityMapCanvas.height);

  cityMapCtx.strokeStyle = "rgba(80, 120, 80, 0.18)";
  cityMapCtx.lineWidth = 1;
  for (let i = 24; i < cityMapCanvas.width; i += 42) {
    cityMapCtx.beginPath();
    cityMapCtx.moveTo(i, 0);
    cityMapCtx.lineTo(i, cityMapCanvas.height);
    cityMapCtx.stroke();
    cityMapCtx.beginPath();
    cityMapCtx.moveTo(0, i);
    cityMapCtx.lineTo(cityMapCanvas.width, i);
    cityMapCtx.stroke();
  }

  cityNodes.forEach((node) => {
    node.links.forEach((linkedId) => {
      if (node.id > linkedId) return;
      const linkedNode = getNodeById(linkedId);
      const trafficMix = (node.x + linkedNode.y) % 3;
      cityMapCtx.strokeStyle = trafficMix === 0 ? "#32a852" : trafficMix === 1 ? "#f0b646" : "#d34b4b";
      cityMapCtx.lineWidth = trafficMix === 0 ? 10 : 8;
      cityMapCtx.lineCap = "round";
      cityMapCtx.beginPath();
      cityMapCtx.moveTo(node.x, node.y);
      cityMapCtx.lineTo(linkedNode.x, linkedNode.y);
      cityMapCtx.stroke();

      cityMapCtx.strokeStyle = "rgba(255,255,255,0.95)";
      cityMapCtx.lineWidth = 2;
      cityMapCtx.beginPath();
      cityMapCtx.moveTo(node.x, node.y);
      cityMapCtx.lineTo(linkedNode.x, linkedNode.y);
      cityMapCtx.stroke();
    });
  });

  const currentNode = getNodeById(state.save.world.currentNodeId);

  questDefinitions.forEach((quest) => {
    const node = getNodeById(quest.nodeId);
    const unlocked = isQuestUnlocked(quest);
    const completed = isQuestCompleted(quest.id);
    cityMapCtx.fillStyle = completed ? "#2bc970" : unlocked ? "#f44587" : "#8a8f99";
    cityMapCtx.beginPath();
    cityMapCtx.arc(node.x, node.y, 8, 0, Math.PI * 2);
    cityMapCtx.fill();
    cityMapCtx.fillStyle = "#20303f";
    cityMapCtx.font = "700 11px Rajdhani";
    cityMapCtx.fillText(quest.title, node.x + 10, node.y - 10);
  });

  cityNodes.forEach((node) => {
    cityMapCtx.fillStyle = node.id === currentNode.id ? "#1463ff" : "#ffffff";
    cityMapCtx.strokeStyle = "#194a76";
    cityMapCtx.lineWidth = 2;
    cityMapCtx.beginPath();
    cityMapCtx.arc(node.x, node.y, node.id === currentNode.id ? 7 : 5, 0, Math.PI * 2);
    cityMapCtx.fill();
    cityMapCtx.stroke();

    cityMapCtx.fillStyle = "#2b3742";
    cityMapCtx.font = "600 12px Rajdhani";
    cityMapCtx.fillText(node.label, node.x + 8, node.y + 18);
  });

  cityMapCtx.fillStyle = "#111827";
  cityMapCtx.font = "700 12px Rajdhani";
  cityMapCtx.fillText("Traffic Map", 14, 18);
}

function renderMapPanel() {
  renderQuestList();
  drawCityMap();
  const currentNode = getNodeById(state.save.world.currentNodeId);
  if (mapHint) {
    mapHint.textContent = `Current district: ${currentNode.label}. Use the map to move to connected story quests.`;
  }
}

function renderAllPanels() {
  renderProfile();
  renderStory();
  renderGarage();
  renderOnlinePanel();
  renderMapPanel();
}

function switchView(targetId) {
  menuButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === targetId);
  });

  contentViews.forEach((view) => {
    view.classList.toggle("is-active", view.id === targetId);
  });
}

function trackSignal(distance, frequency, amplitude, phase = 0) {
  return Math.sin((distance / frequency) + phase + game.trackSeed) * amplitude;
}

function getTrackState(distance) {
  const curve =
    trackSignal(distance, 260, 0.48) +
    trackSignal(distance, 610, 0.34, 1.8) +
    trackSignal(distance, 1180, 0.22, 0.5);
  const hill =
    trackSignal(distance, 460, 0.78, 1.2) +
    trackSignal(distance, 980, 0.32, 0.25);

  return { curve, hill };
}

function spawnPlayer() {
  const stats = getCarPerformance();
  return {
    speed: 0,
    distance: 0,
    nitro: stats.nitroMax,
    lateral: 0,
    lateralVelocity: 0,
    steerVisual: 0,
    color: "#ff8f49",
    ...stats,
  };
}

function spawnRivals(race) {
  const rivals = [];
  for (let index = 0; index < race.aiCount; index += 1) {
    rivals.push({
      speed: 116 + index * 12 + (race.difficulty === "elite" ? 42 : race.difficulty === "pro" ? 24 : 0),
      distance: -(index + 1) * 120,
      drift: Math.random() * Math.PI * 2,
      lateral: ((index % 3) - 1) * 0.32,
      color: ["#49e7ff", "#ff5ea8", "#cfff72", "#ffc857", "#9b7cff"][index % 5],
    });
  }
  return rivals;
}

function startRace(race, mode) {
  state.activeRace = race;
  state.mode = mode;
  game.player = spawnPlayer();
  game.rivals = spawnRivals(race);
  game.running = true;
  game.finished = false;
  game.countdown = 3.2;
  game.startFlash = 0;
  game.trackSeed = Math.random() * Math.PI * 2;
  game.currentCurve = 0;
  game.currentHill = 0;
  hudEvent.textContent = race.name;
  hudProgress.textContent = "0%";
  hudPosition.textContent = `1 / ${game.rivals.length + 1}`;
  hudSpeed.textContent = "0 mph";
  hudNitro.textContent = `${Math.round(game.player.nitro)}%`;
  hideOverlay();
  setMessage(`Starting ${race.name}. Finish first for the full payout.`);
}

function finishRace(place) {
  if (game.finished || !state.activeRace) return;

  game.finished = true;
  game.running = false;

  const race = state.activeRace;
  const racerCount = game.rivals.length + 1;
  const creditsEarned = place === 1 ? race.payout : Math.round(race.payout * 0.45);
  const xpEarned = place === 1 ? race.xp : Math.round(race.xp * 0.55);

  state.save.credits += creditsEarned;
  state.save.xp += xpEarned;

  if (place === 1 && state.mode === "story") {
    state.save.wins += 1;
    const quest = getQuestByRaceId(race.id);
    if (quest && !state.save.world.completedQuestIds.includes(quest.id)) {
      state.save.world.completedQuestIds.push(quest.id);
    }
  }

  saveProgress();
  renderAllPanels();
  showOverlay(
    place === 1 ? "Victory" : "Race Complete",
    place === 1 ? `${race.name} cleared` : `Finished ${place} of ${racerCount}`,
    place === 1
      ? `You won ${creditsEarned} credits and ${xpEarned} XP. Head to the garage if you want more speed before the next story race.`
      : `You earned ${creditsEarned} credits and ${xpEarned} XP. Tune the car and run it back for first place.`,
    "Back To Story"
  );
  setMessage(place === 1 ? "Race win locked in. New upgrades are ready in the garage." : "Race complete. Upgrade your ride and take another shot.");
}

function getPosition() {
  const allCars = [{ type: "player", distance: game.player.distance }, ...game.rivals.map((rival) => ({ type: "rival", distance: rival.distance }))];
  allCars.sort((a, b) => b.distance - a.distance);
  return allCars.findIndex((entry) => entry.type === "player") + 1;
}

function updateRace(delta) {
  if (!game.running || !state.activeRace || !game.player) return;

  if (game.countdown > 0) {
    game.countdown -= delta;
    if (game.countdown <= 0) {
      game.startFlash = 1.1;
      setMessage("Go go go!");
    }
    return;
  }

  if (game.startFlash > 0) {
    game.startFlash = Math.max(game.startFlash - delta, 0);
  }

  const player = game.player;
  const race = state.activeRace;
  const accelInput = keys.up ? 1 : 0;
  const brakeInput = keys.down ? 1 : 0;
  const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const usingNitro = keys.boost && player.nitro > 0;
  const trackNow = getTrackState(player.distance);

  game.currentCurve = trackNow.curve;
  game.currentHill = trackNow.hill;

  const engineForce = accelInput * player.acceleration;
  const drag = 34 + player.speed * 0.13;
  const brakeForce = brakeInput * 190;

  player.speed += (engineForce - drag - brakeForce) * delta;

  if (usingNitro) {
    player.speed += 128 * delta;
    player.nitro = Math.max(player.nitro - 28 * delta, 0);
  } else {
    player.nitro = Math.min(player.nitro + 8 * delta, player.nitroMax);
  }

  player.speed = Math.max(0, Math.min(player.speed, player.maxSpeed + (usingNitro ? 42 : 0)));

  const speedRatio = player.speed / Math.max(player.maxSpeed, 1);
  const steerPower = player.turnRate * (0.72 + speedRatio * 1.08);
  const driftSlip = trackNow.curve * (0.12 + speedRatio * 0.3);

  player.lateralVelocity += steerInput * steerPower * delta;
  player.lateralVelocity -= player.lateral * 1.05 * delta;
  player.lateralVelocity -= driftSlip * delta;
  player.lateralVelocity *= 0.86 + player.driftControl * 0.08;
  player.lateral += player.lateralVelocity * 2.15;
  player.steerVisual += (steerInput - player.steerVisual) * Math.min(delta * 8, 1);

  const shoulderLimit = 1.05;
  const trackLimit = 1.34;

  if (Math.abs(player.lateral) > shoulderLimit) {
    const outside = Math.abs(player.lateral) - shoulderLimit;
    player.speed *= 1 - Math.min(outside * 0.09 * delta * 60, 0.12);
    player.lateralVelocity *= 0.9;
  }

  if (Math.abs(player.lateral) > trackLimit) {
    player.lateral = Math.sign(player.lateral) * trackLimit;
    player.lateralVelocity *= -0.28;
    player.speed *= 0.92;
  }

  player.distance += player.speed * delta;

  game.rivals.forEach((rival, index) => {
    const rivalTrack = getTrackState(rival.distance);
    const targetLane = Math.sin((rival.distance / 210) + rival.drift) * 0.58;
    rival.lateral += (targetLane - rival.lateral) * delta * 0.8;
    rival.speed += ((rival.speed * 0.98 + 10) - rival.speed) * delta * 0.15;
    rival.distance += (rival.speed + rivalTrack.curve * 10 + Math.sin(rival.distance / 190 + index) * 8) * delta;
  });

  const place = getPosition();
  const progress = Math.min((player.distance / race.distance) * 100, 100);

  hudProgress.textContent = `${Math.round(progress)}%`;
  hudPosition.textContent = `${place} / ${game.rivals.length + 1}`;
  hudSpeed.textContent = `${Math.round(player.speed)} mph`;
  hudNitro.textContent = `${Math.round((player.nitro / player.nitroMax) * 100)}%`;

  if (player.distance >= race.distance) {
    finishRace(place);
  }
}

function projectPoint(worldZ, worldX, worldY) {
  const depth = Math.max(worldZ, 0.1);
  const scale = road.cameraDepth / depth;
  return {
    x: canvas.width / 2 + worldX * scale * canvas.width * 0.5,
    y: road.horizonY + ((1 - scale) * (canvas.height - road.horizonY)) - worldY * scale * 140,
    scale,
  };
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#050912");
  sky.addColorStop(0.45, "#111b42");
  sky.addColorStop(1, "#16223f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  for (let i = 0; i < 80; i += 1) {
    const x = (i * 97 + game.trackSeed * 100) % canvas.width;
    const y = (i * 41) % road.horizonY;
    ctx.fillRect(x, y, 2, 2);
  }

  const cityGlow = ctx.createLinearGradient(0, road.horizonY - 20, 0, road.horizonY + 90);
  cityGlow.addColorStop(0, "rgba(73, 231, 255, 0.03)");
  cityGlow.addColorStop(1, "rgba(255, 94, 168, 0.18)");
  ctx.fillStyle = cityGlow;
  ctx.fillRect(0, road.horizonY - 10, canvas.width, 120);

  for (let i = 0; i < 16; i += 1) {
    const x = i * 70 + ((game.player?.distance || 0) * 0.12 % 70);
    const height = 30 + (i % 5) * 18;
    ctx.fillStyle = i % 2 === 0 ? "rgba(73, 231, 255, 0.22)" : "rgba(255, 94, 168, 0.18)";
    ctx.fillRect(x, road.horizonY - height, 28, height);
  }

  const ground = ctx.createLinearGradient(0, road.horizonY, 0, canvas.height);
  ground.addColorStop(0, "#0b1824");
  ground.addColorStop(1, "#06111a");
  ctx.fillStyle = ground;
  ctx.fillRect(0, road.horizonY, canvas.width, canvas.height - road.horizonY);
}

function drawSegment(segment) {
  const { near, far, laneShiftNear, laneShiftFar, grassColor, rumbleColor } = segment;

  ctx.fillStyle = grassColor;
  ctx.beginPath();
  ctx.moveTo(0, near.y);
  ctx.lineTo(canvas.width, near.y);
  ctx.lineTo(canvas.width, far.y);
  ctx.lineTo(0, far.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rumbleColor;
  ctx.beginPath();
  ctx.moveTo(near.x - near.roadHalfWidth - near.shoulderWidth, near.y);
  ctx.lineTo(near.x - near.roadHalfWidth, near.y);
  ctx.lineTo(far.x - far.roadHalfWidth, far.y);
  ctx.lineTo(far.x - far.roadHalfWidth - far.shoulderWidth, far.y);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(near.x + near.roadHalfWidth, near.y);
  ctx.lineTo(near.x + near.roadHalfWidth + near.shoulderWidth, near.y);
  ctx.lineTo(far.x + far.roadHalfWidth + far.shoulderWidth, far.y);
  ctx.lineTo(far.x + far.roadHalfWidth, far.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = segment.roadColor;
  ctx.beginPath();
  ctx.moveTo(near.x - near.roadHalfWidth, near.y);
  ctx.lineTo(near.x + near.roadHalfWidth, near.y);
  ctx.lineTo(far.x + far.roadHalfWidth, far.y);
  ctx.lineTo(far.x - far.roadHalfWidth, far.y);
  ctx.closePath();
  ctx.fill();

  if (segment.index % 2 === 0) {
    const lineNearWidth = near.roadHalfWidth * 0.05;
    const lineFarWidth = far.roadHalfWidth * 0.05;
    const centerNear = near.x + laneShiftNear;
    const centerFar = far.x + laneShiftFar;
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.beginPath();
    ctx.moveTo(centerNear - lineNearWidth, near.y);
    ctx.lineTo(centerNear + lineNearWidth, near.y);
    ctx.lineTo(centerFar + lineFarWidth, far.y);
    ctx.lineTo(centerFar - lineFarWidth, far.y);
    ctx.closePath();
    ctx.fill();
  }
}

function buildVisibleSegments() {
  const segments = [];
  const player = game.player;
  const playerDistance = player ? player.distance : 0;
  let accumulatedCurve = 0;
  let lastFar = null;

  for (let index = road.visibleSegments; index >= 1; index -= 1) {
    const segStart = playerDistance + (index - 1) * road.segmentLength;
    const segEnd = playerDistance + index * road.segmentLength;
    const startTrack = getTrackState(segStart);
    const endTrack = getTrackState(segEnd);
    const nearDepth = index;
    const farDepth = index + 1;

    accumulatedCurve += startTrack.curve * 0.42;

    const nearProj = projectPoint(nearDepth, accumulatedCurve - player.lateral * 0.7, startTrack.hill);
    const farProj = projectPoint(farDepth, accumulatedCurve + endTrack.curve * 0.35 - player.lateral * 0.7, endTrack.hill);

    const near = {
      x: nearProj.x,
      y: Math.min(nearProj.y, canvas.height + 60),
      roadHalfWidth: nearProj.scale * road.halfWidth,
      shoulderWidth: nearProj.scale * road.shoulderWidth,
      scale: nearProj.scale,
    };

    const far = {
      x: farProj.x,
      y: farProj.y,
      roadHalfWidth: farProj.scale * road.halfWidth,
      shoulderWidth: farProj.scale * road.shoulderWidth,
      scale: farProj.scale,
    };

    if (lastFar && near.y < lastFar.y) near.y = lastFar.y;
    lastFar = far;

    segments.push({
      index,
      near,
      far,
      laneShiftNear: startTrack.curve * near.scale * 80,
      laneShiftFar: endTrack.curve * far.scale * 80,
      grassColor: index % 2 === 0 ? "#102b20" : "#0c221a",
      rumbleColor: index % 2 === 0 ? "#ff5ea8" : "#49e7ff",
      roadColor: index % 2 === 0 ? "#232c3d" : "#1c2433",
    });
  }

  return segments;
}

function drawRoadsideObjects(segments) {
  segments.forEach((segment, index) => {
    if (index % 3 !== 0) return;

    const leftX = segment.near.x - segment.near.roadHalfWidth - segment.near.shoulderWidth - 18;
    const rightX = segment.near.x + segment.near.roadHalfWidth + segment.near.shoulderWidth + 18;
    const poleHeight = 24 + segment.near.scale * 120;

    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(leftX, segment.near.y - poleHeight, 3, poleHeight);
    ctx.fillRect(rightX, segment.near.y - poleHeight, 3, poleHeight);

    ctx.fillStyle = index % 2 === 0 ? "#49e7ff" : "#ffc857";
    ctx.beginPath();
    ctx.arc(leftX + 1.5, segment.near.y - poleHeight, 6 + segment.near.scale * 9, 0, Math.PI * 2);
    ctx.arc(rightX + 1.5, segment.near.y - poleHeight, 6 + segment.near.scale * 9, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCarSprite(screenX, screenY, size, color, steer, boost) {
  const bodyWidth = size * 0.56;
  const bodyLength = size;
  const skew = steer * size * 0.12;

  ctx.save();
  ctx.translate(screenX, screenY);

  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.26, bodyWidth * 0.7, size * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#080e1a";
  ctx.fillRect(-bodyWidth * 0.54 + skew, -bodyLength * 0.45, bodyWidth * 1.08, bodyLength * 0.9);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-bodyWidth * 0.48 + skew, -bodyLength * 0.4);
  ctx.lineTo(bodyWidth * 0.44 + skew, -bodyLength * 0.28);
  ctx.lineTo(bodyWidth * 0.5 + skew * 0.4, bodyLength * 0.28);
  ctx.lineTo(-bodyWidth * 0.52 + skew * 0.4, bodyLength * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.beginPath();
  ctx.moveTo(-bodyWidth * 0.22 + skew, -bodyLength * 0.14);
  ctx.lineTo(bodyWidth * 0.16 + skew, -bodyLength * 0.06);
  ctx.lineTo(bodyWidth * 0.08 + skew, bodyLength * 0.08);
  ctx.lineTo(-bodyWidth * 0.26 + skew, bodyLength * 0.02);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1b2436";
  const wheelWidth = bodyWidth * 0.16;
  const wheelHeight = bodyLength * 0.18;
  ctx.fillRect(-bodyWidth * 0.62 + skew, -bodyLength * 0.32, wheelWidth, wheelHeight);
  ctx.fillRect(bodyWidth * 0.46 + skew, -bodyLength * 0.22, wheelWidth, wheelHeight);
  ctx.fillRect(-bodyWidth * 0.68 + skew * 0.4, bodyLength * 0.14, wheelWidth, wheelHeight);
  ctx.fillRect(bodyWidth * 0.42 + skew * 0.4, bodyLength * 0.24, wheelWidth, wheelHeight);

  if (boost) {
    ctx.fillStyle = "rgba(255, 146, 72, 0.8)";
    ctx.beginPath();
    ctx.moveTo(-bodyWidth * 0.12, bodyLength * 0.43);
    ctx.lineTo(bodyWidth * 0.12, bodyLength * 0.43);
    ctx.lineTo(0, bodyLength * 0.76);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function getCarScreenPosition(distanceAhead, lateralOffset) {
  const clampedDepth = Math.max(1.1, 1.3 + distanceAhead / road.segmentLength);
  const trackAtDepth = getTrackState((game.player?.distance || 0) + distanceAhead);
  const roadCenterShift = trackAtDepth.curve * 0.6 - (game.player?.lateral || 0) * 0.7;
  const projected = projectPoint(clampedDepth, roadCenterShift + lateralOffset, trackAtDepth.hill);
  return { x: projected.x, y: projected.y, scale: projected.scale };
}

function drawRivals() {
  if (!game.player) return;
  const playerDistance = game.player.distance;

  const visible = game.rivals
    .map((rival) => ({ rival, gap: rival.distance - playerDistance }))
    .filter((entry) => entry.gap > -120 && entry.gap < road.segmentLength * road.visibleSegments)
    .sort((a, b) => b.gap - a.gap);

  visible.forEach(({ rival, gap }) => {
    const position = getCarScreenPosition(gap, rival.lateral * 1.4);
    const size = 46 + position.scale * 188;
    drawCarSprite(position.x, position.y, size, rival.color, Math.sin(rival.drift + rival.distance / 140) * 0.25, false);
  });
}

function drawPlayer() {
  if (!game.player) return;
  const player = game.player;
  const boost = keys.boost && player.nitro > 0 && game.countdown <= 0 && !game.finished;
  const screenX = canvas.width / 2 + player.lateral * canvas.width * 0.22;
  const screenY = canvas.height - 102 + Math.abs(player.steerVisual) * 5;
  drawCarSprite(screenX, screenY, 136, player.color, player.steerVisual, boost);
}

function drawRaceText() {
  if (game.countdown > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 88px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.ceil(game.countdown)}`, canvas.width / 2, canvas.height / 2);
    return;
  }

  if (game.startFlash > 0) {
    ctx.fillStyle = `rgba(201,255,114,${Math.min(game.startFlash, 1)})`;
    ctx.font = "800 78px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("GO!", canvas.width / 2, canvas.height / 2);
    return;
  }

  if (!game.running && !game.finished) {
    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "700 34px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("Select A Story Event", canvas.width / 2, canvas.height / 2);
  }
}

function drawScene() {
  drawBackground();
  drawRoad();
  drawRivals();
  drawPlayer();
  drawRaceText();
}

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - game.lastTime) / 1000 || 0, 0.033);
  game.lastTime = timestamp;
  updateRace(delta);
  drawScene();
  requestAnimationFrame(gameLoop);
}

function normalizeCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function broadcastRoom() {
  saveRoom();
  renderOnlinePanel();
  if (roomChannel && state.room) roomChannel.postMessage(state.room);
}

function createRoom() {
  state.room = { code: randomCode(), hostReady: false, guestReady: false, role: "host", statusText: "Room created. Waiting for a guest to join." };
  broadcastRoom();
  setMessage(`Room ${state.room.code} created. Share the code with your friend.`);
}

function joinRoom() {
  const code = normalizeCode(joinCodeInput.value);
  if (code.length !== 6) {
    setMessage("Room code must be 6 characters.");
    return;
  }

  state.room = { code, hostReady: false, guestReady: false, role: "guest", statusText: "Joined room. Toggle ready so the host can start the duel." };
  broadcastRoom();
  setMessage(`Joined room ${code}.`);
}

function toggleReady() {
  if (!state.room) {
    setMessage("Create or join a room first.");
    return;
  }

  if (state.room.role === "host") {
    state.room.hostReady = !state.room.hostReady;
  } else {
    state.room.guestReady = !state.room.guestReady;
  }

  state.room.statusText = "Ready state updated. Start the duel when both racers are ready.";
  broadcastRoom();
}

function startDuel() {
  if (!state.room) {
    setMessage("No room active yet.");
    return;
  }

  if (!state.room.hostReady || !state.room.guestReady) {
    setMessage("Both players need to be ready before the duel can start.");
    return;
  }

  const duelRace = {
    id: "code-duel",
    name: `Code Duel ${state.room.code}`,
    description: "Prototype versus race.",
    distance: 3600,
    payout: 260,
    xp: 100,
    aiCount: 1,
    difficulty: "pro",
    unlockWins: 0,
  };

  state.room.statusText = "Duel started. Race is live.";
  broadcastRoom();
  startRace(duelRace, "duel");
}

function syncIncomingRoom(roomData) {
  if (!roomData || !state.room || roomData.code !== state.room.code) return;
  const localRole = state.room.role;
  state.room = { ...roomData, role: localRole };
  saveRoom();
  renderOnlinePanel();
}

function attachEvents() {
  menuButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewTarget));
  });

  mapToggleButton?.addEventListener("click", () => {
    switchView("mapView");
  });

  overlayActionButton.addEventListener("click", () => {
    switchView("storyView");
    if (game.finished) {
      game.finished = false;
      state.activeRace = null;
      state.mode = "free";
    }
    showOverlay("Story Event", "Select a race to start", "Pick an event from story mode, upgrade your car in the garage, or set up a versus room.");
  });

  createRoomButton.addEventListener("click", createRoom);
  joinRoomButton.addEventListener("click", joinRoom);
  toggleReadyButton.addEventListener("click", toggleReady);
  startDuelButton.addEventListener("click", startDuel);
  joinCodeInput.addEventListener("input", () => {
    joinCodeInput.value = normalizeCode(joinCodeInput.value);
  });

  const keyMap = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ShiftLeft: "boost",
    ShiftRight: "boost",
  };

  window.addEventListener("keydown", (event) => {
    const mapped = keyMap[event.code];
    if (mapped) {
      keys[mapped] = true;
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    const mapped = keyMap[event.code];
    if (mapped) {
      keys[mapped] = false;
      event.preventDefault();
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === roomKey && event.newValue) {
      try {
        syncIncomingRoom(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed room updates.
      }
    }
  });

  if (roomChannel) {
    roomChannel.addEventListener("message", (event) => {
      syncIncomingRoom(event.data);
    });
  }

  cityMapCanvas?.addEventListener("click", (event) => {
    const rect = cityMapCanvas.getBoundingClientRect();
    const scaleX = cityMapCanvas.width / rect.width;
    const scaleY = cityMapCanvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const hitNode = cityNodes.find((node) => Math.hypot(node.x - x, node.y - y) < 16);
    if (!hitNode) return;

    if (hitNode.id === state.save.world.currentNodeId) {
      const questHere = questDefinitions.find((quest) => quest.nodeId === hitNode.id && isQuestUnlocked(quest));
      if (questHere) {
        const race = storyRaces.find((item) => item.id === questHere.raceId);
        if (race) startRace(race, "story");
      } else {
        setMessage(`Exploring ${hitNode.label}. No active quest here yet.`);
      }
      return;
    }

    travelToNode(hitNode.id);
  });
}

function init() {
  renderAllPanels();
  switchView("storyView");
  showOverlay("Story Event", "Select a race to start", "Pick an event from story mode, upgrade your car in the garage, or set up a versus room.");
  attachEvents();
  requestAnimationFrame(gameLoop);
}

init();
