import { createRoom, joinRoom, listenRoom, syncState, getPlayerRole } from "./firebase.js";
let roomId = null;

// ----- Constantes Globais do Jogo -----
const MAX_PV = 40; // Alterado de 20 para 40
const DECK_SIZE = 20; // Tamanho do baralho a ser montado

// ----- Definição de Cartas -----
const CARD_POOL = {
    // Básicas
    espadachim: { id:'espadachim', name:'Espadachim', type:'basic', cost:1, desc:'Causa 2 de dano.', art:'⚔️', image: 'espadachim.png', play: ({ctx})=>dealDamage(ctx,2) },
    escudo: { id:'escudo', name:'Escudo de Madeira', type:'basic', cost:1, desc:'Ganha 2 de escudo.', art:'🛡️', image: 'escudodemadeira.png' ,play: ({ctx})=>gainShield(ctx.player,2) },
    flecha: { id:'flecha', name:'Flecha Rápida', type:'basic', cost:0, desc:'Causa 1 de dano.', art:'🏹',image: 'flecharapida.png' , play: ({ctx})=>dealDamage(ctx,1) },
    pocao: { id:'pocao', name:'Poção Menor', type:'basic', cost:1, desc:'Cura 2 PV.', art:'🧪', image: 'curamenor.png', play: ({ctx})=>heal(ctx.player,2) },
    martelo: { id:'martelo', name:'Martelo de Pedra', type:'basic', cost:2, desc:'Causa 3 de dano.', art:'🔨', image: 'martelodepedra.png', play: ({ctx})=>dealDamage(ctx,3) },
    arqueiro: { id:'arqueiro', name:'Arqueiro', type:'basic', cost:2, desc:'2 de dano, ignora 1 de defesa.', art:'🎯', image: 'arqueiro.png', play: ({ctx})=>dealDamage(ctx,2, {ignoreDef:1}) },
    goblin: { id:'goblin', name:'Goblin Saqueador', type:'basic', cost:1, desc:'Causa 3 de dano direto.', art:'👺', image: 'goblinsa.png', play: ({ctx})=>dealDamage(ctx,3) },
  
    // Raras
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
  
    // Lendárias
    dragao: { id:'dragao', name:'Dragão Ancestral', type:'legend', cost:5, desc:'Causa 10 de dano.', image: 'dragaoancestral.png', art:'🐲', play: ({ctx})=>dealDamage(ctx,10) },
    cavaleiro: { id:'cavaleiro', name:'Cavaleiro Imortal', type:'legend', cost:6, desc:'Causa 6 de dano e cura 3 de vida.', art:'👻', image: 'cavaleiroimortal.png', play: async ({ctx})=>{
        await dealDamage(ctx,6);
        heal(ctx.player,3);
    }},
    tempestade: { id:'tempestade', name:'Tempestade Arcana', type:'legend', cost:4, desc:'Causa 3 de dano e aplica 2 turnos de Sangramento (1 de dano por turno).', art:'🌪️', image: 'tempestadearcana.png', play: async ({ctx})=>{
        await dealDamage(ctx,3);
        applyEffect(ctx.opponent, {key:'bleed', turns:3, damage:1}); // 3 turnos para aplicar 2 vezes
    }},
    espadaDivina: { id:'espadaDivina', name:'Espada Divina', type:'legend', cost:3, desc:'Dobra o dano da próxima carta de ataque nos próximos 2 turnos.', art:'✨', image: 'espadadivina.png', play: ({ctx})=>applyEffect(ctx.player, {key:'doubleNextAttack',turns:2}) },
    feiticeira: { id: 'feiticeira', name: 'Feiticeira da Lua', type: 'legend', cost: 3, desc: 'Recupera 3 de PV e ganha 2 de energia.', art: '🌙', image: 'feiticeiradalua.png', play: ({ctx}) => {
        heal(ctx.player, 3);
        state[ctx.player].energy = Math.min(7, state[ctx.player].energy + 2);
        log(`${state[ctx.player].name} sente a energia da lua!`);
    }},

    // Jokers
    jokerRed: { id:'jokerRed', name:'Joker Vermelho', type:'joker', cost:2, desc:'Multiplica por 2 todo o dano neste turno.', art:'🔴', image: 'jokervermelho.png', play: ({ctx})=>applyEffect(ctx.player, {key:'doubleAllDamage',turns:1}) },
    jokerBlue: { id:'jokerBlue', name:'Joker Azul', type:'joker', cost:1, desc:'Defesas também curam 2 PV neste turno.', art:'🔵', image: 'jokerazul.png', play: ({ctx})=>applyEffect(ctx.player, {key:'defHeal',turns:1}) },
    jokerGreen: { id:'jokerGreen', name:'Joker Verde', type:'joker', cost:3, desc:'Permite comprar 2 cartas.', art:'🟢', image: 'jokerverde.png', play: ({ctx})=>{ drawCard(ctx.player); drawCard(ctx.player); } },
    jokerGold: { id:'jokerGold', name:'Joker Dourado', type:'joker', cost:1, desc:'Revive 1 carta do descarte para a mão.', art:'🟡', image: 'jokerdourado.png', play: ({ctx})=>reviveFromDiscard(ctx) }
  };
  
  const RARE_CARD_TYPES = ['legend', 'joker'];
  
  // ----------------- helpers para sync com Firebase -----------------
function serializeCardArray(arr) {
if (!Array.isArray(arr)) return [];
return arr.map(c => (typeof c === 'string') ? c : (c && c.id ? c.id : null)).filter(x => x != null);
}


function sanitizeStateForSync(st) {
if (!st) return st;
const s = {
turn: st.turn || 1,
active: st.active || 'p1',
gameStarted: !!st.gameStarted,
activeEffects: st.activeEffects || [],
log: st.log || [],
gameEnded: !!st.gameEnded
};


['p1','p2'].forEach(pk => {
const p = st[pk] || {};
s[pk] = {
id: p.id || pk,
name: p.name || pk,
pv: (typeof p.pv === 'number') ? p.pv : 40,
deck: serializeCardArray(p.deck || []),
hand: serializeCardArray(p.hand || []),
discard: serializeCardArray(p.discard || []),
energy: (typeof p.energy === 'number') ? p.energy : 0,
shield: (typeof p.shield === 'number') ? p.shield : 0
};
});


s.playedCards = serializeCardArray(st.playedCards || []);
return s;
}


function expandRemoteState(remote) {
if (!remote) return null;
const s = JSON.parse(JSON.stringify(remote));
['p1','p2'].forEach(pk => {
const p = s[pk] || {};
['deck','hand','discard'].forEach(k => {
if (!Array.isArray(p[k])) p[k] = [];
else p[k] = p[k].map(id => (typeof id === 'string' && CARD_POOL[id]) ? { ...CARD_POOL[id] } : id);
});
s[pk] = p;
});
s.playedCards = (Array.isArray(s.playedCards)) ? s.playedCards.map(id => (CARD_POOL[id] ? { ...CARD_POOL[id] } : id)) : [];
return s;
}


function pushState() {
try {
const sanitized = sanitizeStateForSync(state);
syncState(sanitized);
console.log('[DEBUG] pushState enviado', sanitized);
} catch (err) {
console.error('[ERROR] pushState failed', err);
alert("Erro ao salvar baralho.");
}
}


  // ----- Estado do Jogo -----
  let state = null;
  let gameMode = 'vs-bot'; // 'vs-bot' ou 'vs-player'
  let player1CustomDeck = [];
  let player2CustomDeck = [];
  let currentDeckBuilderFor = 'p1';
  
  function getOpponent(playerKey) {
    return playerKey === 'p1' ? 'p2' : 'p1';
  }

function newGame() {
  // reconstrói os decks a partir do state salvo no Firebase (ids -> objetos)
  const deckP1 = (state.p1.deck || []).map(id => CARD_POOL[id]);
  const deckP2 = (state.p2.deck || []).map(id => CARD_POOL[id]);

  state = {
    turn: 1,
    active: 'p1',
    p1: { id: 'p1', name: state.p1.name || 'Jogador 1', pv: MAX_PV, deck: shuffle(deckP1), hand: [], discard: [], energy: 0, shield: 0 },
    p2: { id: 'p2', name: state.p2.name || 'Jogador 2', pv: MAX_PV, deck: shuffle(deckP2), hand: [], discard: [], energy: 0, shield: 0 },
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
    const add = (id, n) => { for(let i=0; i<n; i++) deck.push(CARD_POOL[id]) };
    add('espadachim', 3); add('escudo', 2); add('flecha', 2); add('pocao', 2);
    add('martelo', 2); add('arqueiro', 2); add('goblin', 2); add('mago', 2);
    add('barreira', 1); add('lamina', 1);
    return deck;
  }
  
  // ----- Lógica do Jogo -----
  function shuffle(a) { return a.slice().sort(() => Math.random() - 0.5); }
  
  function drawCard(who) {
      const p = state[who];
      if (p.deck.length === 0) {
          if(p.discard.length > 0) {
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
    state.log.unshift(`[T${state.turn}] ${msg}`);
    if(state.log.length > 50) state.log.pop();
    updateUI();
  }
  
  function startTurn(who) {
      if (state.gameEnded) return;
      state.active = who;

      if(gameMode === 'vs-player'){
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
    const isHumanTurn = (gameMode === 'vs-bot' && who === 'p1') || gameMode === 'vs-player';

    if (isHumanTurn) {
        state.playedCards = [];
        state.undoStack = [];
        document.getElementById('end-turn').disabled = false;
        document.getElementById('undo-move').disabled = true;
    }

    p.shield = 0;
    p.energy = Math.min(7, p.energy + 3); // Alterado para 7 de max e +3 por turno
    
    log(`${p.name} começou o turno e ganhou +3 de Energia.`);
    
    state.activeEffects = state.activeEffects.filter(eff => {
        if (eff.owner === who) {
            // Aplica efeitos de dano por turno (como sangramento)
            if (eff.key === 'bleed' && eff.turns > 1) { // Só aplica se não for o turno que expiraria
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
  }
  
  function endTurn() {
      const activePlayer = state.active;
      const opponent = getOpponent(activePlayer);

      if (state.active === 'p1' || (state.active === 'p2' && gameMode === 'vs-player')) {
          document.getElementById('end-turn').disabled = true;
      }
      log(`${state[activePlayer].name} terminou seu turno.`);
      state[activePlayer].discard.push(...state.playedCards);
      
      if(activePlayer === 'p2') {
        state.turn++;
      }
      state.playedCards = [];
      startTurn(opponent);

      if (gameMode === 'vs-player-online') {
        pushState();;
    }

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

      if (gameMode === 'vs-player-online') {
        pushState();;
    }

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

      if (gameMode === 'vs-player-online') {
        pushState();;
    }

  }
  
  function enemyAI() {
      if (state.gameEnded) return;
      const enemy = state.p2;
      const playableCards = enemy.hand.map((c, i) => ({card: c, index: i})).filter(item => item.card.cost <= enemy.energy);
  
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
  
  // ----- Efeitos das Cartas -----
  async function dealDamage(ctx, amount, opts = {}) {
    const defender = state[ctx.opponent];
    let dmg = amount;
    if(hasEffect(ctx.player,'doubleAllDamage')) dmg *= 2;
    if(hasEffect(ctx.player,'doubleNextAttack')){ dmg *= 2; removeEffect(ctx.player,'doubleNextAttack'); }
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
        targetAvatarId = state.active === targetPlayerKey ? 'bottom-player-avatar' : 'top-player-avatar';
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
      if(idx >= 0) state.activeEffects.splice(idx, 1);
  }
  
  function reviveFromDiscard(ctx) {
      const p = state[ctx.player];
      if(p.discard.length === 0) { log('Descarte vazio.'); return; }
      const revivedCard = p.discard.pop();
      p.hand.push(revivedCard);
      log(`${p.name} reviveu ${revivedCard.name} do descarte.`);
      updateUI();
  }
  
  function checkWin() {
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
    if(isSmall) el.classList.add('small-card');
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
    if(!state) return;

    const bottomPlayerKey = (gameMode === 'vs-player') ? state.active : 'p1';
    const topPlayerKey = getOpponent(bottomPlayerKey);
    
    const bottomP = state[bottomPlayerKey];
    const topP = state[topPlayerKey];

    // Nomes e Avatares
    document.getElementById('bottom-player-name').textContent = bottomP.name;
    document.getElementById('top-player-name').textContent = topP.name;
    document.getElementById('bottom-player-avatar').textContent = bottomPlayerKey === 'p1' ? '😎' : '🤓';
    document.getElementById('top-player-avatar').textContent = topPlayerKey === 'p1' ? '😎' : (gameMode === 'vs-bot' ? '🤖' : '🤓');

    // Barras de Vida
    const bottomHealthPercent = (Math.max(0, bottomP.pv) / MAX_PV) * 100;
    document.getElementById('bottom-player-health-bar').style.width = `${bottomHealthPercent}%`;
    const topHealthPercent = (Math.max(0, topP.pv) / MAX_PV) * 100;
    document.getElementById('top-player-health-bar').style.width = `${topHealthPercent}%`;

    // Stats
    document.getElementById('bottom-player-pv').textContent = `${bottomP.pv} PV ${bottomP.shield > 0 ? `(+${bottomP.shield}🛡️)`: ''}`;
    document.getElementById('bottom-player-deck').textContent = bottomP.deck.length;
    document.getElementById('bottom-player-discard').textContent = bottomP.discard.length;
    
    document.getElementById('top-player-pv').textContent = `${topP.pv} PV ${topP.shield > 0 ? `(+${topP.shield}🛡️)`: ''}`;
    document.getElementById('top-player-deck').textContent = topP.deck.length;
    document.getElementById('top-player-discard').textContent = topP.discard.length;
    document.getElementById('top-player-energy').textContent = topP.energy;
    
    // Controle do ícone de Sangramento
    const topBleedIcon = document.getElementById('top-player-bleed-icon');
    const bottomBleedIcon = document.getElementById('bottom-player-bleed-icon');
    
    hasEffect(topPlayerKey, 'bleed') ? topBleedIcon.classList.remove('hidden') : topBleedIcon.classList.add('hidden');
    hasEffect(bottomPlayerKey, 'bleed') ? bottomBleedIcon.classList.remove('hidden') : bottomBleedIcon.classList.add('hidden');

    document.getElementById('turn-indicator').textContent = `Turno ${state.turn}`;
    document.getElementById('undo-move').disabled = state.undoStack.length === 0;

    const energyBar = document.getElementById('bottom-player-energy');
    energyBar.innerHTML = '';
    for(let i=0; i<7; i++){ // Alterado de 5 para 7
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
  
  // ----- Lógica do Deck Builder -----
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
      cardPoolEl.innerHTML = ''; // Limpa para caso seja o segundo jogador
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

  // ----- Início do Jogo -----
  document.addEventListener('DOMContentLoaded', () => {

    

    // Botão de entrar em uma sala existente
    // BOTÃO ENTRAR SALA (guest)
    // BOTÃO ENTRAR SALA (guest)
 // Entrar em sala online (guest)
  document.getElementById("join-room-btn").onclick = () => {
    const gameModeSelectionScreen = document.getElementById('game-container hidden');
    const code = document.getElementById("room-code-input").value.trim();
    if (!code) return alert("Digite um código válido!");

    gameMode = "vs-player-online";
    roomId = code;
    currentDeckBuilderFor = "p2";
    state = { p1: { name: "Jogador 1", deck: [] }, p2: { name: "Você", deck: [] } };

    gameModeSelectionScreen.classList.add("hidden");
    deckBuilderScreen.classList.remove("hidden");
    initializeDeckBuilder();

    joinRoom(roomId, (remoteState) => {
      state = expandRemoteState(remoteState);
      updateUI();

      if (!state.gameStarted &&
          state.p1.deck && state.p1.deck.length === DECK_SIZE &&
          state.p2.deck && state.p2.deck.length === DECK_SIZE) {
        console.log('[DEBUG] Ambos confirmaram (p2), iniciando jogo');
        state.gameStarted = true;
        pushState();
      }

      if (state.gameStarted) {
        deckBuilderScreen.classList.add("hidden");
        gameContainer.classList.remove("hidden");
        newGame();
      }
    });
  };
    const deckBuilderScreen = document.getElementById('deck-builder-screen');
    const gameContainer = document.querySelector('.game-container');

    // Controles de Seleção de Modo
    document.getElementById('vs-bot-btn').onclick = () => {
        gameMode = 'vs-bot';
        currentDeckBuilderFor = 'p1';
        gameModeSelectionScreen.classList.add('hidden');
        deckBuilderScreen.classList.remove('hidden');
        // Pré-inicializa o state para pegar nomes
        state = { p1: { name: 'Jogador' }, p2: { name: 'Inimigo' } };
        initializeDeckBuilder();
    };
    
    document.getElementById('vs-player-btn').onclick = () => {
        gameMode = 'vs-player';
        currentDeckBuilderFor = 'p1';
        gameModeSelectionScreen.classList.add('hidden');
        deckBuilderScreen.classList.remove('hidden');
        // Pré-inicializa o state para pegar nomes
        state = { p1: { name: 'Jogador 1' }, p2: { name: 'Jogador 2' } };
        initializeDeckBuilder();
    };

    // BOTÃO CRIAR SALA (host)
// Criar sala online (host)
  document.getElementById("vs-player-online-btn").onclick = () => {
    gameMode = "vs-player-online";
    currentDeckBuilderFor = "p1";

    state = { p1: { name: "Você", deck: [] }, p2: { name: "Aguardando...", deck: [] } };
    roomId = createRoom(state);

    listenRoom(roomId, (remoteState) => {
      state = expandRemoteState(remoteState);
      updateUI();

      if (!state.gameStarted &&
          state.p1.deck && state.p1.deck.length === DECK_SIZE &&
          state.p2.deck && state.p2.deck.length === DECK_SIZE) {
        console.log('[DEBUG] Ambos confirmaram, iniciando jogo');
        state.gameStarted = true;
        pushState();
      }

      if (state.gameStarted) {
        deckBuilderScreen.classList.add("hidden");
        gameContainer.classList.remove("hidden");
        newGame();
      }
    });

    document.getElementById("room-code").innerText = roomId;
    document.getElementById("room-code-display").classList.remove("hidden");
    gameModeSelectionScreen.classList.add("hidden");
    deckBuilderScreen.classList.remove("hidden");
    initializeDeckBuilder();
  };



    // Controles do Jogo
    document.getElementById('end-turn').onclick = endTurn;
    document.getElementById('undo-move').onclick = undoMove;
  
    // Controles do Deck Builder
    // --- handler protegido e com debug para o botão Confirmar Baralho ---
const startBtn = document.getElementById('start-game-btn');
startBtn.onclick = () => {
const currentDeck = (currentDeckBuilderFor === 'p1') ? player1CustomDeck : player2CustomDeck;
if (currentDeck.length !== DECK_SIZE) {
alert(`Seu baralho tem ${currentDeck.length}/${DECK_SIZE} cartas.`);
return;
}


if (gameMode === "vs-player-online") {
if (currentDeckBuilderFor === 'p1') {
state.p1 = state.p1 || {};
state.p1.deck = currentDeck.map(c => c.id);
} else {
state.p2 = state.p2 || {};
state.p2.deck = currentDeck.map(c => c.id);
}
pushState();
alert("Baralho confirmado! Aguarde o outro jogador...");
} else {
deckBuilderScreen.classList.add('hidden');
gameContainer.classList.remove('hidden');
newGame();
}
};


  });
