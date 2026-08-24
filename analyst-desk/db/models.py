"""SQLAlchemy models for analyst desk state + deduplication."""
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from config import DB_PATH

Base = declarative_base()
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
Session = sessionmaker(bind=engine)


class AlertSent(Base):
    """Dedup log — one row per alert dispatched to Telegram."""
    __tablename__ = "alerts_sent"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    ticker       = Column(String(16), nullable=False, index=True)
    event_type   = Column(String(64), nullable=False)
    content_hash = Column(String(64), nullable=False, unique=True)
    severity     = Column(String(16))
    message_text = Column(Text)
    sent_at      = Column(DateTime, default=datetime.utcnow, index=True)


class PriceSnapshot(Base):
    """Last-seen price per ticker — used to detect moves between checks."""
    __tablename__ = "price_snapshots"
    ticker        = Column(String(16), primary_key=True)
    price         = Column(Float)
    prev_close    = Column(Float)
    volume        = Column(Float)
    avg_volume_30d = Column(Float)
    updated_at    = Column(DateTime, default=datetime.utcnow)


class MutedTicker(Base):
    """Tickers silenced via /mute command."""
    __tablename__ = "muted_tickers"
    ticker    = Column(String(16), primary_key=True)
    muted_until = Column(DateTime, nullable=False)


class Thesis(Base):
    """Investment thesis per ticker with integrity tracking."""
    __tablename__ = "theses"
    ticker       = Column(String(16), primary_key=True)
    thesis_text  = Column(Text)
    status       = Column(String(16), default="INTACT")   # INTACT / WATCH / CHALLENGED
    last_checked = Column(DateTime)
    notes        = Column(Text)


class SeenFiling(Base):
    """Tracks SEC filings already processed to avoid re-alerting."""
    __tablename__ = "seen_filings"
    accession_no = Column(String(32), primary_key=True)
    ticker       = Column(String(16), index=True)
    form_type    = Column(String(16))
    seen_at      = Column(DateTime, default=datetime.utcnow)


class SeenNews(Base):
    """Tracks news articles already processed."""
    __tablename__ = "seen_news"
    url_hash  = Column(String(64), primary_key=True)
    ticker    = Column(String(16), index=True)
    seen_at   = Column(DateTime, default=datetime.utcnow)


class SeenRating(Base):
    """Tracks analyst rating changes already processed."""
    __tablename__ = "seen_ratings"
    rating_hash = Column(String(64), primary_key=True)
    ticker      = Column(String(16), index=True)
    seen_at     = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(engine)
