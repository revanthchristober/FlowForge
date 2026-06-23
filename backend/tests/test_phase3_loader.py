"""Phase 3 eval loader tests — file loading and PRD matching."""

import pytest
from pathlib import Path
from unittest.mock import patch, mock_open


class TestLoader:
    def test_list_golden_prds_returns_stems(self):
        from forgeflow.eval.loader import list_golden_prds
        prds = list_golden_prds()
        # We have at least 4: todo_api, auth_unsafe, invoice_parser, mini_crm
        assert len(prds) >= 2
        assert "todo_api" in prds
        assert "auth_unsafe" in prds

    def test_load_prd_reads_markdown(self):
        from forgeflow.eval.loader import load_prd
        text = load_prd("todo_api")
        assert "Todo API" in text
        assert "## Overview" in text

    def test_load_expected_returns_dict(self):
        from forgeflow.eval.loader import load_expected
        expected = load_expected("todo_api")
        assert isinstance(expected, dict)
        assert "must_have_tasks" in expected
        assert "required_doc_sections" in expected
        assert "thresholds" in expected

    def test_load_expected_auth_unsafe_has_seeded_findings(self):
        from forgeflow.eval.loader import load_expected
        expected = load_expected("auth_unsafe")
        assert "seeded_findings" in expected
        assert len(expected["seeded_findings"]) > 0
        patterns = [f["pattern"] for f in expected["seeded_findings"]]
        assert any("SQL" in p for p in patterns)

    def test_match_todo_api_by_title(self):
        from forgeflow.eval.loader import match_prd_to_golden
        prd_text = "# Todo API — Product Requirements Document\n\n## Overview\nA REST API."
        result = match_prd_to_golden(prd_text)
        assert result == "todo_api"

    def test_match_returns_none_for_unknown(self):
        from forgeflow.eval.loader import match_prd_to_golden
        prd_text = "# Completely Unknown XYZ PRD\n\nSomething totally different with unique words."
        result = match_prd_to_golden(prd_text)
        assert result is None

    def test_load_invoice_parser_prd(self):
        from forgeflow.eval.loader import load_prd, load_expected
        text = load_prd("invoice_parser")
        assert "Invoice Parser" in text
        expected = load_expected("invoice_parser")
        assert "must_have_tasks" in expected

    def test_load_mini_crm_prd(self):
        from forgeflow.eval.loader import load_prd, load_expected
        text = load_prd("mini_crm")
        assert "Mini CRM" in text
        expected = load_expected("mini_crm")
        assert "must_have_epics" in expected
        assert "Contacts" in expected["must_have_epics"]

    def test_load_expected_missing_file_raises(self):
        from forgeflow.eval.loader import load_expected
        with pytest.raises(FileNotFoundError):
            load_expected("nonexistent_prd_xyz")

    def test_match_auth_unsafe_by_title(self):
        from forgeflow.eval.loader import match_prd_to_golden, load_prd
        # Load the real auth_unsafe PRD text and match it
        text = load_prd("auth_unsafe")
        result = match_prd_to_golden(text)
        assert result == "auth_unsafe"
