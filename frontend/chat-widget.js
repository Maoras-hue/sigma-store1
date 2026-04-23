// SIMPLE CHAT WIDGET - WORKING VERSION
(function() {
    console.log('Chat widget loading...');
    
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
    `;
    
    widget.appendChild(button);
    widget.appendChild(chatWindow);
    document.body.appendChild(widget);
    
    // Add dark mode styles
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
    `;
    document.head.appendChild(style);
    
    // Event listeners
    document.getElementById('chat_toggle_btn').onclick = function() {
        document.getElementById('chat_window').style.display = 'flex';
        document.getElementById('chat_toggle_btn').style.display = 'none';
    };
    
    document.getElementById('chat_close_btn').onclick = function() {
        document.getElementById('chat_window').style.display = 'none';
        document.getElementById('chat_toggle_btn').style.display = 'flex';
    };
    
    document.getElementById('chat_send_btn').onclick = function() {
        var input = document.getElementById('chat_input');
        var message = input.value.trim();
        if (message) {
            alert('Message sent: ' + message + '\n\nAdmin will reply at: https://sigma-store-api.onrender.com/admin/chat.html');
            input.value = '';
        }
    };
    
    console.log('Chat widget created successfully');
})();