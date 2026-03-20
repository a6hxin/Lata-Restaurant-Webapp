// ─────────────────────────────────────────────
//  utils/sendOTP.js  –  Email OTP Sender
// ─────────────────────────────────────────────
const nodemailer = require('nodemailer');

/** Generate a secure 6-digit OTP */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/** Create nodemailer transporter from env */
const createTransporter = () =>
  nodemailer.createTransporter({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

/**
 * Send OTP email to user
 * @param {string} email  - Recipient email
 * @param {string} otp    - 6-digit OTP
 * @param {string} name   - User's first name
 */
const sendOTPEmail = async (email, otp, name = 'there') => {
  const transporter = createTransporter();

  const mailOptions = {
    from:    `"Lata Family Restaurant 🪔" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `${otp} – Your OTP for Lata Family Restaurant`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;">
        <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(123,45,0,0.1);">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#7B2D00,#4A1800);padding:28px 32px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🪔</div>
            <h1 style="margin:0;font-size:20px;color:#fff;font-weight:600;letter-spacing:0.5px;">Lata Family Restaurant</h1>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:1.5px;text-transform:uppercase;">Email Verification</p>
          </div>

          <!-- Body -->
          <div style="padding:32px;">
            <p style="font-size:15px;color:#1A0A00;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
            <p style="font-size:14px;color:#7A5C44;line-height:1.7;margin:0 0 24px;">
              Your One-Time Password (OTP) for verifying your account is:
            </p>

            <!-- OTP Box -->
            <div style="background:#FDF6EE;border:1.5px solid #E2C9A8;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
              <div style="font-size:40px;font-weight:700;color:#E8821A;letter-spacing:10px;font-family:Georgia,serif;">
                ${otp}
              </div>
            </div>

            <!-- Warning -->
            <div style="background:#FFF8E1;border-left:3px solid #C8860A;border-radius:4px;padding:12px 16px;margin-bottom:20px;">
              <p style="margin:0;font-size:13px;color:#7B5A00;">
                ⏱ This OTP is valid for <strong>10 minutes</strong> only.<br/>
                🔒 Never share this OTP with anyone, including our staff.
              </p>
            </div>

            <p style="font-size:13px;color:#7A5C44;line-height:1.6;margin:0;">
              If you did not request this OTP, please ignore this email or
              <a href="mailto:support@latafamilyrestaurant.in" style="color:#E8821A;">contact us</a>.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#FDF6EE;padding:16px 32px;border-top:1px solid #E2C9A8;text-align:center;">
            <p style="margin:0;font-size:11px;color:#7A5C44;opacity:0.7;">
              © 2025 Lata Family Restaurant · 123 Civil Lines, Nagpur – 440001
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send order confirmation email
 * @param {string} email
 * @param {object} order - order details
 */
const sendOrderConfirmEmail = async (email, order) => {
  const transporter = createTransporter();

  const itemsHTML = order.items.map(i =>
    `<tr>
      <td style="padding:8px 0;font-size:13px;color:#1A0A00;">${i.name} × ${i.quantity}</td>
      <td style="padding:8px 0;font-size:13px;color:#E8821A;text-align:right;font-weight:500;">₹${i.price * i.quantity}</td>
    </tr>`
  ).join('');

  await transporter.sendMail({
    from:    `"Lata Family Restaurant 🪔" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `Order Confirmed! ${order.orderId} – Lata Family Restaurant`,
    html: `
      <div style="max-width:480px;margin:32px auto;font-family:Arial,sans-serif;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#7B2D00,#4A1800);padding:24px 32px;text-align:center;">
          <div style="font-size:28px;">🎉</div>
          <h1 style="margin:8px 0 0;font-size:18px;color:#fff;">Order Confirmed!</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-size:14px;color:#7A5C44;">Order ID: <strong style="color:#E8821A;">${order.orderId}</strong></p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            ${itemsHTML}
            <tr style="border-top:1px solid #E2C9A8;">
              <td style="padding:10px 0;font-size:14px;font-weight:600;color:#1A0A00;">Total</td>
              <td style="padding:10px 0;font-size:14px;font-weight:700;color:#E8821A;text-align:right;">₹${order.total}</td>
            </tr>
          </table>
          <p style="font-size:13px;color:#7A5C44;">Estimated time: <strong>${order.estimatedTime}</strong></p>
          <p style="font-size:13px;color:#7A5C44;">Thank you for choosing Lata Family Restaurant! 🙏</p>
        </div>
      </div>
    `,
  });
};

module.exports = { generateOTP, sendOTPEmail, sendOrderConfirmEmail };
