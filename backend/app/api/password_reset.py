"""
Password Reset via OTP — Gmail SMTP.

Flow:
  POST /auth/forgot-password   { email }
    → generates a 6-digit OTP, stores bcrypt hash in DB (15-min TTL)
    → sends OTP to user's email via Gmail SMTP

  POST /auth/reset-password    { email, otp, new_password }
    → verifies OTP, updates password hash, marks OTP used
"""

import logging
import os
import secrets
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import hash_password, verify_password
from app.models.password_history import PasswordHistory
from app.models.password_reset import PasswordResetOTP
from app.models.user import User

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Password Reset"])

# ── SMTP config from .env ──────────────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

# ── Schemas ────────────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pwd_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_otp() -> str:
    return str(secrets.randbelow(900000) + 100000)  # 100000–999999


def _invalidate_old_otps(db: Session, user_id: int) -> None:
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.user_id == user_id,
        PasswordResetOTP.used == False,
    ).update({"used": True})


def _send_otp_email(to_email: str, user_name: str, otp: str) -> None:
    """Send OTP email via Gmail SMTP."""

    subject = "Your FrauDex Password Reset Code"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f5f6fb;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0"
              style="background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

              <!-- header -->
              <tr>
                <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                    🛡️ FrauDex
                  </h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                    AI-Powered Invoice Fraud Detection
                  </p>
                </td>
              </tr>

              <!-- body -->
              <tr>
                <td style="padding:36px 40px;">
                  <p style="margin:0 0 8px;font-size:15px;color:#0f1117;">
                    Hi <strong>{user_name}</strong>,
                  </p>
                  <p style="margin:0 0 24px;font-size:14px;color:#4b5468;line-height:1.6;">
                    We received a request to reset your FrauDex account password.
                    Use the code below — it expires in <strong>15 minutes</strong>.
                  </p>

                  <!-- OTP box -->
                  <div style="background:#f1f3f9;border:1px solid #e2e6f0;border-radius:12px;
                              padding:24px;text-align:center;margin-bottom:24px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;
                              letter-spacing:0.15em;color:#8b92a5;text-transform:uppercase;">
                      Your One-Time Password
                    </p>
                    <p style="margin:0;font-size:40px;font-weight:800;
                              letter-spacing:0.4em;color:#4f46e5;">
                      {otp}
                    </p>
                  </div>

                  <p style="margin:0 0 8px;font-size:13px;color:#8b92a5;line-height:1.6;">
                    If you did not request a password reset, please ignore this email.
                    Your account remains secure.
                  </p>
                </td>
              </tr>

              <!-- footer -->
              <tr>
                <td style="background:#f8f9fc;padding:20px 40px;border-top:1px solid #e2e6f0;
                           text-align:center;">
                  <p style="margin:0;font-size:11px;color:#8b92a5;">
                    © 2026 FrauDex · Evidence-first decisions
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    text_body = f"Your FrauDex password reset OTP is: {otp}\nValid for 15 minutes."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"FrauDex <{SMTP_FROM}>"
    msg["To"]      = to_email

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())

    logger.info(f"OTP email sent to {to_email}")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Always returns 200 to prevent email enumeration."""
    user = db.query(User).filter(User.email == body.email).first()

    if user:
        otp_plain = _generate_otp()

        _invalidate_old_otps(db, user.id)

        record = PasswordResetOTP(
            user_id    = user.id,
            otp_hash   = hash_password(otp_plain),
            expires_at = PasswordResetOTP.expiry(),
        )
        db.add(record)
        db.commit()

        try:
            _send_otp_email(user.email, user.name, otp_plain)
            logger.info(f"Password reset OTP sent to {user.email}")
        except Exception as e:
            # don't fail the request if email fails — log and continue
            logger.error(f"Failed to send OTP email to {user.email}: {e}")
            print(f"\n[EMAIL FAILED] OTP for {user.email}: {otp_plain}\nError: {e}\n")

    return {"message": "If that email is registered, you will receive a reset code shortly."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP or email.")

    now = datetime.now(timezone.utc)
    record = (
        db.query(PasswordResetOTP)
        .filter(
            PasswordResetOTP.user_id    == user.id,
            PasswordResetOTP.used       == False,
            PasswordResetOTP.expires_at >  now,
        )
        .order_by(PasswordResetOTP.created_at.desc())
        .first()
    )

    if not record or not verify_password(body.otp, record.otp_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP.")

    # ── Check last 2 passwords ─────────────────────────────────────────────
    last_2 = (
        db.query(PasswordHistory)
        .filter(PasswordHistory.user_id == user.id)
        .order_by(PasswordHistory.created_at.desc())
        .limit(2)
        .all()
    )
    for old in last_2:
        if verify_password(body.new_password, old.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot reuse your last 2 passwords. Please choose a different password.",
            )

    # ── Save current password to history before overwriting ───────────────
    db.add(PasswordHistory(user_id=user.id, password_hash=user.password_hash))

    # ── Update password + mark OTP used ───────────────────────────────────
    user.password_hash = hash_password(body.new_password)
    record.used = True
    db.commit()

    return {"message": "Password updated successfully. You can now log in."}
