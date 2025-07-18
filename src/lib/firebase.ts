// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDJ4TRa4g7DhIS4klasIAO8YZR0kNjAV14",
  authDomain: "greengohub.firebaseapp.com",
  databaseURL: "https://greengohub-default-rtdb.firebaseio.com",
  projectId: "greengohub",
  storageBucket: "greengohub.firebasestorage.app",
  messagingSenderId: "404244045422",
  appId: "1:404244045422:web:8007df1e69dda46d3bd07f",
  measurementId: "G-W5SVQW5NGR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
