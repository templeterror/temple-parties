"""
Geocoding service using OpenStreetMap Nominatim API.
Converts street addresses and curated Philly/campus landmarks to lat/lng.
"""
import httpx
import logging
import random
import re
from app.constants import TEMPLE_BOUNDS

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "TemplePartiesApp/1.0 (https://tuparties.com; support@tuparties.com)"

# Philadelphia city box for validating geocoding results — covers Temple,
# Fishtown, University City / Drexel, Center City, and Lincoln Financial,
# while rejecting totally wrong cities.
VALID_BOUNDS = {
    "min_lat": 39.875,
    "max_lat": 40.100,
    "min_lng": -75.280,
    "max_lng": -75.050,
}

# viewbox = left,top,right,bottom (Nominatim order)
_TEMPLE_VIEWBOX = (
    f"{VALID_BOUNDS['min_lng']},{VALID_BOUNDS['max_lat']},"
    f"{VALID_BOUNDS['max_lng']},{VALID_BOUNDS['min_lat']}"
)

# Curated spots Nominatim often buries or labels as a nearby road only.
# Matched first in suggest + geocode so "Bell Tower" / "the Linc" just work.
# Optional `label` overrides the default campus suffix (Temple University).
TEMPLE_LANDMARKS: list[dict] = [
    {
        "name": "Bell Tower",
        "aliases": ("temple bell tower", "founders bell tower", "the bell tower"),
        "lat": 39.9813653,
        "lon": -75.1543675,
    },
    {
        "name": "Founder's Garden",
        "aliases": ("founders garden", "founder's garden"),
        "lat": 39.9811804,
        "lon": -75.1555697,
    },
    {
        "name": "Liacouras Center",
        "aliases": ("the liacouras", "liacouras"),
        "lat": 39.9798139,
        "lon": -75.1585825,
    },
    {
        "name": "Charles Library",
        "aliases": ("charles library", "temple library"),
        "lat": 39.9821563,
        "lon": -75.1552931,
    },
    {
        "name": "Morgan Hall",
        "aliases": ("morgan hall north", "morgan hall south"),
        "lat": 39.9779781,
        "lon": -75.1573659,
    },
    {
        "name": "Mitten Hall",
        "aliases": ("mitten",),
        "lat": 39.981921,
        "lon": -75.156674,
    },
    {
        "name": "Howard Gittis Student Center",
        "aliases": ("student center", "gittis student center", "tech center"),
        "lat": 39.979428,
        "lon": -75.154945,
    },
    {
        "name": "Temple Performing Arts Center",
        "aliases": ("tpac", "performing arts center"),
        "lat": 39.981442,
        "lon": -75.156813,
    },
    {
        "name": "Beury Hall",
        "aliases": ("beury",),
        "lat": 39.982223,
        "lon": -75.154402,
    },
    {
        "name": "Gladfelter Hall",
        "aliases": ("gladfelter",),
        "lat": 39.981347,
        "lon": -75.152367,
    },
    {
        "name": "Tuttleman Learning Center",
        "aliases": ("tuttleman", "tlc"),
        "lat": 39.980357,
        "lon": -75.154199,
    },
    {
        "name": "Pearson McGonigle Hall",
        "aliases": ("mcgonigle", "mcgonigle hall", "pearson hall", "pearson"),
        "lat": 39.980692,
        "lon": -75.158368,
    },
    {
        "name": "Lincoln Financial Field",
        "aliases": (
            "lincoln financial",
            "the linc",
            "linc",
            "lincoln financial field",
        ),
        "lat": 39.900833,
        "lon": -75.1675,
        "label": "Lincoln Financial Field, Philadelphia, PA",
    },
]

_US_STATE_ABBREV = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
}

_ROAD_DIR_ABBREV = (
    ("Northwest", "NW"),
    ("Northeast", "NE"),
    ("Southwest", "SW"),
    ("Southeast", "SE"),
    ("North", "N"),
    ("South", "S"),
    ("East", "E"),
    ("West", "W"),
)

# Nominatim puts named POIs under one of these address keys (not always "name").
_PLACE_NAME_KEYS = (
    "building",
    "amenity",
    "tourism",
    "leisure",
    "office",
    "shop",
    "university",
    "college",
    "school",
    "library",
    "historic",
    "attraction",
    "stadium",
    "sports_centre",
    "community_centre",
    "public_building",
    "man_made",
)

_GENERIC_PLACE_TOKENS = frozenset(
    {
        "yes",
        "no",
        "building",
        "tower",
        "house",
        "apartments",
        "residential",
        "commercial",
        "retail",
        "industrial",
        "university",
        "college",
        "school",
        "library",
        "theatre",
        "theater",
        "stadium",
    }
)


def _abbrev_road(road: str) -> str:
    """West Montgomery Avenue → W Montgomery Avenue (Google-ish)."""
    cleaned = road.strip()
    for full, short in _ROAD_DIR_ABBREV:
        if cleaned.startswith(full + " "):
            return f"{short} {cleaned[len(full) + 1:]}"
    return cleaned


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", (text or "").lower())).strip()


def _landmark_label(spot: dict) -> str:
    """Display label for a curated landmark (campus default, or spot['label'])."""
    custom = (spot.get("label") or "").strip()
    if custom:
        return custom
    return f"{spot['name']}, Temple University, Philadelphia, PA"


def _place_name(address: dict | None, *, name: str | None = None) -> str:
    """Best human landmark/building name from Nominatim fields."""
    explicit = (name or "").strip()
    if explicit and _norm(explicit) not in _GENERIC_PLACE_TOKENS:
        return explicit
    if not address:
        return ""
    for key in _PLACE_NAME_KEYS:
        val = (address.get(key) or "").strip()
        if val and _norm(val) not in _GENERIC_PLACE_TOKENS:
            return val
    return ""


def format_us_address(
    address: dict | None,
    fallback: str = "",
    *,
    name: str | None = None,
) -> str:
    """
    Build a Google-style label from Nominatim addressdetails.

    Street example: 1705 W Montgomery Avenue, Philadelphia, PA 19121
    Landmark example: Bell Tower, Lenfest Circle, Philadelphia, PA 19122

    Prefers a building/POI name when present so campus spots aren't reduced
    to the nearest road only.
    """
    if not address and not name:
        return fallback

    place = _place_name(address, name=name)
    house = (address.get("house_number") or "").strip() if address else ""
    road = _abbrev_road(
        (address.get("road") or address.get("pedestrian") or "") if address else ""
    )
    street = f"{house} {road}".strip() if (house or road) else ""

    city = ""
    state = ""
    postcode = ""
    if address:
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or ""
        ).strip()

        state_raw = (address.get("state") or "").strip()
        iso = (address.get("ISO3166-2-lvl4") or "").strip()  # e.g. US-PA
        if iso.startswith("US-") and len(iso) == 5:
            state = iso[3:]
        else:
            state = _US_STATE_ABBREV.get(state_raw.lower(), state_raw)

        postcode = (address.get("postcode") or "").strip()
        # Prefer 5-digit ZIP when Nominatim returns ZIP+4
        if len(postcode) > 5 and postcode[5] == "-":
            postcode = postcode[:5]

    city_line_parts: list[str] = []
    if city:
        city_line_parts.append(city)
    state_zip = " ".join(p for p in (state, postcode) if p)
    if state_zip:
        city_line_parts.append(state_zip)
    city_line = ", ".join(city_line_parts)

    parts: list[str] = []
    if place:
        parts.append(place)
        # Avoid "Bell Tower, Bell Tower" when road equals the place name.
        if street and _norm(street) != _norm(place):
            parts.append(street)
    elif street:
        parts.append(street)

    if city_line:
        parts.append(city_line)

    label = ", ".join(parts)
    return label or fallback


def _is_philadelphia(address: dict | None) -> bool:
    """True when Nominatim addressdetails resolve to Philadelphia, PA."""
    if not address:
        return False
    for key in ("city", "town", "municipality", "county"):
        val = (address.get(key) or "").strip().lower()
        if val in ("philadelphia", "philadelphia county"):
            return True
    return False


def _in_valid_bounds(lat: float, lng: float) -> bool:
    return (
        VALID_BOUNDS["min_lat"] <= lat <= VALID_BOUNDS["max_lat"]
        and VALID_BOUNDS["min_lng"] <= lng <= VALID_BOUNDS["max_lng"]
    )


def match_temple_landmarks(query: str, *, limit: int = 5) -> list[dict]:
    """
    Return curated Philly + Temple campus spots whose name/aliases match.

    Substring match either way so "bell" → Bell Tower and
    "Bell Tower Temple" still hits.
    """
    needle = _norm(query)
    if len(needle) < 3:
        return []

    hits: list[dict] = []
    for spot in TEMPLE_LANDMARKS:
        haystacks = (_norm(spot["name"]), *(_norm(a) for a in spot["aliases"]))
        if any(needle in h or h in needle for h in haystacks if h):
            hits.append(
                {
                    "display_name": _landmark_label(spot),
                    "lat": round(float(spot["lat"]), 8),
                    "lon": round(float(spot["lon"]), 8),
                }
            )
            if len(hits) >= limit:
                break
    return hits


def geocode_address(address: str) -> tuple[float, float] | None:
    """
    Geocode an address to (latitude, longitude) using Nominatim.

    Checks curated Temple landmarks first, then Nominatim. Appends
    ", Philadelphia, PA" when missing to bias toward campus.

    Returns None if geocoding fails or the result is outside the valid area.
    """
    cleaned = (address or "").strip()
    if not cleaned:
        return None

    # Exact-ish curated hit (e.g. user typed "Bell Tower" or picked a landmark label).
    for hit in match_temple_landmarks(cleaned, limit=1):
        label_norm = _norm(hit["display_name"])
        query_norm = _norm(cleaned)
        spot_name = _norm(hit["display_name"].split(",")[0])
        if (
            query_norm == label_norm
            or query_norm == spot_name
            or spot_name in query_norm
            or query_norm in spot_name
        ):
            return hit["lat"], hit["lon"]

    search_address = cleaned
    if "philadelphia" not in cleaned.lower() and "phila" not in cleaned.lower():
        search_address = f"{cleaned}, Philadelphia, PA"

    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(
                NOMINATIM_URL,
                params={
                    "q": search_address,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 0,
                    "viewbox": _TEMPLE_VIEWBOX,
                    "bounded": 0,
                },
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            results = response.json()

        if not results:
            logger.warning(f"Nominatim returned no results for: {address}")
            return None

        lat = float(results[0]["lat"])
        lng = float(results[0]["lon"])

        if not _in_valid_bounds(lat, lng):
            logger.warning(
                f"Geocoded location ({lat}, {lng}) outside valid bounds for: {address}"
            )
            return None

        return round(lat, 8), round(lng, 8)

    except httpx.HTTPError as e:
        logger.error(f"Nominatim HTTP error for '{address}': {e}")
        return None
    except (KeyError, IndexError, ValueError) as e:
        logger.error(f"Error parsing Nominatim response for '{address}': {e}")
        return None


def suggest_addresses(query: str, *, limit: int = 5) -> list[dict]:
    """
    Return address autocomplete hits near Temple (server-side Nominatim).

    Curated campus landmarks are prepended so spots like the Bell Tower show
    up even when Nominatim would only return the nearest road.

    Browser calls to Nominatim get 403 (custom User-Agent is stripped on CORS),
    so the frontend must go through this proxy.
    """
    cleaned = (query or "").strip()
    if len(cleaned) < 3:
        return []

    limit = max(1, min(limit, 8))
    suggestions: list[dict] = match_temple_landmarks(cleaned, limit=limit)
    seen_labels = {_norm(s["display_name"]) for s in suggestions}
    seen_coords = {(s["lat"], s["lon"]) for s in suggestions}

    if len(suggestions) >= limit:
        return suggestions

    search_query = cleaned
    if "philadelphia" not in cleaned.lower() and "phila" not in cleaned.lower():
        search_query = f"{cleaned}, Philadelphia, PA"

    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(
                NOMINATIM_URL,
                params={
                    "q": search_query,
                    "format": "json",
                    "limit": max(1, min(limit, 8)),
                    "addressdetails": 1,
                    "countrycodes": "us",
                    # Bias toward Temple without hard-excluding nearby Philly streets.
                    "viewbox": _TEMPLE_VIEWBOX,
                    "bounded": 0,
                },
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            results = response.json()
    except httpx.HTTPError as e:
        logger.error(f"Nominatim suggest HTTP error for '{query}': {e}")
        return suggestions
    except (TypeError, ValueError) as e:
        logger.error(f"Nominatim suggest parse error for '{query}': {e}")
        return suggestions

    for row in results or []:
        if len(suggestions) >= limit:
            break
        addr = row.get("address") or {}
        if not _is_philadelphia(addr):
            continue
        try:
            lat = float(row["lat"])
            lng = float(row["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if not _in_valid_bounds(lat, lng):
            continue
        raw_display = row.get("display_name") or ""
        label = format_us_address(addr, fallback=raw_display, name=row.get("name"))
        if not label:
            continue
        lat_r, lon_r = round(lat, 8), round(lng, 8)
        label_norm = _norm(label)
        if label_norm in seen_labels or (lat_r, lon_r) in seen_coords:
            continue
        seen_labels.add(label_norm)
        seen_coords.add((lat_r, lon_r))
        suggestions.append(
            {
                "display_name": label,
                "lat": lat_r,
                "lon": lon_r,
            }
        )
    return suggestions


def generate_fallback_coordinates() -> tuple[float, float]:
    """Generate random coordinates within Temple area as a fallback."""
    lat = random.uniform(TEMPLE_BOUNDS["min_lat"], TEMPLE_BOUNDS["max_lat"])
    lng = random.uniform(TEMPLE_BOUNDS["min_lng"], TEMPLE_BOUNDS["max_lng"])
    return round(lat, 8), round(lng, 8)
