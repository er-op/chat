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
    where,
    onSnapshot, 
    serverTimestamp,
    doc,
    deleteDoc,
    setDoc,
    getDocs,
    updateDoc 
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


const voiceCallBtn = document.getElementById('voice-call-btn');
const incomingCallPopup = document.getElementById('incoming-call-popup');
const incomingCallText = document.getElementById('incoming-call-text');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');
const activeCallBar = document.getElementById('active-call-bar');
const activeCallText = document.getElementById('active-call-text');
const endCallBtn = document.getElementById('end-call-btn');
const remoteAudio = document.getElementById('remote-audio');


const videoCallBtn = document.getElementById('video-call-btn');
const videoCallContainer = document.getElementById('video-call-container');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const videoCallText = document.getElementById('video-call-text');
const endVideoCallBtn = document.getElementById('end-video-call-btn');


const keywordContainer =
document.getElementById('keyword-container');

const keywordInput =
document.getElementById('secret-keyword');

const keywordSubmitBtn =
document.getElementById('keyword-submit-btn');


let activeSelectedUserId = null; 
let activeSelectedUserEmail = null;
let unsubscribeFromMessages = null; 
let unsubscribeFromUsers = null;
let unsubscribeFromUnread = null;
let cachedUnreadCounts = {}; 


let peerConnection = null;
let localStream = null;
let currentCallId = null;
let currentIncomingCall = null;
let unsubscribeIncomingCalls = null;
let unsubscribeCallStatus = null;
let unsubscribeAnswer = null;
let unsubscribeRemoteCandidates = null;

let currentCallType = "audio";

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
        keywordContainer.style.display = 'block';
        chatContainer.style.display = 'none';

        userDisplayEmail.textContent = `Logged in as: ${getDisplayName(user.email)}`;
        
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            online: true,
            lastSeen: serverTimestamp()
        }, { merge: true });

        emailInput.value = ''; 
        passwordInput.value = '';
        
        listenToAvailableUsersList(); 
        listenForGlobalUnreadBadges();
        listenForIncomingVoiceCalls();
    } else {
        authContainer.style.display = 'block';
        chatContainer.style.display = 'none';
        chatWindow.innerHTML = '<div class="system-message">Select an active friend bubble from the left side to load history, bro!</div>'; 
        clearChatBtn.style.display = 'none'; 
        
        if (unsubscribeFromMessages) unsubscribeFromMessages();
        if (unsubscribeFromUsers) unsubscribeFromUsers();
        if (unsubscribeFromUnread) unsubscribeFromUnread();

        if (unsubscribeIncomingCalls) unsubscribeIncomingCalls();
        cleanupVoiceCall();

        
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
            online: true,
            lastSeen: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        alert(`Login Error: ${error.message}`);
    }
});


logoutBtn.addEventListener('click', async () => {

    await setDoc(doc(db,"users",auth.currentUser.uid),{
        online:false,
        lastSeen:serverTimestamp()
    },{merge:true});

    signOut(auth);
});

keywordSubmitBtn.addEventListener('click', () => {

    const keyword =
    keywordInput.value.trim().toLowerCase();

    if(keyword === "valobashi"){

        keywordContainer.style.display = 'none';

        chatContainer.style.display = 'flex';

    }
    else{

        alert(
            "Wrong keyword, bro! Access denied."
        );

        keywordInput.value = '';

        keywordInput.focus();
    }

});

keywordInput.addEventListener('keypress',(e)=>{

    if(e.key === 'Enter'){
        keywordSubmitBtn.click();
    }

});


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
                    <span class="bubble-status">${userData.online ? '🟢 Online' : '⚫ Offline'}</span>

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
    onSnapshot(doc(db,"users",targetUid),(docSnap)=>{

    const data=docSnap.data();

    const statusText = data.online
    ? "🟢 Online"
    : "⚫ Offline";

    userDisplayEmail.textContent = statusText;
});

    document.getElementById('active-user-avatar').textContent = targetEmail.substring(0,2).toUpperCase();
    
    messageInput.disabled = false;
    sendBtn.disabled = false;
    voiceBtn.disabled = false; 
    voiceCallBtn.disabled = false;
    videoCallBtn.disabled = false;
    clearChatBtn.style.display = 'block'; 

    cachedUnreadCounts[targetUid] = 0;
    listenToAvailableUsersList();
    listenForActiveMessages();
}


function listenForActiveMessages() {
    if (unsubscribeFromMessages) unsubscribeFromMessages();

    const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);
    const messagesQuery = query(
        collection(db, "rooms", roomId, "messages"),
        orderBy("timestamp", "asc")
    );

    unsubscribeFromMessages = onSnapshot(messagesQuery, async (snapshot) => {
        chatWindow.innerHTML = '';

        if (snapshot.empty) {
            chatWindow.innerHTML =
                '<div class="system-message">No messages yet. Say hi, bro!</div>';
            return;
        }

        const viewedUpdateTasks = [];

        snapshot.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();
            const isSentByMe = data.senderId === auth.currentUser.uid;

            // Mark received messages as viewed when current user opens chat
            if (
                !isSentByMe &&
                data.senderId === activeSelectedUserId &&
                data.viewed !== true
            ) {
                viewedUpdateTasks.push(
                    updateDoc(
                        doc(db, "rooms", roomId, "messages", snapshotDoc.id),
                        { viewed: true }
                    )
                );
            }

            const messageElement = document.createElement('div');
            messageElement.classList.add('message', isSentByMe ? 'sent' : 'received');

            const formattedTime = data.timestamp
                ? data.timestamp.toDate().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : "Just Now";

            let contentHTML = '';

            if (data.fileType === 'voice') {
                contentHTML = `
                <audio controls>
                <source src="${data.fileUrl}" type="audio/webm">
                </audio>`;
            }

            else if (data.fileType === 'image') {
                contentHTML = `<img
                src="${data.fileUrl}"
                class="chat-image"
                alt="Image">`;
            }

            else {
                contentHTML =
                    `<span class="message-text">${escapeHTML(data.text || '')}</span>`;
            }

            const tickHTML = isSentByMe
                ? `<span class="message-tick ${data.viewed ? 'viewed' : ''}">✓✓</span>`
                : '';

            messageElement.innerHTML = `
                <div class="message-content">
                    ${contentHTML}
                    ${isSentByMe ? `<button class="delete-btn" data-id="${snapshotDoc.id}">🗑️</button>` : ''}
                </div>

                <div class="message-meta">
                    <span class="timestamp">${formattedTime}</span>
                    ${tickHTML}
                </div>
            `;

            chatWindow.appendChild(messageElement);
        });

        if (viewedUpdateTasks.length > 0) {
            Promise.all(viewedUpdateTasks).catch(console.error);
        }

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

    if (!text || !activeSelectedUserId || !auth.currentUser) return;

    const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);

    messageInput.value = '';
    sendBtn.disabled = true;

    try {
        await addDoc(collection(db, "rooms", roomId, "messages"), {
            text: text,
            fileUrl: "",
            fileType: "text",
            senderId: auth.currentUser.uid,
            receiverId: activeSelectedUserId,
            viewed: false,
            timestamp: serverTimestamp()
        });

        await addDoc(collection(db, "global_unread_tracker"), {
            senderId: auth.currentUser.uid,
            receiverId: activeSelectedUserId,
            timestamp: serverTimestamp()
        });

    } catch (e) {
        console.error(e);
        alert("Message sending failed, bro.");
        messageInput.value = text;
    } finally {
        sendBtn.disabled = false;
        messageInput.focus();
    }
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
                    receiverId: activeSelectedUserId,
                    viewed: false,
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
                            receiverId: activeSelectedUserId,
                            viewed: false,
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


// ============================================================================
// 10. REAL-TIME VOICE CALLING ENGINE - WEBRTC + FIRESTORE SIGNALING
// ============================================================================


const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" }
    ],
    iceCandidatePoolSize: 10
};




function createPeerConnection(callId, isCaller) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = async (event) => {
        const remoteStream = event.streams[0];

        console.log("Remote stream received:", remoteStream);

        if (currentCallType === "video") {
            remoteVideo.srcObject = remoteStream;

            try {
                await remoteVideo.play();
            } catch (err) {
                console.warn("Remote video autoplay blocked:", err);
            }
        } else {
            remoteAudio.srcObject = remoteStream;

            try {
                await remoteAudio.play();
            } catch (err) {
                console.warn("Remote audio autoplay blocked:", err);
            }
        }
    };

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            const candidateCollection = isCaller
                ? "offerCandidates"
                : "answerCandidates";

            await addDoc(
                collection(db, "calls", callId, candidateCollection),
                event.candidate.toJSON()
            );
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log("Connection state:", peerConnection.connectionState);

        if (peerConnection.connectionState === "connected") {
            if (currentCallType === "video") {
                videoCallText.textContent = "Video call connected";
            } else {
                activeCallText.textContent = "Voice call connected";
            }
        }

        if (
            peerConnection.connectionState === "failed" ||
            peerConnection.connectionState === "closed"
        ) {
            cleanupVoiceCall();
        }

        // Do not immediately cleanup on "disconnected"
        // It can recover automatically.
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE state:", peerConnection.iceConnectionState);

        if (peerConnection.iceConnectionState === "failed") {
            cleanupVoiceCall();
        }
    };

    return peerConnection;
}



async function clearOldCandidates(callId) {
    const offerCandidates = await getDocs(collection(db, "calls", callId, "offerCandidates"));
    const answerCandidates = await getDocs(collection(db, "calls", callId, "answerCandidates"));

    const deleteList = [];

    offerCandidates.forEach((candidateDoc) => {
        deleteList.push(deleteDoc(doc(db, "calls", callId, "offerCandidates", candidateDoc.id)));
    });

    answerCandidates.forEach((candidateDoc) => {
        deleteList.push(deleteDoc(doc(db, "calls", callId, "answerCandidates", candidateDoc.id)));
    });

    await Promise.all(deleteList);
}

async function startVoiceCall() {
    currentCallType = "audio";
    if (!activeSelectedUserId || !auth.currentUser) return;

    try {
        const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);
        currentCallId = `${roomId}_${Date.now()}`;


        await clearOldCandidates(currentCallId);

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        createPeerConnection(currentCallId, true);

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);

        const offer = {
            type: offerDescription.type,
            sdp: offerDescription.sdp
        };

        await setDoc(doc(db, "calls", currentCallId), {
            callerId: auth.currentUser.uid,
            callerEmail: auth.currentUser.email,
            receiverId: activeSelectedUserId,
            receiverEmail: activeSelectedUserEmail,
            offer: offer,
            answer: null,
            status: "ringing",
            callType: "audio",
            createdAt: serverTimestamp()
        });

        activeCallText.textContent = `Calling ${getDisplayName(activeSelectedUserEmail)}...`;
        activeCallBar.style.display = "flex";

        unsubscribeAnswer = onSnapshot(doc(db, "calls", currentCallId), async (snapshot) => {
            const data = snapshot.data();

            if (!data) return;

            if (data.status === "rejected" || data.status === "ended") {
                cleanupVoiceCall();
                return;
            }

            if (data.answer && peerConnection && !peerConnection.currentRemoteDescription) {
                const answerDescription = new RTCSessionDescription(data.answer);
                await peerConnection.setRemoteDescription(answerDescription);

                activeCallText.textContent = `On call with ${getDisplayName(activeSelectedUserEmail)}`;
            }
        });

        unsubscribeRemoteCandidates = onSnapshot(
            collection(db, "calls", currentCallId, "answerCandidates"),
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        peerConnection.addIceCandidate(candidate).catch(console.error);
                    }
                });
            }
        );

        unsubscribeCallStatus = onSnapshot(doc(db, "calls", currentCallId), (snapshot) => {
            const data = snapshot.data();

            if (!data) return;

            if (data.status === "ended" || data.status === "rejected") {
                cleanupVoiceCall();
            }
        });

    } catch (error) {
        console.error(error);
        alert("Unable to start voice call. Please allow microphone permission, bro.");
        cleanupVoiceCall();
    }
}

async function startVideoCall() {
    if (!activeSelectedUserId || !auth.currentUser) return;

    try {
        currentCallType = "video";

        const roomId = getConversationRoomId(auth.currentUser.uid, activeSelectedUserId);
        currentCallId = `${roomId}_${Date.now()}`;


        await clearOldCandidates(currentCallId);

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });

        localVideo.srcObject = localStream;

        createPeerConnection(currentCallId, true);

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);

        const offer = {
            type: offerDescription.type,
            sdp: offerDescription.sdp
        };

        await setDoc(doc(db, "calls", currentCallId), {
            callerId: auth.currentUser.uid,
            callerEmail: auth.currentUser.email,
            receiverId: activeSelectedUserId,
            receiverEmail: activeSelectedUserEmail,
            offer: offer,
            answer: null,
            status: "ringing",
            callType: "video",
            createdAt: serverTimestamp()
        });

        videoCallText.textContent =
            `Calling ${getDisplayName(activeSelectedUserEmail)}...`;

        videoCallContainer.style.display = "flex";

        unsubscribeAnswer = onSnapshot(doc(db, "calls", currentCallId), async (snapshot) => {
            const data = snapshot.data();

            if (!data) return;

            if (data.status === "rejected" || data.status === "ended") {
                cleanupVoiceCall();
                return;
            }

            if (data.answer && peerConnection && !peerConnection.currentRemoteDescription) {
                const answerDescription = new RTCSessionDescription(data.answer);
                await peerConnection.setRemoteDescription(answerDescription);

                videoCallText.textContent =
                    `On video call with ${getDisplayName(activeSelectedUserEmail)}`;
            }
        });

        unsubscribeRemoteCandidates = onSnapshot(
            collection(db, "calls", currentCallId, "answerCandidates"),
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        peerConnection.addIceCandidate(candidate).catch(console.error);
                    }
                });
            }
        );

        unsubscribeCallStatus = onSnapshot(doc(db, "calls", currentCallId), (snapshot) => {
            const data = snapshot.data();

            if (!data) return;

            if (data.status === "ended" || data.status === "rejected") {
                cleanupVoiceCall();
            }
        });

    } catch (error) {
        console.error(error);
        alert("Unable to start video call. Please allow camera and microphone permission, bro.");
        cleanupVoiceCall();
    }
}


function listenForIncomingVoiceCalls() {
    if (unsubscribeIncomingCalls) unsubscribeIncomingCalls();

    const incomingQuery = query(
        collection(db, "calls"),
        where("receiverId", "==", auth.currentUser.uid),
        where("status", "==", "ringing")
    );

    unsubscribeIncomingCalls = onSnapshot(incomingQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const callData = change.doc.data();

                currentIncomingCall = {
                    id: change.doc.id,
                    data: callData
                };

                const callLabel = callData.callType === "video" ? "video calling" : "calling";
                incomingCallText.textContent =    `${getDisplayName(callData.callerEmail)} is ${callLabel} you...`;

                incomingCallPopup.style.display = "flex";
            }
        });
    });
}


async function acceptVoiceCall() {
    if (!currentIncomingCall || !auth.currentUser) return;

    try {
        currentCallId = currentIncomingCall.id;
        const callData = currentIncomingCall.data;

        currentCallType = callData.callType || "audio";

        incomingCallPopup.style.display = "none";

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: currentCallType === "video"
        });

        if (currentCallType === "video") {
            localVideo.srcObject = localStream;
            videoCallContainer.style.display = "flex";
            videoCallText.textContent =
                `On video call with ${getDisplayName(callData.callerEmail)}`;
        }

        createPeerConnection(currentCallId, false);

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        unsubscribeRemoteCandidates = onSnapshot(
            collection(db, "calls", currentCallId, "offerCandidates"),
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        peerConnection.addIceCandidate(candidate).catch(console.error);
                    }
                });
            }
        );

        const offerDescription = callData.offer;
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offerDescription)
        );

        const answerDescription = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp
        };

        await updateDoc(doc(db, "calls", currentCallId), {
            answer: answer,
            status: "accepted"
        });

        if (currentCallType === "audio") {
            activeCallText.textContent =
                `On call with ${getDisplayName(callData.callerEmail)}`;

            activeCallBar.style.display = "flex";
        }

        unsubscribeCallStatus = onSnapshot(doc(db, "calls", currentCallId), (snapshot) => {
            const data = snapshot.data();

            if (!data) return;

            if (data.status === "ended" || data.status === "rejected") {
                cleanupVoiceCall();
            }
        });

    } catch (error) {
        console.error(error);
        alert("Unable to accept call. Please allow camera/microphone permission, bro.");
        cleanupVoiceCall();
    }
}


async function rejectVoiceCall() {
    if (!currentIncomingCall) return;

    await updateDoc(doc(db, "calls", currentIncomingCall.id), {
        status: "rejected"
    });

    incomingCallPopup.style.display = "none";
    currentIncomingCall = null;
}

async function endVoiceCall() {
    if (currentCallId) {
        await updateDoc(doc(db, "calls", currentCallId), {
            status: "ended"
        }).catch(() => {});
    }

    cleanupVoiceCall();
}

function cleanupVoiceCall() {
    if (unsubscribeAnswer) {
        unsubscribeAnswer();
        unsubscribeAnswer = null;
    }

    if (unsubscribeRemoteCandidates) {
        unsubscribeRemoteCandidates();
        unsubscribeRemoteCandidates = null;
    }

    if (unsubscribeCallStatus) {
        unsubscribeCallStatus();
        unsubscribeCallStatus = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
    }

    remoteAudio.srcObject = null;

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    videoCallContainer.style.display = "none";
    currentCallType = "audio";


    activeCallBar.style.display = "none";
    incomingCallPopup.style.display = "none";

    currentCallId = null;
    currentIncomingCall = null;
}


voiceCallBtn.addEventListener("click", startVoiceCall);
videoCallBtn.addEventListener("click", startVideoCall);

acceptCallBtn.addEventListener("click", acceptVoiceCall);
rejectCallBtn.addEventListener("click", rejectVoiceCall);

endCallBtn.addEventListener("click", endVoiceCall);
endVideoCallBtn.addEventListener("click", endVoiceCall);
