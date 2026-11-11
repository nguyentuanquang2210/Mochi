import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

// This public Firebase config identifies the app. User data access remains
// protected by Firebase Authentication and Firestore/Storage security rules.
const firebaseConfig = {
  apiKey: 'AIzaSyDQn13OpzAY-3xl2UcIMHYI8HW3MvWYcns',
  authDomain: 'mochi-81c6b.firebaseapp.com',
  projectId: 'mochi-81c6b',
  storageBucket: 'mochi-81c6b.firebasestorage.app',
  messagingSenderId: '250258014661',
  appId: '1:250258014661:web:3416c9c6286ebe2b6bcbac',
  measurementId: 'G-YLQ2D2GRY9'
};

// `getAnalytics()` is deliberately omitted: Firebase Web Analytics is not a
// native Expo service and should not run during app startup on Android/iOS.
export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firestore: Firestore = getFirestore(firebaseApp);
export const firebaseStorage: FirebaseStorage = getStorage(firebaseApp);
