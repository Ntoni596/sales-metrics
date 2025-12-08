// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration (provided via Vite env vars)
// Keep secrets out of source control by setting these in .env/.env.local
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
} as const;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const FIREBASE_PROJECT_ID = (firebaseConfig.projectId || "") as string;
export const FIRESTORE_ENABLE_URL = `https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${FIREBASE_PROJECT_ID}`;
// Only the minimal keys are required for Firestore usage
export const MISSING_ENV_KEYS: string[] = (
  [
    ["VITE_FIREBASE_API_KEY", firebaseConfig.apiKey],
    ["VITE_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
    ["VITE_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
    ["VITE_FIREBASE_APP_ID", firebaseConfig.appId],
  ] as Array<[string, string | undefined]>
)
  .filter(([_, v]) => !v)
  .map(([k]) => k);
export const FIREBASE_CONFIG_OK = MISSING_ENV_KEYS.length === 0;
// Verbose Firestore logging to help diagnose save issues during development
try {
  setLogLevel("debug");
  // eslint-disable-next-line no-console
  console.log("[Firebase] Initialized", {
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    fromEnv: true,
  });
  if (MISSING_ENV_KEYS.length) {
    console.error(
      "[Firebase] Missing required env vars:",
      MISSING_ENV_KEYS.join(", ")
    );
  }
} catch (_) {
  // ignore
}

// Analytics is optional; guard where not available (SSR/tests)
try {
  getAnalytics(app);
} catch (_) {
  // ignore analytics init errors in unsupported environments
}
