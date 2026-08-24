"""
Tyler Memory Engine — Loop 21
Stores preferences, decisions, and context that persist across conversations.
Makes every future interaction sharper and more personalized.
"""
import logging
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST
from db.queries import memory_get, memory_set, memory_get_all

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


def get_context_summary() -> str:
    """Build a context string from memory for use in Claude prompts."""
    memories = memory_get_all()
    if not memories:
        return ""
    lines = ["USER CONTEXT FROM MEMORY:"]
    for m in memories[:15]:
        lines.append(f"  [{m['category']}] {m['key']}: {m['value'][:100]}")
    return "\n".join(lines)


def extract_and_store_preferences(user_message: str, bot_response: str):
    """
    Analyze a user message + response to extract any preferences or decisions.
    Call this after every significant interaction.
    """
    prompt = f"""Analyze this user message and bot response. Extract any user preferences,
investment decisions, or important context worth remembering for future conversations.

User: "{user_message[:300]}"
Bot: "{bot_response[:300]}"

Only extract something if it's genuinely worth remembering long-term — preferences about
how they want information, investment decisions, things they care about.

If there's something worth storing, return JSON:
{{"store": true, "key": "short-key", "value": "what to remember", "category": "preference|decision|note"}}

If nothing worth storing:
{{"store": false}}

Return ONLY valid JSON."""

    try:
        import json, re
        resp = client.messages.create(model=MODEL_FAST, max_tokens=150,
                                       messages=[{"role": "user", "content": prompt}])
        text = resp.content[0].text
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if not match:
            return
        data = json.loads(match.group())
        if data.get("store") and data.get("key") and data.get("value"):
            memory_set(data["key"], data["value"], data.get("category", "note"))
    except Exception as e:
        log.debug(f"extract_preferences: {e}")


def remember_alert_preference(ticker: str, event_type: str, responded: bool):
    """Track which alert types the user actually responds to."""
    key  = f"alert_pref_{ticker}_{event_type}"
    val  = memory_get(key)
    count = int(val.split("/")[0]) if val else 0
    total = int(val.split("/")[1]) if val and "/" in val else 0
    total += 1
    if responded:
        count += 1
    memory_set(key, f"{count}/{total}", "alert_pref")


def get_alert_preference_score(ticker: str, event_type: str) -> float:
    """Return 0.0-1.0 score for how much user cares about this alert type."""
    key = f"alert_pref_{ticker}_{event_type}"
    val = memory_get(key)
    if not val or "/" not in val:
        return 0.5
    try:
        count, total = map(int, val.split("/"))
        return count / total if total > 0 else 0.5
    except Exception:
        return 0.5
