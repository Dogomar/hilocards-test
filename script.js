// script.js
import { createRoom, joinRoom, listenRoom, syncState, getPlayerRole } from "./firebase.js";
let roomId = null;

// ----- Constantes Globais do Jogo -----
const MAX_PV = 40;
const DECK_SIZE = 20;

// ----- Definição de Cartas -----
const CARD_POOL = {
  // (mantive exatamente suas cartas — cole aqui o mesmo objeto do seu arquivo original)
  espadachim: { id:'espadachim', name:'Espadachim', type:'basic', cost:1, desc:'Causa 2 de dano.', art:'⚔️', image: 'espadachim.png', play: ({ctx})=>dealDamage(ctx,2) },
  escudo: { id:'escudo', name:'Escudo de Madeira', type:'basic', cost:1, desc:'Ganha 2 de escudo.', art:'🛡️', image: 'escudodemadeira.png' ,play: ({ctx})=>gainShield(ctx.player,2) },
  flecha: { id:'flecha', name:'Flecha Rápida', type:'basic', cost:0, desc:'Causa 1 de dano.', art:'🏹',image: 'flecharapida.png' , play: ({ctx})=>dealDamage(ctx,1) },
  pocao: { id:'pocao', name:'Poção Menor', type:'basic', cost:1, desc:'Cura 2 PV.', art:'🧪', image: 'curamenor.png', play: ({ctx})=>heal(ctx.player,2) },
  martelo: { id:'martelo', name:'Martelo de Pedra', type:'basic', cost:2, desc:'Causa 3 de dano.', art:'🔨', image: 'martelodepedra.png', play: ({ctx})=>dealDamage(ctx,3) },
  arqueiro: { id:'arqueiro', name:'Arqueiro', type:'basic', cost:2, desc:'2 de dano, ignora 1 de defesa.', art:'🎯', image: 'arqueiro.png', play: ({ctx})=>dealDamage(ctx,2, {ignoreDef:1}) },
  goblin: { id:'goblin', name:'Goblin Saqueador', type:'basic', cost:1, desc:'Causa 3 de dano direto.', art:'👺', image: 'goblinsa.png', play: ({ctx})=>dealDamage(ctx,3) },
  mago: { id:'mago', name:'Mago Aprendiz', type:'rare', cost:2, desc:'Causa 4 de dano.', art:'🧙', image: 'magoaprendiz.png', play: ({ctx})=>dealDamage(ctx,4) },
  barreira: { id:'barreira', name:'Barreira de Pedra', type:'rare', cost:2, desc:'Ganha 5 de escudo.', art:'🧱', image: 'barreiradepedra.png', play: ({ctx})=>gainShield(ctx.player,5) },
  lamina: { id:'lamina', name:'Lâmina Flamejante', type:'rare', cost:2, desc:'3 de dano, ignora toda a defesa.', art:'🔥', image: 'laminaflamejante.png', play: ({ctx})=>dealDamage(ctx,3, {ignoreDef:999}) },
  pocaoM: { id:'pocaoM', name:'Poção Maior', type:'rare', cost:2, desc:'Cura 5 PV.', art:'💖', image: 'curamaior.png', play: ({ctx})=>heal(ctx.player,5) },
  cacador: { id:'cacador', name:'Caçador Sombrio', type:'rare', cost:2, desc:'Causa 2 de dano e te dá 1 de energia.',  art:'🦇', image: 'cacadorsombrio.png', play: async ({ctx})=>{
      await dealDamage(ctx,2);
      log('Caçador Sombrio ativou seu efeito!');
      state[ctx.player].energy = Math.min(7, state[ctx.player].energy + 1);
      updateUI();
  }},
  dragao: { id:'dragao', name:'Dragão Ancestral', type:'legend', cost:5, desc:'Causa 10 de dano.', image: 'dragaoancestral.png', art:'🐲', play: ({ctx})=>dealDamage(ctx,10) },
  cavaleiro: { id:'cavaleiro', name:'Cavaleiro Imortal', type:'legend', cost:6, desc:'Causa 6 de dano e cura 3 de vida.', art:'👻', image: 'cavaleiroimortal.png', play: async ({ctx})=>{
      await dealDamage(ctx,6);
      heal(ctx.player,3);
  }},
  tempestade: { id:'tempestade', name:'Tempestade Arcana', type:'legend', cost:4, desc:'Causa 3 de dano e aplica 2 turnos de Sangramento (1 de dano por turno).', art:'🌪️', image: 'tempestadearcana.png', play: async ({ctx})=>{
      await dealDamage(ctx,3);
      applyEffect(ctx.opponent, {key:'bleed', turns:3, damage:1});
  }},
  espadaDivina: { id:'espadaDivina', name:'Espada Divina', type:'legend', cost:3, desc:'Dobra o dano da próxima carta de ataque nos próximos 2 turnos.', art:'✨', image: 'espadadivina.png', play: ({ctx})=>applyEffect(ctx.player, {key:'doubleNextAttack',turns:2}) },
  feiticeira: { id: 'feiticeira', name: 'Feiticeira da Lua', type: 'legend', cost: 3, desc: 'Recupera 3 de PV e ganha 2 de energia.', art: '🌙', image: 'feiticeiradalua.png', play: ({ctx}) => {
      heal(ctx.player, 3);
      state[ctx.player].energy = Math.min(7, state[ctx.player].energy + 2);
      log(`${state[ctx.player].name} sente a energia da lua!`);
  }},
  jokerRed: { id:'jokerRed', name:'Joker Vermelho', type:'joker', cost:2, desc:'Multiplica por 2 todo o dano neste turno.', art:'🔴', image: 'jokervermelho.png', play: ({ctx})=>applyEffect(ctx.player, {key:'doubleAllDamage',turns:1}) },
  jokerBlue: { id:'jokerBlue', name:'Joker Azul', type:'joker', cost:1, desc:'Defesas também curam 2 PV neste turno.', art:'🔵', image: 'jokerazul.png', play: ({ctx})=>applyEffect(ctx.player, {key:'defHeal',turns:1}) },
  jokerGreen: { id:'jokerGreen', name:'Joker Verde', type:'joker', cost:3, desc:'Permite comprar 2 cartas.', art:'🟢', image: 'jokerverde.png', play: ({ctx})=>{ drawCard(ctx.player); drawCard(ctx.player); } },
  jokerGold: { id:'jokerGold', name:'Joker Dourado', type:'joker', cost:1, desc:'Revive 1 carta do descarte para a mão.', art:'🟡', image: 'jokerdourado.png', play: ({ctx})=>reviveFromDiscard(ctx) }
};

const RARE_CARD_TYPES = ['legend','joker'];

// ----- Estado do Jogo -----
let state = null;
let gameMode = 'vs-bot'; // 'vs-bot' | 'vs-player' | 'vs-player-online'
let player1CustomDeck = [];
let player2CustomDeck = [];
let currentDeckBuilderFor = 'p1';

// ----- Utilidades -----
function getOpponent(playerKey) { return playerKey === 'p1' ? 'p2' : 'p1'; }
function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }

// ----- Funções que transformam pré-game -> in-game (host faz isso) -----
function buildInGameStateFromPre(pre) {
  const p1deck = shuffle((pre.p1.deck || []).slice());
  const p2deck = shuffle((pre.p2.deck || []).slice());
  const inGame = {
    turn: 1,
    active: 'p1',
    p1: { id: 'p1', name: pre.p1.name || 'Jogador 1', pv: MAX_PV, deck: p1deck, hand: [], discard: [], energy: 0, shield: 0 },
    p2: { id: 'p2', name: pre.p2.name || 'Jogador 2', pv: MAX_PV, deck: p2deck, hand: [], discard: [], energy: 0, shield: 0 },
    activeEffects: [],
    log: [],
    gameEnded: false,
    playedCards: [],
    undoStack: [],
    gameStarted: true
  };
  // comprar 5 cartas iniciais
  for (let i = 0; i < 5; i++) {
    if (inGame.p1.deck.length) inGame.p1.hand.push(inGame.p1.deck.shift());
    if (inGame.p2.deck.length) inGame.p2.hand.push(inGame.p2.deck.shift());
  }
  return inGame;
}

// Quando o servidor (host) já montou o estado de jogo e gravou no DB,
// ambos clientes recebem esse estado e "iniciam" localmente a UI a partir dele.
function startFromServerState(serverState) {
  state = serverState;
  // certifique-se que o jogo está aparecendo
  document.getElementById('deck-builder-screen').classList.add('hidden');
  document.querySelector('.game-container').classList.remove('hidden');
  updateUI();
  // iniciar a lógica de turno a partir do estado atual
  // usamos startTurn para aplicar a rotina de início (mas cuidado: caso host já tenha feito um startTurn, verifique duplicidade)
  startTurn(state.active);
}

// ----- Lógica do Jogo (mantive a maioria das suas funções, apenas integrei sync online) -----
function newGame() {
  // newGame continua existindo para modos locais/vs-bot (não é usado para o flow online)
  state = {
    turn: 1,
    active: 'p1',
    p1: { id: 'p1', name: 'Jogador 1', pv: MAX_PV, deck: shuffle(player1CustomDeck), hand: [], discard: [], energy: 0, shield: 0 },
    p2: { id: 'p2', name: gameMode === 'vs-bot' ? 'Inimigo' : 'Jogador 2', pv: MAX_PV, deck: gameMode === 'vs-bot' ? shuffle(buildStarterDeck()) : shuffle(player2CustomDeck), hand: [], discard: [], energy: 0, shield: 0 },
    activeEffects: [],
    log: [],
    gameEnded: false,
    playedCards: [],
    undoStack: []
  };
  for (let i = 0; i < 5; i++) { drawCard('p1'); drawCard('p2'); }
  startTurn('p1');
}

function buildStarterDeck() {
  const deck = [];
  const add = (id, n) => { for (let i = 0; i < n; i++) deck.push(CARD_POOL[id]); };
  add('espadachim', 3); add('escudo', 2); add('flecha', 2); add('pocao', 2);
  add('martelo', 2); add('arqueiro', 2); add('goblin', 2); add('mago', 2);
  add('barreira', 1); add('lamina', 1);
  return deck;
}

function drawCard(who) {
  const p = state[who];
  if (!p) return null;
  if (p.deck.length === 0) {
    if (p.discard.length > 0) {
      log(`${p.name} ficou sem cartas! Reembaralhando o descarte.`);
      p.deck = shuffle(p.discard);
      p.discard = [];
    } else {
      log(`${p.name} não tem cartas! Perde 2 PV.`);
      p.pv -= 2;
      const avatarId = (gameMode === 'vs-player' && who === state.active) ? 'bottom-player-avatar' : (who === 'p1' ? 'bottom-player-avatar' : 'top-player-avatar');
      showDamageIndicator(2, document.getElementById(avatarId));
      checkWin();
      updateUI();
      return null;
    }
  }
  const card = p.deck.shift();
  p.hand.push(card);
  updateUI();
  return card;
}

function log(msg) {
  if (!state) return;
  state.log.unshift(`[T${state.turn}] ${msg}`);
  if (state.log.length > 50) state.log.pop();
  updateUI();
}

function startTurn(who) {
  if (!state || state.gameEnded) return;
  state.active = who;

  if (gameMode === 'vs-player') {
    const transitionScreen = document.getElementById('turn-transition-screen');
    document.getElementById('transition-title').textContent = `Vez do ${state[who].name}`;
    transitionScreen.classList.remove('hidden');
    document.getElementById('transition-continue-btn').onclick = () => {
      transitionScreen.classList.add('hidden');
      executeTurnStart(who);
    };
  } else {
    executeTurnStart(who);
  }
}

function executeTurnStart(who) {
  const p = state[who];
  // tratar modo online: considera jogador humano se for vs-player-online e o jogador for o player local
  const isHumanTurn = (gameMode === 'vs-bot' && who === 'p1') || gameMode === 'vs-player' || (gameMode === 'vs-player-online' && getPlayerRole() === who);

  if (isHumanTurn) {
    state.playedCards = [];
    state.undoStack = [];
    document.getElementById('end-turn').disabled = false;
    document.getElementById('undo-move').disabled = true;
  } else {
    document.getElementById('end-turn').disabled = true;
  }

  p.shield = 0;
  p.energy = Math.min(7, p.energy + 3);

  log(`${p.name} começou o turno e ganhou +3 de Energia.`);

  state.activeEffects = state.activeEffects.filter(eff => {
    if (eff.owner === who) {
      if (eff.key === 'bleed' && eff.turns > 1) {
        log(`${p.name} sofre ${eff.damage} de dano de Sangramento.`);
        p.pv -= eff.damage || 1;
        const avatarId = (gameMode === 'vs-player' && who === state.active) ? 'bottom-player-avatar' : (who === 'p1' ? 'bottom-player-avatar' : 'top-player-avatar');
        showDamageIndicator(eff.damage || 1, document.getElementById(avatarId));
        if (checkWin()) return false;
      }
      eff.turns--;
      if (eff.turns <= 0) {
        log(`Efeito '${eff.key}' expirou para ${p.name}.`);
        return false;
      }
    }
    return true;
  });

  drawCard(who);
  updateUI();

  if (gameMode === 'vs-bot' && who === 'p2') setTimeout(enemyAI, 1000);

  // em modo online, sincronize pequenas mudanças (opcional)
  if (gameMode === 'vs-player-online') syncState(state);
}

function endTurn() {
  const activePlayer = state.active;
  const opponent = getOpponent(activePlayer);

  if (state.active === 'p1' || (state.active === 'p2' && gameMode === 'vs-player')) {
    document.getElementById('end-turn').disabled = true;
  }
  log(`${state[activePlayer].name} terminou seu turno.`);
  state[activePlayer].discard.push(...state.playedCards);

  if (activePlayer === 'p2') {
    state.turn++;
  }
  state.playedCards = [];
  startTurn(opponent);

  if (gameMode === 'vs-player-online') syncState(state);
}

function undoMove() {
  if (state.gameEnded || state.undoStack.length === 0) return;

  const lastMove = state.undoStack.pop();
  const p = state[state.active];
  const opponent = state[getOpponent(state.active)];

  p.energy = lastMove.prevEnergy;
  p.pv = lastMove.prevPV;
  p.shield = lastMove.prevShield;
  p.deck = lastMove.prevDeck;
  p.discard = lastMove.prevDiscard;
  opponent.pv = lastMove.prevOpponentPV;
  opponent.shield = lastMove.prevOpponentShield;

  const cardToReturn = state.playedCards.pop();
  if (cardToReturn) {
    p.hand.push(cardToReturn);
    log(`Retornada a jogada de ${cardToReturn.name}.`);
  }

  document.getElementById('undo-move').disabled = state.undoStack.length === 0;
  updateUI();

  if (gameMode === 'vs-player-online') syncState(state);
}

async function playCard(handIdx) {
  if (gameMode === 'vs-player-online' && state.active !== getPlayerRole()) {
    return; // não é sua vez
  }
  if (state.gameEnded) return;
  const p = state[state.active];
  const card = p.hand[handIdx];
  if (!card || card.cost > p.energy) return;

  state.undoStack.push({
    prevEnergy: p.energy,
    prevPV: p.pv,
    prevShield: p.shield,
    prevDeck: p.deck.slice(),
    prevDiscard: p.discard.slice(),
    prevOpponentPV: state[getOpponent(state.active)].pv,
    prevOpponentShield: state[getOpponent(state.active)].shield,
    cardId: card.id
  });

  p.energy -= card.cost;
  const playedCard = p.hand.splice(handIdx, 1)[0];
  log(`${p.name} jogou ${card.name}.`);

  const context = { ctx: { player: state.active, opponent: getOpponent(state.active) } };
  await card.play(context);

  state.playedCards.push(playedCard);
  document.getElementById('undo-move').disabled = false;
  updateUI();

  if (gameMode === 'vs-player-online') syncState(state);
}

function enemyAI() {
  if (state.gameEnded) return;
  const enemy = state.p2;
  const playableCards = enemy.hand.map((c, i) => ({ card: c, index: i })).filter(item => item.card.cost <= enemy.energy);

  if (playableCards.length > 0) {
    const { card, index } = playableCards[0];
    enemy.energy -= card.cost;
    const playedCard = enemy.hand.splice(index, 1)[0];
    log(`Inimigo jogou ${card.name}.`);
    const context = { ctx: { player: 'p2', opponent: 'p1' } };
    card.play(context);
    state.playedCards.push(playedCard);
    updateUI();
    setTimeout(() => enemyAI(), 1200);
  } else {
    setTimeout(endTurn, 700);
  }
}

async function dealDamage(ctx, amount, opts = {}) {
  const defender = state[ctx.opponent];
  let dmg = amount;
  if (hasEffect(ctx.player, 'doubleAllDamage')) dmg *= 2;
  if (hasEffect(ctx.player, 'doubleNextAttack')) { dmg *= 2; removeEffect(ctx.player, 'doubleNextAttack'); }
  let ignoredShield = opts.ignoreDef ? Math.min(defender.shield, opts.ignoreDef) : 0;
  const shieldBlock = Math.max(0, defender.shield - ignoredShield);
  const finalDamage = Math.max(0, dmg - shieldBlock);
  defender.shield = Math.max(0, defender.shield - dmg);
  defender.pv -= finalDamage;
  log(`${state[ctx.player].name} causou ${dmg} de dano a ${defender.name}. ${shieldBlock} bloqueado.`);

  const targetPlayerKey = ctx.opponent;
  let targetAvatarId = '';
  if (gameMode === 'vs-bot') {
    targetAvatarId = targetPlayerKey === 'p1' ? 'bottom-player-avatar' : 'top-player-avatar';
  } else {
    // no online, bottom é sempre jogador local
    const bottomKey = (gameMode === 'vs-player-online') ? getPlayerRole() || state.active : ((gameMode === 'vs-player') ? state.active : 'p1');
    targetAvatarId = bottomKey === targetPlayerKey ? 'bottom-player-avatar' : 'top-player-avatar';
  }
  showDamageIndicator(finalDamage, document.getElementById(targetAvatarId));

  updateUI();
  await new Promise(resolve => setTimeout(resolve, 500));
  checkWin();
  return defender.pv <= 0;
}

function gainShield(who, amount) {
  const p = state[who];
  if (hasEffect(who, 'defHeal')) heal(who, 2);
  p.shield += amount;
  log(`${p.name} ganhou ${amount} de escudo.`);
  updateUI();
}

function heal(who, amount) {
  const p = state[who];
  p.pv = Math.min(MAX_PV, p.pv + amount);
  log(`${p.name} recuperou ${amount} PV.`);
  updateUI();
}

function applyEffect(playerKey, effect) {
  state.activeEffects.push({ owner: playerKey, ...effect });
  log(`${state[playerKey].name} ativou o efeito: ${effect.key}.`);
  updateUI();
}

function hasEffect(playerKey, key) { return state.activeEffects.some(e => e.owner === playerKey && e.key === key); }
function removeEffect(playerKey, key) {
  const idx = state.activeEffects.findIndex(e => e.owner === playerKey && e.key === key);
  if (idx >= 0) state.activeEffects.splice(idx, 1);
}

function reviveFromDiscard(ctx) {
  const p = state[ctx.player];
  if (p.discard.length === 0) { log('Descarte vazio.'); return; }
  const revivedCard = p.discard.pop();
  p.hand.push(revivedCard);
  log(`${p.name} reviveu ${revivedCard.name} do descarte.`);
  updateUI();
}

function checkWin() {
  if (!state) return false;
  if (state.gameEnded) return true;
  if (state.p1.pv <= 0 || state.p2.pv <= 0) {
    state.gameEnded = true;
    const winner = state.p1.pv > 0 ? state.p1.name : state.p2.name;
    setTimeout(() => {
      alert(`Fim de Jogo! Vencedor: ${winner}`);
      window.location.reload();
    }, 1000);
    return true;
  }
  return false;
}

// ----- Renderização e UI -----
function renderCard(card, isSmall = false) {
  const el = document.createElement('div');
  el.className = 'card';
  if (isSmall) el.classList.add('small-card');
  el.dataset.type = card.type;

  if (card.image) {
    el.classList.add('full-image');
    el.style.backgroundImage = `url('${card.image}')`;
  } else {
    el.innerHTML = `
      <div class="card-header">
        <div class="card-name">${card.name}</div>
        <div class="card-cost">${card.cost}</div>
      </div>
      <div class="card-art">${card.art || ''}</div>
      <div class="card-desc">${card.desc}</div>
      <div class="card-type">${card.type}</div>
    `;
  }
  return el;
}

function updateUI() {
  if (!state) return;

  // bottom player key: em online, bottom = player local; em local vs-player, bottom = active; senão p1
  let bottomPlayerKey;
  if (gameMode === 'vs-player-online') {
    bottomPlayerKey = getPlayerRole() || state.active;
  } else if (gameMode === 'vs-player') {
    bottomPlayerKey = state.active;
  } else {
    bottomPlayerKey = 'p1';
  }
  const topPlayerKey = getOpponent(bottomPlayerKey);

  const bottomP = state[bottomPlayerKey];
  const topP = state[topPlayerKey];

  document.getElementById('bottom-player-name').textContent = bottomP.name;
  document.getElementById('top-player-name').textContent = topP.name;
  document.getElementById('bottom-player-avatar').textContent = bottomPlayerKey === 'p1' ? '😎' : '🤓';
  document.getElementById('top-player-avatar').textContent = topPlayerKey === 'p1' ? '😎' : (gameMode === 'vs-bot' ? '🤖' : '🤓');

  const bottomHealthPercent = (Math.max(0, bottomP.pv) / MAX_PV) * 100;
  document.getElementById('bottom-player-health-bar').style.width = `${bottomHealthPercent}%`;
  const topHealthPercent = (Math.max(0, topP.pv) / MAX_PV) * 100;
  document.getElementById('top-player-health-bar').style.width = `${topHealthPercent}%`;

  document.getElementById('bottom-player-pv').textContent = `${bottomP.pv} PV ${bottomP.shield > 0 ? `(+${bottomP.shield}🛡️)` : ''}`;
  document.getElementById('bottom-player-deck').textContent = bottomP.deck.length;
  document.getElementById('bottom-player-discard').textContent = bottomP.discard.length;

  document.getElementById('top-player-pv').textContent = `${topP.pv} PV ${topP.shield > 0 ? `(+${topP.shield}🛡️)` : ''}`;
  document.getElementById('top-player-deck').textContent = topP.deck.length;
  document.getElementById('top-player-discard').textContent = topP.discard.length;
  document.getElementById('top-player-energy').textContent = topP.energy;

  const topBleedIcon = document.getElementById('top-player-bleed-icon');
  const bottomBleedIcon = document.getElementById('bottom-player-bleed-icon');
  hasEffect(topPlayerKey, 'bleed') ? topBleedIcon.classList.remove('hidden') : topBleedIcon.classList.add('hidden');
  hasEffect(bottomPlayerKey, 'bleed') ? bottomBleedIcon.classList.remove('hidden') : bottomBleedIcon.classList.add('hidden');

  document.getElementById('turn-indicator').textContent = `Turno ${state.turn}`;
  document.getElementById('undo-move').disabled = state.undoStack.length === 0;

  const energyBar = document.getElementById('bottom-player-energy');
  energyBar.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const orb = document.createElement('div');
    orb.className = `energy-orb ${i < bottomP.energy ? 'filled' : ''}`;
    energyBar.appendChild(orb);
  }

  const hand = document.getElementById('hand');
  hand.innerHTML = '';
  bottomP.hand.forEach((card, idx) => {
    const el = renderCard(card, false);
    if (card.cost <= bottomP.energy) el.classList.add('playable');
    el.onclick = () => playCard(idx);
    hand.appendChild(el);
  });

  const playedCardsArea = document.getElementById('played-cards');
  playedCardsArea.innerHTML = '';
  state.playedCards.forEach(card => playedCardsArea.appendChild(renderCard(card, true)));

  document.getElementById('log-area').innerHTML = state.log.map(entry => `<div class="log-entry">${entry}</div>`).join('');
}

function showDamageIndicator(amount, targetElement) {
  if (amount <= 0 || !targetElement) return;
  const indicator = document.createElement('div');
  indicator.className = 'damage-indicator';
  indicator.textContent = `-${amount}`;
  document.body.appendChild(indicator);
  const rect = targetElement.getBoundingClientRect();
  indicator.style.left = `${rect.left + rect.width / 2 - indicator.offsetWidth / 2}px`;
  indicator.style.top = `${rect.top - indicator.offsetHeight}px`;
  setTimeout(() => indicator.remove(), 1500);
}

// ----- Deck Builder -----
function updateDeckBuilderUI() {
  const currentDeck = (currentDeckBuilderFor === 'p1') ? player1CustomDeck : player2CustomDeck;
  const counter = document.getElementById('deck-counter');
  const list = document.getElementById('current-deck-list');
  const startBtn = document.getElementById('start-game-btn');

  counter.textContent = `${currentDeck.length}/${DECK_SIZE}`;
  list.innerHTML = '';

  const cardCounts = currentDeck.reduce((acc, card) => {
    acc[card.id] = (acc[card.id] || 0) + 1;
    return acc;
  }, {});

  Object.keys(cardCounts).sort().forEach(cardId => {
    const card = CARD_POOL[cardId];
    const count = cardCounts[cardId];
    const li = document.createElement('div');
    li.className = 'card-in-deck';
    li.innerHTML = `<span>${card.name} (x${count})</span><button data-card-id="${card.id}">-</button>`;
    list.appendChild(li);
  });

  list.querySelectorAll('button').forEach(button => {
    button.onclick = (e) => removeCardFromDeck(e.target.getAttribute('data-card-id'));
  });

  startBtn.disabled = currentDeck.length !== DECK_SIZE;
}

function addCardToDeck(card) {
  const currentDeck = (currentDeckBuilderFor === 'p1') ? player1CustomDeck : player2CustomDeck;
  if (currentDeck.length < DECK_SIZE) {
    currentDeck.push(card);
    updateDeckBuilderUI();
  } else {
    alert(`Você só pode ter ${DECK_SIZE} cartas no seu baralho!`);
  }
}

function removeCardFromDeck(cardId) {
  const currentDeck = (currentDeckBuilderFor === 'p1') ? player1CustomDeck : player2CustomDeck;
  const index = currentDeck.findIndex(card => card.id === cardId);
  if (index > -1) {
    currentDeck.splice(index, 1);
    updateDeckBuilderUI();
  }
}

function initializeDeckBuilder() {
  document.getElementById('deck-builder-title').textContent = `Monte seu Baralho - ${state[currentDeckBuilderFor].name}`;
  const cardPoolEl = document.getElementById('card-pool');
  cardPoolEl.innerHTML = '';
  document.getElementById('deck-size-label').textContent = DECK_SIZE;
  const uniqueCards = Object.values(CARD_POOL);

  uniqueCards.forEach(card => {
    const cardEl = renderCard(card, false);
    cardEl.classList.add('deck-builder-card');
    cardEl.onclick = () => addCardToDeck(card);
    cardPoolEl.appendChild(cardEl);
  });

  updateDeckBuilderUI();
}

// ----- Início do Jogo e Handlers UI -----
document.addEventListener('DOMContentLoaded', () => {
  const gameModeSelectionScreen = document.getElementById('game-mode-selection');
  const deckBuilderScreen = document.getElementById('deck-builder-screen');
  const gameContainer = document.querySelector('.game-container');

  // Botão Entrar por código (guest)
  document.getElementById("join-room-btn").onclick = () => {
    const code = document.getElementById("room-code-input").value.trim();
    if (!code) return alert("Digite um código válido!");

    gameMode = "vs-player-online";
    roomId = code;
    currentDeckBuilderFor = "p2";
    // nomes iniciais (apenas para UX)
    state = { p1: { name: "Jogador 1", deck: [] }, p2: { name: "Você", deck: [] }, gameStarted: false };

    gameModeSelectionScreen.classList.add("hidden");
    deckBuilderScreen.classList.remove("hidden");

    initializeDeckBuilder();

    // começa a escutar o host (isso também define role = 'p2' internamente)
    joinRoom(roomId, (remoteState) => {
      state = remoteState;
      updateUI();
      // se host já iniciou (gameStarted true), iniciamos localmente a partir do serverState
      if (state.gameStarted) {
        startFromServerState(state);
      } else {
        // caso host ainda não tenha iniciado, apenas atualize UI (aguardando)
      }
    });
  };

  // Modo vs-bot / vs-player local / vs-player-online (host)
  document.getElementById('vs-bot-btn').onclick = () => {
    gameMode = 'vs-bot';
    currentDeckBuilderFor = 'p1';
    gameModeSelectionScreen.classList.add('hidden');
    deckBuilderScreen.classList.remove('hidden');
    state = { p1: { name: 'Jogador' }, p2: { name: 'Inimigo' } };
    initializeDeckBuilder();
  };

  document.getElementById('vs-player-btn').onclick = () => {
    gameMode = 'vs-player';
    currentDeckBuilderFor = 'p1';
    gameModeSelectionScreen.classList.add('hidden');
    deckBuilderScreen.classList.remove('hidden');
    state = { p1: { name: 'Jogador 1' }, p2: { name: 'Jogador 2' } };
    initializeDeckBuilder();
  };

  document.getElementById("vs-player-online-btn").onclick = () => {
    gameMode = "vs-player-online";
    currentDeckBuilderFor = "p1";
    state = { p1: { name: "Você", deck: [] }, p2: { name: "Aguardando...", deck: [] }, gameStarted: false };

    gameModeSelectionScreen.classList.add("hidden");
    deckBuilderScreen.classList.remove("hidden");

    initializeDeckBuilder();
  };

  // Controles do Jogo
  document.getElementById('end-turn').onclick = endTurn;
  document.getElementById('undo-move').onclick = undoMove;

  // Controles do Deck Builder
  const startBtn = document.getElementById('start-game-btn');
  startBtn.onclick = () => {
    const currentDeck = (currentDeckBuilderFor === 'p1') ? player1CustomDeck : player2CustomDeck;
    if (currentDeck.length !== DECK_SIZE) return;

    // ----- Host confirma baralho online (cria sala) -----
    if (gameMode === "vs-player-online" && currentDeckBuilderFor === "p1") {
      // salva deck do p1 no objeto de pré-game
      state.p1.deck = player1CustomDeck.slice();
      state.p1.name = state.p1.name || 'Jogador 1';
      // cria sala e grava pre-game no DB
      roomId = createRoom({ p1: state.p1, p2: state.p2, gameStarted: false });
      // mostrar código na tela (coloque um elemento <div id="room-code-display"><span id="room-code"/></div"> no seu HTML)
      const roomDisplay = document.getElementById('room-code');
      if (roomDisplay) {
        roomDisplay.textContent = roomId;
        document.getElementById('room-code-display')?.classList.remove('hidden');
      } else {
        alert("Código da sala: " + roomId);
      }

      // Host começa a escutar a sala (sem mudar role)
      listenRoom(roomId, (remoteState) => {
        state = remoteState;
        updateUI();
        // quando P2 enviar deck, o host monta o estado do jogo e grava no DB
        if (!state.gameStarted && state.p2 && Array.isArray(state.p2.deck) && state.p2.deck.length === DECK_SIZE) {
          const inGame = buildInGameStateFromPre(state);
          // host grava o estado de jogo completo (embaralhado + mãos iniciais)
          syncState(inGame);
        }
        // quando DB já traz gameStarted true (ou já traz inGame state), startFromServerState será executado no listener do host também
        if (state.gameStarted) {
          startFromServerState(state);
        }
      });

      // ficar aguardando P2 (host permanece no deck-builder)
      currentDeckBuilderFor = "p2";
      alert("Sala criada. Compartilhe o código com seu amigo: " + roomId);
      return;
    }

    // ----- Guest confirma deck online (envia deck e aguarda host) -----
    else if (gameMode === "vs-player-online" && currentDeckBuilderFor === "p2") {
      state.p2.deck = player2CustomDeck.slice();
      state.p2.name = state.p2.name || 'Jogador 2';
      // envia o deck para o DB (host está escutando e irá montar o jogo)
      syncState(state);
      // esconda a tela de deckbuilder e mostre um estado "aguardando host"
      alert("Baralho enviado. Aguardando o host iniciar a partida...");
      // NÃO chamamos newGame() aqui — aguardamos o host montar o inGameState e gravar no DB
      return;
    }

    // ----- Modos locais tradicionais -----
    else {
      deckBuilderScreen.classList.add('hidden');
      gameContainer.classList.remove('hidden');
      newGame();
    }
  };

});
