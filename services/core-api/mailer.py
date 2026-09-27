import asyncio
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "AI-SDLC <no-reply@localhost>")
# starttls (port 587), ssl (port 465) or none (local test servers only)
SMTP_SECURITY = os.getenv("SMTP_SECURITY", "starttls").lower()


def _send_sync(message: EmailMessage) -> None:
    if SMTP_SECURITY == "ssl":
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ssl.create_default_context(), timeout=20)
    else:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)
    with server:
        if SMTP_SECURITY == "starttls":
            server.starttls(context=ssl.create_default_context())
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(message)


async def send_email(to: str, subject: str, body: str) -> None:
    """Sends a plain-text email. Without SMTP configured, the email is written to the log instead,
    so verification and reset links can be used during local development."""
    if not SMTP_HOST:
        logger.warning("SMTP not configured, email not sent. To: %s | Subject: %s\n%s", to, subject, body)
        return
    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    # smtplib blocks, so keep it off the event loop.
    await asyncio.to_thread(_send_sync, message)
