"""Signup, login, logout, me (D2). Public except membership-gated group routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from kaikei.api.deps import get_session
from kaikei.application import auth as auth_svc

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class SignupIn(BaseModel):
    email: str
    name: str = Field(min_length=1)
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str


class SessionOut(BaseModel):
    token: str
    user: UserOut


def _http(err: auth_svc.AuthError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=err.message)


def _user_out(user) -> UserOut:
    return UserOut(id=str(user.id), email=user.email, name=user.name)


@router.post("/signup", response_model=SessionOut)
def signup(body: SignupIn, session: Annotated[Session, Depends(get_session)]) -> SessionOut:
    try:
        principal = auth_svc.signup(
            session, email=body.email, name=body.name, password=body.password
        )
        session.commit()
    except auth_svc.AuthError as err:
        raise _http(err) from err
    assert principal.token is not None
    return SessionOut(token=principal.token, user=_user_out(principal.user))


@router.post("/login", response_model=SessionOut)
def login(body: LoginIn, session: Annotated[Session, Depends(get_session)]) -> SessionOut:
    try:
        principal = auth_svc.login(session, email=body.email, password=body.password)
        session.commit()
    except auth_svc.AuthError as err:
        raise _http(err) from err
    assert principal.token is not None
    return SessionOut(token=principal.token, user=_user_out(principal.user))


@router.post("/logout")
def logout(
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, bool]:
    token = (authorization or "").removeprefix("Bearer ").strip()
    if token:
        auth_svc.logout(session, token)
        session.commit()
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> UserOut:
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "not signed in")
    user = auth_svc.user_from_token(session, token)
    if user is None:
        raise HTTPException(401, "not signed in")
    return _user_out(user)
