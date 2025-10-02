// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, update, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCkqTQbzsppJHibUroWE5WtvxAFG6TUAzs",
    authDomain: "hilocardst.firebaseapp.com",
    databaseURL: "https://hilocardst-default-rtdb.firebaseio.com", // ⚡ precisa do RTDB
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
  set(ref(db, "rooms/" + roomId), { state: initialState });
  return roomId;
}

export function joinRoom(code, callback) {
  roomId = code;
  playerRole = "p2";
  onValue(ref(db, "rooms/" + roomId + "/state"), (snapshot) => {
    if (snapshot.exists()) callback(snapshot.val());
  });
}

export function syncState(state) {
  if (!roomId) return;
  update(ref(db, "rooms/" + roomId), { state });
}

export function getPlayerRole() {
  return playerRole;
}
