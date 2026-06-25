// ============================================================
// Firebase configuration for the LAF1201 pre-lesson module.
// The apiKey here is publishable; it is NOT a secret.
// Security comes from Firestore Rules, not from hiding this file.
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDEEhlkmXTcZ69etUNk2KJWngyp7meeP5M",
  authDomain: "laf1201.firebaseapp.com",
  projectId: "laf1201",
  storageBucket: "laf1201.firebasestorage.app",
  messagingSenderId: "84075254825",
  appId: "1:84075254825:web:5fe21c20a467fab977b838",
  measurementId: "G-DHK50S348X"
};

const FIREBASE_HOSTED_DOMAIN = '';

// ── Course profile: '6-week' (Special Term 1) or '14-week' (regular semester) ──
// Changes XP level thresholds and streak multiplier tiers across the binder.
window.LAF1201_COURSE_PROFILE = '6-week';
