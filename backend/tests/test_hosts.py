"""Host applications: apply, status, admin approve/reject, party-create gate."""
from unittest.mock import MagicMock
import uuid

from tests.conftest import create_mock_auth_response, create_mock_db_response


def _auth(mock_supabase, mock_user):
    mock_supabase.auth.get_user = MagicMock(
        return_value=create_mock_auth_response(mock_user["id"], mock_user["email"])
    )


def _profile(mock_user, **overrides):
    row = {
        "id": mock_user["id"],
        "email": mock_user["email"],
        "username": "owl",
        "school_year": "2028",
        "is_admin": False,
        "is_host": False,
        "created_at": "2026-08-01T00:00:00",
    }
    row.update(overrides)
    return row


def _application(mock_user, **overrides):
    row = {
        "id": str(uuid.uuid4()),
        "user_id": mock_user["id"],
        "org_type": "frat",
        "org_name": "Alpha Sigma Phi",
        "instagram": "alphasigmaphi_tu",
        "address": "1629 W Diamond St",
        "status": "pending",
        "created_at": "2026-08-17T12:00:00",
        "reviewed_at": None,
        "reviewed_by": None,
    }
    row.update(overrides)
    return row


def _apply_payload():
    return {
        "org_type": "frat",
        "org_name": "Alpha Sigma Phi",
        "instagram": "@alphasigmaphi_tu",
        "address": "1629 W Diamond St",
    }


class TestHostMe:
    def test_not_host_no_application(self, client, mock_supabase, mock_user):
        _auth(mock_supabase, mock_user)

        def mock_table(name):
            tbl = MagicMock()
            if name == "user_profiles":
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([_profile(mock_user)])
            else:
                tbl.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = \
                    create_mock_db_response([])
            return tbl

        mock_supabase.table.side_effect = mock_table

        response = client.get("/hosts/me", headers={"Authorization": "Bearer valid_token"})
        assert response.status_code == 200
        data = response.json()
        assert data["isHost"] is False
        assert data["application"] is None

    def test_pending_application(self, client, mock_supabase, mock_user):
        _auth(mock_supabase, mock_user)
        app = _application(mock_user)

        def mock_table(name):
            tbl = MagicMock()
            if name == "user_profiles":
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([_profile(mock_user)])
            else:
                tbl.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = \
                    create_mock_db_response([app])
            return tbl

        mock_supabase.table.side_effect = mock_table

        response = client.get("/hosts/me", headers={"Authorization": "Bearer valid_token"})
        assert response.status_code == 200
        data = response.json()
        assert data["application"]["orgName"] == "Alpha Sigma Phi"
        assert data["application"]["status"] == "pending"
        assert data["application"]["instagram"] == "alphasigmaphi_tu"

    def test_unauthenticated(self, client, mock_supabase):
        assert client.get("/hosts/me").status_code == 401


class TestApplyToHost:
    def test_apply_success(self, client, mock_supabase, mock_user):
        _auth(mock_supabase, mock_user)
        created = _application(mock_user)

        def mock_table(name):
            tbl = MagicMock()
            if name == "user_profiles":
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([_profile(mock_user)])
            else:
                tbl.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = \
                    create_mock_db_response([])
                tbl.insert.return_value.execute.return_value = create_mock_db_response([created])
            return tbl

        mock_supabase.table.side_effect = mock_table

        response = client.post(
            "/hosts/applications",
            json=_apply_payload(),
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "pending"
        assert response.json()["instagram"] == "alphasigmaphi_tu"

    def test_already_host_conflict(self, client, mock_supabase, mock_user):
        _auth(mock_supabase, mock_user)

        def mock_table(name):
            tbl = MagicMock()
            tbl.select.return_value.eq.return_value.execute.return_value = \
                create_mock_db_response([_profile(mock_user, is_host=True)])
            return tbl

        mock_supabase.table.side_effect = mock_table

        response = client.post(
            "/hosts/applications",
            json=_apply_payload(),
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 409

    def test_duplicate_pending_conflict(self, client, mock_supabase, mock_user):
        _auth(mock_supabase, mock_user)

        def mock_table(name):
            tbl = MagicMock()
            if name == "user_profiles":
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([_profile(mock_user)])
            else:
                tbl.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = \
                    create_mock_db_response([{"id": str(uuid.uuid4())}])
            return tbl

        mock_supabase.table.side_effect = mock_table

        response = client.post(
            "/hosts/applications",
            json=_apply_payload(),
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 409

    def test_rejects_bad_org_type(self, client, mock_supabase, mock_user):
        _auth(mock_supabase, mock_user)
        response = client.post(
            "/hosts/applications",
            json={**_apply_payload(), "org_type": "club"},
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 422


class TestCreatePartyRequiresHost:
    def test_non_host_cannot_create(self, client, mock_supabase, mock_user, valid_party_data):
        _auth(mock_supabase, mock_user)
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([_profile(mock_user, is_host=False)])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 403
        assert "host" in response.json()["detail"].lower()

    def test_admin_can_create_without_host_flag(
        self, client, mock_supabase, mock_user, valid_party_data
    ):
        _auth(mock_supabase, mock_user)
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
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([_profile(mock_user, is_admin=True, is_host=False)])
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            create_mock_db_response([created_party])

        response = client.post(
            "/parties",
            json=valid_party_data,
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200


class TestAdminHostApplications:
    def _as_admin(self, mock_supabase, mock_admin_user):
        _auth(mock_supabase, mock_admin_user)

    def test_list_requires_admin(self, client, mock_supabase, mock_user):
        _auth(mock_supabase, mock_user)
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = \
            create_mock_db_response([{"is_admin": False}])
        response = client.get(
            "/admin/host-applications",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 403

    def test_approve_sets_is_host(self, client, mock_supabase, mock_admin_user, mock_user):
        self._as_admin(mock_supabase, mock_admin_user)
        app = _application(mock_user)

        def mock_table(name):
            tbl = MagicMock()
            if name == "user_profiles":
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{"is_admin": True}])
                tbl.update.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([_profile(mock_user, is_host=True)])
            else:
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([app])
                tbl.update.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{**app, "status": "approved"}])
            return tbl

        mock_supabase.table.side_effect = mock_table

        response = client.post(
            f"/admin/host-applications/{app['id']}/approve",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200
        assert "approved" in response.json()["message"].lower()

    def test_reject_pending(self, client, mock_supabase, mock_admin_user, mock_user):
        self._as_admin(mock_supabase, mock_admin_user)
        app = _application(mock_user)

        def mock_table(name):
            tbl = MagicMock()
            if name == "user_profiles":
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{"is_admin": True}])
            else:
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([app])
                tbl.update.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{**app, "status": "rejected"}])
            return tbl

        mock_supabase.table.side_effect = mock_table

        response = client.post(
            f"/admin/host-applications/{app['id']}/reject",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 200

    def test_approve_not_pending(self, client, mock_supabase, mock_admin_user, mock_user):
        self._as_admin(mock_supabase, mock_admin_user)
        app = _application(mock_user, status="approved")

        def mock_table(name):
            tbl = MagicMock()
            if name == "user_profiles":
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([{"is_admin": True}])
            else:
                tbl.select.return_value.eq.return_value.execute.return_value = \
                    create_mock_db_response([app])
            return tbl

        mock_supabase.table.side_effect = mock_table

        response = client.post(
            f"/admin/host-applications/{app['id']}/approve",
            headers={"Authorization": "Bearer valid_token"},
        )
        assert response.status_code == 400
