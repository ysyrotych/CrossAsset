"""Database query helpers — dedup, state reads/writes."""
import hashlib
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session as OrmSession
from db.models import (AlertSent, PriceSnapshot, MutedTicker, SeenFiling, SeenNews,
                        SeenRating, DailyPnL, TylerMemory, CustomAlertRule,
                        InsiderCluster, TechnicalSignal, Session)
from config import THRESHOLDS


def make_hash(*parts: str) -> str:
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:32]


# ── Alert dedup ───────────────────────────────────────────────────────────────

def already_alerted(ticker: str, event_type: str, content_hash: str) -> bool:
    window_hours = THRESHOLDS["dedup_window_hours"]
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    with Session() as s:
        return s.query(AlertSent).filter(
            AlertSent.content_hash == content_hash,
            AlertSent.sent_at >= cutoff,
        ).first() is not None


def record_alert(ticker: str, event_type: str, content_hash: str,
                 severity: str, message_text: str):
    with Session() as s:
        s.merge(AlertSent(ticker=ticker, event_type=event_type, content_hash=content_hash,
                          severity=severity, message_text=message_text))
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
            row.price = price; row.prev_close = prev_close
            row.volume = volume; row.avg_volume_30d = avg_volume_30d
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
            s.delete(row); s.commit()
        return False


def mute_ticker(ticker: str, hours: float):
    with Session() as s:
        s.merge(MutedTicker(ticker=ticker, muted_until=datetime.utcnow() + timedelta(hours=hours)))
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


# ── Daily P&L ─────────────────────────────────────────────────────────────────

def record_daily_pnl(date: str, total_value: float, day_pnl: float,
                     day_pnl_pct: float, best: str, worst: str):
    with Session() as s:
        row = s.query(DailyPnL).filter_by(date=date).first()
        if row:
            row.total_value = total_value; row.day_pnl = day_pnl
            row.day_pnl_pct = day_pnl_pct; row.best_ticker = best; row.worst_ticker = worst
        else:
            s.add(DailyPnL(date=date, total_value=total_value, day_pnl=day_pnl,
                           day_pnl_pct=day_pnl_pct, best_ticker=best, worst_ticker=worst))
        s.commit()


def get_pnl_streak() -> int:
    """Return current win (+) or loss (-) streak count."""
    with Session() as s:
        rows = s.query(DailyPnL).order_by(DailyPnL.date.desc()).limit(30).all()
    if not rows:
        return 0
    sign = 1 if rows[0].day_pnl >= 0 else -1
    streak = 0
    for r in rows:
        if (r.day_pnl >= 0) == (sign > 0):
            streak += 1
        else:
            break
    return streak * sign


def get_pnl_history(days: int = 30) -> list[dict]:
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    with Session() as s:
        rows = s.query(DailyPnL).filter(DailyPnL.date >= cutoff).order_by(DailyPnL.date).all()
    return [{"date": r.date, "pnl": r.day_pnl, "pnl_pct": r.day_pnl_pct,
             "total": r.total_value} for r in rows]


# ── Tyler Memory ──────────────────────────────────────────────────────────────

def memory_get(key: str) -> str | None:
    with Session() as s:
        row = s.query(TylerMemory).filter_by(key=key).first()
        return row.value if row else None


def memory_set(key: str, value: str, category: str = "note"):
    with Session() as s:
        s.merge(TylerMemory(key=key, value=value, category=category,
                             updated_at=datetime.utcnow()))
        s.commit()


def memory_get_all(category: str = None) -> list[dict]:
    with Session() as s:
        q = s.query(TylerMemory)
        if category:
            q = q.filter_by(category=category)
        return [{"key": r.key, "value": r.value, "category": r.category} for r in q.all()]


# ── Custom Alert Rules ────────────────────────────────────────────────────────

def get_active_rules() -> list[dict]:
    with Session() as s:
        rows = s.query(CustomAlertRule).filter_by(active=True).all()
        return [{"id": r.id, "description": r.description, "ticker": r.ticker,
                 "rule_type": r.rule_type, "parameters": r.parameters,
                 "last_fired": r.last_fired} for r in rows]


def add_custom_rule(description: str, ticker: str | None, rule_type: str, parameters: str):
    with Session() as s:
        s.add(CustomAlertRule(description=description, ticker=ticker,
                              rule_type=rule_type, parameters=parameters))
        s.commit()


def mark_rule_fired(rule_id: int):
    with Session() as s:
        row = s.query(CustomAlertRule).filter_by(id=rule_id).first()
        if row:
            row.last_fired = datetime.utcnow()
            s.commit()


# ── Insider Clusters ──────────────────────────────────────────────────────────

def record_insider_trade(ticker: str, name: str, tx_type: str, shares: float,
                          price: float, value: float, date: str):
    with Session() as s:
        s.add(InsiderCluster(ticker=ticker, reporter_name=name, transaction_type=tx_type,
                              shares=shares, price=price, value=value, transaction_date=date))
        s.commit()


def get_recent_insider_buys(ticker: str, days: int = 30) -> list[dict]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    with Session() as s:
        rows = s.query(InsiderCluster).filter(
            InsiderCluster.ticker == ticker,
            InsiderCluster.recorded_at >= cutoff,
            InsiderCluster.transaction_type.contains("P"),
        ).all()
        return [{"name": r.reporter_name, "value": r.value, "date": r.transaction_date} for r in rows]


# ── Technical Signals ─────────────────────────────────────────────────────────

def upsert_technical_signal(ticker: str, rsi: float, macd: float, macd_signal: float,
                             ma50: float, ma200: float, price: float):
    with Session() as s:
        s.merge(TechnicalSignal(ticker=ticker, rsi=rsi, macd=macd, macd_signal=macd_signal,
                                 ma50=ma50, ma200=ma200, price=price, updated_at=datetime.utcnow()))
        s.commit()


def get_technical_signal(ticker: str) -> dict | None:
    with Session() as s:
        r = s.query(TechnicalSignal).filter_by(ticker=ticker).first()
        if not r:
            return None
        return {"rsi": r.rsi, "macd": r.macd, "macd_signal": r.macd_signal,
                "ma50": r.ma50, "ma200": r.ma200, "price": r.price}


# ── Cleanup ───────────────────────────────────────────────────────────────────

def cleanup_old_records(days: int = 30):
    cutoff = datetime.utcnow() - timedelta(days=days)
    with Session() as s:
        s.query(AlertSent).filter(AlertSent.sent_at < cutoff).delete()
        s.query(SeenFiling).filter(SeenFiling.seen_at < cutoff).delete()
        s.query(SeenNews).filter(SeenNews.seen_at < cutoff).delete()
        s.query(SeenRating).filter(SeenRating.seen_at < cutoff).delete()
        s.commit()
