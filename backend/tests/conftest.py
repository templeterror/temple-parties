"""
Pytest configuration and fixtures for Temple Parties backend tests.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, MagicMock, patch
from datetime import date, datetime, timedelta
import uuid

# Mock the database before importing the app
@pytest.fixture(autouse=True)
def mock_supabase():
    """Mock Supabase client for all tests.

    We need to patch supabase in each router module because Python's
    'from X import Y' creates a binding at import time. If we only patch
    app.database.supabase, modules that already imported supabase won't
    see the new mock.
    """
    mock_db = MagicMock()
    mock_db.table = MagicMock()
    mock_db.auth = MagicMock()
    mock_db.storage = MagicMock()

    with patch('app.database.supabase', mock_db), \
         patch('app.routers.auth.supabase', mock_db), \
         patch('app.routers.profiles.supabase', mock_db), \
         patch('app.routers.parties.supabase', mock_db), \
         patch('app.routers.admin.supabase', mock_db), \
         patch('app.routers.ratings.supabase', mock_db), \
         patch('app.routers.hosts.supabase', mock_db), \
         patch('app.services.admin_check.supabase', mock_db), \
         patch('app.routers.parties.geocode_address', return_value=(39.981, -75.155)):
        yield mock_db


@pytest.fixture
def client(mock_supabase):
    """Create a test client with mocked database and disabled rate limiting."""
    from app.main import app, limiter

    # Disable rate limiting for tests
    limiter.enabled = False

    # Also disable rate limiters in routers
    from app.routers.auth import (
        limiter as auth_limiter,
        _otp_request_by_email,
        _otp_verify_by_email,
    )
    from app.routers.profiles import limiter as profiles_limiter
    from app.routers.parties import limiter as parties_limiter
    from app.routers.ratings import limiter as ratings_limiter
    from app.routers.admin import limiter as admin_limiter
    from app.routers.hosts import limiter as hosts_limiter
    auth_limiter.enabled = False
    profiles_limiter.enabled = False
    parties_limiter.enabled = False
    ratings_limiter.enabled = False
    admin_limiter.enabled = False
    hosts_limiter.enabled = False
    # Per-email limiters are in-process and sticky — clear between tests.
    _otp_request_by_email._hits.clear()
    _otp_verify_by_email._hits.clear()

    # Most tests mock `table.return_value` as a party row. require_onboarded
    # would otherwise treat that row as a profile and 403. Skip the profile
    # lookup here; tests that need the real gate use `enforce_onboarding`.
    from fastapi import Depends
    from app.routers.auth import require_auth
    from app.routers.profiles import require_onboarded

    def _skip_onboarding_check(user: dict = Depends(require_auth)):
        return user

    app.dependency_overrides[require_onboarded] = _skip_onboarding_check

    yield TestClient(app)

    app.dependency_overrides.pop(require_onboarded, None)

    # Re-enable rate limiting after test
    limiter.enabled = True
    auth_limiter.enabled = True
    profiles_limiter.enabled = True
    parties_limiter.enabled = True
    ratings_limiter.enabled = True
    admin_limiter.enabled = True
    hosts_limiter.enabled = True


@pytest.fixture
def enforce_onboarding(client):
    """Run require_onboarded for real (username + school year on the profile)."""
    from app.main import app
    from app.routers.profiles import require_onboarded

    saved = app.dependency_overrides.pop(require_onboarded, None)
    yield
    if saved is not None:
        app.dependency_overrides[require_onboarded] = saved


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    return {
        "id": str(uuid.uuid4()),
        "email": "testuser@temple.edu"
    }


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user."""
    return {
        "id": str(uuid.uuid4()),
        "email": "admin@temple.edu",
        "is_admin": True
    }


@pytest.fixture
def valid_party_data():
    """Valid party creation data."""
    today = date.today()
    days_until_friday = (4 - today.weekday()) % 7
    next_friday = today + timedelta(days=days_until_friday)
    return {
        "title": "Test Party",
        "host": "Test Host",
        "pin_label": "TP",
        "category": "House Party",
        "date": next_friday.isoformat(),
        "doors_open": "10 PM",
        "address": "123 Test St, Philadelphia, PA"
    }


@pytest.fixture
def mock_party():
    """Create a mock party from the database."""
    return {
        "id": str(uuid.uuid4()),
        "title": "Test Party",
        "host": "Test Host",
        "pin_label": "TP",
        "category": "House Party",
        "day": "friday",
        "date": date.today().isoformat(),
        "doors_open": "10 PM",
        "address": "123 Test St",
        "latitude": 39.981,
        "longitude": -75.155,
        "going_count": 10,
        "status": "approved",
        "created_by": str(uuid.uuid4()),
        "weekend_of": date.today().isoformat(),
        "created_at": datetime.now().isoformat(),
        "like_percentage": 0,
        "rating_count": 0,
    }


@pytest.fixture
def auth_headers():
    """Create mock authorization headers."""
    return {"Authorization": "Bearer mock_valid_token"}


def create_mock_auth_response(user_id: str, email: str):
    """Helper to create a mock auth response."""
    mock_response = Mock()
    mock_response.user = Mock()
    mock_response.user.id = user_id
    mock_response.user.email = email
    return mock_response


def create_mock_db_response(data: list, count=None):
    """Helper to create a mock database response."""
    mock_response = Mock()
    mock_response.data = data
    mock_response.count = count if count is not None else len(data)
    return mock_response
