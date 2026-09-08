import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from app.rate_limit import client_ip_key

from app.constants import RATE_LIMITS
from app.database import supabase
from app.models.host import HostApplicationCreate, HostApplicationResponse, HostMeResponse
from app.routers.profiles import ensure_profile, require_onboarded, _validate_instagram

router = APIRouter(prefix="/hosts", tags=["hosts"])
limiter = Limiter(key_func=client_ip_key)
logger = logging.getLogger(__name__)


def row_to_application(row: dict) -> HostApplicationResponse:
    created = row.get("created_at")
    reviewed = row.get("reviewed_at")
    return HostApplicationResponse(
        id=row["id"],
        userId=row["user_id"],
        orgType=row["org_type"],
        orgName=row["org_name"],
        instagram=row["instagram"],
        address=row["address"],
        status=row["status"],
        createdAt=str(created) if created else None,
        reviewedAt=str(reviewed) if reviewed else None,
    )


def profile_can_post(profile: dict) -> bool:
    """Approved hosts and admins may create parties."""
    return bool(profile.get("is_host") or profile.get("is_admin"))


def require_host_poster(user: dict) -> dict:
    profile = ensure_profile(user)
    if not profile_can_post(profile):
        raise HTTPException(
            status_code=403,
            detail="Become a host to post a party",
        )
    return profile


@router.get("/me", response_model=HostMeResponse)
async def get_my_host_status(user: dict = Depends(require_onboarded)):
    """Current host flag plus the latest application, if any."""
    profile = ensure_profile(user)
    result = (
        supabase.table("host_applications")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    application = row_to_application(result.data[0]) if result.data else None
    return HostMeResponse(
        isHost=bool(profile.get("is_host") or profile.get("is_admin")),
        application=application,
    )


@router.post("/applications", response_model=HostApplicationResponse)
@limiter.limit(RATE_LIMITS["host_apply"])
async def apply_to_host(
    request: Request,
    data: HostApplicationCreate,
    user: dict = Depends(require_onboarded),
):
    """
    Submit a host application. Proof is an Instagram DM to @tuparties (manual).
    One pending application at a time. Rejected users may apply again.
    """
    profile = ensure_profile(user)
    if profile.get("is_host"):
        raise HTTPException(status_code=409, detail="You are already a host")

    pending = (
        supabase.table("host_applications")
        .select("id")
        .eq("user_id", user["id"])
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if pending.data:
        raise HTTPException(
            status_code=409,
            detail="You already have an application pending review",
        )

    try:
        handle = _validate_instagram(data.instagram)
    except HTTPException:
        raise
    if not handle:
        raise HTTPException(status_code=422, detail="instagram is required")

    try:
        created = (
            supabase.table("host_applications")
            .insert(
                {
                    "user_id": user["id"],
                    "org_type": data.org_type,
                    "org_name": data.org_name,
                    "instagram": handle,
                    "address": data.address,
                    "status": "pending",
                }
            )
            .execute()
        )
        if not created.data:
            raise HTTPException(status_code=400, detail="Failed to submit application")
        return row_to_application(created.data[0])
    except HTTPException:
        raise
    except Exception:
        logger.exception("POST /hosts/applications failed")
        raise HTTPException(status_code=400, detail="Failed to submit application")
