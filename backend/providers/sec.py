"""SEC via edgartools (MIT). Spec §10a — always built, only 2 functions.

No key, no quota. SEC_USER_AGENT + 10 req/sec. Cache: filings days, insider hours.
No XBRL parsing for MVP (AV covers fundamentals).
"""
from __future__ import annotations

import os

from backend.cache.cache import cache_key, get_or_fetch
from backend.models.source_record import make_record

TTL_FILINGS = 24 * 3600
TTL_INSIDER = 6 * 3600


class SkipProvider(Exception):
    pass


def _identity():
    ua = os.environ.get("SEC_USER_AGENT", "")
    if not ua:
        raise SkipProvider("SEC_USER_AGENT missing")
    try:
        from edgar import set_identity

        set_identity(ua)
    except Exception as e:
        raise SkipProvider(str(e))


def filings(ticker: str, form: str = "10-K", limit: int = 3) -> list:
    key = cache_key("sec", "filings", {"t": ticker, "f": form}, TTL_FILINGS)

    def fetch():
        # Always live (free, keyless) — skipped only if SEC blocks or lookup fails.
        try:
            _identity()
            from edgar import Company

            c = Company(ticker)
            fl = c.get_filings(form=form).head(limit)
            out = []
            for f in fl:
                out.append(
                    make_record(
                        "sec",
                        "filings",
                        {"form": getattr(f, "form", form), "filing_date": str(getattr(f, "filing_date", "")), "url": getattr(f, "url", None) or getattr(f, "filing_url", None)},
                        entity_id=ticker,
                    )
                )
            return out
        except SkipProvider as e:
            return [make_record("sec", "filings", {"status": "skipped", "reason": str(e)}, entity_id=ticker)]
        except Exception as e:
            return [make_record("sec", "filings", {"status": "skipped", "reason": str(e)}, entity_id=ticker)]

    return get_or_fetch(key, TTL_FILINGS, fetch)


def insider(ticker: str, limit: int = 5) -> list:
    key = cache_key("sec", "insider", {"t": ticker}, TTL_INSIDER)

    def fetch():
        # Always live (free, keyless) — skipped only if SEC blocks or lookup fails.
        try:
            _identity()
            from edgar import Company

            c = Company(ticker)
            fl = c.get_filings(form="4").head(limit)
            out = []
            for f in fl:
                out.append(
                    make_record(
                        "sec",
                        "insider",
                        {"form": "4", "filing_date": str(getattr(f, "filing_date", "")), "url": getattr(f, "url", None) or getattr(f, "filing_url", None)},
                        entity_id=ticker,
                    )
                )
            return out
        except SkipProvider as e:
            return [make_record("sec", "insider", {"status": "skipped", "reason": str(e)}, entity_id=ticker)]
        except Exception as e:
            return [make_record("sec", "insider", {"status": "skipped", "reason": str(e)}, entity_id=ticker)]

    return get_or_fetch(key, TTL_INSIDER, fetch)
