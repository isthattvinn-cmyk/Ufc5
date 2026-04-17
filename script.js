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
};

const saveKey = "nightCircuitLegendsSave";
const roomKey = "nightCircuitLegendsRoom";
const roomChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel("night-circuit-legends") : null;

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

const keys = { left: false, right: false, up: false, down: false, boost: false };

const state = {
  save: loadSave(),
  activeRace: null,
  mode: "free",
  messageTimeout: null,
  room: loadRoom(),
};

const game = {
  running: false,
  finished: false,
  countdown: 0,
  startFlash: 0,
  lastTime: 0,
  roadOffset: 0,
  player: null,
  rivals: [],
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
    maxSpeed: 210 + upgrades.topSpeed * 20,
    acceleration: 130 + upgrades.acceleration * 18,
    turnRate: 2.2 + upgrades.handling * 0.28,
    grip: 0.88 + upgrades.handling * 0.018,
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

  storyRaces.forEach((race) => {
    const unlocked = state.save.wins >= race.unlockWins;
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
      <div class="story-tags">
        <div class="story-tag"><span>Distance</span><strong>${Math.round(race.distance / 100)} km</strong></div>
        <div class="story-tag"><span>Payout</span><strong>${race.payout} cr</strong></div>
        <div class="story-tag"><span>Rivals</span><strong>${race.aiCount}</strong></div>
      </div>
      <div class="story-foot">
        <button class="button button-primary story-button" ${unlocked ? "" : "disabled"}>${unlocked ? "Start Race" : `Need ${race.unlockWins} wins`}</button>
        <button class="button button-secondary story-button" data-preview="true">Preview</button>
      </div>
    `;

    const buttons = article.querySelectorAll("button");
    const startButton = buttons[0];
    const previewButton = buttons[1];

    if (startButton) {
      startButton.addEventListener("click", () => {
        if (unlocked) startRace(race, "story");
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
    { label: "Top Speed", value: stats.maxSpeed, max: 320 },
    { label: "Acceleration", value: stats.acceleration, max: 230 },
    { label: "Handling", value: stats.turnRate * 40, max: 180 },
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

function renderAllPanels() {
  renderProfile();
  renderStory();
  renderGarage();
  renderOnlinePanel();
}

function switchView(targetId) {
  menuButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === targetId);
  });

  contentViews.forEach((view) => {
    view.classList.toggle("is-active", view.id === targetId);
  });
}

function spawnPlayer() {
  const stats = getCarPerformance();
  return { x: canvas.width / 2, y: canvas.height - 110, speed: 0, distance: 0, nitro: stats.nitroMax, laneBias: 0, color: "#ff8f49", ...stats };
}

function spawnRivals(race) {
  const rivals = [];
  for (let index = 0; index < race.aiCount; index += 1) {
    rivals.push({
      x: canvas.width / 2 + ((index % 2 === 0 ? -1 : 1) * (90 + index * 16)),
      speed: 110 + index * 10 + (race.difficulty === "elite" ? 36 : race.difficulty === "pro" ? 20 : 0),
      distance: 0,
      drift: Math.random() * Math.PI * 2,
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
  game.roadOffset = 0;
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

  player.speed += accelInput * player.acceleration * delta;
  player.speed -= brakeInput * 180 * delta;
  player.speed -= 42 * delta;

  if (usingNitro) {
    player.speed += 120 * delta;
    player.nitro = Math.max(player.nitro - 28 * delta, 0);
  } else {
    player.nitro = Math.min(player.nitro + 8 * delta, player.nitroMax);
  }

  player.speed = Math.max(0, Math.min(player.speed, player.maxSpeed + (usingNitro ? 38 : 0)));
  player.laneBias += steerInput * player.turnRate * 72 * delta * (0.45 + player.speed / Math.max(player.maxSpeed, 1));
  player.laneBias *= player.grip;

  if (Math.abs(player.laneBias) > 220) {
    player.speed *= 0.988;
  }

  player.laneBias = Math.max(-240, Math.min(240, player.laneBias));
  player.distance += player.speed * delta;
  game.roadOffset += player.speed * delta;

  game.rivals.forEach((rival, index) => {
    const targetPace = rival.speed + Math.sin((rival.distance / 220) + rival.drift) * 18;
    rival.distance += targetPace * delta;
    rival.x = canvas.width / 2 + Math.sin((rival.distance / 160) + rival.drift) * (120 + index * 8);
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

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#071020");
  gradient.addColorStop(1, "#0e1734");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(73, 231, 255, 0.14)";
  for (let i = 0; i < 20; i += 1) {
    const y = (i * 42 + (game.roadOffset * 0.18)) % canvas.height;
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

function drawRoad() {
  const laneCenter = canvas.width / 2 + (game.player ? game.player.laneBias : 0);
  const roadTopWidth = 280;
  const roadBottomWidth = 540;

  ctx.beginPath();
  ctx.moveTo(laneCenter - roadTopWidth / 2, 0);
  ctx.lineTo(laneCenter + roadTopWidth / 2, 0);
  ctx.lineTo(laneCenter + roadBottomWidth / 2, canvas.height);
  ctx.lineTo(laneCenter - roadBottomWidth / 2, canvas.height);
  ctx.closePath();
  ctx.fillStyle = "#1d2434";
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 4;
  ctx.setLineDash([24, 18]);
  ctx.beginPath();
  ctx.moveTo(laneCenter, 0);
  ctx.lineTo(laneCenter, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 16; i += 1) {
      const y = (i * 44 + game.roadOffset * 0.5) % (canvas.height + 50) - 50;
      ctx.fillStyle = i % 2 === 0 ? "#ff5ea8" : "#49e7ff";
      const xOffset = side * ((roadTopWidth / 2) + ((roadBottomWidth - roadTopWidth) * (y / canvas.height)) / 2 + 18);
      ctx.fillRect(laneCenter + xOffset, y, 12, 28);
    }
  }
}

function drawCar(x, y, color, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#09101f";
  ctx.fillRect(-20, -32, 40, 64);
  ctx.fillStyle = color;
  ctx.fillRect(-16, -28, 32, 56);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(-8, -18, 16, 16);
  ctx.fillStyle = "#1a2133";
  ctx.fillRect(-18, -26, 6, 14);
  ctx.fillRect(12, -26, 6, 14);
  ctx.fillRect(-18, 12, 6, 14);
  ctx.fillRect(12, 12, 6, 14);
  ctx.restore();
}

function drawRivals() {
  if (!game.player) return;
  const playerDistance = game.player.distance;

  game.rivals.forEach((rival) => {
    const gap = rival.distance - playerDistance;
    const y = canvas.height - 170 - gap * 0.13;
    if (y > -80 && y < canvas.height + 80) {
      drawCar(rival.x, y, rival.color, 0.9);
    }
  });
}

function drawPlayer() {
  if (!game.player) return;

  drawCar(canvas.width / 2 + game.player.laneBias, canvas.height - 110, game.player.color, 1.06);

  if (keys.boost && game.player.nitro > 0 && game.countdown <= 0 && !game.finished) {
    ctx.fillStyle = "rgba(255, 146, 72, 0.85)";
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 + game.player.laneBias - 10, canvas.height - 70);
    ctx.lineTo(canvas.width / 2 + game.player.laneBias + 10, canvas.height - 70);
    ctx.lineTo(canvas.width / 2 + game.player.laneBias, canvas.height - 34);
    ctx.closePath();
    ctx.fill();
  }
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
}

function init() {
  renderAllPanels();
  switchView("storyView");
  showOverlay("Story Event", "Select a race to start", "Pick an event from story mode, upgrade your car in the garage, or set up a versus room.");
  attachEvents();
  requestAnimationFrame(gameLoop);
}

init();
