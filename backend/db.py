import os

from dotenv import load_dotenv
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Point it at your managed Postgres instance "
        "(Supabase/Neon/etc.) in a .env file — see .env.example."
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class RenderJob(Base):
    __tablename__ = "render_jobs"

    id = Column(Integer, primary_key=True)
    shot_name = Column(String, nullable=False)
    sequence = Column(String, nullable=False)
    assigned_artist = Column(String, nullable=False)
    status = Column(String, nullable=False)  # queued | rendering | failed | done
    estimated_hours = Column(Float, nullable=False)
    actual_hours = Column(Float, nullable=True)
    deadline = Column(DateTime, nullable=False)
    render_attempts = Column(Integer, default=1)
    complexity_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Artist(Base):
    __tablename__ = "artists"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    current_capacity_pct = Column(Float, nullable=False)
    active_shots = Column(Integer, default=0)


class AlertLog(Base):
    __tablename__ = "alerts_log"

    id = Column(Integer, primary_key=True)
    shot_name = Column(String, nullable=False)
    risk_reason = Column(String, nullable=False)
    recommended_action = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="high")
    sent_at = Column(DateTime, server_default=func.now())


def get_session() -> Session:
    return SessionLocal()


def init_db() -> None:
    Base.metadata.create_all(engine)
