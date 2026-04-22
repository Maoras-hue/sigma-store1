// email.js - Email notification system
const nodemailer = require('nodemailer');

// Email configuration (add these to your .env file)
const EMAIL_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for 587
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@sigma-store.com'
};

// Create transporter
let transporter = null;

function initEmail() {
    if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
        console.log('⚠️ Email not configured. Add SMTP_USER and SMTP_PASS to .env');
        return false;
    }
    
    transporter = nodemailer.createTransport({
        host: EMAIL_CONFIG.host,
        port: EMAIL_CONFIG.port,
        secure: EMAIL_CONFIG.secure,
        auth: {
            user: EMAIL_CONFIG.user,
            pass: EMAIL_CONFIG.pass
        }
    });
    
    console.log('✅ Email system initialized');
    return true;
}

// Send order confirmation email to customer
async function sendOrderConfirmation(order, user, cartItems) {
    if (!transporter) return false;
    
    const itemsHtml = cartItems.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">x${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">$${item.price}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">$${item.price * item.quantity}</td>
        </tr>
    `).join('');
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #111; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f5f5f5; padding: 10px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #eee; }
                .total { font-size: 1.2em; font-weight: bold; text-align: right; margin-top: 15px; }
                .btn { display: inline-block; background: #e05a2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>σ Sigma Store</h1>
                    <p>Order Confirmation</p>
                </div>
                <div class="content">
                    <p>Dear <strong>${user.name || user.email}</strong>,</p>
                    <p>Thank you for your order! We've received your order and will process it soon.</p>
                    
                    <div class="order-details">
                        <h3>Order Details</h3>
                        <p><strong>Order ID:</strong> ${order.order_id}</p>
                        <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                        <p><strong>Payment Method:</strong> ${order.payment_method || 'WhatsApp'}</p>
                        
                        <h3>Items</h3>
                        <table>
                            <thead>
                                <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                        
                        <div class="total">
                            <p>Subtotal: $${order.subtotal}</p>
                            <p>Shipping: ${order.shipping === 0 ? 'Free' : '$' + order.shipping}</p>
                            <p style="font-size: 1.3em;">Total: <strong>$${order.total}</strong></p>
                        </div>
                    </div>
                    
                    <p>You can track your order here:</p>
                    <p><a href="https://sigma-store1.vercel.app/track.html?order=${order.order_id}" class="btn">Track Order</a></p>
                    
                    <p>If you have any questions, reply to this email or contact us on WhatsApp.</p>
                </div>
                <div class="footer">
                    <p>Sigma Studio — Mardan, Pakistan</p>
                    <p>Email: sigma@example.com | WhatsApp: +92 300 1234567</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: EMAIL_CONFIG.from,
        to: user.email,
        subject: `Order Confirmation #${order.order_id} - Sigma Store`,
        html: html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Order confirmation sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

// Send order status update email
async function sendOrderStatusUpdate(order, user, newStatus) {
    if (!transporter) return false;
    
    const statusMessages = {
        pending: 'Your order has been received and is pending review.',
        processing: 'Your order is being processed.',
        shipped: 'Your order has been shipped!',
        delivered: 'Your order has been delivered. Enjoy!'
    };
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #111; color: white; padding: 20px; text-align: center; }
                .status { background: #4caf50; color: white; padding: 10px; text-align: center; font-size: 1.2em; }
                .btn { display: inline-block; background: #e05a2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>σ Sigma Store</h1>
                </div>
                <div class="status">
                    Order Status: ${newStatus.toUpperCase()}
                </div>
                <div class="content">
                    <p>Dear <strong>${user.name || user.email}</strong>,</p>
                    <p>${statusMessages[newStatus] || `Your order status has been updated to ${newStatus}.`}</p>
                    <p><strong>Order ID:</strong> ${order.order_id}</p>
                    <a href="https://sigma-store1.vercel.app/track.html?order=${order.order_id}" class="btn">Track Your Order</a>
                </div>
                <div class="footer">
                    <p>Sigma Studio — Mardan, Pakistan</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: EMAIL_CONFIG.from,
        to: user.email,
        subject: `Order Status Update #${order.order_id} - ${newStatus}`,
        html: html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Status update sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

// Send welcome email on signup
async function sendWelcomeEmail(user) {
    if (!transporter) return false;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #111; color: white; padding: 20px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Sigma Store!</h1>
                </div>
                <div class="content">
                    <p>Dear <strong>${user.name}</strong>,</p>
                    <p>Welcome to Sigma Store! We're excited to have you.</p>
                    <p>You can now:</p>
                    <ul>
                        <li>Browse our products</li>
                        <li>Add items to wishlist</li>
                        <li>Track your orders</li>
                        <li>Apply as a seller</li>
                    </ul>
                    <p>Start shopping: <a href="https://sigma-store1.vercel.app">sigma-store1.vercel.app</a></p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: EMAIL_CONFIG.from,
        to: user.email,
        subject: 'Welcome to Sigma Store!',
        html: html
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Welcome email sent to ${user.email}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

module.exports = { initEmail, sendOrderConfirmation, sendOrderStatusUpdate, sendWelcomeEmail };