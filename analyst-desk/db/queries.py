"""Database query helpers — dedup, state reads/writes."""
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session as OrmSession
from db.models import AlertSent, PriceSnapshot, MutedTicker, SeenFiling, SeenNews, SeenRating, Session
from config import THRESHOLDS


def make_hash(*parts: str) -> str:
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:32]


# ── Alert dedup ───────────────────────────────────────────────────────────────

def already_alerted(ticker: str, event_type: str, content_hash: str) -> bool:
    """Return True if this exact alert was already sent within the dedup window."""
    window_hours = THRESHOLDS["dedup_window_hours"]
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    with Session() as s:
        exists = s.query(AlertSent).filter(
            AlertSent.content_hash == content_hash,
            AlertSent.sent_at >= cutoff,
        ).first()
        return exists is not None


def record_alert(ticker: str, event_type: str, content_hash: str,
                 severity: str, message_text: str):
    with Session() as s:
        row = AlertSent(
            ticker=ticker, event_type=event_type, content_hash=content_hash,
            severity=severity, message_text=message_text,
        )
        s.merge(row)
        s.commit()


# ── Price snapshots ───────────────────────────────────────────────────────────

def get_price_snapshot(ticker: str) -> PriceSnapshot | None:
    with Session() as s:
        return s.query(PriceSnapshot).filter_by(ticker=ticker).first()


def upsert_price_snapshot(ticker: str, price: float, prev_close: float,
                          volume: float, avg_volume_30d: float):
    with Session() as s:
        row = s.query(PriceSnapshot).filter_by(ticker=ticker).first()
        if row:
            row.price = price
            row.prev_close = prev_close
            row.volume = volume
            row.avg_volume_30d = avg_volume_30d
            row.updated_at = datetime.utcnow()
        else:
            s.add(PriceSnapshot(ticker=ticker, price=price, prev_close=prev_close,
                                volume=volume, avg_volume_30d=avg_volume_30d))
        s.commit()


# ── Muted tickers ─────────────────────────────────────────────────────────────

def is_muted(ticker: str) -> bool:
    with Session() as s:
        row = s.query(MutedTicker).filter_by(ticker=ticker).first()
        if row and row.muted_until > datetime.utcnow():
            return True
        if row:
            s.delete(row)
            s.commit()
        return False


def mute_ticker(ticker: str, hours: float):
    with Session() as s:
        row = MutedTicker(ticker=ticker, muted_until=datetime.utcnow() + timedelta(hours=hours))
        s.merge(row)
        s.commit()


def unmute_ticker(ticker: str):
    with Session() as s:
        s.query(MutedTicker).filter_by(ticker=ticker).delete()
        s.commit()


# ── Filing / news / rating dedup ──────────────────────────────────────────────

def seen_filing(accession_no: str) -> bool:
    with Session() as s:
        return s.query(SeenFiling).filter_by(accession_no=accession_no).first() is not None


def mark_filing_seen(accession_no: str, ticker: str, form_type: str):
    with Session() as s:
        s.merge(SeenFiling(accession_no=accession_no, ticker=ticker, form_type=form_type))
        s.commit()


def seen_news(url_hash: str) -> bool:
    with Session() as s:
        return s.query(SeenNews).filter_by(url_hash=url_hash).first() is not None


def mark_news_seen(url_hash: str, ticker: str):
    with Session() as s:
        s.merge(SeenNews(url_hash=url_hash, ticker=ticker))
        s.commit()


def seen_rating(rating_hash: str) -> bool:
    with Session() as s:
        return s.query(SeenRating).filter_by(rating_hash=rating_hash).first() is not None


def mark_rating_seen(rating_hash: str, ticker: str):
    with Session() as s:
        s.merge(SeenRating(rating_hash=rating_hash, ticker=ticker))
        s.commit()


# ── Cleanup ───────────────────────────────────────────────────────────────────

def cleanup_old_records(days: int = 30):
    """Remove dedup records older than N days to keep DB lean."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    with Session() as s:
        s.query(AlertSent).filter(AlertSent.sent_at < cutoff).delete()
        s.query(SeenFiling).filter(SeenFiling.seen_at < cutoff).delete()
        s.query(SeenNews).filter(SeenNews.seen_at < cutoff).delete()
        s.query(SeenRating).filter(SeenRating.seen_at < cutoff).delete()
        s.commit()
