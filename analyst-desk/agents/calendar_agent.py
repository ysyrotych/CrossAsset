"""
Google Calendar Agent — natural language → calendar events.
Handles OAuth setup, event creation, and reading upcoming events.
"""
import json
import logging
import os
import re
from datetime import datetime, timedelta
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_DEEP, TIMEZONE, GOOGLE_CREDENTIALS_JSON, GOOGLE_TOKEN_JSON

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
TOKEN_FILE  = "/app/google_token.json"
CREDS_FILE  = "/app/google_credentials.json"


def _write_creds_files():
    """Write credentials from env to disk if present."""
    if GOOGLE_CREDENTIALS_JSON and not os.path.exists(CREDS_FILE):
        try:
            with open(CREDS_FILE, "w") as f:
                f.write(GOOGLE_CREDENTIALS_JSON)
        except Exception as e:
            log.warning(f"Could not write credentials file: {e}")
    if GOOGLE_TOKEN_JSON and not os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "w") as f:
                f.write(GOOGLE_TOKEN_JSON)
        except Exception as e:
            log.warning(f"Could not write token file: {e}")


def get_calendar_service():
    """Return an authenticated Google Calendar service, or None if not set up."""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build

        _write_creds_files()

        if not os.path.exists(TOKEN_FILE):
            return None

        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_FILE, "w") as f:
                f.write(creds.to_json())
        if not creds or not creds.valid:
            return None

        return build("calendar", "v3", credentials=creds, cache_discovery=False)
    except ImportError:
        log.warning("google-api-python-client not installed")
        return None
    except Exception as e:
        log.warning(f"Calendar auth: {e}")
        return None


def is_calendar_request(text: str) -> bool:
    """Quick check if a message looks like a calendar request."""
    # Must contain an explicit calendar/scheduling keyword (not generic finance words)
    explicit_keywords = [
        "add to calendar", "schedule", "remind me", "set a meeting",
        "book a", "appointment", "calendar", "add event", "set reminder",
        "meeting with", "call with", "lunch with", "dinner with",
        "drinks with", "coffee with", "catch up with",
    ]
    # Time + action pattern: needs both a time reference AND an action word
    time_refs = ["tomorrow", "next week", "on monday", "on tuesday", "on wednesday",
                 "on thursday", "on friday", "on saturday", "on sunday"]
    action_words = ["add", "book", "schedule", "remind", "set", "create", "put"]

    text_lower = text.lower()

    # Explicit calendar phrase — direct match
    if any(k in text_lower for k in explicit_keywords):
        return True

    # Time reference + action word together — e.g. "add tomorrow at 3pm"
    has_time = any(t in text_lower for t in time_refs)
    has_action = any(a in text_lower for a in action_words)
    return has_time and has_action


def parse_calendar_intent(user_message: str, current_time: str) -> dict | None:
    """
    Use Claude to extract calendar event details from natural language.
    Returns dict with: title, date, start_time, end_time, description, or None.
    """
    prompt = f"""Extract calendar event details from this message.
Current date/time: {current_time} (America/New_York)

Message: "{user_message}"

If this is a calendar request, return JSON:
{{
  "is_calendar": true,
  "title": "Event title",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "description": "optional notes",
  "all_day": false
}}

If NOT a calendar request: {{"is_calendar": false}}

Rules:
- Infer reasonable duration if not specified (30min for calls, 1h for meetings, 2h for dinner)
- "tomorrow" = {(datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')}
- "next Monday" = calculate from today
- If only time given, assume today or tomorrow if time has passed
- Return ONLY valid JSON, no other text"""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP, max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        text = resp.content[0].text.strip()
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if not match:
            return None
        data = json.loads(match.group())
        return data if data.get("is_calendar") else None
    except Exception as e:
        log.warning(f"parse_calendar_intent: {e}")
        return None


def create_event(event_data: dict) -> dict | None:
    """Create a Google Calendar event from parsed event data."""
    service = get_calendar_service()
    if not service:
        return None

    try:
        import pytz
        tz = pytz.timezone(TIMEZONE)

        date_str  = event_data.get("date", datetime.now().strftime("%Y-%m-%d"))
        start_str = event_data.get("start_time", "09:00")
        end_str   = event_data.get("end_time",   "10:00")

        if event_data.get("all_day"):
            event = {
                "summary": event_data.get("title", "Event"),
                "description": event_data.get("description", ""),
                "start": {"date": date_str},
                "end":   {"date": date_str},
            }
        else:
            start_dt = tz.localize(datetime.strptime(f"{date_str} {start_str}", "%Y-%m-%d %H:%M"))
            end_dt   = tz.localize(datetime.strptime(f"{date_str} {end_str}",   "%Y-%m-%d %H:%M"))
            event = {
                "summary":     event_data.get("title", "Event"),
                "description": event_data.get("description", "Added via Tyler"),
                "start": {"dateTime": start_dt.isoformat(), "timeZone": TIMEZONE},
                "end":   {"dateTime": end_dt.isoformat(),   "timeZone": TIMEZONE},
            }

        created = service.events().insert(calendarId="primary", body=event).execute()
        return created
    except Exception as e:
        log.warning(f"create_event: {e}")
        return None


def get_upcoming_calendar_events(days: int = 7) -> list[dict]:
    """Return upcoming calendar events for the next N days."""
    service = get_calendar_service()
    if not service:
        return []
    try:
        import pytz
        tz = pytz.timezone(TIMEZONE)
        now   = datetime.now(tz).isoformat()
        until = (datetime.now(tz) + timedelta(days=days)).isoformat()
        result = service.events().list(
            calendarId="primary", timeMin=now, timeMax=until,
            maxResults=15, singleEvents=True, orderBy="startTime",
        ).execute()
        return result.get("items", [])
    except Exception as e:
        log.warning(f"get_upcoming_events: {e}")
        return []


def format_events_list(events: list[dict]) -> str:
    """Format calendar events for Telegram display."""
    if not events:
        return "📅 No upcoming events in the next 7 days."

    lines = ["📅 UPCOMING EVENTS\n"]
    for e in events:
        title = e.get("summary", "Untitled")
        start = e.get("start", {})
        dt_str = start.get("dateTime", start.get("date", ""))
        try:
            if "T" in dt_str:
                import pytz
                dt = datetime.fromisoformat(dt_str)
                dt_local = dt.astimezone(pytz.timezone(TIMEZONE))
                formatted = dt_local.strftime("%a %b %-d · %-I:%M %p")
            else:
                dt = datetime.strptime(dt_str, "%Y-%m-%d")
                formatted = dt.strftime("%a %b %-d · All day")
        except Exception:
            formatted = dt_str
        lines.append(f"• {formatted} — {title}")

    return "\n".join(lines)


def generate_auth_url() -> str | None:
    """Generate Google OAuth URL for initial setup."""
    try:
        from google_auth_oauthlib.flow import Flow
        _write_creds_files()
        if not os.path.exists(CREDS_FILE):
            return None
        flow = Flow.from_client_secrets_file(
            CREDS_FILE, scopes=SCOPES,
            redirect_uri="urn:ietf:wg:oauth:2.0:oob"
        )
        auth_url, _ = flow.authorization_url(prompt="consent")
        return auth_url
    except Exception as e:
        log.warning(f"generate_auth_url: {e}")
        return None


def exchange_auth_code(code: str) -> bool:
    """Exchange OAuth auth code for tokens and save."""
    try:
        from google_auth_oauthlib.flow import Flow
        flow = Flow.from_client_secrets_file(
            CREDS_FILE, scopes=SCOPES,
            redirect_uri="urn:ietf:wg:oauth:2.0:oob"
        )
        flow.fetch_token(code=code)
        with open(TOKEN_FILE, "w") as f:
            f.write(flow.credentials.to_json())
        log.info("Google Calendar OAuth tokens saved")
        return True
    except Exception as e:
        log.warning(f"exchange_auth_code: {e}")
        return False
