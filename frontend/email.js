// email.js - Email configuration
const nodemailer = require('nodemailer');

// Configure email transporter
// For Gmail (you'll need to enable "Less secure apps" or use App Password)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',  // Replace with your email
        pass: 'your-app-password'       // Replace with your app password
    }
});

// Send Welcome Email
async function sendWelcomeEmail(userEmail, userName) {
    const mailOptions = {
        from: '"Sigma Store" <your-email@gmail.com>',
        to: userEmail,
        subject: 'Welcome to Sigma Store! 🎉',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e05a2a;">Welcome to Sigma Store!</h2>
                <p>Hi ${userName},</p>
                <p>Thank you for creating an account with Sigma Store.</p>
                <p>You can now:</p>
                <ul>
                    <li>✓ Save items to your wishlist</li>
                    <li>✓ Track your orders</li>
                    <li>✓ Get exclusive deals</li>
                </ul>
                <a href="http://127.0.0.1:5500/index.html" style="background: #e05a2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Start Shopping →</a>
                <p style="margin-top: 20px; color: #666;">Happy Shopping!<br>Sigma Team</p>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log('Welcome email sent to:', userEmail);
    } catch (error) {
        console.error('Email error:', error);
    }
}

// Send Order Confirmation Email
async function sendOrderConfirmationEmail(userEmail, userName, orderId, items, total) {
    // Format items list
    let itemsHtml = '';
    items.forEach(item => {
        itemsHtml += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">x${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${item.price}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${item.price * item.quantity}</td>
            </tr>
        `;
    });
    
    const mailOptions = {
        from: '"Sigma Store" <your-email@gmail.com>',
        to: userEmail,
        subject: `Order Confirmation #${orderId}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e05a2a;">Order Confirmation</h2>
                <p>Hi ${userName},</p>
                <p>Thank you for your order! Here are your order details:</p>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <thead>
                        <tr><th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Qty</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Price</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div style="text-align: right; margin-top: 15px;">
                    <p><strong>Total: $${total}</strong></p>
                </div>
                
                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #4caf50;">
                    <p><strong>📞 Payment Instructions:</strong></p>
                    <p>Please send payment to:</p>
                    <p>• Easypaisa: 03XX-XXXXXXX</p>
                    <p>• JazzCash: 03XX-XXXXXXX</p>
                    <p>After payment, we'll process your order and send download link.</p>
                </div>
                
                <a href="http://127.0.0.1:5500/track.html?order=${orderId}" style="background: #e05a2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Your Order →</a>
                
                <p style="margin-top: 20px; color: #666;">Thank you for shopping with Sigma!</p>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log('Order confirmation sent to:', userEmail);
    } catch (error) {
        console.error('Email error:', error);
    }
}

// Send Order Status Update Email
async function sendStatusUpdateEmail(userEmail, userName, orderId, newStatus) {
    const statusMessages = {
        'pending': 'We have received your order and are waiting for payment confirmation.',
        'processing': 'Payment confirmed! We are preparing your order.',
        'shipped': 'Your order has been shipped! Download link sent to your email.',
        'delivered': 'Your order is complete. Thank you for shopping with us!'
    };
    
    const statusColors = {
        'pending': '#ff9800',
        'processing': '#2196f3',
        'shipped': '#9c27b0',
        'delivered': '#4caf50'
    };
    
    const mailOptions = {
        from: '"Sigma Store" <your-email@gmail.com>',
        to: userEmail,
        subject: `Order #${orderId} Status Update`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e05a2a;">Order Status Update</h2>
                <p>Hi ${userName},</p>
                
                <div style="background: ${statusColors[newStatus]}; color: white; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="margin: 0;">${newStatus.toUpperCase()}</h3>
                </div>
                
                <p style="margin: 15px 0;">${statusMessages[newStatus]}</p>
                
                ${newStatus === 'shipped' ? `
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>📥 Download Your Product:</strong></p>
                    <a href="#" style="background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Download Now</a>
                </div>
                ` : ''}
                
                <a href="http://127.0.0.1:5500/track.html?order=${orderId}" style="background: #e05a2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Your Order →</a>
                
                <p style="margin-top: 20px; color: #666;">Thank you for shopping with Sigma!</p>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log('Status update email sent to:', userEmail);
    } catch (error) {
        console.error('Email error:', error);
    }
}

module.exports = { sendWelcomeEmail, sendOrderConfirmationEmail, sendStatusUpdateEmail };