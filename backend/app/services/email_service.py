import resend
from app.core.config import settings


class EmailService:
    def __init__(self):
        resend.api_key = settings.RESEND_API_KEY

    def send_invitation_email(
        self,
        to_email: str,
        team_name: str,
        inviter_name: str,
        invitation_token: str,
    ) -> None:
        """Send team invitation email"""

        # Construct invitation URL (frontend base URL + token)
        invitation_url = f"{settings.FRONTEND_URL}/invitations/accept?token={invitation_token}"

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">You've been invited to join {team_name}</h2>
                    <p>{inviter_name} has invited you to join their team on Monitorillo.</p>
                    <p style="margin: 30px 0;">
                        <a href="{invitation_url}"
                           style="background-color: #2563eb; color: white; padding: 12px 24px;
                                  text-decoration: none; border-radius: 6px; display: inline-block;">
                            Accept Invitation
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        This invitation will expire in 48 hours.
                    </p>
                    <p style="color: #666; font-size: 12px; margin-top: 40px;">
                        If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                </div>
            </body>
        </html>
        """

        params = {
            "from": settings.ALERT_EMAIL_FROM,
            "to": [to_email],
            "subject": f"Invitation to join {team_name} on Monitorillo",
            "html": html_content,
        }

        try:
            resend.Emails.send(params)
        except Exception as e:
            # Log error but don't fail the invitation creation
            print(f"Failed to send invitation email: {e}")
