// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCkqTQbzsppJHibUroWE5WtvxAFG6TUAzs",
    authDomain: "hilocardst.firebaseapp.com",
    databaseURL: "https://hilocardst-default-rtdb.firebaseio.com",
    projectId: "hilocardst",
    storageBucket: "hilocardst.appspot.com",
    messagingSenderId: "470124139327",
    appId: "1:470124139327:web:64849a4bcd81dce60e798a",
    measurementId: "G-CL7F040K1K"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let roomId = null;
let playerRole = null; // "p1" ou "p2"

export function createRoom(initialState) {
  roomId = Math.random().toString(36).substring(2, 8);
  playerRole = "p1";
  // Garanta flag gameStarted (host cria pré-game)
  const stateToSave = { ...initialState, gameStarted: initialState.gameStarted || false };
  set(ref(db, `rooms/${roomId}`), stateToSave);
  return roomId;
}

// Listener genérico (usável pelo host para "escutar" a sala sem mudar role)
export function listenRoom(code, callback) {
  roomId = code;
  onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
    if (snapshot.exists()) callback(snapshot.val());
  });
}

// Join (usado pelo guest: marca role=p2 e começa a escutar)
export function joinRoom(code, callback) {
  roomId = code;
  playerRole = "p2";
  onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
    if (snapshot.exists()) callback(snapshot.val());
  });
}

// Substitui totalmente o estado no DB (uso simples)
export function syncState(state) {
  if (!roomId) return;
  set(ref(db, `rooms/${roomId}`), state);
}

export function getPlayerRole() {
  return playerRole;
}
