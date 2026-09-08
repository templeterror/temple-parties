import asyncio
import logging
import uuid
from fastapi import APIRouter, File, HTTPException, Depends, Query, Request, UploadFile
from typing import List, Optional
from datetime import date, timedelta
from slowapi import Limiter
from app.rate_limit import client_ip_key
from app.config import get_settings
from app.database import supabase
from app.models.party import (
    HostStats,
    PartyCreate,
    PartyUpdate,
    PartyResponse,
    PartiesListResponse,
    PosterUploadResponse,
    AddressSuggestion,
    CreateWeekendOptionsResponse,
    WeekendOption,
)
from app.routers.auth import get_current_user
from app.routers.profiles import ensure_profile, require_onboarded
from app.routers.hosts import require_host_poster
from app.services.geocoding import geocode_address, suggest_addresses
from app.services import weekend as weekend_service
from app.services.admin_check import user_is_admin
from app.constants import RATE_LIMITS

router = APIRouter(prefix="/parties", tags=["parties"])
limiter = Limiter(key_func=client_ip_key)
logger = logging.getLogger(__name__)

_POSTER_MAX_BYTES = 1_048_576  # matches posters bucket limit (1MB)
_POSTER_MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}

# Re-export for callers that still import from this module (admin, ratings).
EASTERN = weekend_service.EASTERN
today_eastern = weekend_service.today_eastern
get_current_weekend = weekend_service.get_current_weekend


_TICKET_REF = "tuparty"


def _resolve_poster_image(stored: Optional[str]) -> Optional[str]:
    """Turn a storage path into a public URL; leave legacy absolute URLs as-is."""
    if not stored:
        return None
    if stored.startswith("http://") or stored.startswith("https://"):
        return stored
    settings = get_settings()
    return (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/posters/{stored}"
    )


def _ticket_url_with_ref(stored: Optional[str]) -> Optional[str]:
    """Return the stored HTTPS ticket URL with ref=tuparty if not already present."""
    if not stored:
        return None
    lower = stored.lower()
    if "ref=" in lower:
        return stored
    sep = "&" if "?" in stored else "?"
    return f"{stored}{sep}ref={_TICKET_REF}"


def _like_dislike_counts(party: dict) -> tuple[int, int]:
    count = int(party.get("rating_count") or 0)
    if count <= 0:
        return 0, 0
    pct = float(party.get("like_percentage") or 0)
    likes = int(round(pct / 100.0 * count))
    likes = max(0, min(count, likes))
    return likes, count - likes


def _day_and_weekend(party_date: date) -> tuple[str, date]:
    return weekend_service.day_and_weekend(party_date)


def _get_host_stats(party: dict) -> Optional[HostStats]:
    """Host cred for the party page, from the leaderboard RPC.

    Reuses get_host_rankings() (the exact math behind the Ranks tab) and picks
    the row for the party's primary host (host_codes[0]). host_codes is
    admin-curated and empty for most self-serve listings, so None is the
    normal case — the host row on the page simply skips its stats line.

    Best-effort by design: the cred line is decorative, so any failure here
    logs and returns None instead of ever breaking the party page.
    """
    codes = party.get("host_codes") or []
    if not codes:
        return None
    try:
        result = supabase.rpc("get_host_rankings").execute()
        for row in result.data or []:
            if row.get("host_code") == codes[0]:
                return HostStats(
                    displayName=row["display_name"],
                    partiesHosted=row.get("parties_hosted") or 0,
                    avgLikePercentage=float(row.get("avg_like_percentage") or 0),
                    logoUrl=row.get("logo_url"),
                )
    except Exception:
        logger.exception("host stats lookup failed for party %s", party.get("id"))
    return None


def _is_headliner(party: dict) -> bool:
    """Is this party its night's headliner (top going count, same weekend+day)?

    Mirrors the feed's client-side "HYPED" pick: highest going_count among
    approved parties that night. Best-effort — any failure just means no
    badge, never an error.
    """
    try:
        result = (
            supabase.table("parties")
            .select("id")
            .eq("weekend_of", party["weekend_of"])
            .eq("day", party["day"])
            .eq("status", "approved")
            .order("going_count", desc=True)
            .limit(1)
            .execute()
        )
        return bool(result.data) and result.data[0]["id"] == party["id"]
    except Exception:
        logger.exception("headliner lookup failed for party %s", party.get("id"))
        return False


def db_to_response(party: dict, *, reveal: bool = True, host_stats: Optional[HostStats] = None, is_headliner: bool = False) -> PartyResponse:
    """Convert database party to API response format.

    Soft-gate (Epic 7.3): when reveal is False (anonymous caller), street
    address and engagement counts are null. Lat/lng stay so the map works.
    The promo CODE is gated too — the label/hint stay public as the carrot
    ("PROMO · 20% OFF"), but the code itself needs a sign-in, same as the
    address. ticketUrl / ticketPrice / description stay public.
    host_stats is attached by the detail endpoint only (list stays lean).
    """
    party_date = weekend_service.resolve_party_date(party)
    rating_open, rating_locked = weekend_service.rating_window(party)

    address = party["address"] if reveal else None
    going_count = party["going_count"] if reveal else None
    like_pct = float(party.get("like_percentage") or 0) if reveal else None
    rating_count = (party.get("rating_count") or 0) if reveal else None
    like_count, dislike_count = _like_dislike_counts(party) if reveal else (None, None)

    if hasattr(party_date, "isoformat"):
        party_date = party_date.isoformat()
    day = (party.get("day") or "friday")
    if isinstance(day, str):
        day = day.lower()
    lat = party.get("latitude")
    lng = party.get("longitude")

    return PartyResponse(
        id=party["id"],
        title=party["title"],
        host=party["host"],
        pinLabel=party.get("pin_label") or "",
        category=party["category"],
        day=day,
        date=party_date or "",
        doorsOpen=party.get("doors_open") or "",
        doorsClose=party.get("doors_close"),
        address=address,
        latitude=float(lat) if lat is not None else 0.0,
        longitude=float(lng) if lng is not None else 0.0,
        goingCount=going_count,
        status=party.get("status"),
        likePercentage=like_pct,
        ratingCount=rating_count,
        likeCount=like_count,
        dislikeCount=dislike_count,
        isVerified=party.get("is_verified", False),
        posterImage=_resolve_poster_image(party.get("poster_image")),
        description=party.get("description"),
        ticketPrice=party.get("ticket_price"),
        ticketUrl=_ticket_url_with_ref(party.get("external_ticket_url")),
        promoCode=party.get("promo_code") if reveal else None,
        promoLabel=party.get("promo_label"),
        promoHint=party.get("promo_hint"),
        ratingOpen=rating_open,
        ratingLocked=rating_locked,
        hostStats=host_stats,
        isHeadliner=is_headliner,
    )


def _read_going_count(party_id: str) -> int:
    """Read trigger-maintained going_count from parties (do not write it)."""
    result = (
        supabase.table("parties")
        .select("going_count")
        .eq("id", party_id)
        .execute()
    )
    if not result.data:
        return 0
    return int(result.data[0].get("going_count") or 0)


def _can_view_party(party: dict, user: Optional[dict]) -> bool:
    """Approved is public; pending/rejected only for owner or admin."""
    status = party.get("status") or "approved"
    if status == "approved":
        return True
    if not user:
        return False
    if party.get("created_by") == user["id"]:
        return True
    return user_is_admin(user["id"])


@router.get("", response_model=PartiesListResponse)
async def get_parties(
    day: Optional[str] = Query(None, description="Filter by day (thursday/friday/saturday)"),
    weekend_of: Optional[str] = Query(None, description="Friday date (YYYY-MM-DD) of the weekend to query"),
    user: Optional[dict] = Depends(get_current_user)
):
    """
    Get all approved parties for the requested (or current) weekend,
    plus authoritative weekend metadata for the frontend.
    Anonymous callers get soft-gated fields (no address / counts).
    """
    if weekend_of:
        try:
            weekend = weekend_service.parse_weekend_of(weekend_of)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail="Invalid weekend_of; expected a Friday date as YYYY-MM-DD",
            )
    else:
        weekend = weekend_service.get_current_weekend()

    meta = weekend_service.weekend_meta(weekend)
    reveal = user is not None

    query = supabase.table("parties").select("*").eq("status", "approved").eq("weekend_of", weekend.isoformat())

    if day:
        query = query.eq("day", day)

    try:
        result = query.order("going_count", desc=True).execute()
        rows = result.data or []
    except Exception:
        logger.exception("GET /parties query failed")
        raise HTTPException(status_code=500, detail="Failed to load parties") from None

    parties: List[PartyResponse] = []
    for party in rows:
        try:
            parties.append(db_to_response(party, reveal=reveal))
        except Exception:
            logger.exception("Skipping unreadable party %s", party.get("id"))

    return PartiesListResponse(
        weekendOf=meta.weekend_of.isoformat(),
        thursdayDate=meta.thursday_date.isoformat(),
        fridayDate=meta.friday_date.isoformat(),
        saturdayDate=meta.saturday_date.isoformat(),
        parties=parties,
    )


@router.get("/user/going", response_model=List[str])
async def get_user_going_parties(user: dict = Depends(require_onboarded)):
    """
    Get list of party IDs that the current user is going to.
    """
    result = supabase.table("party_going").select("party_id").eq("user_id", user["id"]).execute()

    return [row["party_id"] for row in result.data]


_demo_weekend_cache: dict = {"weekend_of": None, "expires_at": None}
_DEMO_CACHE_TTL = timedelta(hours=1)
_DEMO_MIN_PARTIES = 5


@router.get("/demo-weekend")
async def get_demo_weekend():
    """
    Return the Friday (YYYY-MM-DD) of the most recent past weekend with enough
    approved parties to make the /demo page feel alive. Falls back to the
    highest-traffic past Friday in the last 12 months if nothing recent qualifies.
    Result cached in-process for 1 hour.
    """
    now = weekend_service.now_eastern()
    if (
        _demo_weekend_cache["weekend_of"] is not None
        and _demo_weekend_cache["expires_at"] is not None
        and _demo_weekend_cache["expires_at"] > now
    ):
        return {"weekendOf": _demo_weekend_cache["weekend_of"]}

    today_iso = today_eastern().isoformat()

    rows = (
        supabase.table("parties")
        .select("weekend_of, going_count")
        .eq("status", "approved")
        .lt("weekend_of", today_iso)
        .execute()
    )

    counts: dict[str, int] = {}
    going_sums: dict[str, int] = {}
    for row in rows.data or []:
        wk = row.get("weekend_of")
        if not wk:
            continue
        wk_key = wk.isoformat() if hasattr(wk, "isoformat") else str(wk)
        counts[wk_key] = counts.get(wk_key, 0) + 1
        going_sums[wk_key] = going_sums.get(wk_key, 0) + (row.get("going_count") or 0)

    chosen: Optional[str] = None

    # Primary: most recent past Friday with >= _DEMO_MIN_PARTIES approved parties.
    qualifying = sorted(
        (wk for wk, c in counts.items() if c >= _DEMO_MIN_PARTIES),
        reverse=True,
    )
    if qualifying:
        chosen = qualifying[0]

    # Fallback: highest-traffic past Friday in the last 12 months.
    if chosen is None:
        cutoff = (today_eastern() - timedelta(days=365)).isoformat()
        candidates = [wk for wk in counts.keys() if wk >= cutoff]
        if candidates:
            chosen = max(candidates, key=lambda wk: going_sums.get(wk, 0))

    if chosen is None:
        raise HTTPException(status_code=404, detail="No past weekend with party data available")

    _demo_weekend_cache["weekend_of"] = chosen
    _demo_weekend_cache["expires_at"] = now + _DEMO_CACHE_TTL

    return {"weekendOf": chosen}


@router.get("/create-options", response_model=CreateWeekendOptionsResponse)
async def get_create_options(user: dict = Depends(require_onboarded)):
    """
    Future (and in-progress Saturday) weekends for the create-party picker.
    Browse `GET /parties` weekend meta can be a *past* Friday on Mon — never use that for create.
    """
    del user
    today = weekend_service.today_eastern()
    weekends = weekend_service.creatable_weekends(12, today)
    return CreateWeekendOptionsResponse(
        today=today.isoformat(),
        weekends=[
            WeekendOption(
                weekendOf=w.weekend_of.isoformat(),
                thursdayDate=w.thursday_date.isoformat(),
                fridayDate=w.friday_date.isoformat(),
                saturdayDate=w.saturday_date.isoformat(),
            )
            for w in weekends
        ],
    )


@router.get("/address-suggest", response_model=list[AddressSuggestion])
@limiter.limit(RATE_LIMITS["address_suggest"])
async def address_suggest(
    request: Request,
    q: str = Query(..., min_length=3, max_length=200),
    user: dict = Depends(require_onboarded),
):
    """
    Autocomplete addresses near Temple via server-side Nominatim.
    Browsers cannot call Nominatim directly (403) — use this proxy.
    """
    del user  # auth required; unused beyond that
    results = await asyncio.to_thread(suggest_addresses, q)
    return [AddressSuggestion(**row) for row in results]


@router.get("/mine", response_model=List[PartyResponse])
async def get_my_parties(user: dict = Depends(require_onboarded)):
    """
    Listings created by the current user (pending / approved / rejected).
    Must be registered before GET /{party_id} so "mine" is not captured as an id.
    """
    result = (
        supabase.table("parties")
        .select("*")
        .eq("created_by", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return [db_to_response(party, reveal=True) for party in (result.data or [])]


@router.post("/poster", response_model=PosterUploadResponse)
@limiter.limit(RATE_LIMITS["poster_upload"])
async def upload_poster(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(require_onboarded),
):
    """
    Mediated poster upload (Epic 8.1): client sends an image; backend writes to
    the posters bucket with a randomized key and returns the storage path only.
    """
    content_type = (file.content_type or "").lower().strip()
    ext = _POSTER_MIME_TO_EXT.get(content_type)
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Poster must be JPEG, PNG, WebP, or GIF",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > _POSTER_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Poster must be 1MB or smaller",
        )

    object_path = f"{user['id']}/{uuid.uuid4().hex}.{ext}"

    try:
        require_host_poster(user)
        supabase.storage.from_("posters").upload(
            object_path,
            raw,
            {"content-type": content_type, "upsert": "false"},
        )
        return PosterUploadResponse(path=object_path)
    except HTTPException:
        raise
    except Exception:
        logger.exception("POST /parties/poster failed")
        raise HTTPException(status_code=400, detail="Failed to upload poster")


@router.get("/{party_id}", response_model=PartyResponse)
async def get_party(
    party_id: str,
    user: Optional[dict] = Depends(get_current_user),
):
    """
    Get a single party by ID.
    Public: approved only. Owner + admin may see pending/rejected.
    Soft-gate strips address/counts for anonymous callers.
    """
    result = supabase.table("parties").select("*").eq("id", party_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Party not found")

    party = result.data[0]
    if not _can_view_party(party, user):
        raise HTTPException(status_code=404, detail="Party not found")

    # Host cred + headliner status are public (same data anyone can derive
    # from the feed) — the soft gate only covers address + counts.
    return db_to_response(
        party,
        reveal=user is not None,
        host_stats=_get_host_stats(party),
        is_headliner=_is_headliner(party),
    )


@router.post("", response_model=PartyResponse)
@limiter.limit(RATE_LIMITS["create_party"])
async def create_party(request: Request, data: PartyCreate, user: dict = Depends(require_onboarded)):
    """
    Create a new party. Status will be 'pending' until admin approves.
    Rate limited to 10 requests per minute per IP.
    Geocode failures surface as 422 (no silent fake pins — Epic 8.2 / §8.14).
    Hosts only — apply at POST /hosts/applications first.
    """
    profile = require_host_poster(user)

    # A host's approved application IS their org identity: parties render
    # under the org's name (not whatever the request claims) — ADMINS
    # INCLUDED, so nobody's personal username ever shows as the host. The
    # only free-text case left is an admin with no application at all
    # (posting on behalf of an org that hasn't onboarded — the name they
    # type is deliberate, never a defaulted username). Everyone else must
    # apply first; a legacy is_host flag alone is no longer enough.
    host_name = data.host
    org = _approved_host_application(user["id"])
    if org:
        host_name = org["org_name"][:30]
        if data.category == "Frat Party" and org.get("org_type") != "frat" and not profile.get("is_admin"):
            raise HTTPException(
                status_code=422,
                detail="Only frat host accounts can post Frat Party listings",
            )
    elif not profile.get("is_admin"):
        raise HTTPException(
            status_code=403,
            detail="Set up your host account first — apply on the Become a Host page",
        )

    return await insert_party(data, user["id"], host_name=host_name, status="pending")


async def insert_party(
    data: PartyCreate, user_id: str, *, host_name: str, status: str
) -> PartyResponse:
    """The shared create core: poster ownership check → geocode → weekend
    validation → insert.

    Both posting flows funnel through here — the host flow above (org-stamped
    name, pending review) and the admin manual-upload flow in routers/admin.py
    (typed name, live immediately) — so the validation rules can never drift
    between them. Callers decide WHO the party posts as and WHAT status it
    starts in; this function guarantees everything else is legit.
    """
    _require_own_poster_path(data.poster_image, user_id)

    lat, lng = data.latitude, data.longitude
    if lat is None or lng is None:
        # Off the event loop — Nominatim is sync HTTP (§8.13).
        geocoded = await asyncio.to_thread(geocode_address, data.address)
        if geocoded is None:
            raise HTTPException(
                status_code=422,
                detail="We couldn't find that location. Try a street address or campus spot (e.g. Bell Tower).",
            )
        lat, lng = geocoded

    # Derive day and weekend_of from the submitted date
    party_date = date.fromisoformat(data.date)
    if not weekend_service.is_creatable_party_date(party_date):
        raise HTTPException(
            status_code=422,
            detail="Party date must be a Thursday, Friday, or Saturday today or in the future",
        )
    day, weekend = _day_and_weekend(party_date)

    try:
        party_data = {
            "title": data.title,
            "host": host_name,
            "pin_label": data.pin_label,
            "category": data.category,
            "day": day,
            "date": data.date,
            "doors_open": data.doors_open,
            "doors_close": data.doors_close,
            "address": data.address,
            "latitude": lat,
            "longitude": lng,
            "going_count": 0,
            "created_by": user_id,
            "status": status,
            "weekend_of": weekend.isoformat(),
            "poster_image": data.poster_image,
            "description": data.description,
            "ticket_price": data.ticket_price,
            "external_ticket_url": data.external_ticket_url,
            "promo_code": data.promo_code,
            "promo_label": data.promo_label,
            "promo_hint": data.promo_hint,
        }

        result = supabase.table("parties").insert(party_data).execute()

        return db_to_response(result.data[0], reveal=True)

    except HTTPException:
        raise
    except Exception:
        logger.exception("party insert failed")
        raise HTTPException(status_code=400, detail="Failed to create party")


def _approved_host_application(user_id: str) -> Optional[dict]:
    """Latest approved host application — the host's org identity.

    Returns None only when the user genuinely has no approved application
    (admins, or hosts who haven't applied/been approved yet). A lookup
    FAILURE raises instead: since the org name is now required to post, a
    DB hiccup must fail loudly rather than quietly treat a real host as
    unapproved (or, worse, let a submitted name through unchecked).
    """
    try:
        result = (
            supabase.table("host_applications")
            .select("org_name, org_type")
            .eq("user_id", user_id)
            .eq("status", "approved")
            .order("reviewed_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("approved host application lookup failed for %s", user_id)
        raise HTTPException(
            status_code=503,
            detail="Couldn't verify your host account — try again in a moment",
        )
    return result.data[0] if result.data else None


def _require_own_poster_path(poster_image: Optional[str], user_id: str) -> None:
    if poster_image is None:
        return
    prefix = f"{user_id}/"
    if not poster_image.startswith(prefix):
        raise HTTPException(
            status_code=422,
            detail="poster_image must be a path uploaded by this account",
        )


@router.patch("/{party_id}", response_model=PartyResponse)
@limiter.limit(RATE_LIMITS["update_party"])
async def update_party(
    request: Request,
    party_id: str,
    data: PartyUpdate,
    user: dict = Depends(require_onboarded),
):
    """
    Owner edit. Pending and approved only — rejected listings stay frozen.
    Rate limited to 10 requests per minute per IP.
    """
    profile = ensure_profile(user)

    result = supabase.table("parties").select("*").eq("id", party_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Party not found")

    party = result.data[0]
    if party.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own parties")
    if (party.get("status") or "") == "rejected":
        raise HTTPException(status_code=403, detail="Rejected parties cannot be edited")

    updates = data.model_dump(exclude_unset=True)

    # Same rule as create for regular hosts: the rendered host name is the
    # org name, never free text — any edit that touches `host` gets it
    # re-stamped (or dropped if they somehow have no application). Admins
    # are exempt HERE even though create stamps them: they own the
    # manual-upload flow, and fixing a manually posted party's host name
    # would otherwise get the admin's own org stamped over it.
    if "host" in updates and not profile.get("is_admin"):
        org = _approved_host_application(user["id"])
        if org:
            updates["host"] = org["org_name"][:30]
        else:
            updates.pop("host")

    if "poster_image" in updates:
        _require_own_poster_path(updates["poster_image"], user["id"])

    if updates.get("date"):
        party_date = date.fromisoformat(updates["date"])
        if not weekend_service.is_creatable_party_date(party_date):
            raise HTTPException(
                status_code=422,
                detail="Party date must be a Thursday, Friday, or Saturday today or in the future",
            )
        day, weekend = _day_and_weekend(party_date)
        updates["day"] = day
        updates["weekend_of"] = weekend.isoformat()

    address_changed = "address" in updates and updates["address"] is not None
    lat = updates.get("latitude")
    lng = updates.get("longitude")
    coords_provided = lat is not None and lng is not None
    if address_changed and not coords_provided:
        geocoded = await asyncio.to_thread(geocode_address, updates["address"])
        if geocoded is None:
            raise HTTPException(
                status_code=422,
                detail="We couldn't find that location. Try a street address or campus spot (e.g. Bell Tower).",
            )
        updates["latitude"], updates["longitude"] = geocoded

    if not updates:
        return db_to_response(party, reveal=True)

    # Re-review rule (spec 11.5): editing an APPROVED listing sends it back
    # to the moderation queue. Without this, a host could get a harmless
    # party approved and then swap in anything — the approval would be
    # meaningless. Pending listings just stay pending.
    if (party.get("status") or "") == "approved":
        updates["status"] = "pending"

    try:
        updated = (
            supabase.table("parties").update(updates).eq("id", party_id).execute()
        )
        if not updated.data:
            raise HTTPException(status_code=400, detail="Failed to update party")
        return db_to_response(updated.data[0], reveal=True)
    except HTTPException:
        raise
    except Exception:
        logger.exception("PATCH /parties/%s failed", party_id)
        raise HTTPException(status_code=400, detail="Failed to update party")


@router.delete("/{party_id}")
@limiter.limit(RATE_LIMITS["delete_party"])
async def delete_party(request: Request, party_id: str, user: dict = Depends(require_onboarded)):
    """
    Delete a party. Only the creator can delete their party.
    """
    # Check if party exists and belongs to user
    result = supabase.table("parties").select("*").eq("id", party_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Party not found")

    party = result.data[0]

    if party["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own parties")

    supabase.table("parties").delete().eq("id", party_id).execute()

    return {"message": "Party deleted"}


@router.post("/{party_id}/going")
@limiter.limit(RATE_LIMITS["toggle_going_auth"])
async def mark_going(request: Request, party_id: str, user: dict = Depends(require_onboarded)):
    """
    Mark the current user as going to a party (idempotent).
    going_count is maintained by the DB trigger from party_going rows.
    """
    party_result = (
        supabase.table("parties")
        .select("id, status, going_count")
        .eq("id", party_id)
        .execute()
    )

    if not party_result.data:
        raise HTTPException(status_code=404, detail="Party not found")

    party = party_result.data[0]
    if party.get("status") != "approved":
        raise HTTPException(status_code=404, detail="Party not found")

    existing = (
        supabase.table("party_going")
        .select("party_id")
        .eq("party_id", party_id)
        .eq("user_id", user["id"])
        .execute()
    )

    if not existing.data:
        try:
            supabase.table("party_going").insert({
                "party_id": party_id,
                "user_id": user["id"],
            }).execute()
        except Exception:
            # Race: another request inserted first — treat as already going
            pass

    return {"going": True, "goingCount": _read_going_count(party_id)}


@router.delete("/{party_id}/going")
@limiter.limit(RATE_LIMITS["toggle_going_auth"])
async def unmark_going(request: Request, party_id: str, user: dict = Depends(require_onboarded)):
    """
    Remove the current user from a party's going list (idempotent).
    going_count is maintained by the DB trigger from party_going rows.
    """
    party_result = (
        supabase.table("parties")
        .select("id")
        .eq("id", party_id)
        .execute()
    )

    if not party_result.data:
        raise HTTPException(status_code=404, detail="Party not found")

    supabase.table("party_going").delete().eq("party_id", party_id).eq("user_id", user["id"]).execute()

    return {"going": False, "goingCount": _read_going_count(party_id)}
