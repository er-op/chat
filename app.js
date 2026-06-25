// ============================================================================
// 1. FIREBASE SDK IMPORTS (Loading Firebase directly via CDN)
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
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================================
// 2. YOUR FIREBASE CONFIGURATION
// Replace the placeholder strings below with your actual keys from Firebase Console!
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

// Initialize Firebase App, Auth, and Firestore Database
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

let unsubscribeFromMessages = null; // Variable to hold our real-time database listener

// ============================================================================
// 4. AUTHENTICATION TRACKER (Checks if a user is logged in or out)
// ============================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in -> Show Chat, Hide Login
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        userDisplayEmail.textContent = `Logged in as: ${user.email}`;
        
        // Clear input credentials
        emailInput.value = '';
        passwordInput.value = '';

        // Start listening for real-time messages
        listenForMessages();
    } else {
        // User is signed out -> Show Login, Hide Chat
        authContainer.style.display = 'block';
        chatContainer.style.display = 'none';
        chatWindow.innerHTML = ''; // Clear chat window cache
        
        // Unsubscribe from database listener to save performance/data usage
        if (unsubscribeFromMessages) {
            unsubscribeFromMessages();
        }
    }
});

// ============================================================================
// 5. SIGN UP, LOGIN & LOGOUT UTILITIES
// ============================================================================

// Sign Up Action
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

// Login Action
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

// Logout Action
logoutBtn.addEventListener('click', () => {
    signOut(auth).catch((error) => alert(`Logout Error: ${error.message}`));
});


// ============================================================================
// 6. REAL-TIME MESSAGING ENGINE
// ============================================================================

// Function to Send a Message to Firestore Database
async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return; // Prevent sending blank messages

    const currentUser = auth.currentUser;
    if (!currentUser) return alert("You must be logged in to send messages.");

    try {
        // Add a new document to the "messages" collection in Firestore
        await addDoc(collection(db, "messages"), {
            text: messageText,
            senderEmail: currentUser.email,
            senderId: currentUser.uid,
            timestamp: serverTimestamp() // Uses cloud server time to ensure order accuracy
        });
        
        messageInput.value = ''; // Reset input field
        messageInput.focus();
    } catch (error) {
        console.error("Error sending message: ", error);
        alert("Failed to send message.");
    }
}

// Event Listeners for Send triggers
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Function that streams messages from Firestore in Real-Time
function listenForMessages() {
    // Create a query to look at the "messages" collection ordered by timestamp
    const messagesQuery = query(collection(db, "messages"), orderBy("timestamp", "asc"));

    // setup the onSnapshot real-time listener
    unsubscribeFromMessages = onSnapshot(messagesQuery, (snapshot) => {
        chatWindow.innerHTML = ''; // Wipe window clean before reloading updated logs
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (!data.timestamp) return; // Skip temporary rendering errors while cloud sets timestamps

            const messageElement = document.createElement('div');
            
            // Check if the message belongs to the current user or someone else
            const isSentByMe = data.senderId === auth.currentUser.uid;
            
            // Apply corresponding styling tags based on sender context
            messageElement.classList.add('message', isSentByMe ? 'sent' : 'received');

            // Format JavaScript timestamp date into clean readable hours/minutes
            const date = data.timestamp.toDate();
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Structure inside chat bubbles
            messageElement.innerHTML = `
                ${!isSentByMe ? `<span class="sender-meta">${data.senderEmail.split('@')[0]}</span>` : ''}
                <span class="message-text">${escapeHTML(data.text)}</span>
                <span class="timestamp">${formattedTime}</span>
            `;

            chatWindow.appendChild(messageElement);
        });

        // Automatically scroll to the absolute bottom when a new message drops in
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }, (error) => {
        console.error("Database streaming error: ", error);
    });
}

// Security Helper: Stops users from injecting harmful HTML/Scripts into chat text
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}