// ============================================================================
// 1. FIREBASE SDK IMPORTS
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    doc,
    deleteDoc,
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================================
// 2. YOUR FIREBASE CONFIGURATION
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyB1uzmDbEQMFHvD8J9EkUDyj5Hnc36ImG4",
  authDomain: "chatapplication-6bee4.firebaseapp.com",
  projectId: "chatapplication-6bee4",
  storageBucket: "chatapplication-6bee4.firebasestorage.app",
  messagingSenderId: "111107631523",
  appId: "1:111107631523:web:156caaefc8e3a18a765216",
  measurementId: "G-60EH4K3X4Z"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================================
// 3. DOM ELEMENT REFERENCES
// ============================================================================
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn'); 
const logoutBtn = document.getElementById('logout-btn');
const userDisplayEmail = document.getElementById('user-display-email');
const chatWindow = document.getElementById('chat-window');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn'); 
const fileInput = document.getElementById('file-input');   
const usersListContainer = document.getElementById('users-list');

let activeSelectedUserId = null; 
let activeSelectedUserEmail = null;
let unsubscribeFromMessages = null; 
let cachedUnreadCounts = {}; 

// ============================================================================
// 4. AUTHENTICATION TRACKER
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        userDisplayEmail.textContent = `Logged in as: ${user.email}`;
        
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            lastSeen: serverTimestamp()
        }, { merge: true });

        emailInput.value = ''; 
        passwordInput.value = '';
        
        listenToAvailableUsersList(); 
        listenForGlobalUnreadBadges();
    } else {
        authContainer.style.display = 'block';
        chatContainer.style.display = 'none';
        chatWindow.innerHTML = '<div class="system-message">Select a person from the list to chat, bro!</div>'; 
        if (unsubscribeFromMessages) unsubscribeFromMessages();
    }
});

// ============================================================================
// 5. SIGN UP, LOGIN & LOGOUT UTILITIES
// ============================================================================

// Sign Up Handler
signupBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) return alert('Please enter both email and password, bro.');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        await setDoc(doc(db, "users", newUser.uid), {
            uid: newUser.uid,
            email: newUser.email,
            lastSeen: serverTimestamp()
        });

        alert('Account created successfully, bro! You are now visible to everyone.');
    } catch (error) {
        alert(`Sign Up Error: ${error.message}`);
    }
});

// Login Handler
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) return alert('Please enter both email and password.');

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            lastSeen: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        alert(`Login Error: ${error.message}`);
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// ============================================================================
// 6. REAL-TIME MESSAGING ENGINE & SIDEBAR GENERATION
// ============================================================================

function listenToAvailableUsersList() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        usersListContainer.innerHTML = '';
        snapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            if (userData.uid === auth.currentUser.uid) return; 

            const initials = userData.email.substring(0, 2).toUpperCase();
            const unreadCount = cachedUnreadCounts[userData.uid] || 0;

            const bubbleItem = document.createElement('div');
            bubbleItem.className = `user-bubble-item ${activeSelectedUserId === userData.uid ? 'active' : ''}`;
            bubbleItem.innerHTML = `
                <div class="bubble-avatar">${initials}</div>
                <div class="bubble-info">
                    <span class="bubble-name">${userData.email.split('@')[0]}</span>
                    <span class="bubble-status">Click to open chat</span>
                </div>
                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
            `;

            bubbleItem.addEventListener('click', () => selectActiveTargetUserChat(userData.uid, userData.email));
            usersListContainer.appendChild(bubbleItem);
        });
    });
}

function getConversationRoomId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function selectActiveTargetUserChat(targetUid, targetEmail) {
    activeSelectedUserId = targetUid;
    activeSelectedUserEmail = targetEmail;
    
    document.getElementById('current-chat-title').textContent = `Chat with ${targetEmail.split('@')[0]}`;
    document.getElementById('active-user-avatar').textContent = targetEmail.substring(0,2).toUpperCase();
    
    messageInput.disabled = false;
    sendBtn.disabled = false;

    cachedUnreadCounts[targetUid] = 0;
    listenToAvailableUsersList();

    listenForActiveMessages();
}

function listenForActiveMessages() {
    if (unsubscribeFromMessages) unsubscribeFromMessages();

    const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);
    const messagesQuery = query(collection(db, "rooms", roomId, "messages"), orderBy("timestamp", "asc"));

    unsubscribeFromMessages = onSnapshot(messagesQuery, (snapshot) => {
        chatWindow.innerHTML = '';
        if (snapshot.empty) {
            chatWindow.innerHTML = '<div class="system-message">No messages yet. Say hi, bro!</div>';
        }

        snapshot.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();
            const messageElement = document.createElement('div');
            const isSentByMe = data.senderId === auth.currentUser.uid;
            messageElement.classList.add('message', isSentByMe ? 'sent' : 'received');

            const formattedTime = data.timestamp ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just Now";

            let contentHTML = data.fileUrl 
                ? `<img src="${data.fileUrl}" class="chat-media" alt="Shared image" loading="lazy">` 
                : `<span class="message-text">${escapeHTML(data.text)}</span>`;

            messageElement.innerHTML = `
                <div class="message-content">
                    ${contentHTML}
                    ${isSentByMe ? `<button class="delete-btn" data-id="${snapshotDoc.id}">🗑️</button>` : ''}
                </div>
                <span class="timestamp">${formattedTime}</span>
            `;

            chatWindow.appendChild(messageElement);
        });
        chatWindow.scrollTop = chatWindow.scrollHeight;
    });
}

function listenForGlobalUnreadBadges() {
    onSnapshot(collection(db, "global_unread_tracker"), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                if (data.receiverId === auth.currentUser.uid && data.senderId !== activeSelectedUserId) {
                    cachedUnreadCounts[data.senderId] = (cachedUnreadCounts[data.senderId] || 0) + 1;
                }
            }
        });
        listenToAvailableUsersList();
    });
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !activeSelectedUserId) return;

    const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);
    messageInput.value = '';

    try {
        await addDoc(collection(db, "rooms", roomId, "messages"), {
            text: text, fileUrl: "", senderId: auth.currentUser.uid, timestamp: serverTimestamp()
        });
        await addDoc(collection(db, "global_unread_tracker"), {
            senderId: auth.currentUser.uid, receiverId: activeSelectedUserId, timestamp: serverTimestamp()
        });
    } catch (e) { console.error(e); }
    messageInput.focus();
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// ============================================================================
// 7. HIGH-PERFORMANCE 2MB+ IMAGE ON-THE-FLY COMPRESSION ENGINE
// ============================================================================
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !activeSelectedUserId) return;

    const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);

    // Dynamic processing indicator UI flag insertion
    const loader = document.createElement('div');
    loader.className = 'system-message'; 
    loader.id = 'img-loading-flag'; 
    loader.textContent = 'Compressing and processing high-res image, bro...';
    chatWindow.appendChild(loader);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;

        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Establish proportional safe limits to scale layout boundaries
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Compress format to standard JPEG and set threshold conversion quality density to 60%
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);

            try {
                await addDoc(collection(db, "rooms", roomId, "messages"), {
                    text: "", 
                    fileUrl: compressedBase64, 
                    senderId: auth.currentUser.uid, 
                    timestamp: serverTimestamp()
                });
                await addDoc(collection(db, "global_unread_tracker"), {
                    senderId: auth.currentUser.uid, 
                    receiverId: activeSelectedUserId, 
                    timestamp: serverTimestamp()
                });
            } catch (err) { 
                alert("Failed to send image."); 
            } finally { 
                if(document.getElementById('img-loading-flag')) document.getElementById('img-loading-flag').remove(); 
                fileInput.value = ''; 
            }
        };
    };

    reader.onerror = () => {
        alert("Error handling image binary encoding streams.");
        if(document.getElementById('img-loading-flag')) document.getElementById('img-loading-flag').remove();
    };
});

// ============================================================================
// 8. ATOMIC MESSAGE DELETION INTERCEPTOR
// ============================================================================
chatWindow.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const msgId = e.target.getAttribute('data-id');
        const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);
        if (confirm("Delete this message, bro?")) {
            try { await deleteDoc(doc(db, "rooms", roomId, "messages", msgId)); } catch(e) { alert("Failed deletion mapping."); }
        }
    }
});

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}