// COMPLETE CHAT WIDGET - WITH AUTO-RECEIVE MESSAGES
(function() {
    console.log('Chat widget loading...');
    
    const API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';
    let socket = null;
    let isConnected = false;
    
    // Get or create user ID
    function getUserId() {
        let userId = localStorage.getItem('chat_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('chat_user_id', userId);
        }
        return userId;
    }
    
    // Get user name if logged in
    function getUserName() {
        const user = localStorage.getItem('sigma_user');
        if (user) {
            try {
                const userData = JSON.parse(user);
                return userData.name || userData.email.split('@')[0];
            } catch(e) {}
        }
        return 'Guest';
    }
    
    // Save message to server
    async function saveMessage(message) {
        try {
            await fetch(API_URL + '/api/chat/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: getUserId(),
                    userName: getUserName(),
                    message: message,
                    isAdmin: false
                })
            });
        } catch(e) {
            console.error('Save error:', e);
        }
    }
    
    // Load chat history
    async function loadChatHistory() {
        try {
            const response = await fetch(API_URL + '/api/chat/history/' + getUserId());
            const responseData = await response.json();
            const container = document.getElementById('chat_messages_container');
            
            if (container) {
                container.innerHTML = '';
                if (data.messages && data.messages.length > 0) {
                    for (let i = 0; i < data.messages.length; i++) {
                        const msg = data.messages[i];
                        addMessageToContainer(msg.message, msg.is_admin ? true : false, false);
                    }
                } else {
                    container.innerHTML = '<div style="text-align:center; color:#888;">Send a message to support</div>';
                }
            }
        } catch(e) {
            console.error('Load history error:', e);
        }
    }
    
    // Add message to container
    function addMessageToContainer(message, isAdmin, isNew = true) {
        const container = document.getElementById('chat_messages_container');
        if (!container) return;
        
        // Remove empty placeholder if exists
        if (container.children.length === 1 && container.children[0].innerText === 'Send a message to support') {
            container.innerHTML = '';
        }
        
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '10px';
        msgDiv.style.padding = '10px 12px';
        msgDiv.style.borderRadius = '15px';
        msgDiv.style.maxWidth = '85%';
        msgDiv.style.wordWrap = 'break-word';
        
        if (isAdmin) {
            msgDiv.style.background = '#e9ecef';
            msgDiv.style.color = '#333';
            msgDiv.style.marginRight = 'auto';
            msgDiv.textContent = 'Support: ' + message;
        } else {
            msgDiv.style.background = 'linear-gradient(135deg,#e05a2a,#ff8c42)';
            msgDiv.style.color = 'white';
            msgDiv.style.marginLeft = 'auto';
            msgDiv.style.textAlign = 'right';
            msgDiv.textContent = message;
        }
        
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
        
        // Play sound for new message (optional)
        if (isNew && isAdmin) {
            // Just log for now
            console.log('New message from admin:', message);
        }
    }
    
    // Connect to socket.io for real-time messages
    function connectSocket() {
        if (socket && socket.connected) return;
        
        socket = io(API_URL, {
            transports: ['websocket', 'polling']
        });
        
        socket.on('connect', function() {
            console.log('Chat socket connected');
            isConnected = true;
            socket.emit('user-join', getUserId());
        });
        
        socket.on('disconnect', function() {
            console.log('Chat socket disconnected');
            isConnected = false;
            setTimeout(connectSocket, 5000);
        });
        
        socket.on('new-message', function(data) {
            console.log('New message received:', data);
            if (data.isAdmin) {
                addMessageToContainer(data.message, true, true);
                // Also save to localStorage for chat history
                saveMessageToLocal(data.message, true);
            }
        });
    }
    
    // Save message to localStorage for quick access
    function saveMessageToLocal(message, isAdmin) {
        let messages = JSON.parse(localStorage.getItem('chat_messages_' + getUserId()) || '[]');
        messages.push({ message: message, isAdmin: isAdmin, time: Date.now() });
        if (messages.length > 50) messages.shift();
        localStorage.setItem('chat_messages_' + getUserId(), JSON.stringify(messages));
    }
    
    // Send message function
    async function sendMessage() {
        const input = document.getElementById('chat_input');
        const message = input.value.trim();
        if (!message) return;
        
        // Add to chat window
        addMessageToContainer(message, false, true);
        
        // Save to server
        await saveMessage(message);
        
        // Send via socket if connected
        if (socket && isConnected) {
            socket.emit('customer-message', {
                userId: getUserId(),
                userName: getUserName(),
                message: message
            });
        }
        
        input.value = '';
    }
    
    // Check if widget already exists
    if (document.getElementById('custom_chat_widget')) {
        console.log('Widget already exists');
        return;
    }
    
    // Create widget container
    var widget = document.createElement('div');
    widget.id = 'custom_chat_widget';
    widget.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999;';
    
    // Chat button
    var button = document.createElement('div');
    button.id = 'chat_toggle_btn';
    button.style.cssText = 'width:60px; height:60px; background:linear-gradient(135deg,#e05a2a,#ff8c42); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 15px rgba(224,90,42,0.3);';
    button.innerHTML = '<span style="font-size:28px; color:white;">💬</span>';
    
    // Chat window
    var chatWindow = document.createElement('div');
    chatWindow.id = 'chat_window';
    chatWindow.style.cssText = 'display:none; position:absolute; bottom:80px; right:0; width:350px; height:450px; background:white; border-radius:16px; box-shadow:0 10px 40px rgba(0,0,0,0.2); flex-direction:column; overflow:hidden;';
    
    chatWindow.innerHTML = `
        <div style="background:linear-gradient(135deg,#e05a2a,#ff8c42); color:white; padding:15px; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:16px;">Support Team</h3>
            <button id="chat_close_btn" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">×</button>
        </div>
        <div id="chat_messages_container" style="flex:1; padding:15px; overflow-y:auto; background:#f8f9fa;">
            <div style="text-align:center; color:#888;">Send a message to support</div>
        </div>
        <div style="display:flex; padding:10px; border-top:1px solid #dee2e6; background:white;">
            <input type="text" id="chat_input" placeholder="Type your message..." style="flex:1; padding:10px; border:1px solid #dee2e6; border-radius:25px; outline:none;">
            <button id="chat_send_btn" style="margin-left:10px; padding:10px 20px; background:linear-gradient(135deg,#e05a2a,#ff8c42); color:white; border:none; border-radius:25px; cursor:pointer;">Send</button>
        </div>
        <div style="padding:5px; text-align:center; font-size:10px; color:#888; border-top:1px solid #eee;">
            Online
        </div>
    `;
    
    widget.appendChild(button);
    widget.appendChild(chatWindow);
    document.body.appendChild(widget);
    
    // Dark mode styles
    var style = document.createElement('style');
    style.textContent = `
        body.dark #chat_window {
            background: #1e293b;
        }
        body.dark #chat_messages_container {
            background: #0f172a;
        }
        body.dark #chat_input {
            background: #334155;
            border-color: #475569;
            color: white;
        }
        body.dark #chat_messages_container div:not([style*="background:linear-gradient"]) {
            background: #334155 !important;
            color: #e2e8f0 !important;
        }
    `;
    document.head.appendChild(style);
    
    // Event listeners
    document.getElementById('chat_toggle_btn').onclick = function() {
        document.getElementById('chat_window').style.display = 'flex';
        document.getElementById('chat_toggle_btn').style.display = 'none';
        connectSocket();
        loadChatHistory();
    };
    
    document.getElementById('chat_close_btn').onclick = function() {
        document.getElementById('chat_window').style.display = 'none';
        document.getElementById('chat_toggle_btn').style.display = 'flex';
    };
    
    document.getElementById('chat_send_btn').onclick = sendMessage;
    document.getElementById('chat_input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    
    console.log('Chat widget created successfully');
})();