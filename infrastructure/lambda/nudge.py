import base64
import binascii
import json
import os

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://spendwise.abdullahiomer.com")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Content-Type": "application/json",
}

# Insight logic — maps answer combinations to a single personalised
# sentence. Ordered from most specific to least specific so the first
# matching rule wins.
INSIGHT_RULES = [
    {
        "conditions": {"feeling": "Stressed", "planned": "Just saw it now"},
        "insight": "You found this while stressed and hadn't planned on it. Worth sitting with that for a moment.",
    },
    {
        "conditions": {"feeling": "Tired", "planned": "Just saw it now"},
        "insight": "Late-night browsing while tired is when most things end up in carts. This one might look different in the morning.",
    },
    {
        "conditions": {"feeling": "Bored", "planned": "Just saw it now"},
        "insight": "Boredom-browsing accounts for a lot of things people end up not keeping. No judgment, just worth noticing.",
    },
    {
        "conditions": {"feeling": "Stressed", "wait": "I need it now"},
        "insight": "The urgency feels real right now. It usually does when you're stressed. Give it twenty minutes and the feeling tends to shift.",
    },
    {
        "conditions": {"feeling": "Excited", "planned": "Just saw it now"},
        "insight": "Excitement is a good feeling to buy from, as long as it is about the thing itself and not just the act of buying.",
    },
    {
        "conditions": {"planned": "Been planning it", "wait": "Yes, easy"},
        "insight": "You planned this one and you're not in a rush. That's about as confident as a purchase decision gets.",
    },
    {
        "conditions": {"planned": "Been planning it"},
        "insight": "This was on your mind before today. Planned purchases tend to stick, and this one probably will too.",
    },
    {
        "conditions": {"feeling": "Good", "planned": "Just saw it now"},
        "insight": "You're feeling good and saw something you liked. Just check it's the thing you want, not the feeling you're chasing.",
    },
    {
        "conditions": {"wait": "I need it now"},
        "insight": "When something feels urgent, that urgency is worth a closer look. Twenty minutes almost never changes whether something is right for you.",
    },
    {
        "conditions": {"wait": "Yes, easy"},
        "insight": "You're relaxed about this one. That's usually a good sign: not anxious to buy, just interested.",
    },
    {
        "conditions": {"feeling": "Tired"},
        "insight": "Decisions made when you are tired tend to look different the next morning. Not always, but often enough to be worth a pause.",
    },
]

DEFAULT_INSIGHT = (
    "No wrong answer here. The fact that you paused at all is worth something."
)


def get_insight(feeling: str, planned: str, wait: str) -> str:
    answers = {"feeling": feeling, "planned": planned, "wait": wait}
    for rule in INSIGHT_RULES:
        if all(answers.get(k) == v for k, v in rule["conditions"].items()):
            return rule["insight"]
    return DEFAULT_INSIGHT


ALLOWED_ANSWERS = {
    "feeling": {"Good", "Stressed", "Tired", "Bored", "Excited"},
    "planned": {"Been planning it", "Just saw it now", "Not sure"},
    "wait": {"Yes, easy", "Maybe", "I need it now"},
}
MAX_BODY_BYTES = 4096


def response(status, payload):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(payload)}


def handler(event, context):
    method = event.get("httpMethod")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}
    if method != "POST":
        return response(405, {"error": "Only POST is supported"})

    raw = event.get("body") or ""
    if not isinstance(raw, str):
        return response(400, {"error": "Request body must be a valid JSON object"})
    # Bound work before decoding; API Gateway can pass binary payloads as base64.
    limit = ((MAX_BODY_BYTES + 2) // 3) * 4 if event.get("isBase64Encoded") else MAX_BODY_BYTES
    if len(raw.encode("utf-8")) > limit:
        return response(413, {"error": "Request body is too large"})
    try:
        if event.get("isBase64Encoded"):
            raw = base64.b64decode(raw, validate=True).decode("utf-8")
        if len(raw.encode("utf-8")) > MAX_BODY_BYTES:
            return response(413, {"error": "Request body is too large"})
        body = json.loads(raw)
    except (ValueError, binascii.Error, UnicodeError):
        return response(400, {"error": "Request body must be a valid JSON object"})

    if not isinstance(body, dict) or set(body) != set(ALLOWED_ANSWERS):
        return response(400, {"error": "Provide only feeling, planned, and wait"})
    for field, options in ALLOWED_ANSWERS.items():
        if not isinstance(body[field], str) or body[field] not in options:
            return response(400, {"error": "Invalid answer for " + field})

    # Do not log request bodies: mood answers belong only to this request.
    insight = get_insight(body["feeling"], body["planned"], body["wait"])
    return response(200, {"insight": insight})
