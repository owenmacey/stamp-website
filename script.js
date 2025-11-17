// script.js (ES module)

// --------- 1. Firebase imports (from CDN) ---------
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';

// --------- 2. Your Firebase config (REPLACE THIS) ---------
const firebaseConfig = {
  apiKey: "AIzaSyBeLXkIG-4eah04jytQqewxeAqFVfHPkYg",
  authDomain: "stamp-project-5d221.firebaseapp.com",
  projectId: "stamp-project-5d221",
  storageBucket: "stamp-project-5d221.firebasestorage.app",
  messagingSenderId: "953444275310",
  appId: "1:953444275310:web:6ad89654c3a7ebe918427f",
  measurementId: "G-3H6G0ND5HV"
};

// --------- 3. Initialize Firebase ---------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --------- 4. DOM elements ---------
const board = document.getElementById('board');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');
const stampNameInput = document.getElementById('stampName');
const stampColorInput = document.getElementById('stampColor');

let currentUser = null;

// --------- 5. Auth logic ---------
loginBtn.addEventListener('click', () => {
  if (currentUser) {
    // Log out
    signOut(auth).catch(err => {
      console.error(err);
      alert('Error signing out, check console for details.');
    });
  } else {
    // Log in
    signInWithPopup(auth, provider).catch(err => {
      console.error(err);
      alert('Error signing in, check console for details.');
    });
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    const name = user.displayName || user.email || 'User';
    statusEl.textContent = `Logged in as ${name}`;
    loginBtn.textContent = 'Log out';

    // Prefill name input if empty
    if (!stampNameInput.value) {
      stampNameInput.value = name;
    }
  } else {
    statusEl.textContent = 'Not logged in';
    loginBtn.textContent = 'Log in with Google';
  }
});

// --------- 6. Firestore: ensure ONE stamp per user ---------
async function upsertMyStamp(x, y) {
  if (!currentUser) {
    alert('Please log in to place or move your stamp.');
    return;
  }

  const userId = currentUser.uid;
  const stampsCol = collection(db, 'stamps');

  const name =
    (stampNameInput.value || '').trim() ||
    currentUser.displayName ||
    currentUser.email ||
    'Anonymous';

  const color = stampColorInput.value || '#e53935';

  // 1) Find existing stamps for this user
  const existingQuery = query(stampsCol, where('userId', '==', userId));
  const existingSnap = await getDocs(existingQuery);

  let targetRef;

  if (!existingSnap.empty) {
    // Use the first one as the "official" stamp
    const [firstDoc, ...rest] = existingSnap.docs;
    targetRef = firstDoc.ref;

    // Delete any extra stamps for this user (cleanup)
    const deletions = rest.map(docSnap => deleteDoc(docSnap.ref));
    if (deletions.length > 0) {
      await Promise.all(deletions);
    }
  } else {
    // No existing stamp: create a brand new one
    targetRef = doc(stampsCol); // random id is fine
  }

  // 2) Create or update the chosen stamp document
  await setDoc(
    targetRef,
    {
      userId,
      name,
      color,
      x,
      y,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

// --------- 7. Click handler on the board ---------
board.addEventListener('click', async (e) => {
  if (!currentUser) {
    alert('Log in first to place your stamp.');
    return;
  }

  const rect = board.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;   // 0–1
  const y = (e.clientY - rect.top) / rect.height;   // 0–1

  try {
    await upsertMyStamp(x, y);
  } catch (err) {
    console.error(err);
    alert('Error saving your stamp. Check the console for details.');
  }
});

// --------- 8. Render stamps in real-time ---------
function renderStamp(docId, data) {
  const el = document.createElement('div');
  el.className = 'stamp';
  el.style.left = (data.x * 100) + '%';
  el.style.top = (data.y * 100) + '%';
  el.style.background = data.color || '#e53935';

  let title = data.name || 'Unknown';
  if (data.updatedAt && data.updatedAt.toDate) {
    const dt = data.updatedAt.toDate();
    title += ' — last updated: ' + dt.toLocaleString();
  }
  el.title = title;

  board.appendChild(el);
}

function startStampListener() {
  const stampsCol = collection(db, 'stamps');
  const q = query(stampsCol, orderBy('updatedAt', 'asc'));

  onSnapshot(
    q,
    (snapshot) => {
      // Clear the board and re-draw everything
      board.innerHTML = '';
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (typeof data.x === 'number' && typeof data.y === 'number') {
          renderStamp(docSnap.id, data);
        }
      });
    },
    (error) => {
      console.error('onSnapshot error:', error);
    }
  );
}

startStampListener();
