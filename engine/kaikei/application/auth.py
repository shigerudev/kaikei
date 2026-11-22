"""Minimal auth (D2): scrypt passwords, hashed session tokens, group memberships."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from kaikei.infrastructure.db import models

_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}
_SESSION_DAYS = 30


class AuthError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


@dataclass(frozen=True)
class Principal:
    user: models.User
    token: str | None = None


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, **_SCRYPT)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def signup(session: Session, *, email: str, name: str, password: str) -> Principal:
    email = email.strip().casefold()
    if session.scalar(select(models.User.id).where(models.User.email == email)):
        raise AuthError(409, f"email {email!r} is already registered")
    if len(password) < 8:
        raise AuthError(422, "password must be at least 8 characters")
    salt = secrets.token_bytes(16)
    user = models.User(
        email=email,
        name=name.strip() or email,
        password_salt=salt,
        password_hash=_hash_password(password, salt),
    )
    session.add(user)
    session.flush()
    return Principal(user=user, token=_issue_session(session, user))


def login(session: Session, *, email: str, password: str) -> Principal:
    email = email.strip().casefold()
    user = session.scalar(select(models.User).where(models.User.email == email))
    if user is None:
        raise AuthError(401, "invalid email or password")
    challenge = _hash_password(password, user.password_salt)
    if not hmac.compare_digest(challenge, user.password_hash):
        raise AuthError(401, "invalid email or password")
    return Principal(user=user, token=_issue_session(session, user))


def _issue_session(session: Session, user: models.User) -> str:
    raw = secrets.token_urlsafe(32)
    session.add(
        models.AuthSession(
            user_id=user.id,
            token_hash=_token_hash(raw),
            expires_at=datetime.now(UTC) + timedelta(days=_SESSION_DAYS),
        )
    )
    session.flush()
    return raw


def logout(session: Session, token: str) -> None:
    row = session.scalar(
        select(models.AuthSession).where(models.AuthSession.token_hash == _token_hash(token))
    )
    if row is not None:
        session.delete(row)
        session.flush()


def user_from_token(session: Session, token: str) -> models.User | None:
    row = session.scalar(
        select(models.AuthSession).where(models.AuthSession.token_hash == _token_hash(token))
    )
    if row is None or row.expires_at < datetime.now(UTC):
        return None
    return session.get(models.User, row.user_id)


def membership(
    session: Session, user_id: uuid.UUID, group_id: uuid.UUID
) -> models.Membership | None:
    return session.scalar(
        select(models.Membership).where(
            models.Membership.user_id == user_id, models.Membership.group_id == group_id
        )
    )


def add_owner(session: Session, user_id: uuid.UUID, group_id: uuid.UUID) -> None:
    if membership(session, user_id, group_id) is None:
        session.add(models.Membership(user_id=user_id, group_id=group_id, role="owner"))
        session.flush()


def add_member_by_email(session: Session, group_id: uuid.UUID, email: str) -> models.Membership:
    user = session.scalar(select(models.User).where(models.User.email == email.strip().casefold()))
    if user is None:
        raise AuthError(404, "no user with that email")
    existing = membership(session, user.id, group_id)
    if existing is not None:
        return existing
    row = models.Membership(user_id=user.id, group_id=group_id, role="member")
    session.add(row)
    session.flush()
    return row


def issue_mcp_token(session: Session, group_id: uuid.UUID, label: str = "") -> str:
    raw = secrets.token_urlsafe(32)
    session.add(
        models.GroupMcpToken(group_id=group_id, token_hash=_token_hash(raw), label=label.strip())
    )
    session.flush()
    return raw


def resolve_mcp_token(session: Session, token: str) -> models.Group | None:
    row = session.scalar(
        select(models.GroupMcpToken).where(
            models.GroupMcpToken.token_hash == _token_hash(token),
            models.GroupMcpToken.revoked_at.is_(None),
        )
    )
    if row is None:
        return None
    return session.get(models.Group, row.group_id)


def revoke_mcp_token(session: Session, group_id: uuid.UUID, token_id: uuid.UUID) -> None:
    row = session.get(models.GroupMcpToken, token_id)
    if row is None or row.group_id != group_id:
        raise AuthError(404, "token not found")
    row.revoked_at = datetime.now(UTC)
    session.flush()
