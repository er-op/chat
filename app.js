// ============================================================================
// 1. FIREBASE SDK IMPORTS (Updated with Storage)
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
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ============================================================================
// 2. YOUR FIREBASE CONFIGURATION
// Keep your actual keys pasted here exactly as you had them before!
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
const storage = getStorage(app); 

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

let unsubscribeFromMessages = null; // Holds active database listener sync pointer

// ============================================================================
// 4. AUTHENTICATION TRACKER (Checks if a user is logged in or out)
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in -> Show Chat UI, Hide Login UI
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        userDisplayEmail.textContent = `Logged in as: ${user.email}`;
        
        // Clear credential cache input elements
        emailInput.value = '';
        passwordInput.value = '';

        // Initialize our live incoming message engine
        listenForMessages();
    } else {
        // User is signed out -> Show Login UI, Hide Chat UI
        authContainer.style.display = 'block';
        chatContainer.style.display = 'none';
        chatWindow.innerHTML = ''; 
        
        // Kill listener socket connection to optimize performance when logged out
        if (unsubscribeFromMessages) {
            unsubscribeFromMessages();
        }
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
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Account created successfully!');
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
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert(`Login Error: ${error.message}`);
    }
});

// Logout Handler
logoutBtn.addEventListener('click', () => {
    signOut(auth).catch((error) => alert(`Logout Error: ${error.message}`));
});

// ============================================================================
// 6. REAL-TIME MESSAGING ENGINE & MEDIA UPLOADS
// ============================================================================

// Trigger hidden file selector when clicking the attach button
attachBtn.addEventListener('click', () => fileInput.click());

// Handle file selection, storage uploads, and firestore references
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return alert("You must be logged in to send media files, bro.");

    // Define a unique dynamic path for the storage node
    const fileRef = ref(storage, `chats/${Date.now()}_${file.name}`);
    
    // Injected transient loading UI tag
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'system-message';
    loadingDiv.id = 'upload-loading';
    loadingDiv.textContent = 'Uploading media asset...';
    chatWindow.appendChild(loadingDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        // 1. Upload binary stream payload directly into cloud bucket storage
        await uploadBytes(fileRef, file);
        
        // 2. Fetch the newly created storage token download url string
        const downloadURL = await getDownloadURL(fileRef);
        
        // 3. Write data schema package to firestore logs collection
        await addDoc(collection(db, "messages"), {
            text: "", 
            fileUrl: downloadURL,
            fileType: file.type.startsWith('image/') ? 'image' : 'video',
            senderEmail: currentUser.email,
            senderId: currentUser.uid,
            timestamp: serverTimestamp()
        });

    } catch (error) {
        console.error("Upload process error logging: ", error);
        alert("Failed to upload media file.");
    } finally {
        // Purge placeholder loading elements
        const loader = document.getElementById('upload-loading');
        if (loader) loader.remove();
        fileInput.value = ''; // Reset input target track
    }
});

// Function to Send standard text message
async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return; // Prevent pushing whitespace lines

    const currentUser = auth.currentUser;
    if (!currentUser) return alert("You must be logged in to send messages.");

    try {
        await addDoc(collection(db, "messages"), {
            text: messageText,
            fileUrl: "",
            fileType: "text",
            senderEmail: currentUser.email,
            senderId: currentUser.uid,
            timestamp: serverTimestamp() // Atomic clock sync time stamp
        });
        messageInput.value = '';
        messageInput.focus();
    } catch (error) {
        console.error("Text push failure logs: ", error);
        alert("Failed to send message.");
    }
}

// Global text interaction UI listeners
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// Stream and render messages (Supports layout distribution changes for text/media content)
function listenForMessages() {
    const messagesQuery = query(collection(db, "messages"), orderBy("timestamp", "asc"));

    unsubscribeFromMessages = onSnapshot(messagesQuery, (snapshot) => {
        chatWindow.innerHTML = ''; // Fresh render layout strip
        
        snapshot.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();
            if (!data.timestamp) return; // Ignore local offline cache rendering adjustments

            const messageElement = document.createElement('div');
            const isSentByMe = data.senderId === auth.currentUser.uid;
            messageElement.classList.add('message', isSentByMe ? 'sent' : 'received');

            const date = data.timestamp.toDate();
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Evaluate data packet type definitions to assign conditional body template injections
            let contentHTML = '';
            if (data.fileType === 'image') {
                contentHTML = `<img src="${data.fileUrl}" class="chat-media" alt="Shared image" loading="lazy">`;
            } else if (data.fileType === 'video') {
                contentHTML = `<video src="${data.fileUrl}" class="chat-media" controls></video>`;
            } else {
                contentHTML = `<span class="message-text">${escapeHTML(data.text)}</span>`;
            }

            // Combine frame contents with sender headers and structural delete controls
            messageElement.innerHTML = `
                ${!isSentByMe ? `<span class="sender-meta">${data.senderEmail.split('@')[0]}</span>` : ''}
                <div class="message-content">
                    ${contentHTML}
                    ${isSentByMe ? `<button class="delete-btn" data-id="${snapshotDoc.id}">🗑️</button>` : ''}
                </div>
                <span class="timestamp">${formattedTime}</span>
            `;

            chatWindow.appendChild(messageElement);
        });
        
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }, (error) => {
        console.error("Realtime pipe listener crashed: ", error);
    });
}

// Intercept deletion execution streams targeting matching record entries hashes
chatWindow.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const messageId = e.target.getAttribute('data-id');
        if (confirm("Are you sure you want to delete this message, bro?")) {
            try { 
                await deleteDoc(doc(db, "messages", messageId)); 
            } catch (error) { 
                console.error("Removal request failed: ", error);
                alert("Failed to delete."); 
            }
        }
    }
});

// Input sanitize validation filter
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}