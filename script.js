// --------- 1. Firebase imports (from CDN) ---------
    // Version taken from the official Firebase CDN docs. :contentReference[oaicite:0]{index=0}
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
    import {
      getFirestore,
      collection,
      addDoc,
      serverTimestamp,
      query,
      orderBy,
      onSnapshot
    } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
    import {
      getAuth,
      GoogleAuthProvider,
      signInWithPopup,
      onAuthStateChanged,
      signOut
    } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

    // --------- 2. Your Firebase config (replace this!) ---------
    // Go to Firebase Console > Project settings > "Your apps" > Web app
    // and copy the config object, then paste it over this placeholder.
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID"
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
      } else {
        statusEl.textContent = 'Not logged in';
        loginBtn.textContent = 'Log in with Google';
      }
    });

    // --------- 6. Firestore: add a stamp ---------
    async function addStamp(x, y) {
      if (!currentUser) {
        alert('Please log in to place a stamp.');
        return;
      }

      const stampsCol = collection(db, 'stamps');

      await addDoc(stampsCol, {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Anonymous',
        x,
        y,
        createdAt: serverTimestamp()
      });
    }

    // --------- 7. Click handler on the board ---------
    board.addEventListener('click', async (e) => {
      if (!currentUser) {
        alert('Please log in first.');
        return;
      }

      const rect = board.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;   // 0–1
      const y = (e.clientY - rect.top) / rect.height;   // 0–1

      try {
        await addStamp(x, y);
      } catch (err) {
        console.error(err);
        alert('Error saving stamp.');
      }
    });

    // --------- 8. Render stamps in real-time ---------
    function renderStamp(data) {
      const el = document.createElement('div');
      el.className = 'stamp';
      el.style.left = (data.x * 100) + '%';
      el.style.top = (data.y * 100) + '%';

      if (data.createdAt && data.createdAt.toDate) {
        const dt = data.createdAt.toDate();
        el.title = `${data.userName || 'Unknown'} @ ${dt.toLocaleString()}`;
      } else {
        el.title = data.userName || 'Unknown';
      }

      board.appendChild(el);
    }

    function startStampListener() {
      const stampsCol = collection(db, 'stamps');
      const q = query(stampsCol, orderBy('createdAt', 'asc'));

      onSnapshot(q, (snapshot) => {
        // Simple approach: clear and re-render all stamps
        board.innerHTML = '';
        snapshot.forEach(doc => {
          const data = doc.data();
          if (typeof data.x === 'number' && typeof data.y === 'number') {
            renderStamp(data);
          }
        });
      });
    }

    startStampListener();