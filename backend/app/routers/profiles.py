import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from slowapi import Limiter
from app.rate_limit import client_ip_key

from app.constants import RATE_LIMITS
from app.config import get_settings
from app.database import supabase
from app.models.user import ALLOWED_SCHOOL_YEARS, ProfileUpdate, User
from app.routers.auth import require_auth

_AVATAR_MAX_BYTES = 512_000  # matches avatars bucket limit
_AVATAR_MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

router = APIRouter(prefix="/profiles", tags=["profiles"])
limiter = Limiter(key_func=client_ip_key)
logger = logging.getLogger(__name__)

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{2,30}$")
_INSTAGRAM_RE = re.compile(r"^[a-zA-Z0-9._]{1,30}$")


def _profile_to_user(profile: dict, email: Optional[str]) -> User:
    raw_email = (email or profile.get("email") or "").strip()
    created = profile.get("created_at") or datetime.now(timezone.utc).isoformat()
    return User(
        id=str(profile["id"]),
        email=raw_email or "unknown@temple.edu",
        username=profile.get("username"),
        is_admin=bool(profile.get("is_admin", False)),
        created_at=created,
        school_year=profile.get("school_year"),
        greek_life=profile.get("greek_life"),
        instagram=profile.get("instagram"),
        avatar_url=profile.get("avatar_url"),
        is_host=bool(profile.get("is_host", False)),
    )


def ensure_profile(user: dict) -> dict:
    """
    Return the user_profiles row, creating a stub if the auth trigger missed
    (e.g. users created before Epic 3.4).
    """
    result = (
        supabase.table("user_profiles")
        .select("*")
        .eq("id", user["id"])
        .execute()
    )
    if result.data:
        return result.data[0]

    created = (
        supabase.table("user_profiles")
        .insert(
            {
                "id": user["id"],
                "email": user.get("email"),
                "is_admin": False,
            }
        )
        .execute()
    )
    if not created.data:
        raise HTTPException(status_code=500, detail="Failed to create profile")
    return created.data[0]


def profile_is_onboarded(profile: dict) -> bool:
    """True when the profile has the same required fields as /onboarding."""
    username = profile.get("username")
    school_year = profile.get("school_year")
    return (
        isinstance(username, str)
        and bool(username.strip())
        and isinstance(school_year, str)
        and bool(school_year.strip())
    )


def require_onboarded(user: dict = Depends(require_auth)) -> dict:
    """Product actions require username + school year — the same bar as /onboarding."""
    profile = ensure_profile(user)
    if not profile_is_onboarded(profile):
        raise HTTPException(
            status_code=403,
            detail="Finish setting up your account first",
        )
    return user


def _validate_username(username: str) -> str:
    cleaned = username.strip()
    if not _USERNAME_RE.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Username must be 2–30 characters: letters, numbers, underscore",
        )
    return cleaned


def _validate_school_year(value: str) -> str:
    """The field stores a GRADUATION YEAR ("2028") since the 2026-08-17
    redesign; the legacy class-standing values stay accepted so accounts
    created before the switch keep working."""
    cleaned = value.strip().lower()
    if cleaned.isdigit() and len(cleaned) == 4 and 2020 <= int(cleaned) <= 2040:
        return cleaned
    if cleaned not in ALLOWED_SCHOOL_YEARS:
        raise HTTPException(
            status_code=400,
            detail="school_year must be a graduation year (e.g. 2028)",
        )
    return cleaned


def _validate_instagram(value: str) -> str:
    cleaned = value.strip().lstrip("@")
    if cleaned == "":
        return ""
    if not _INSTAGRAM_RE.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="instagram must be a valid handle (letters, numbers, . _)",
        )
    return cleaned


def _validate_optional_text(value: str, field: str, max_len: int = 100) -> str:
    cleaned = value.strip()
    if len(cleaned) > max_len:
        raise HTTPException(
            status_code=400,
            detail=f"{field} must be {max_len} characters or less",
        )
    return cleaned


@router.get("/me", response_model=User)
async def get_my_profile(user: dict = Depends(require_auth)):
    """Return the authenticated user's profile (creates stub if missing)."""
    try:
        profile = ensure_profile(user)
        return _profile_to_user(profile, user.get("email"))
    except HTTPException:
        raise
    except Exception as e:
        # DB trouble, not a bad request — 503 tells the client "retry me",
        # while a 400/401 here made healthy accounts look brand-new during
        # the 2026-08-18 outage and re-triggered onboarding.
        logger.exception("GET /profiles/me failed")
        raise HTTPException(
            status_code=503,
            detail="Your profile is temporarily unavailable — try again in a moment.",
        ) from e


@router.get("/username-available")
@limiter.limit(RATE_LIMITS["username_check"])
async def username_available(
    request: Request,
    username: str,
    user: dict = Depends(require_auth),
):
    """
    Live username availability for onboarding (6.3).
    Charset/length validated the same way as PATCH; taken names return available=false.
    """
    cleaned = username.strip()
    if not _USERNAME_RE.match(cleaned):
        return {
            "username": cleaned,
            "available": False,
            "reason": "invalid",
        }

    try:
        clash = (
            supabase.table("user_profiles")
            .select("id")
            .eq("username", cleaned)
            .neq("id", user["id"])
            .execute()
        )
        taken = bool(clash.data)
        return {
            "username": cleaned,
            "available": not taken,
            "reason": "taken" if taken else None,
        }
    except Exception as e:
        logger.exception("GET /profiles/username-available failed")
        raise HTTPException(
            status_code=503,
            detail="Couldn't check that username right now — try again in a moment.",
        ) from e


@router.patch("/me", response_model=User)
@limiter.limit(RATE_LIMITS["profile_update"])
async def update_my_profile(
    request: Request,
    data: ProfileUpdate,
    user: dict = Depends(require_auth),
):
    """
    Update onboarding / profile fields for the authenticated user.
    Absorbs v1 POST /auth/set-username (username is one of the patchable fields).
    """
    updates: dict = {}

    if data.username is not None:
        updates["username"] = _validate_username(data.username)
    if data.school_year is not None:
        updates["school_year"] = _validate_school_year(data.school_year)
    if data.greek_life is not None:
        updates["greek_life"] = _validate_optional_text(data.greek_life, "greek_life") or None
    if data.instagram is not None:
        handle = _validate_instagram(data.instagram)
        updates["instagram"] = handle or None
    if data.avatar_url is not None:
        updates["avatar_url"] = _validate_optional_text(data.avatar_url, "avatar_url", 500) or None

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        ensure_profile(user)

        # Username uniqueness — surface a clean 409 instead of a raw DB error.
        if "username" in updates:
            clash = (
                supabase.table("user_profiles")
                .select("id")
                .eq("username", updates["username"])
                .neq("id", user["id"])
                .execute()
            )
            if clash.data:
                raise HTTPException(status_code=409, detail="Username already taken")

        # postgrest returns the updated row by default (return=representation),
        # so no extra .select() is needed — and the filter builder has no such
        # method; chaining one raises AttributeError (the 1.0.5 bug).
        result = (
            supabase.table("user_profiles")
            .update(updates)
            .eq("id", user["id"])
            .execute()
        )
        row = result.data[0] if result.data else None
        if row is None:
            # Belt-and-braces: if the UPDATE matched but returned nothing,
            # read the row back before declaring failure.
            readback = (
                supabase.table("user_profiles")
                .select("*")
                .eq("id", user["id"])
                .execute()
            )
            row = readback.data[0] if readback.data else None
        if not row:
            raise HTTPException(status_code=400, detail="Failed to update profile")

        return _profile_to_user(row, user.get("email"))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("PATCH /profiles/me failed")
        # Unique constraint races still possible under concurrency.
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=409, detail="Username already taken") from e
        # Anything else is on us (DB / network), so say "retry" instead of
        # blaming the request with a 400.
        raise HTTPException(
            status_code=503,
            detail="Couldn't save your profile right now — try again in a moment.",
        ) from e


@router.post("/me/avatar", response_model=User)
@limiter.limit(RATE_LIMITS["avatar_upload"])
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(require_auth),
):
    """
    Mediated avatar upload (6.4): client sends a resized image; backend writes to
    the avatars bucket with a randomized key and stores the public URL on the profile.
    """
    content_type = (file.content_type or "").lower().strip()
    ext = _AVATAR_MIME_TO_EXT.get(content_type)
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Avatar must be JPEG, PNG, or WebP",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > _AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Avatar must be 512KB or smaller",
        )

    object_path = f"{user['id']}/{uuid.uuid4().hex}.{ext}"

    try:
        ensure_profile(user)
        # Service-role upload bypasses Storage RLS; path is still namespaced by user id.
        supabase.storage.from_("avatars").upload(
            object_path,
            raw,
            {"content-type": content_type, "upsert": "false"},
        )

        settings = get_settings()
        public_url = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/avatars/{object_path}"
        )

        result = (
            supabase.table("user_profiles")
            .update({"avatar_url": public_url})
            .eq("id", user["id"])
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to save avatar")

        return _profile_to_user(result.data[0], user.get("email"))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("POST /profiles/me/avatar failed")
        raise HTTPException(
            status_code=503,
            detail="Couldn't upload your avatar right now — try again in a moment.",
        ) from e
