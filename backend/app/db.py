"""Database layer. SQLite for local development, PostgreSQL in production (set DATABASE_URL)."""
import os
from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, Index, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reliefready.db")
if DATABASE_URL.startswith("postgres://"):  # Render / Heroku style URL
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    """Control-room staff and drivers. PINs are stored as salted PBKDF2 hashes."""
    __tablename__ = "users"
    id = Column(String(32), primary_key=True)
    role = Column(String(16), nullable=False)          # admin | driver
    name = Column(String(120), nullable=False)
    pin_hash = Column(String(200), nullable=False)
    vehicle = Column(String(120), default="")
    vehicle_type = Column(String(16), default="truck")  # truck | jeep | boat
    created_at = Column(DateTime(timezone=True), default=utcnow)


class Record(Base):
    """Operational records: sos, stops, reports, escalations, drivers, zones.

    Each record keeps its full JSON body (validated by the API schemas) plus indexed
    columns used for filtering. JSON maps to JSONB-compatible JSON on PostgreSQL.
    """
    __tablename__ = "records"
    collection = Column(String(24), primary_key=True)
    id = Column(String(64), primary_key=True)
    data = Column(JSON, nullable=False)
    status = Column(String(32), index=True, default="")
    owner = Column(String(32), index=True, default="")   # driver id for stops / drivers
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, index=True)

    __table_args__ = (Index("ix_records_collection_updated", "collection", "updated_at"),)


def init_db():
    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
