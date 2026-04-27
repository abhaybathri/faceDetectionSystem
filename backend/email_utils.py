"""
Email utility — sends OTP emails via Gmail SMTP.
Configure SMTP_EMAIL and SMTP_PASSWORD in environment variables.

For Gmail: enable "App Passwords" in your Google account
  (Google Account → Security → 2-Step Verification → App passwords)
  Set SMTP_EMAIL=youremail@gmail.com
  Set SMTP_PASSWORD=your_app_password
"""

import smtplib, os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST  = os.environ.get("SMTP_HOST",     "smtp.gmail.com")
SMTP_PORT  = int(os.environ.get("SMTP_PORT", "587"))
SMTP_EMAIL = os.environ.get("SMTP_EMAIL",    "fakeabhay7728bahtri@gmail.com")
SMTP_PASS  = os.environ.get("SMTP_PASSWORD", "mcpoqqudejuudwkp")


def _send(to_email: str, subject: str, html_body: str) -> bool:
    """Send an email. Returns True on success, False on failure."""
    if not SMTP_EMAIL or not SMTP_PASS:
        # Dev mode — extract OTP from HTML and print clearly
        import re
        otp_match = re.search(r'letter-spacing:10px[^>]*>(\d{6})<', html_body)
        otp_val   = otp_match.group(1) if otp_match else "check HTML above"
        print("\n" + "="*55)
        print(f"  [DEV MODE — EMAIL NOT SENT]")
        print(f"  To      : {to_email}")
        print(f"  Subject : {subject}")
        print(f"  OTP     : {otp_val}")
        print("="*55)
        print("  To enable real emails, set SMTP_EMAIL and SMTP_PASSWORD")
        print("  See start.bat for instructions.\n")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"FaceAttend <{SMTP_EMAIL}>"
        msg["To"]      = to_email
        # Plain text fallback
        import re
        plain = re.sub(r'<[^>]+>', '', html_body).strip()
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_EMAIL, SMTP_PASS)
            server.sendmail(SMTP_EMAIL, [to_email], msg.as_string())
        print(f"[EMAIL] Sent to {to_email} — {subject}")
        return True
    except smtplib.SMTPAuthenticationError:
        print("[EMAIL ERROR] Authentication failed.")
        print("  → Make sure you are using a Gmail App Password, NOT your regular Gmail password.")
        print("  → Get one at: https://myaccount.google.com/apppasswords")
        return False
    except smtplib.SMTPRecipientsRefused:
        print(f"[EMAIL ERROR] Recipient refused: {to_email}")
        return False
    except Exception as e:
        print(f"[EMAIL ERROR] {type(e).__name__}: {e}")
        return False


def send_otp_email(to_email: str, otp: str, purpose: str) -> bool:
    """Send OTP email for verification or password reset."""
    if purpose == "verify_teacher":
        subject = "FaceAttend — Verify Teacher Email"
        action  = "verify your email address"
    elif purpose == "verify_student":
        subject = "FaceAttend — Verify Student Email"
        action  = "verify your email address"
    elif purpose == "reset_password":
        subject = "FaceAttend — Password Reset OTP"
        action  = "reset your password"
    else:
        subject = "FaceAttend — OTP Verification"
        action  = "complete your action"

    html = f"""
    <div style="font-family:Segoe UI,sans-serif;max-width:480px;margin:0 auto;
                background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#4f46e5;padding:28px 32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:1.4rem">FaceAttend</h1>
        <p style="color:#c7d2fe;margin:6px 0 0;font-size:0.9rem">College Attendance System</p>
      </div>
      <div style="padding:32px">
        <p style="color:#1e293b;font-size:1rem;margin:0 0 16px">
          Use the OTP below to <strong>{action}</strong>:
        </p>
        <div style="background:#4f46e5;color:#fff;font-size:2.2rem;font-weight:700;
                    letter-spacing:10px;text-align:center;padding:20px;border-radius:10px;
                    margin:0 0 20px">
          {otp}
        </div>
        <p style="color:#64748b;font-size:0.85rem;margin:0">
          This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.
        </p>
      </div>
      <div style="background:#f1f5f9;padding:16px 32px;text-align:center">
        <p style="color:#94a3b8;font-size:0.78rem;margin:0">
          If you did not request this, please ignore this email.
        </p>
      </div>
    </div>
    """
    return _send(to_email, subject, html)


def send_teacher_credentials(to_email: str, name: str, temp_password: str) -> bool:
    """Send login credentials to a newly created teacher."""
    html = f"""
    <div style="font-family:Segoe UI,sans-serif;max-width:480px;margin:0 auto;
                background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#4f46e5;padding:28px 32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:1.4rem">FaceAttend</h1>
        <p style="color:#c7d2fe;margin:6px 0 0;font-size:0.9rem">College Attendance System</p>
      </div>
      <div style="padding:32px">
        <p style="color:#1e293b;font-size:1rem;margin:0 0 16px">
          Hello <strong>{name}</strong>, your teacher account has been created.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr>
            <td style="padding:10px;background:#f1f5f9;border-radius:6px 0 0 6px;
                       color:#64748b;font-size:0.85rem;width:40%">Email</td>
            <td style="padding:10px;background:#f1f5f9;border-radius:0 6px 6px 0;
                       color:#1e293b;font-weight:600;font-size:0.9rem">{to_email}</td>
          </tr>
          <tr><td colspan="2" style="height:6px"></td></tr>
          <tr>
            <td style="padding:10px;background:#f1f5f9;border-radius:6px 0 0 6px;
                       color:#64748b;font-size:0.85rem">Temp Password</td>
            <td style="padding:10px;background:#f1f5f9;border-radius:0 6px 6px 0;
                       color:#1e293b;font-weight:600;font-size:0.9rem">{temp_password}</td>
          </tr>
        </table>
        <p style="color:#ef4444;font-size:0.85rem;margin:0">
          Please change your password after first login using the Reset Password option.
        </p>
      </div>
    </div>
    """
    return _send(to_email, "FaceAttend — Your Teacher Account Credentials", html)
