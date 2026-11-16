"""Tests for the Nudge Lambda and for parity with the demo's local fallback.

Run from the repository root:
    pip install pytest
    pytest -q
"""
import json
import re
import sys
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "infrastructure" / "lambda"))

import nudge  # noqa: E402

DEMO_JS = ROOT / "spendwise" / "js" / "demo.js"

# Voice rules from the design system, enforced as tests.
# The product never uses clinical or moralising language,
# and never uses dashes in user-facing copy.
BANNED_WORDS = [
    "impulse", "impulsive", "should", "shouldn't",
    "warning", "addiction", "mistake", "bad decision",
]
DASHES = ["\u2014", "\u2013"]  # em dash, en dash

ALL_TEXTS = [r["insight"] for r in nudge.INSIGHT_RULES] + [nudge.DEFAULT_INSIGHT]


# ---------------------------------------------------------------
# Insight selection
# ---------------------------------------------------------------
CASES = [
    ("Stressed", "Just saw it now", "Maybe", "stressed and hadn't planned"),
    ("Tired", "Just saw it now", "Maybe", "Late-night browsing"),
    ("Bored", "Just saw it now", "Yes, easy", "Boredom-browsing"),
    ("Stressed", "Been planning it", "I need it now", "The urgency feels real"),
    ("Excited", "Just saw it now", "Maybe", "Excitement is a good feeling"),
    ("Good", "Been planning it", "Yes, easy", "planned this one"),
    ("Good", "Been planning it", "Maybe", "on your mind before today"),
    ("Good", "Just saw it now", "Maybe", "feeling good"),
    ("Good", "Not sure", "I need it now", "urgency is worth a closer look"),
    ("Good", "Not sure", "Yes, easy", "relaxed about this one"),
    ("Tired", "Not sure", "Maybe", "tired tend to look different"),
]


@pytest.mark.parametrize("feeling,planned,wait,expected", CASES)
def test_insight_selection(feeling, planned, wait, expected):
    assert expected in nudge.get_insight(feeling, planned, wait)


def test_unmatched_answers_get_the_default_insight():
    assert nudge.get_insight("Good", "Not sure", "Maybe") == nudge.DEFAULT_INSIGHT


def test_unknown_values_do_not_crash():
    assert nudge.get_insight("???", "???", "???") == nudge.DEFAULT_INSIGHT


# ---------------------------------------------------------------
# Voice rules
# ---------------------------------------------------------------
@pytest.mark.parametrize("text", ALL_TEXTS)
def test_copy_has_no_dashes(text):
    for d in DASHES:
        assert d not in text, f"dash found in: {text}"


@pytest.mark.parametrize("text", ALL_TEXTS)
def test_copy_avoids_banned_words(text):
    lowered = text.lower()
    for word in BANNED_WORDS:
        assert not re.search(r"\b" + re.escape(word) + r"\b", lowered), (
            f"banned word '{word}' in: {text}"
        )


# ---------------------------------------------------------------
# Handler behaviour
# ---------------------------------------------------------------
def call(body=None, method="POST", raw=None):
    event = {"httpMethod": method}
    if raw is not None:
        event["body"] = raw
    elif body is not None:
        event["body"] = json.dumps(body)
    return nudge.handler(event, None)


VALID = {"feeling": "Stressed", "planned": "Just saw it now", "wait": "I need it now"}


def test_valid_request_returns_insight():
    res = call(VALID)
    assert res["statusCode"] == 200
    assert "insight" in json.loads(res["body"])
    assert res["headers"]["Access-Control-Allow-Origin"] == nudge.ALLOWED_ORIGIN
    assert res["headers"]["Content-Type"] == "application/json"


def test_missing_fields_is_a_400():
    res = call({"feeling": "Good"})
    assert res["statusCode"] == 400
    assert "error" in json.loads(res["body"])


def test_empty_body_is_a_400():
    assert call().get("statusCode") == 400


def test_malformed_json_is_a_400_not_a_500():
    assert call(raw="{not json")["statusCode"] == 400


def test_json_that_is_not_an_object_is_a_400():
    assert call(raw="[]")["statusCode"] == 400


def test_preflight_returns_cors_headers():
    res = call(method="OPTIONS")
    assert res["statusCode"] == 200
    assert "POST" in res["headers"]["Access-Control-Allow-Methods"]


def test_error_responses_do_not_leak_internals():
    res = call(raw="{not json")
    assert "Traceback" not in res["body"]
    assert "json" not in res["body"].lower() or "valid JSON" in res["body"]


# ---------------------------------------------------------------
# Parity: the demo's local fallback must match the Lambda exactly,
# so visitors see the same wording whichever one answers.
# ---------------------------------------------------------------
def parse_js_rules():
    # Evaluate only the rule literals so formatting changes do not break parity checks.
    script = r"""
    const fs = require('fs');
    const vm = require('vm');
    const src = fs.readFileSync(process.argv[1], 'utf8');
    const rules = src.match(/const LOCAL_RULES = (\[[\s\S]*?\n  \]);/);
    const fallback = src.match(/const DEFAULT_INSIGHT =\s*([\s\S]*?);/);
    if (!rules || !fallback) throw new Error('Insight constants not found');
    console.log(JSON.stringify([vm.runInNewContext(rules[1]), vm.runInNewContext(fallback[1])]));
    """
    result = subprocess.run(
        ["node", "-e", script, str(DEMO_JS)],
        check=True, capture_output=True, text=True,
    )
    rules, fallback = json.loads(result.stdout)
    return [(conditions, text) for conditions, text in rules], fallback


def test_demo_fallback_matches_lambda_rules():
    js_rules, js_default = parse_js_rules()
    py_rules = [(r["conditions"], r["insight"]) for r in nudge.INSIGHT_RULES]

    problems = []
    if len(js_rules) != len(py_rules):
        problems.append(f"rule count differs: demo.js has {len(js_rules)}, nudge.py has {len(py_rules)}")

    for n, (js, py) in enumerate(zip(js_rules, py_rules), start=1):
        if js[0] != py[0]:
            problems.append(f"rule {n}: conditions differ\n  demo.js: {js[0]}\n  nudge.py: {py[0]}")
        if js[1] != py[1]:
            problems.append(f"rule {n}: text differs\n  demo.js: {js[1]}\n  nudge.py: {py[1]}")

    if js_default != nudge.DEFAULT_INSIGHT:
        problems.append(f"default insight differs\n  demo.js: {js_default}\n  nudge.py: {nudge.DEFAULT_INSIGHT}")

    assert not problems, "\n".join(problems)
# Public endpoint contract: only the three documented multiple-choice answers.
@pytest.mark.parametrize("field", ["feeling", "planned", "wait"])
@pytest.mark.parametrize("value", ["unknown", 12, True, [], {}, None])
def test_invalid_answer_values_are_client_errors(field, value):
    body = dict(VALID)
    body[field] = value
    assert call(body)["statusCode"] == 400


def test_extra_fields_are_rejected():
    assert call({**VALID, "reason": "private reflection"})["statusCode"] == 400


def test_unsupported_method_is_rejected():
    assert call(VALID, method="GET")["statusCode"] == 405


def test_oversized_body_is_rejected():
    assert call(raw=" " * 4097)["statusCode"] == 413


def test_non_string_body_is_a_client_error():
    assert nudge.handler({"httpMethod": "POST", "body": 12}, None)["statusCode"] == 400


def test_base64_encoded_request_is_supported():
    import base64
    event = {"httpMethod": "POST", "body": base64.b64encode(json.dumps(VALID).encode()).decode(), "isBase64Encoded": True}
    assert nudge.handler(event, None)["statusCode"] == 200


def test_invalid_base64_is_a_client_error():
    assert nudge.handler({"httpMethod": "POST", "body": "%%%", "isBase64Encoded": True}, None)["statusCode"] == 400


def test_base64_decoding_rejects_invalid_utf8():
    import base64
    event = {"httpMethod": "POST", "body": base64.b64encode(b"\xff").decode(), "isBase64Encoded": True}
    assert nudge.handler(event, None)["statusCode"] == 400


def test_base64_decoded_body_must_fit_limit():
    import base64
    event = {"httpMethod": "POST", "body": base64.b64encode(b" " * 4097).decode(), "isBase64Encoded": True}
    assert nudge.handler(event, None)["statusCode"] == 413


def test_all_documented_answer_combinations_are_accepted():
    from itertools import product
    for feeling, planned, wait in product(*nudge.ALLOWED_ANSWERS.values()):
        assert call({"feeling": feeling, "planned": planned, "wait": wait})["statusCode"] == 200
