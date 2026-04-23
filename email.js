// ============================================
// SIGMA STORE - EMAIL NOTIFICATION SYSTEM
// ============================================

const nodemailer = require('nodemailer');

let transporter = null;
let isEmailConfigured = false;

// ============================================
// INITIALIZE EMAIL SYSTEM
// ============================================

function initEmail() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || 'noreply@sigma-store.com';
    
    // Check if email credentials are provided
    if (!user || !pass || user === 'your-email@gmail.com') {
        console.log('⚠️ Email not configured. Skipping email notifications.');
        console.log('💡 To enable emails, add SMTP_USER and SMTP_PASS to .env file');
        return false;
    }
    
    try {
        transporter = nodemailer.createTransport({
            host: host || 'smtp.gmail.com',
            port: parseInt(port) || 587,
            secure: port === '465' ? true : false,
            auth: {
                user: user,
                pass: pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        // Verify connection
        transporter.verify((error, success) => {
            if (error) {
                console.log('❌ Email configuration error:', error.message);
                isEmailConfigured = false;
            } else {
                console.log('✅ Email system initialized successfully');
                isEmailConfigured = true;
            }
        });
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize email:', error.message);
        return false;
    }
}

// ============================================
// SEND WELCOME EMAIL
// ============================================

async function sendWelcomeEmail(user) {
    if (!isEmailConfigured || !transporter) return false;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Welcome to Sigma Store</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #e05a2a, #ff8c42); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .btn { display: inline-block; background: #e05a2a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; margin-top: 20px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                h1 { margin: 0; }
                .feature-list { list-style: none; padding: 0; }
                .feature-list li { padding: 8px 0; border-bottom: 1px solid #eee; }
                .feature-list li:before { content: "✓"; color: #4caf50; margin-right: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>σ Sigma Store</h1>
                    <p>Welcome to the family!</p>
                </div>
                <div class="content">
                    <h2>Hello ${user.name || user.email}!</h2>
                    <p>Thank you for creating an account with Sigma Store. We're excited to have you on board!</p>
                    
                    <h3>What you can do now:</h3>
                    <ul class="feature-list">
                        <li>Browse our collection of digital products</li>
                        <li>Save items to your wishlist</li>
                        <li>Write product reviews and help other customers</li>
                        <li>Track your orders in real-time</li>
                        <li>Apply to become a seller and earn money</li>
                    </ul>
                    
                    <div style="text-align: center;">
                        <a href="https://sigma-store1.vercel.app" class="btn">Start Shopping →</a>
                    </div>
                    
                    <p style="margin-top: 20px;">If you have any questions, feel free to contact us on WhatsApp or email.</p>
                </div>
                <div class="footer">
                    <p>Sigma Studio — Mardan, Pakistan</p>
                    <p>WhatsApp: +92 325 9042317 | Email: support@sigma-store.com</p>
                    <p>&copy; 2026 Sigma Store. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@sigma-store.com',
        to: user.email,
        subject: '🎉 Welcome to Sigma Store!',
        html: html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Welcome email sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send welcome email:', error.message);
        return false;
    }
}

// ============================================
// SEND ORDER CONFIRMATION EMAIL
// ============================================

async function sendOrderConfirmation(order, user, items) {
    if (!isEmailConfigured || !transporter) return false;
    
    // Format items table
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">x${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Order Confirmation</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #e05a2a, #ff8c42); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .order-details { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f5f5f5; padding: 10px; text-align: left; }
                td { padding: 10px; border-bottom: 1px solid #eee; }
                .total { font-size: 1.2em; font-weight: bold; text-align: right; margin-top: 15px; }
                .btn { display: inline-block; background: #e05a2a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; margin-top: 20px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                .status { display: inline-block; background: #ff9800; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>σ Sigma Store</h1>
                    <p>Order Confirmation</p>
                </div>
                <div class="content">
                    <h2>Thank you for your order, ${user.name || user.email}!</h2>
                    <p>Your order has been received and is being processed.</p>
                    
                    <div class="order-details">
                        <h3>Order Details</h3>
                        <p><strong>Order ID:</strong> ${order.order_id}</p>
                        <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                        <p><strong>Payment Method:</strong> ${order.payment_method || 'WhatsApp'}</p>
                        <p><strong>Order Status:</strong> <span class="status">${order.status || 'Pending'}</span></p>
                        
                        <h3>Items Ordered</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                        
                        <div class="total">
                            <p>Subtotal: $${order.subtotal || 0}</p>
                            <p>Shipping: ${order.shipping === 0 ? 'Free' : '$' + order.shipping}</p>
                            <p style="font-size: 1.3em;"><strong>Total: $${order.total}</strong></p>
                        </div>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="https://sigma-store1.vercel.app/track.html?order=${order.order_id}" class="btn">Track Your Order →</a>
                    </div>
                    
                    <p style="margin-top: 20px;">For WhatsApp orders, please send payment to complete your order.</p>
                    <p>Payment Methods: JazzCash, Easypaisa, Bank Transfer</p>
                </div>
                <div class="footer">
                    <p>Sigma Studio — Mardan, Pakistan</p>
                    <p>WhatsApp: +92 325 9042317 | Email: support@sigma-store.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@sigma-store.com',
        to: user.email,
        subject: `📦 Order Confirmation #${order.order_id} - Sigma Store`,
        html: html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Order confirmation sent to ${user.email} for order ${order.order_id}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send order confirmation:', error.message);
        return false;
    }
}

// ============================================
// SEND ORDER STATUS UPDATE EMAIL
// ============================================

async function sendOrderStatusUpdate(order, user, newStatus) {
    if (!isEmailConfigured || !transporter) return false;
    
    const statusMessages = {
        'pending': 'Your order has been received and is pending payment confirmation.',
        'processing': 'Payment confirmed! We are preparing your order.',
        'shipped': 'Great news! Your order has been shipped.',
        'delivered': 'Your order has been delivered. Enjoy your purchase!',
        'cancelled': 'Your order has been cancelled.'
    };
    
    const statusColors = {
        'pending': '#ff9800',
        'processing': '#2196f3',
        'shipped': '#9c27b0',
        'delivered': '#4caf50',
        'cancelled': '#e05a2a'
    };
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Order Status Update</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #e05a2a, #ff8c42); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .status-box { background: ${statusColors[newStatus]}; color: white; padding: 15px; text-align: center; border-radius: 10px; margin: 20px 0; }
                .btn { display: inline-block; background: #e05a2a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; margin-top: 20px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>σ Sigma Store</h1>
                    <p>Order Status Update</p>
                </div>
                <div class="content">
                    <h2>Hello ${user.name || user.email}!</h2>
                    
                    <div class="status-box">
                        <h3 style="margin: 0;">Order Status: ${newStatus.toUpperCase()}</h3>
                    </div>
                    
                    <p>${statusMessages[newStatus]}</p>
                    
                    <p><strong>Order ID:</strong> ${order.order_id}</p>
                    
                    <div style="text-align: center;">
                        <a href="https://sigma-store1.vercel.app/track.html?order=${order.order_id}" class="btn">Track Your Order →</a>
                    </div>
                    
                    <p style="margin-top: 20px;">Thank you for shopping with Sigma Store!</p>
                </div>
                <div class="footer">
                    <p>Sigma Studio — Mardan, Pakistan</p>
                    <p>WhatsApp: +92 325 9042317 | Email: support@sigma-store.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@sigma-store.com',
        to: user.email,
        subject: `🔄 Order Status Update #${order.order_id} - ${newStatus.toUpperCase()}`,
        html: html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Status update sent to ${user.email} for order ${order.order_id}: ${newStatus}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send status update:', error.message);
        return false;
    }
}

// ============================================
// SEND PASSWORD RESET EMAIL
// ============================================

async function sendPasswordResetEmail(user, resetToken) {
    if (!isEmailConfigured || !transporter) return false;
    
    const resetLink = `https://sigma-store1.vercel.app/reset-password.html?token=${resetToken}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Password Reset</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #e05a2a, #ff8c42); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .btn { display: inline-block; background: #e05a2a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                .warning { color: #e05a2a; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>σ Sigma Store</h1>
                    <p>Password Reset Request</p>
                </div>
                <div class="content">
                    <h2>Hello ${user.name || user.email}!</h2>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    
                    <div style="text-align: center;">
                        <a href="${resetLink}" class="btn">Reset Password →</a>
                    </div>
                    
                    <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
                    
                    <p class="warning">⚠️ This link will expire in 1 hour.</p>
                </div>
                <div class="footer">
                    <p>Sigma Studio — Mardan, Pakistan</p>
                    <p>WhatsApp: +92 325 9042317 | Email: support@sigma-store.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@sigma-store.com',
        to: user.email,
        subject: '🔐 Password Reset Request - Sigma Store',
        html: html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Password reset email sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send password reset email:', error.message);
        return false;
    }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

module.exports = {
    initEmail,
    sendWelcomeEmail,
    sendOrderConfirmation,
    sendOrderStatusUpdate,
    sendPasswordResetEmail
};