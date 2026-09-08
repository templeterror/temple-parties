"""
Test cases for party management endpoints.
Tests cover party creation, retrieval, deletion, and validation.
Includes tests for malicious/invalid inputs that could break the system.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, MagicMock
import uuid
from datetime import date, timedelta

from tests.conftest import create_mock_auth_response, create_mock_db_response


class TestGetParties:
    """Tests for GET /parties endpoint."""

    def test_get_parties_success(self, client, mock_supabase, mock_party):
        """Should return list of approved parties."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get("/parties")

        assert response.status_code == 200
        data = response.json()
        assert "parties" in data
        assert "weekendOf" in data
        assert "thursdayDate" in data
        assert "fridayDate" in data
        assert "saturdayDate" in data
        assert len(data["parties"]) == 1
        assert data["parties"][0]["title"] == mock_party["title"]
        assert "ratingOpen" in data["parties"][0]
        assert "ratingLocked" in data["parties"][0]

    def test_get_parties_filter_by_day_friday(self, client, mock_supabase, mock_party):
        """Should filter parties by friday."""
        mock_party["day"] = "friday"
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get("/parties?day=friday")

        assert response.status_code == 200

    def test_get_parties_filter_by_day_saturday(self, client, mock_supabase, mock_party):
        """Should filter parties by saturday."""
        mock_party["day"] = "saturday"
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get("/parties?day=saturday")

        assert response.status_code == 200

    def test_get_parties_filter_by_day_thursday(self, client, mock_supabase, mock_party):
        """Should filter parties by thursday."""
        mock_party["day"] = "thursday"
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get("/parties?day=thursday")

        assert response.status_code == 200

    def test_get_parties_invalid_day_filter(self, client, mock_supabase):
        """Should handle invalid day filter parameter."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([])

        response = client.get("/parties?day=monday")

        # Should return empty parties list or handle gracefully
        assert response.status_code == 200
        assert response.json()["parties"] == []

    def test_get_parties_sql_injection_in_day(self, client, mock_supabase):
        """Should safely handle SQL injection in day parameter."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([])

        malicious_params = [
            "friday'; DROP TABLE parties;--",
            "friday' OR '1'='1",
            "friday\"; DELETE FROM users;--",
        ]

        for param in malicious_params:
            response = client.get(f"/parties?day={param}")
            # Should not crash - Supabase uses parameterized queries
            assert response.status_code == 200

    def test_get_parties_empty_result(self, client, mock_supabase):
        """Should return empty parties list when no parties exist."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([])

        response = client.get("/parties")

        assert response.status_code == 200
        assert response.json()["parties"] == []

    def test_get_parties_invalid_weekend_of(self, client, mock_supabase):
        """Garbage weekend_of should 422, not 500."""
        response = client.get("/parties?weekend_of=not-a-date")
        assert response.status_code == 422

    def test_get_parties_non_friday_weekend_of(self, client, mock_supabase):
        """Non-Friday weekend_of should 422."""
        response = client.get("/parties?weekend_of=2025-08-09")  # Saturday
        assert response.status_code == 422

    def test_get_parties_unauthenticated(self, client, mock_supabase, mock_party):
        """Should allow unauthenticated access to parties list."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get("/parties")

        assert response.status_code == 200
        assert "parties" in response.json()

    def test_get_parties_soft_gate_strips_anon(self, client, mock_supabase, mock_party):
        """Anonymous callers get null address and counts (Epic 7.3)."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get("/parties")
        assert response.status_code == 200
        party = response.json()["parties"][0]
        assert party["address"] is None
        assert party["goingCount"] is None
        assert party["ratingCount"] is None
        assert party["likePercentage"] is None
        assert party["likeCount"] is None
        assert party["dislikeCount"] is None
        assert party["latitude"] is not None
        assert party["longitude"] is not None

    def test_get_parties_authed_reveals_fields(self, client, mock_supabase, mock_user, mock_party):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get(
            "/parties",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200
        party = response.json()["parties"][0]
        assert party["address"] == mock_party["address"]
        assert party["goingCount"] == mock_party["going_count"]
        assert party["ratingCount"] == mock_party["rating_count"]
        assert party["likeCount"] == 0
        assert party["dislikeCount"] == 0


class TestGetParty:
    """Tests for GET /parties/{party_id} endpoint."""

    def test_get_party_success(self, client, mock_supabase, mock_party):
        """Should return single party by ID."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get(f"/parties/{mock_party['id']}")

        assert response.status_code == 200
        assert response.json()["id"] == mock_party["id"]
        # Soft-gate: anon still gets the party but stripped fields
        assert response.json()["address"] is None
        assert response.json()["likeCount"] is None
        assert response.json()["dislikeCount"] is None

    def test_get_party_promo_code_gated_for_anon(self, client, mock_supabase, mock_party):
        """Soft-gate: ticketUrl and the promo label stay public (the carrot),
        but the promo CODE itself is stripped for anonymous callers — the UI
        shows a masked code + SIGN IN instead."""
        mock_party["external_ticket_url"] = "https://dice.fm/event/rave"
        mock_party["promo_code"] = "TUPARTY25"
        mock_party["promo_label"] = "$2 OFF TICKETS"
        mock_party["doors_close"] = "2:00 AM"
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get(f"/parties/{mock_party['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["address"] is None
        assert data["goingCount"] is None
        assert data["ticketUrl"] == "https://dice.fm/event/rave?ref=tuparty"
        assert data["promoCode"] is None
        assert data["promoLabel"] == "$2 OFF TICKETS"
        assert data["doorsClose"] == "2:00 AM"

    def test_get_party_like_dislike_counts_when_authed(self, client, mock_supabase, mock_user, mock_party):
        mock_party["like_percentage"] = 84
        mock_party["rating_count"] = 93
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get(
            f"/parties/{mock_party['id']}",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["likeCount"] == 78
        assert data["dislikeCount"] == 15
        assert data["likePercentage"] == 84.0

    def test_get_party_is_headliner_when_top_of_night(self, client, mock_supabase, mock_party):
        """isHeadliner: true when this party tops its night's going_count ranking."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value \
            .order.return_value.limit.return_value.execute.return_value = \
            create_mock_db_response([{"id": mock_party["id"]}])

        response = client.get(f"/parties/{mock_party['id']}")
        assert response.status_code == 200
        assert response.json()["isHeadliner"] is True

    def test_get_party_not_headliner_when_another_party_tops(self, client, mock_supabase, mock_party):
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])
        mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value \
            .order.return_value.limit.return_value.execute.return_value = \
            create_mock_db_response([{"id": str(uuid.uuid4())}])

        response = client.get(f"/parties/{mock_party['id']}")
        assert response.status_code == 200
        assert response.json()["isHeadliner"] is False

    def test_get_party_host_stats_from_rankings(self, client, mock_supabase, mock_party):
        """host_codes linked -> hostStats attached from the leaderboard RPC."""
        mock_party["host_codes"] = ["asig"]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])
        mock_supabase.rpc.return_value.execute.return_value = create_mock_db_response([
            {
                "host_code": "asig",
                "display_name": "Alpha Sigma Phi",
                "logo_url": None,
                "parties_hosted": 12,
                "avg_like_percentage": 76.4,
            },
            {"host_code": "other", "display_name": "Other", "parties_hosted": 1},
        ])

        response = client.get(f"/parties/{mock_party['id']}")
        assert response.status_code == 200
        stats = response.json()["hostStats"]
        assert stats == {
            "displayName": "Alpha Sigma Phi",
            "partiesHosted": 12,
            "avgLikePercentage": 76.4,
            "logoUrl": None,
        }

    def test_get_party_host_stats_null_without_host_codes(self, client, mock_supabase, mock_party):
        """Self-serve listings (empty host_codes) never call the RPC."""
        mock_party["host_codes"] = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get(f"/parties/{mock_party['id']}")
        assert response.status_code == 200
        assert response.json()["hostStats"] is None
        mock_supabase.rpc.assert_not_called()

    def test_get_party_host_stats_rpc_failure_is_swallowed(self, client, mock_supabase, mock_party):
        """The cred line is decorative — an RPC blowup must not 500 the page."""
        mock_party["host_codes"] = ["asig"]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])
        mock_supabase.rpc.return_value.execute.side_effect = Exception("rpc down")

        response = client.get(f"/parties/{mock_party['id']}")
        assert response.status_code == 200
        assert response.json()["hostStats"] is None

    def test_get_party_pending_hidden_from_public(self, client, mock_supabase, mock_party):
        mock_party["status"] = "pending"
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get(f"/parties/{mock_party['id']}")
        assert response.status_code == 404

    def test_get_party_pending_visible_to_owner(self, client, mock_supabase, mock_user, mock_party):
        mock_party["status"] = "pending"
        mock_party["created_by"] = mock_user["id"]
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.get(
            f"/parties/{mock_party['id']}",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200
        assert response.json()["address"] == mock_party["address"]

    def test_get_party_pending_visible_to_admin(self, client, mock_supabase, mock_user, mock_party):
        mock_party["status"] = "pending"
        mock_party["created_by"] = str(uuid.uuid4())
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "parties":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([mock_party])
            elif table_name == "user_profiles":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{"is_admin": True}])
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.get(
            f"/parties/{mock_party['id']}",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200

    def test_get_party_pending_hidden_from_stranger(self, client, mock_supabase, mock_user, mock_party):
        mock_party["status"] = "rejected"
        mock_party["created_by"] = str(uuid.uuid4())
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "parties":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([mock_party])
            elif table_name == "user_profiles":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{"is_admin": False}])
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.get(
            f"/parties/{mock_party['id']}",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 404

    def test_get_party_not_found(self, client, mock_supabase):
        """Should return 404 for non-existent party."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([])

        fake_id = str(uuid.uuid4())
        response = client.get(f"/parties/{fake_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_party_invalid_uuid(self, client, mock_supabase):
        """Should handle invalid UUID format."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([])

        response = client.get("/parties/not-a-valid-uuid")

        # Should return 404 (not found) rather than crashing
        assert response.status_code in [404, 422]

    def test_get_party_sql_injection_in_id(self, client, mock_supabase):
        """Should safely handle SQL injection in party ID."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([])

        response = client.get("/parties/'; DROP TABLE parties;--")
        assert response.status_code in [404, 422]
        malicious_ids = [
            "'; DROP TABLE parties;--",
            "1 OR 1=1",
            "1; DELETE FROM users;--",
        ]

        for mal_id in malicious_ids:
            response = client.get(f"/parties/{mal_id}")
            # Should return 404, not crash
            assert response.status_code in [404, 422]


class TestCreateParty:
    """Tests for POST /parties endpoint."""

    def test_create_party_success(self, client, mock_supabase, mock_user, valid_party_data):
        """Should successfully create a party."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        created_party = {
            **valid_party_data,
            "id": str(uuid.uuid4()),
            "day": "friday",
            "weekend_of": valid_party_data["date"],
            "latitude": 39.981,
            "longitude": -75.155,
            "going_count": 0,
            "status": "pending",
            "like_percentage": 0,
            "rating_count": 0,
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == valid_party_data["title"]
        assert data["status"] == "pending"

    def test_create_party_with_coordinates(self, client, mock_supabase, mock_user, valid_party_data):
        """Should accept custom coordinates."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["latitude"] = 39.982
        valid_party_data["longitude"] = -75.156
        created_party = {
            **valid_party_data,
            "id": str(uuid.uuid4()),
            "day": "friday",
            "weekend_of": valid_party_data["date"],
            "going_count": 0,
            "status": "pending",
            "like_percentage": 0,
            "rating_count": 0,
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 200
        assert response.json()["latitude"] == 39.982

    def test_create_party_title_too_long(self, client, mock_supabase, mock_user, valid_party_data):
        """Should reject titles longer than 50 characters."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["title"] = "A" * 51

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        # Pydantic validation returns 422
        assert response.status_code == 422

    def test_create_party_title_exactly_50(self, client, mock_supabase, mock_user, valid_party_data):
        """Should accept title of exactly 50 characters."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["title"] = "A" * 50
        created_party = {
            **valid_party_data,
            "id": str(uuid.uuid4()),
            "day": "friday",
            "weekend_of": valid_party_data["date"],
            "latitude": 39.981,
            "longitude": -75.155,
            "going_count": 0,
            "status": "pending",
            "like_percentage": 0,
            "rating_count": 0,
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 200

    def test_create_party_host_too_long(self, client, mock_supabase, mock_user, valid_party_data):
        """Should reject hosts longer than 30 characters."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["host"] = "A" * 31

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        # Pydantic validation returns 422
        assert response.status_code == 422

    def test_create_party_empty_title(self, client, mock_supabase, mock_user, valid_party_data):
        """Should reject empty title."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["title"] = ""

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        # Pydantic should reject empty string or backend validation
        assert response.status_code in [400, 422]

    def test_create_party_missing_required_fields(self, client, mock_supabase, mock_user):
        """Should reject requests missing required fields."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        incomplete_data = {"title": "Test Party"}  # Missing other required fields

        response = client.post(
            "/parties",
            json=incomplete_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 422

    def test_create_party_invalid_day(self, client, mock_supabase, mock_user, valid_party_data):
        """Should reject dates that aren't Thursday, Friday, or Saturday."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["date"] = "2025-01-08"  # Wednesday - not allowed

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 422

    def test_create_party_sql_injection_in_title(self, client, mock_supabase, mock_user, valid_party_data):
        """Should safely handle SQL injection in title."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        malicious_titles = [
            "Party'; DROP TABLE parties;--",
            "Party' OR '1'='1",
            '"; DELETE FROM users;--',
        ]

        for title in malicious_titles:
            valid_party_data["title"] = title[:50]  # Truncate to pass length validation
            created_party = {
                **valid_party_data,
                "id": str(uuid.uuid4()),
                "day": "friday",
                "weekend_of": valid_party_data["date"],
                "latitude": 39.981,
                "longitude": -75.155,
                "going_count": 0,
                "status": "pending",
                "like_percentage": 0,
                "rating_count": 0,
            }
            mock_supabase.table.return_value.insert.return_value.execute.return_value = \
                create_mock_db_response([created_party])

            response = client.post(
                "/parties",
                json=valid_party_data,
                headers={"Authorization": "Bearer valid_token"}
            )

            # Should either accept (parameterized queries) or reject, not crash
            assert response.status_code in [200, 400, 422]

    def test_create_party_xss_in_fields(self, client, mock_supabase, mock_user, valid_party_data):
        """Should safely handle XSS attempts in party fields."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        xss_payloads = {
            "title": "<script>alert('xss')</script>",
            "host": "<img src=x onerror=alert(1)>",
            "address": "<svg onload=alert(1)>",
        }

        for field, payload in xss_payloads.items():
            valid_party_data[field] = payload[:30] if field == "host" else payload[:50]
            created_party = {
                **valid_party_data,
                "id": str(uuid.uuid4()),
                "day": "friday",
                "weekend_of": valid_party_data["date"],
                "latitude": 39.981,
                "longitude": -75.155,
                "going_count": 0,
                "status": "pending",
                "like_percentage": 0,
                "rating_count": 0,
            }
            mock_supabase.table.return_value.insert.return_value.execute.return_value = \
                create_mock_db_response([created_party])

            response = client.post(
                "/parties",
                json=valid_party_data,
                headers={"Authorization": "Bearer valid_token"}
            )

            # Should store (will be escaped on output)
            assert response.status_code in [200, 400, 422]

    def test_create_party_invalid_coordinates(self, client, mock_supabase, mock_user, valid_party_data):
        """Should handle invalid coordinate values."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        # Only test JSON-serializable invalid coordinates
        # Note: float('inf') and float('nan') are not JSON-compliant and will
        # raise ValueError when serializing, so we skip those
        invalid_coords = [
            (999, 999),        # Out of range
            (-999, -999),      # Out of range
        ]

        for lat, lng in invalid_coords:
            valid_party_data["latitude"] = lat
            valid_party_data["longitude"] = lng

            response = client.post(
                "/parties",
                json=valid_party_data,
                headers={"Authorization": "Bearer valid_token"}
            )

            # Should handle gracefully
            assert response.status_code in [200, 400, 422]

    def test_create_party_extremely_long_address(self, client, mock_supabase, mock_user, valid_party_data):
        """Should handle extremely long address."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["address"] = "A" * 10000

        created_party = {
            **valid_party_data,
            "id": str(uuid.uuid4()),
            "day": "friday",
            "weekend_of": valid_party_data["date"],
            "latitude": 39.981,
            "longitude": -75.155,
            "going_count": 0,
            "status": "pending",
            "like_percentage": 0,
            "rating_count": 0,
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        # Should either accept or reject with proper error
        assert response.status_code in [200, 400, 422]

    def test_create_party_unauthenticated(self, client, mock_supabase, valid_party_data):
        """Should reject unauthenticated party creation."""
        response = client.post("/parties", json=valid_party_data)

        assert response.status_code == 401

    def test_create_party_null_body(self, client, mock_supabase, mock_user):
        """Should handle null request body."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        response = client.post(
            "/parties",
            json=None,
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 422

    def test_create_party_extra_fields_ignored(self, client, mock_supabase, mock_user, valid_party_data):
        """Should ignore extra/malicious fields in request."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        # Add fields that should be ignored
        valid_party_data["id"] = str(uuid.uuid4())  # Should not allow setting ID
        valid_party_data["going_count"] = 1000      # Should not allow inflating
        valid_party_data["status"] = "approved"      # Should not allow bypassing moderation
        valid_party_data["created_by"] = "other-user-id"  # Should not allow impersonation

        created_party = {
            **valid_party_data,
            "id": str(uuid.uuid4()),  # Different ID
            "day": "friday",
            "weekend_of": valid_party_data["date"],
            "latitude": 39.981,
            "longitude": -75.155,
            "going_count": 0,         # Should be 0
            "status": "pending",       # Should be pending
            "like_percentage": 0,
            "rating_count": 0,
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 200
        data = response.json()
        # These should be server-controlled, not client-controlled
        assert data["goingCount"] == 0
        assert data["status"] == "pending"

    def test_create_party_geocode_failure_surfaces(self, client, mock_supabase, mock_user, valid_party_data):
        """Geocode miss must 422 — never silent random pins (Epic 8.2 / §8.14)."""
        from unittest.mock import patch

        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{"id": mock_user["id"], "is_admin": False, "is_host": True}])

        with patch("app.routers.parties.geocode_address", return_value=None):
            response = client.post(
                "/parties",
                json=valid_party_data,
                headers={"Authorization": "Bearer valid_token"},
            )

        assert response.status_code == 422
        assert "address" in response.json()["detail"].lower()

    def test_create_party_rejects_past_weekend_date(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{"id": mock_user["id"], "is_admin": False, "is_host": True}])
        valid_party_data["date"] = "2020-01-03"  # Friday in the past

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 422
        assert "future" in response.json()["detail"].lower() or "today" in response.json()["detail"].lower()

    def test_create_party_with_ticket_url_promo_and_end_time(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{"id": mock_user["id"], "is_admin": False, "is_host": True}])

        valid_party_data.update({
            "ticket_price": "$15+",
            "doors_close": "2:00 AM",
            "external_ticket_url": "https://dice.fm/event/rave",
            "promo_code": "tuparty25",
            "promo_label": "$2 OFF TICKETS",
            "promo_hint": "Use at checkout",
        })
        created_party = {
            **valid_party_data,
            "id": str(uuid.uuid4()),
            "day": "friday",
            "weekend_of": valid_party_data["date"],
            "latitude": 39.981,
            "longitude": -75.155,
            "going_count": 0,
            "status": "pending",
            "like_percentage": 0,
            "rating_count": 0,
            "promo_code": "TUPARTY25",
            "external_ticket_url": "https://dice.fm/event/rave",
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["doorsClose"] == "2:00 AM"
        assert data["promoCode"] == "TUPARTY25"
        assert data["promoLabel"] == "$2 OFF TICKETS"
        assert data["promoHint"] == "Use at checkout"
        assert data["ticketUrl"] == "https://dice.fm/event/rave?ref=tuparty"
        insert_payload = mock_supabase.table.return_value.insert.call_args[0][0]
        assert insert_payload["promo_code"] == "TUPARTY25"
        assert insert_payload["external_ticket_url"] == "https://dice.fm/event/rave"

    def test_create_party_rejects_promo_code_without_label(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["promo_code"] = "TUPARTY25"

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 422
        assert "promo_label" in str(response.json()["detail"]).lower()

    def test_create_party_rejects_http_ticket_url(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["external_ticket_url"] = "http://dice.fm/event/rave"

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 422
        assert "https" in str(response.json()["detail"]).lower()

    def test_create_party_with_description_and_ticket_price(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{"id": mock_user["id"], "is_admin": False, "is_host": True}])

        valid_party_data["description"] = "BYOB, rooftop vibes"
        valid_party_data["ticket_price"] = "$10 at door"
        created_party = {
            **valid_party_data,
            "id": str(uuid.uuid4()),
            "day": "friday",
            "weekend_of": valid_party_data["date"],
            "latitude": 39.981,
            "longitude": -75.155,
            "going_count": 0,
            "status": "pending",
            "like_percentage": 0,
            "rating_count": 0,
            "ticket_price": valid_party_data["ticket_price"],
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "BYOB, rooftop vibes"
        assert data["ticketPrice"] == "$10 at door"

    def test_create_party_rejects_external_poster_url(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["poster_image"] = "https://evil.example/pwn.jpg"

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 422

    def test_create_party_rejects_other_users_poster_path(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{"id": mock_user["id"], "is_admin": False, "is_host": True}])
        valid_party_data["poster_image"] = f"{uuid.uuid4()}/abc123.jpg"

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 422
        assert "poster" in response.json()["detail"].lower()

    def test_create_party_accepts_own_poster_path(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{"id": mock_user["id"], "is_admin": False, "is_host": True}])

        path = f"{mock_user['id']}/abcdef0123456789.jpg"
        valid_party_data["poster_image"] = path
        created_party = {
            **valid_party_data,
            "id": str(uuid.uuid4()),
            "day": "friday",
            "weekend_of": valid_party_data["date"],
            "latitude": 39.981,
            "longitude": -75.155,
            "going_count": 0,
            "status": "pending",
            "like_percentage": 0,
            "rating_count": 0,
            "poster_image": path,
        }
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        # Response resolves storage path to a public URL
        assert "/storage/v1/object/public/posters/" in response.json()["posterImage"]
        assert path in response.json()["posterImage"]


class TestUploadPoster:
    """Tests for POST /parties/poster (Epic 8.1)."""

    def test_upload_poster_success(self, client, mock_supabase, mock_user):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{"id": mock_user["id"], "is_admin": False, "is_host": True}])
        mock_supabase.storage.from_.return_value.upload.return_value = None

        response = client.post(
            "/parties/poster",
            files={"file": ("poster.jpg", b"fake-jpeg-bytes", "image/jpeg")},
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        path = response.json()["path"]
        assert path.startswith(f"{mock_user['id']}/")
        assert path.endswith(".jpg")
        mock_supabase.storage.from_.assert_called_with("posters")

    def test_upload_poster_rejects_bad_mime(self, client, mock_supabase, mock_user):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        response = client.post(
            "/parties/poster",
            files={"file": ("x.gif", b"not-really", "application/pdf")},
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 400

    def test_upload_poster_unauthenticated(self, client, mock_supabase):
        response = client.post(
            "/parties/poster",
            files={"file": ("poster.jpg", b"bytes", "image/jpeg")},
        )
        assert response.status_code == 401


class TestGetMyParties:
    """Tests for GET /parties/mine (Epic 8.5)."""

    def test_get_my_parties_returns_all_statuses(
        self, client, mock_supabase, mock_user, mock_party
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        pending = {**mock_party, "id": str(uuid.uuid4()), "status": "pending", "created_by": mock_user["id"]}
        approved = {**mock_party, "id": str(uuid.uuid4()), "status": "approved", "created_by": mock_user["id"]}
        rejected = {**mock_party, "id": str(uuid.uuid4()), "status": "rejected", "created_by": mock_user["id"]}
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = \
            create_mock_db_response([pending, approved, rejected])

        response = client.get(
            "/parties/mine",
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        statuses = {p["status"] for p in response.json()}
        assert statuses == {"pending", "approved", "rejected"}

    def test_get_my_parties_unauthenticated(self, client, mock_supabase):
        response = client.get("/parties/mine")
        assert response.status_code == 401


class TestAddressSuggest:
    """Tests for GET /parties/address-suggest (Nominatim proxy)."""

    def test_address_suggest_success(self, client, mock_supabase, mock_user):
        from unittest.mock import patch

        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        with patch(
            "app.routers.parties.suggest_addresses",
            return_value=[
                {
                    "display_name": "1234 N Broad St, Philadelphia, PA",
                    "lat": 39.981,
                    "lon": -75.155,
                }
            ],
        ):
            response = client.get(
                "/parties/address-suggest?q=1234%20N%20Broad",
                headers={"Authorization": "Bearer valid_token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["lat"] == 39.981
        assert "Broad" in data[0]["display_name"]

    def test_address_suggest_unauthenticated(self, client, mock_supabase):
        response = client.get("/parties/address-suggest?q=broad")
        assert response.status_code == 401

    def test_address_suggest_query_too_short(self, client, mock_supabase, mock_user):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        response = client.get(
            "/parties/address-suggest?q=ab",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 422


class TestHostOrgIdentity:
    """Approved application = org identity: locked host name, gated Frat category."""

    def _mock_tables(self, mock_supabase, mock_user, valid_party_data, org):
        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "user_profiles":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{
                        "id": mock_user["id"],
                        "username": "testuser",
                        "school_year": "2028",
                        "is_admin": False,
                        "is_host": True,
                    }])
            elif table_name == "host_applications":
                mock_tbl.select.return_value.eq.return_value.eq.return_value \
                    .order.return_value.limit.return_value.execute.return_value = \
                    create_mock_db_response([org] if org else [])
            elif table_name == "parties":
                created = {
                    **valid_party_data,
                    "id": str(uuid.uuid4()),
                    "day": "friday",
                    "weekend_of": valid_party_data["date"],
                    "latitude": 39.981,
                    "longitude": -75.155,
                    "going_count": 0,
                    "status": "pending",
                }
                mock_tbl.insert.return_value.execute.return_value = create_mock_db_response([created])
            return mock_tbl
        mock_supabase.table = mock_table

    def test_host_name_locked_to_org(self, client, mock_supabase, mock_user, valid_party_data):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["host"] = "Impostor Name"
        self._mock_tables(mock_supabase, mock_user, valid_party_data,
                          {"org_name": "Alpha Sigma Phi", "org_type": "frat"})

        captured = {}
        original = mock_supabase.table

        def spy_table(name):
            tbl = original(name)
            if name == "parties":
                real_insert = tbl.insert

                def capture(payload):
                    captured.update(payload)
                    return real_insert(payload)

                tbl.insert = capture
            return tbl

        mock_supabase.table = spy_table

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        assert captured["host"] == "Alpha Sigma Phi"

    def test_non_frat_org_cannot_post_frat_party(self, client, mock_supabase, mock_user, valid_party_data):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["category"] = "Frat Party"
        self._mock_tables(mock_supabase, mock_user, valid_party_data,
                          {"org_name": "The Basement", "org_type": "house"})

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 422
        assert "frat" in response.json()["detail"].lower()

    def test_frat_org_can_post_frat_party(self, client, mock_supabase, mock_user, valid_party_data):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        valid_party_data["category"] = "Frat Party"
        self._mock_tables(mock_supabase, mock_user, valid_party_data,
                          {"org_name": "Alpha Sigma Phi", "org_type": "frat"})

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200


class TestUpdateParty:
    """Tests for PATCH /parties/{party_id}."""

    def test_update_party_owner_success(self, client, mock_supabase, mock_user, mock_party):
        mock_party["created_by"] = mock_user["id"]
        mock_party["status"] = "pending"
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])
        updated = {
            **mock_party,
            "doors_close": "2:00 AM",
            "promo_code": "TUPARTY25",
            "promo_label": "$2 OFF COVER",
        }
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([updated])

        response = client.patch(
            f"/parties/{mock_party['id']}",
            json={"doors_close": "2:00 AM", "promo_code": "TUPARTY25", "promo_label": "$2 OFF COVER"},
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["doorsClose"] == "2:00 AM"
        assert data["promoCode"] == "TUPARTY25"
        update_payload = mock_supabase.table.return_value.update.call_args[0][0]
        assert update_payload["promo_code"] == "TUPARTY25"
        assert "status" not in update_payload
        assert "going_count" not in update_payload

    def test_update_approved_party_reenters_review(self, client, mock_supabase, mock_user, mock_party):
        """Re-review rule (spec 11.5): edits to an approved listing go back to pending."""
        mock_party["created_by"] = mock_user["id"]
        mock_party["status"] = "approved"
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])
        mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{**mock_party, "title": "New Title", "status": "pending"}])

        response = client.patch(
            f"/parties/{mock_party['id']}",
            json={"title": "New Title"},
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        update_payload = mock_supabase.table.return_value.update.call_args[0][0]
        assert update_payload["status"] == "pending"
        assert response.json()["status"] == "pending"

    def test_update_party_not_owner(self, client, mock_supabase, mock_user, mock_party):
        mock_party["created_by"] = str(uuid.uuid4())
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.patch(
            f"/parties/{mock_party['id']}",
            json={"doors_close": "2:00 AM"},
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 403
        assert "own" in response.json()["detail"].lower()

    def test_update_party_rejected_forbidden(self, client, mock_supabase, mock_user, mock_party):
        mock_party["created_by"] = mock_user["id"]
        mock_party["status"] = "rejected"
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.patch(
            f"/parties/{mock_party['id']}",
            json={"doors_close": "2:00 AM"},
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 403
        assert "rejected" in response.json()["detail"].lower()

    def test_update_party_unauthenticated(self, client, mock_supabase, mock_party):
        response = client.patch(
            f"/parties/{mock_party['id']}",
            json={"doors_close": "2:00 AM"},
        )
        assert response.status_code == 401


class TestDeleteParty:
    """Tests for DELETE /parties/{party_id} endpoint."""

    def test_delete_party_success(self, client, mock_supabase, mock_user, mock_party):
        """Should allow owner to delete their party."""
        mock_party["created_by"] = mock_user["id"]
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])
        mock_supabase.table.return_value.delete.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([])

        response = client.delete(
            f"/parties/{mock_party['id']}",
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    def test_delete_party_not_owner(self, client, mock_supabase, mock_user, mock_party):
        """Should reject deletion by non-owner."""
        mock_party["created_by"] = str(uuid.uuid4())  # Different user
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.delete(
            f"/parties/{mock_party['id']}",
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 403
        assert "own" in response.json()["detail"].lower()

    def test_delete_party_not_found(self, client, mock_supabase, mock_user):
        """Should return 404 for non-existent party."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([])

        fake_id = str(uuid.uuid4())
        response = client.delete(
            f"/parties/{fake_id}",
            headers={"Authorization": "Bearer valid_token"}
        )

        assert response.status_code == 404

    def test_delete_party_unauthenticated(self, client, mock_supabase, mock_party):
        """Should reject unauthenticated deletion."""
        response = client.delete(f"/parties/{mock_party['id']}")

        assert response.status_code == 401

    def test_delete_party_sql_injection_in_id(self, client, mock_supabase, mock_user):
        """Should safely handle SQL injection in party ID."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([])

        malicious_ids = [
            "'; DROP TABLE parties;--",
            "1' OR '1'='1",
        ]

        for mal_id in malicious_ids:
            response = client.delete(
                f"/parties/{mal_id}",
                headers={"Authorization": "Bearer valid_token"}
            )
            # Should return 404, not crash
            assert response.status_code in [404, 422]
