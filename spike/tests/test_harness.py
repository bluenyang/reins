"""Unit tests — run with `python3 -m unittest discover -s tests`."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import harness as h  # noqa: E402


class TransitionTest(unittest.TestCase):
    def test_verify_limit_escalates_then_human(self):
        st = h.new_state()
        for _ in range(3):
            self.assertEqual(h.transition(st, "verify", "fail", "none")[0], "work")
        self.assertEqual(h.transition(st, "verify", "fail", "none")[0], "escalate")
        self.assertEqual(h.transition(st, "escalate", "fail", "none")[0], "escalate")
        self.assertEqual(h.transition(st, "escalate", "fail", "none")[0], "human")

    def test_pass_chain_and_stops(self):
        st = h.new_state()
        self.assertEqual(h.transition(st, "verify", "pass", "none")[0], "review")
        self.assertEqual(h.transition(st, "review", "changes", "none")[0], "work")
        self.assertEqual(h.transition(st, "qa", "fail", "none")[0], "triage")
        self.assertEqual(h.transition(st, "qa", "pass", "none")[0], "write")
        self.assertEqual(h.transition(st, "work", "done", "intent")[0], "human")

    def test_escalation_success_resets_budgets(self):
        st = h.new_state()
        st["rounds"].update(verify=4, escalate=2)
        h.transition(st, "escalate", "pass", "none")
        self.assertEqual(set(st["rounds"].values()), {0})


class InstallPiecesTest(unittest.TestCase):
    def test_block_is_idempotent_and_before_language(self):
        text = "# AGENTS.md\n\n## Project\n\nx\n\n## Language\n\n- en\n"
        once = h.upsert_block(text)
        self.assertEqual(once, h.upsert_block(once))
        self.assertLess(once.index(h.BEGIN), once.index("## Language"))

    def test_detect_node_skips_mutating_lint(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "yarn.lock").write_text("")
            (root / "package.json").write_text(
                json.dumps(
                    {
                        "scripts": {
                            "lint": "oxlint --fix .",
                            "lint:check": "oxlint .",
                            "format": "oxfmt --write .",
                            "check:abstraction": "node x.mjs",
                            "build": "tsc",
                        }
                    }
                )
            )
            prof = h.detect(root, None)
            self.assertEqual(prof.gates["lint"], "yarn run lint:check")
            self.assertIn("check_abstraction", prof.gates)
            self.assertNotIn("format", prof.gates)
            self.assertTrue(any("format:check" in n for n in prof.notes))

    def test_catalog_match(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / ".ai/knowledge").mkdir(parents=True)
            (root / ".ai/knowledge/failures.md").write_text("## F-001 x\n- symptom: `missing go.sum entry` | `other`\n")
            self.assertEqual(h.catalog_matches(root, "error: missing go.sum entry for module"), ["F-001"])
            self.assertEqual(h.catalog_matches(root, "fine"), [])


if __name__ == "__main__":
    unittest.main()
