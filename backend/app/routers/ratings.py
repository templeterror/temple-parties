from fastapi import APIRouter, HTTPException, Request, Query, Depends
from typing import List, Optional
from datetime import date
from slowapi import Limiter
from app.rate_limit import client_ip_key
from app.database import supabase
from app.models.rating import RatingCreate, RatingResponse, PartyRankingResponse, HostRankingResponse
from app.routers.auth import get_current_user
from app.routers.profiles import require_onboarded
from app.routers.parties import _resolve_poster_image
from app.services import weekend as weekend_service
from app.constants import RATE_LIMITS

router = APIRouter(prefix="/ratings", tags=["ratings"])
limiter = Limiter(key_func=client_ip_key)

# Thin aliases so existing imports/tests stay stable where needed.
get_current_weekend = weekend_service.get_current_weekend
EASTERN = weekend_service.EASTERN
get_party_date = weekend_service.resolve_party_date
is_rating_active = weekend_service.is_rating_active
is_rating_locked = weekend_service.is_rating_locked
parse_doors_open = weekend_service.parse_doors_open
get_monday_cutoff = weekend_service.get_monday_cutoff


@router.post("/{party_id}", response_model=RatingResponse)
@limiter.limit(RATE_LIMITS["submit_rating"])
async def submit_rating(
    request: Request,
    party_id: str,
    data: RatingCreate,
    user: dict = Depends(require_onboarded),
):
    """
    Submit or update a rating for an approved party (auth required).
    Keyed to user_id; re-rating within the window updates in place.
    """
    party_result = supabase.table("parties").select("*").eq("id", party_id).execute()
    if not party_result.data:
        raise HTTPException(status_code=404, detail="Party not found")

    party = party_result.data[0]

    if party.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Only approved parties can be rated")

    if not is_rating_active(party):
        raise HTTPException(status_code=403, detail="Rating not yet active. Opens at doors open time.")

    if is_rating_locked(party):
        raise HTTPException(status_code=403, detail="Rating period has ended.")

    # "Going only" gate (WF-D rating module): ratings come from people who
    # said they went. An RSVP row is the cheapest honest proxy we have — it
    # keeps drive-by review-bombing out and matches the UI copy
    # ("Unlocks at 11 PM · Going only").
    going = (
        supabase.table("party_going")
        .select("party_id")
        .eq("party_id", party_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not going.data:
        raise HTTPException(
            status_code=403,
            detail="Ratings are for people who went — tap GOING first.",
        )

    existing = (
        supabase.table("party_ratings")
        .select("id")
        .eq("party_id", party_id)
        .eq("user_id", user["id"])
        .execute()
    )

    if existing.data:
        supabase.table("party_ratings").update({
            "rating": data.rating,
            "updated_at": weekend_service.now_eastern().isoformat(),
        }).eq("party_id", party_id).eq("user_id", user["id"]).execute()
    else:
        supabase.table("party_ratings").insert({
            "party_id": party_id,
            "user_id": user["id"],
            "rating": data.rating,
        }).execute()

    all_ratings = supabase.table("party_ratings").select("rating").eq("party_id", party_id).execute()
    ratings = [r["rating"] for r in all_ratings.data]
    count = len(ratings)
    like_pct = round((sum(ratings) / count) * 100, 2) if count else 0

    supabase.table("parties").update({
        "like_percentage": like_pct,
        "rating_count": count,
    }).eq("id", party_id).execute()

    return RatingResponse(
        partyId=party_id,
        rating=data.rating,
        likePercentage=like_pct,
        ratingCount=count,
    )


@router.get("/hosts", response_model=List[HostRankingResponse])
async def get_host_rankings(request: Request):
    """
    Get hosts ranked by rating-count-weighted average like percentage.
    Aggregates across all approved parties; co-hosts (multiple entries in
    parties.host_codes) each receive full credit for the party's ratings.
    """
    result = supabase.rpc("get_host_rankings").execute()
    rows = result.data or []
    return [
        HostRankingResponse(
            hostCode=row["host_code"],
            displayName=row["display_name"],
            logoUrl=row.get("logo_url"),
            partiesHosted=row.get("parties_hosted") or 0,
            totalRatingCount=row.get("total_rating_count") or 0,
            totalGoingCount=row.get("total_going_count") or 0,
            avgLikePercentage=float(row.get("avg_like_percentage") or 0),
            bayesianScore=float(row.get("bayesian_score") or 0),
            finalScore=float(row.get("final_score") or 0),
            isEligible=bool(row.get("is_eligible")),
        )
        for row in rows
    ]


@router.get("/{party_id}")
async def get_party_rating(
    request: Request,
    party_id: str,
    user: Optional[dict] = Depends(get_current_user),
):
    """
    Get rating info for a single party, including the current user's rating when authed.
    """
    party_result = (
        supabase.table("parties")
        .select("like_percentage, rating_count")
        .eq("id", party_id)
        .execute()
    )
    if not party_result.data:
        raise HTTPException(status_code=404, detail="Party not found")

    party = party_result.data[0]
    user_rating = None
    if user:
        user_rating_result = (
            supabase.table("party_ratings")
            .select("rating")
            .eq("party_id", party_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if user_rating_result.data:
            user_rating = user_rating_result.data[0]["rating"]

    return {
        "partyId": party_id,
        "likePercentage": float(party.get("like_percentage") or 0),
        "ratingCount": party.get("rating_count") or 0,
        "userRating": user_rating,
    }


@router.get("", response_model=List[PartyRankingResponse])
async def get_rankings(
    request: Request,
    weekend_of: Optional[str] = Query(None, description="Single Friday date (YYYY-MM-DD)"),
    weekend_from: Optional[str] = Query(None, description="Range start Friday date (YYYY-MM-DD)"),
    weekend_to: Optional[str] = Query(None, description="Range end Friday date (YYYY-MM-DD)"),
    user: Optional[dict] = Depends(get_current_user),
):
    """
    Get all parties ranked by like percentage.
    Supports single weekend (weekend_of) or date range (weekend_from + weekend_to).
    Includes the requesting user's rating per party when authenticated.
    """
    query = supabase.table("parties").select("*").eq("status", "approved")

    if weekend_from and weekend_to:
        # Range bounds only need to be real dates — they feed >= / <= comparisons,
        # so unlike weekend_of they don't have to land exactly on a Friday.
        # Without this check, garbage input reaches the database layer and blows
        # up as a 500 (same defect class as v1 §8.12).
        try:
            date.fromisoformat(weekend_from)
            date.fromisoformat(weekend_to)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail="Invalid weekend_from/weekend_to; expected dates as YYYY-MM-DD",
            )
        query = query.gte("weekend_of", weekend_from).lte("weekend_of", weekend_to)
    elif weekend_of:
        try:
            weekend_service.parse_weekend_of(weekend_of)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail="Invalid weekend_of; expected a Friday date as YYYY-MM-DD",
            )
        query = query.eq("weekend_of", weekend_of)
    else:
        weekend = get_current_weekend()
        query = query.eq("weekend_of", weekend.isoformat())

    result = query.order("like_percentage", desc=True).order("rating_count", desc=True).execute()

    user_ratings_map: dict = {}
    if user:
        user_ratings_result = (
            supabase.table("party_ratings")
            .select("party_id, rating")
            .eq("user_id", user["id"])
            .execute()
        )
        user_ratings_map = {r["party_id"]: r["rating"] for r in user_ratings_result.data}

    rankings = []
    for party in result.data:
        rankings.append(PartyRankingResponse(
            id=party["id"],
            title=party["title"],
            host=party["host"],
            category=party["category"],
            day=party["day"],
            date=get_party_date(party),
            doorsOpen=party["doors_open"],
            likePercentage=float(party.get("like_percentage") or 0),
            ratingCount=party.get("rating_count") or 0,
            goingCount=party.get("going_count") or 0,
            userRating=user_ratings_map.get(party["id"]),
            posterImage=_resolve_poster_image(party.get("poster_image")),
        ))

    return rankings
