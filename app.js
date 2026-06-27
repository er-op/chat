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
    setDoc,
    getDocs 
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
const clearChatBtn = document.getElementById('clear-chat-btn'); 
const userDisplayEmail = document.getElementById('user-display-email');
const chatWindow = document.getElementById('chat-window');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn'); 
const voiceBtn = document.getElementById('voice-btn'); 
const fileInput = document.getElementById('file-input');   
const usersListContainer = document.getElementById('users-list');

let activeSelectedUserId = null; 
let activeSelectedUserEmail = null;
let unsubscribeFromMessages = null; 
let unsubscribeFromUsers = null;
let unsubscribeFromUnread = null;
let cachedUnreadCounts = {}; 

// Voice Recording Hardware State Trackers
let mediaRecorder = null;
let audioChunks = [];
let isRecordingAudio = false;

// ============================================================================
// 3A. DISPLAY NAME HELPER
// ============================================================================
function getDisplayName(email) {
    const customMap = {
        "som277482@gmail.com": "eros",
        "soma277482@gmail.com": "era"
    };
    return customMap[email] || email.split('@')[0];
}

// ============================================================================
// 4. AUTHENTICATION TRACKER
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        userDisplayEmail.textContent = `Logged in as: ${getDisplayName(user.email)}`;
        
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
        chatWindow.innerHTML = '<div class="system-message">Select an active friend bubble from the left side to load history, bro!</div>'; 
        clearChatBtn.style.display = 'none'; 
        
        if (unsubscribeFromMessages) unsubscribeFromMessages();
        if (unsubscribeFromUsers) unsubscribeFromUsers();
        if (unsubscribeFromUnread) unsubscribeFromUnread();
        
        activeSelectedUserId = null;
        activeSelectedUserEmail = null;
        cachedUnreadCounts = {};
    }
});

// ============================================================================
// 5. SIGN UP, LOGIN & LOGOUT UTILITIES
// ============================================================================

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
    if (unsubscribeFromUsers) unsubscribeFromUsers();

    unsubscribeFromUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        usersListContainer.innerHTML = '';
        snapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            if (!auth.currentUser || userData.uid === auth.currentUser.uid) return; 

            const initials = userData.email.substring(0, 2).toUpperCase();
            const unreadCount = cachedUnreadCounts[userData.uid] || 0;

            const bubbleItem = document.createElement('div');
            bubbleItem.className = `user-bubble-item ${activeSelectedUserId === userData.uid ? 'active' : ''}`;
            bubbleItem.innerHTML = `
                <div class="bubble-avatar">${initials}</div>
                <div class="bubble-info">
                    <span class="bubble-name">${getDisplayName(userData.email)}</span>
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
    
    document.getElementById('current-chat-title').textContent = `Chat with ${getDisplayName(targetEmail)}`;
    document.getElementById('active-user-avatar').textContent = targetEmail.substring(0,2).toUpperCase();
    
    messageInput.disabled = false;
    sendBtn.disabled = false;
    voiceBtn.disabled = false; 
    clearChatBtn.style.display = 'block'; 

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
            return;
        }

        snapshot.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();
            const messageElement = document.createElement('div');
            const isSentByMe = data.senderId === auth.currentUser.uid;
            messageElement.classList.add('message', isSentByMe ? 'sent' : 'received');

            const formattedTime = data.timestamp ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just Now";

            let contentHTML = '';
            if (data.fileType === 'voice') {
                contentHTML = `<audio src="${data.fileUrl}" controls class="chat-audio-player"></audio>`;
            } else if (data.fileType === 'image') {
                contentHTML = `<img src="${data.fileUrl}" class="chat-media" alt="Shared image" loading="lazy">`;
            } else {
                contentHTML = `<span class="message-text">${escapeHTML(data.text || '')}</span>`;
            }

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
    if (unsubscribeFromUnread) unsubscribeFromUnread();

    unsubscribeFromUnread = onSnapshot(collection(db, "global_unread_tracker"), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                if (auth.currentUser && data.receiverId === auth.currentUser.uid && data.senderId !== activeSelectedUserId) {
                    cachedUnreadCounts[data.senderId] = (cachedUnreadCounts[data.senderId] || 0) + 1;
                }
                if (auth.currentUser && data.receiverId === auth.currentUser.uid && data.senderId === activeSelectedUserId) {
                    deleteDoc(doc(db, "global_unread_tracker", change.doc.id)).catch(() => {});
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
            text: text, fileUrl: "", fileType: "text", senderId: auth.currentUser.uid, timestamp: serverTimestamp()
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
// 7. HIGH-PERFORMANCE IMAGE COMPRESSION ENGINE
// ============================================================================
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !activeSelectedUserId) return;

    const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);

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

            const MAX_WIDTH = 800; 
            const MAX_HEIGHT = 800;
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

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);

            try {
                await addDoc(collection(db, "rooms", roomId, "messages"), {
                    text: "", 
                    fileUrl: compressedBase64, 
                    fileType: "image",
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
        alert("Error handling image data streams.");
        if(document.getElementById('img-loading-flag')) document.getElementById('img-loading-flag').remove();
    };
});

// ============================================================================
// 8. AUDIO RECORDING ENGINE
// ============================================================================
voiceBtn.addEventListener('click', async () => {
    if (!activeSelectedUserId) return;

    if (!isRecordingAudio) {
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(audioStream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                if (audioBlob.size > 600000) {
                    alert("Voice note is too long, bro! Keep it under 30 seconds.");
                    return;
                }

                const reader = new FileReader();
                reader.readAsDataURL(audioBlob); 
                reader.onloadend = async () => {
                    const base64AudioString = reader.result;
                    const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);

                    try {
                        await addDoc(collection(db, "rooms", roomId, "messages"), {
                            text: "",
                            fileUrl: base64AudioString,
                            fileType: "voice", 
                            senderId: auth.currentUser.uid,
                            timestamp: serverTimestamp()
                        });
                        await addDoc(collection(db, "global_unread_tracker"), { 
                            senderId: auth.currentUser.uid, 
                            receiverId: activeSelectedUserId, 
                            timestamp: serverTimestamp() 
                        });
                    } catch (err) { alert("Failed to send voice message, bro."); }
                };
            };

            mediaRecorder.start();
            isRecordingAudio = true;
            voiceBtn.classList.add('recording-active');
            voiceBtn.style.color = '#ea0038';
            messageInput.placeholder = "Recording voice note... Click microphone again to send!";
        } catch (err) {
            alert("Microphone hardware permission denied or unavailable, bro!");
        }
    } 
    else {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        isRecordingAudio = false;
        voiceBtn.classList.remove('recording-active');
        voiceBtn.style.color = '#54656f';
        messageInput.placeholder = "Type a message...";
    }
});

// ============================================================================
// 9. ATOMIC DATABASE MESSAGE DELETION INTERCEPTOR & CLEAR CHAT
// ============================================================================
chatWindow.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const msgId = e.target.getAttribute('data-id');
        const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);
        
        if (confirm("Delete this message permanently from the database, bro?")) {
            try { 
                await deleteDoc(doc(db, "rooms", roomId, "messages", msgId)); 
            } catch(e) { 
                alert("Failed to delete message from the database."); 
            }
        }
    }
});

clearChatBtn.addEventListener('click', async () => {
    if (!activeSelectedUserId) return;

    const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);
    
    if (confirm("Are you completely sure you want to clear this entire chat history, bro?")) {
        if (confirm("Warning: This action is permanent and will delete all text, pictures, and audio logs from the cloud database! Proceed?")) {
            try {
                const messagesRef = collection(db, "rooms", roomId, "messages");
                const querySnapshot = await getDocs(messagesRef);
                
                const deletePromises = [];
                querySnapshot.forEach((messageDoc) => {
                    deletePromises.push(deleteDoc(doc(db, "rooms", roomId, "messages", messageDoc.id)));
                });
                
                await Promise.all(deletePromises);
                alert("Chat cleared successfully, bro!");
            } catch (err) {
                console.error(err);
                alert("Failed to completely clear chat from the database.");
            }
        }
    }
});

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}