"""Python HDI must match the app on the shared fixture (tests/fixtures/hdi-parity.json)."""
import json
import unittest
from pathlib import Path

from analysis.hdi_validation.validate_hdi import components, is_high, score

REPO = Path(__file__).resolve().parents[3]
WEIGHTS = {"hpa": 0.3, "aed": 0.133, "er": 0.3, "reae": 0.133, "iwh": 0.134}


class HdiParityTest(unittest.TestCase):
    def test_matches_app_fixture(self) -> None:
        fixture = json.loads((REPO / "tests/fixtures/hdi-parity.json").read_text(encoding="utf-8"))
        events = [
            {
                "event_type": event["eventType"],
                "problem_id": event["problemId"],
                "timestamp": event["timestamp"],
                "hint_level": event.get("hintLevel"),
                "successful": event.get("successful"),
            }
            for event in fixture["events"]
        ]
        parts = components(events)
        for name, expected in fixture["expected"]["components"].items():
            self.assertAlmostEqual(parts[name], expected, places=6, msg=name)
        self.assertAlmostEqual(score(parts, WEIGHTS), fixture["expected"]["hdi"], places=4)

    def test_high_threshold_is_strict_like_the_app(self) -> None:
        self.assertFalse(is_high(0.6, 0.6))
        self.assertTrue(is_high(0.6001, 0.6))

    def test_empty_history(self) -> None:
        self.assertEqual(components([]), {"hpa": 0.0, "aed": 0.0, "er": 0.0, "reae": 0.0, "iwh": 0.0})


if __name__ == "__main__":
    unittest.main()
