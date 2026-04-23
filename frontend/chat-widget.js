// ============================================
// SIGMA STORE - CUSTOM CHAT WIDGET
// ============================================

(function() {
    const CHAT_API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';
    let socket = null;
    let isConnected = false;
    
    function getUserId() {
        let userId = localStorage.getItem('chat_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('chat_user_id', userId);
        }
        return userId;
    }
    
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
    
    function connectSocket() {
        socket = io(CHAT_API_URL, {
            transports: ['websocket', 'polling']
        });
        
        socket.on('connect', function() {
            console.log('Chat connected');
            isConnected = true;
            socket.emit('user-join', getUserId());
        });
        
        socket.on('disconnect', function() {
            console.log('Chat disconnected');
            isConnected = false;
            setTimeout(connectSocket, 5000);
        });
        
        socket.on('new-message', function(data) {
            if (data.isAdmin) {
                addMessageToChat(data.message, true);
            }
        });
    }
    
    function addMessageToChat(message, isAdmin) {
        const container = document.getElementById('chat_messages_container');
        if (!container) return;
        
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
            msgDiv.style.background = 'linear-gradient(135deg, #e05a2a, #ff8c42)';
            msgDiv.style.color = 'white';
            msgDiv.style.marginLeft = 'auto';
            msgDiv.style.textAlign = 'right';
            msgDiv.textContent = message;
        }
        
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }
    
    async function saveMessage(message) {
        try {
            await fetch(CHAT_API_URL + '/api/chat/save', {
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
    
    async function sendMessage() {
        const input = document.getElementById('chat_input');
        const message = input.value.trim();
        if (!message) return;
        
        addMessageToChat(message, false);
        await saveMessage(message);
        
        if (socket && isConnected) {
            socket.emit('customer-message', {
                userId: getUserId(),
                userName: getUserName(),
                message: message
            });
        }
        
        input.value = '';
    }
    
    function createChatWidget() {
        const widgetHTML = `
            <div id="custom_chat_widget" style="position:fixed; bottom:20px; right:20px; z-index:9999;">
                <div id="chat_toggle_btn" style="width:60px; height:60px; background:linear-gradient(135deg,#e05a2a,#ff8c42); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 15px rgba(224,90,42,0.3);">
                    <span style="font-size:28px; color:white;">💬</span>
                </div>
                
                <div id="chat_window" style="display:none; position:absolute; bottom:80px; right:0; width:350px; height:450px; background:white; border-radius:16px; box-shadow:0 10px 40px rgba(0,0,0,0.2); flex-direction:column; overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#e05a2a,#ff8c42); color:white; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px;">Support Team</h3>
                        <button id="chat_close_btn" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">×</button>
                    </div>
                    <div id="chat_messages_container" style="flex:1; padding:15px; overflow-y:auto; background:#f8f9fa;"></div>
                    <div style="display:flex; padding:10px; border-top:1px solid #dee2e6; background:white;">
                        <input type="text" id="chat_input" placeholder="Type your message..." style="flex:1; padding:10px; border:1px solid #dee2e6; border-radius:25px; outline:none;">
                        <button id="chat_send_btn" style="margin-left:10px; padding:10px 20px; background:linear-gradient(135deg,#e05a2a,#ff8c42); color:white; border:none; border-radius:25px; cursor:pointer;">Send</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', widgetHTML);
        
        document.getElementById('chat_toggle_btn').onclick = function() {
            document.getElementById('chat_window').style.display = 'flex';
            document.getElementById('chat_toggle_btn').style.display = 'none';
            if (!socket) {
                connectSocket();
            }
        };
        
        document.getElementById('chat_close_btn').onclick = function() {
            document.getElementById('chat_window').style.display = 'none';
            document.getElementById('chat_toggle_btn').style.display = 'flex';
        };
        
        document.getElementById('chat_send_btn').onclick = sendMessage;
        document.getElementById('chat_input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendMessage();
        });
    }
    
    // Add dark mode styles for chat
    const style = document.createElement('style');
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
    `;
    document.head.appendChild(style);
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createChatWidget);
    } else {
        createChatWidget();
    }
})();