const firebaseConfig = {
  apiKey: "AIzaSyAbBza6Zsz8E4fAoo2eilbjhkuEMwIaiKg",
  authDomain: "anime-verse-61b3f.firebaseapp.com",
  projectId: "anime-verse-61b3f",
  storageBucket: "anime-verse-61b3f.appspot.com",
  messagingSenderId: "719532570560",
  appId: "1:719532570560:web:af5568039e0ccd448dfa25"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

// Enable offline persistence and expose promise for pages to await
window._persistenceReady = db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence unavailable (multiple tabs)');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported in this browser');
  }
});
