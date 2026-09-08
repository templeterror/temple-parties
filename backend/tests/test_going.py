"""
Test cases for party attendance (going) functionality.
POST mark / DELETE unmark (Epic 7.1) — idempotent, trigger-maintained counts.
"""
import pytest
from unittest.mock import MagicMock
import uuid

from tests.conftest import create_mock_auth_response, create_mock_db_response


class TestMarkGoing:
    """Tests for POST /parties/{party_id}/going."""

    def test_mark_going_success(self, client, mock_supabase, mock_user, mock_party):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "parties":
                # existence check + going_count readback
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{**mock_party, "going_count": 1}])
            elif table_name == "party_going":
                mock_tbl.select.return_value.eq.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([])
                mock_tbl.insert.return_value.execute.return_value = \
                    create_mock_db_response([{"party_id": mock_party["id"], "user_id": mock_user["id"]}])
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.post(
            f"/parties/{mock_party['id']}/going",
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["going"] is True
        assert data["goingCount"] == 1

    def test_mark_going_idempotent(self, client, mock_supabase, mock_user, mock_party):
        """Already going → 200 going:true without insert."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        insert_called = {"n": 0}

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "parties":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{**mock_party, "going_count": 5}])
            elif table_name == "party_going":
                mock_tbl.select.return_value.eq.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{"party_id": mock_party["id"], "user_id": mock_user["id"]}])

                def _insert(*_a, **_k):
                    insert_called["n"] += 1
                    return MagicMock(execute=MagicMock(return_value=create_mock_db_response([])))

                mock_tbl.insert.side_effect = _insert
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.post(
            f"/parties/{mock_party['id']}/going",
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        assert response.json()["going"] is True
        assert insert_called["n"] == 0

    def test_mark_going_party_not_found(self, client, mock_supabase, mock_user):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([])

        response = client.post(
            f"/parties/{uuid.uuid4()}/going",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 404

    def test_mark_going_pending_party_404(self, client, mock_supabase, mock_user, mock_party):
        mock_party["status"] = "pending"
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([mock_party])

        response = client.post(
            f"/parties/{mock_party['id']}/going",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 404

    def test_mark_going_unauthenticated(self, client, mock_supabase, mock_party):
        response = client.post(f"/parties/{mock_party['id']}/going")
        assert response.status_code == 401

    def test_mark_going_requires_onboarding(
        self, client, enforce_onboarding, mock_supabase, mock_user, mock_party
    ):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "user_profiles":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{
                        "id": mock_user["id"],
                        "email": mock_user["email"],
                        "username": None,
                        "school_year": None,
                    }])
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.post(
            f"/parties/{mock_party['id']}/going",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 403
        assert "account" in response.json()["detail"].lower()


class TestUnmarkGoing:
    """Tests for DELETE /parties/{party_id}/going."""

    def test_unmark_going_success(self, client, mock_supabase, mock_user, mock_party):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "parties":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{**mock_party, "going_count": 0}])
            elif table_name == "party_going":
                mock_tbl.delete.return_value.eq.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([])
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.delete(
            f"/parties/{mock_party['id']}/going",
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["going"] is False
        assert data["goingCount"] == 0

    def test_unmark_going_idempotent(self, client, mock_supabase, mock_user, mock_party):
        """Not going → still 200 going:false."""
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "parties":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{**mock_party, "going_count": 3}])
            elif table_name == "party_going":
                mock_tbl.delete.return_value.eq.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([])
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.delete(
            f"/parties/{mock_party['id']}/going",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200
        assert response.json()["going"] is False

    def test_unmark_going_unauthenticated(self, client, mock_supabase, mock_party):
        response = client.delete(f"/parties/{mock_party['id']}/going")
        assert response.status_code == 401


class TestGetUserGoingParties:
    """Tests for GET /parties/user/going endpoint."""

    def test_get_user_going_parties_success(self, client, mock_supabase, mock_user):
        party_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "user_profiles":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{
                        "id": mock_user["id"],
                        "username": "testuser",
                        "school_year": "2028",
                    }])
            elif table_name == "party_going":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([
                        {"party_id": party_ids[0]},
                        {"party_id": party_ids[1]},
                    ])
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.get(
            "/parties/user/going",
            headers={"Authorization": "Bearer valid_token"},
        )

        assert response.status_code == 200
        assert set(response.json()) == set(party_ids)

    def test_get_user_going_parties_empty(self, client, mock_supabase, mock_user):
        mock_supabase.auth.get_user = MagicMock(
            return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
        )

        def mock_table(table_name):
            mock_tbl = MagicMock()
            if table_name == "user_profiles":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{
                        "id": mock_user["id"],
                        "username": "testuser",
                        "school_year": "2028",
                    }])
            elif table_name == "party_going":
                mock_tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([])
            return mock_tbl

        mock_supabase.table = mock_table

        response = client.get(
            "/parties/user/going",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_get_user_going_parties_unauthenticated(self, client, mock_supabase):
        response = client.get("/parties/user/going")
        assert response.status_code == 401


class TestAnonGoingEndpointsRemoved:
    """Epic 10.2 — anonymous forgeable write surface must stay gone."""

    def test_anonymous_increment_gone(self, client, mock_supabase, mock_party):
        response = client.post(f"/parties/{mock_party['id']}/going/anonymous")
        assert response.status_code == 404

    def test_anonymous_decrement_gone(self, client, mock_supabase, mock_party):
        response = client.post(f"/parties/{mock_party['id']}/going/anonymous/decrement")
        assert response.status_code == 404
