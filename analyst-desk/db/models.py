"""SQLAlchemy models for analyst desk state + deduplication."""
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import declarative_base, sessionmaker
from config import DB_PATH

Base = declarative_base()
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
Session = sessionmaker(bind=engine)


class AlertSent(Base):
    __tablename__ = "alerts_sent"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    ticker       = Column(String(16), nullable=False, index=True)
    event_type   = Column(String(64), nullable=False)
    content_hash = Column(String(64), nullable=False, unique=True)
    severity     = Column(String(16))
    message_text = Column(Text)
    sent_at      = Column(DateTime, default=datetime.utcnow, index=True)


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"
    ticker         = Column(String(16), primary_key=True)
    price          = Column(Float)
    prev_close     = Column(Float)
    volume         = Column(Float)
    avg_volume_30d = Column(Float)
    updated_at     = Column(DateTime, default=datetime.utcnow)


class MutedTicker(Base):
    __tablename__ = "muted_tickers"
    ticker      = Column(String(16), primary_key=True)
    muted_until = Column(DateTime, nullable=False)


class Thesis(Base):
    __tablename__ = "theses"
    ticker       = Column(String(16), primary_key=True)
    thesis_text  = Column(Text)
    status       = Column(String(16), default="INTACT")
    last_checked = Column(DateTime)
    notes        = Column(Text)


class SeenFiling(Base):
    __tablename__ = "seen_filings"
    accession_no = Column(String(32), primary_key=True)
    ticker       = Column(String(16), index=True)
    form_type    = Column(String(16))
    seen_at      = Column(DateTime, default=datetime.utcnow)


class SeenNews(Base):
    __tablename__ = "seen_news"
    url_hash = Column(String(64), primary_key=True)
    ticker   = Column(String(16), index=True)
    seen_at  = Column(DateTime, default=datetime.utcnow)


class SeenRating(Base):
    __tablename__ = "seen_ratings"
    rating_hash = Column(String(64), primary_key=True)
    ticker      = Column(String(16), index=True)
    seen_at     = Column(DateTime, default=datetime.utcnow)


class DailyPnL(Base):
    """Daily portfolio P&L tracking for streaks and history."""
    __tablename__ = "daily_pnl"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    date          = Column(String(10), nullable=False, index=True)
    total_value   = Column(Float)
    day_pnl       = Column(Float)
    day_pnl_pct   = Column(Float)
    best_ticker   = Column(String(16))
    worst_ticker  = Column(String(16))
    recorded_at   = Column(DateTime, default=datetime.utcnow)


class TylerMemory(Base):
    """Persistent memory — Tyler remembers preferences and context."""
    __tablename__ = "tyler_memory"
    key        = Column(String(128), primary_key=True)
    value      = Column(Text)
    category   = Column(String(32))     # preference | decision | note | alert_pref
    updated_at = Column(DateTime, default=datetime.utcnow)


class CustomAlertRule(Base):
    """User-defined alert rules set via natural language."""
    __tablename__ = "custom_alert_rules"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    description = Column(Text, nullable=False)
    ticker      = Column(String(16))
    rule_type   = Column(String(32))    # price_threshold | periodic_check | condition
    parameters  = Column(Text)          # JSON string of rule parameters
    active      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    last_fired  = Column(DateTime)


class InsiderCluster(Base):
    """Tracks insider transactions for cluster detection."""
    __tablename__ = "insider_clusters"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    ticker           = Column(String(16), nullable=False, index=True)
    reporter_name    = Column(String(128))
    transaction_type = Column(String(32))
    shares           = Column(Float)
    price            = Column(Float)
    value            = Column(Float)
    transaction_date = Column(String(20))
    alerted          = Column(Boolean, default=False)
    recorded_at      = Column(DateTime, default=datetime.utcnow)


class TechnicalSignal(Base):
    """Last computed technical indicators per ticker."""
    __tablename__ = "technical_signals"
    ticker      = Column(String(16), primary_key=True)
    rsi         = Column(Float)
    macd        = Column(Float)
    macd_signal = Column(Float)
    ma50        = Column(Float)
    ma200       = Column(Float)
    price       = Column(Float)
    updated_at  = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(engine)
