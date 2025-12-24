import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDYFfhoj60YQP0J-lcapg3uWIShA2SukpQ",
  authDomain: "geoforestv1.firebaseapp.com",
  projectId: "geoforestv1",
  storageBucket: "geoforestv1.firebasestorage.app",
  messagingSenderId: "73639013419",
  appId: "1:73639013419:web:0a48627ddb53e9e80a0e6e"
};

// 1. Inicializa o App (Singleton para evitar erros de hot-reload no Next.js)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Inicializa os serviços usando o app garantido acima
const db = getFirestore(app);
const auth = getAuth(app);

// 3. Exporta para usar nas páginas
export { db, auth };