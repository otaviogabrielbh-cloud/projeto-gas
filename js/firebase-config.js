// Configuração do Firebase
// Lembre-se de configurar as Regras de Segurança no console do Firebase

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyB-4XspbY5GalueBG8JGUJ7BfdQvPh8d1c",
    authDomain: "canoas-gas.firebaseapp.com",
    databaseURL: "https://canoas-gas-default-rtdb.firebaseio.com",
    projectId: "canoas-gas",
    storageBucket: "canoas-gas.firebasestorage.app",
    messagingSenderId: "657432003828",
    appId: "1:657432003828:web:40c6eca9096896f955caa1",
    measurementId: "G-3SMNWNELJ5"
};

const app = initializeApp(firebaseConfig);
const remoteDb = getDatabase(app);

export { remoteDb, ref, set, get, onValue, firebaseConfig };
