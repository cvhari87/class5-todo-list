import { initializeApp, getApps } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCv75SolQNbyW4RsgJuSBnsP_Pg7vk4VTE",
  authDomain: "class5-todo-list-85158.firebaseapp.com",
  projectId: "class5-todo-list-85158",
  storageBucket: "class5-todo-list-85158.firebasestorage.app",
  messagingSenderId: "553124403620",
  appId: "1:553124403620:web:0dde83fb4315dff2758931",
}

// Prevent re-initializing on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
