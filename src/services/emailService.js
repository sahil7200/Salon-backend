const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_SERVICE,
  } = process.env;

  if (EMAIL_SERVICE && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      service: EMAIL_SERVICE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  } else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587', 10),
      secure: SMTP_SECURE === 'true' || SMTP_PORT === '465',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
};

/**
 * Format role name for display
 */
const formatRole = (role) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Administrator';
    case 'SALON_OWNER':
      return 'Salon Owner';
    case 'RECEPTIONIST':
      return 'Receptionist / Staff';
    default:
      return role || 'User';
  }
};

/**
 * Send an email with user login credentials
 */
const sendUserCredentialsEmail = async ({ name, email, password, role, salonName, loginUrl }) => {
  const appUrl = loginUrl || process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || '"Salon CRM" <no-reply@saloncrm.com>';
  const formattedRole = formatRole(role);

  const subject = `Welcome to Salon CRM - Your Account Login Credentials`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Account Credentials</title>
  <style>
    body {
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f6f9;
      color: #333333;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e9ecef;
    }
    .header {
      background: linear-gradient(135deg, #023c69 0%, #0d5c9d 100%);
      color: #ffffff;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .credentials-box {
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .cred-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .cred-item:last-child {
      border-bottom: none;
    }
    .cred-label {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }
    .cred-value {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      font-family: 'Consolas', 'Courier New', monospace;
      background: #e2e8f0;
      padding: 4px 10px;
      border-radius: 4px;
    }
    .role-badge {
      display: inline-block;
      background: #023c69;
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 24px;
    }
    .cta-button {
      display: inline-block;
      background: #023c69;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      transition: background 0.2s;
    }
    .cta-button:hover {
      background: #012847;
    }
    .security-notice {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 4px;
      font-size: 13px;
      color: #92400e;
      margin-top: 24px;
      line-height: 1.5;
    }
    .footer {
      background: #f8fafc;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Salon CRM</h1>
      <p>Welcome aboard! Your account is ready.</p>
    </div>
    <div class="content">
      <div class="greeting">
        Hello <strong>${name}</strong>,<br><br>
        Your account has been created for <strong>Salon CRM</strong>${salonName ? ` for <strong>${salonName}</strong>` : ''}. Below are your login credentials to access the platform:
      </div>

      <div class="credentials-box">
        <div class="cred-item">
          <span class="cred-label">Assigned Role</span>
          <span class="role-badge">${formattedRole}</span>
        </div>
        ${salonName ? `
        <div class="cred-item">
          <span class="cred-label">Salon</span>
          <span style="font-weight: 600; color: #1e293b;">${salonName}</span>
        </div>` : ''}
        <div class="cred-item">
          <span class="cred-label">Login Email</span>
          <span class="cred-value">${email}</span>
        </div>
        <div class="cred-item">
          <span class="cred-label">Password</span>
          <span class="cred-value">${password}</span>
        </div>
      </div>

      <div class="cta-container">
        <a href="${appUrl}" class="cta-button" target="_blank">Login to Salon CRM</a>
      </div>

      <div class="security-notice">
        <strong>🔒 Security Notice:</strong> Please change your password after logging in for the first time and never share your credentials with anyone.
      </div>
    </div>
    <div class="footer">
      This is an automated message from Salon CRM. If you did not request or expect this account, please contact your administrator.
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
Welcome to Salon CRM!

Hello ${name},

Your account has been created${salonName ? ` for ${salonName}` : ''}.

Role: ${formattedRole}
Login Email: ${email}
Password: ${password}
Login URL: ${appUrl}

Security Notice: Please change your password after logging in for the first time.
  `;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    console.log('\n================== [EMAIL DISPATCHED (DEV CONSOLE)] ==================');
    console.log(`To: ${name} <${email}>`);
    console.log(`Subject: ${subject}`);
    console.log(`Role: ${formattedRole}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Login URL: ${appUrl}`);
    console.log('Notice: Configure SMTP_HOST, SMTP_USER, SMTP_PASS in .env to send real emails.');
    console.log('=======================================================================\n');
    return { success: true, mode: 'console' };
  }

  try {
    const info = await mailTransporter.sendMail({
      from: fromEmail,
      to: `"${name}" <${email}>`,
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[EmailService] Credentials email sent to ${email}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send email to ${email}:`, error.message);
    // Don't throw so user creation does not fail if mail delivery has a network issue
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendUserCredentialsEmail,
};
