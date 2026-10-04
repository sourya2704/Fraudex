from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import Optional

from app.core.security import JWT_SECRET_KEY, JWT_ALGORITHM
from app.database.connection import SessionLocal
from app.models.user import User


# OAuth2 scheme kept for Swagger UI "Authorize" button.
# auto_error=False means it returns None instead of 401 when
# no Bearer header is present — we handle the fallback to cookie below.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _decode_token(token: str) -> dict:
    """Decode and validate a JWT, raising 401 on any failure."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("sub") is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


def get_current_user(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Resolve the current user from either:
      1. HttpOnly cookie  'fraudex_access_token'  (production path)
      2. Authorization: Bearer <token> header     (Swagger UI / API clients)

    Cookie takes priority so that browser sessions are always cookie-based.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Please log in.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Try HttpOnly cookie first
    token = request.cookies.get("fraudex_access_token")

    # 2. Fall back to Bearer header (Swagger / programmatic clients)
    if not token:
        token = bearer_token

    if not token:
        raise credentials_exception

    payload = _decode_token(token)
    user_id = payload.get("sub")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    return user


def require_role(*allowed_roles: str):
    """
    Dependency factory for role-based access control (RBAC).

    Usage:
        Depends(require_role("ADMIN"))
        Depends(require_role("ADMIN", "FINANCE_MANAGER"))

    Returns the current user if their role is in allowed_roles,
    otherwise raises HTTP 403.
    """

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return role_checker
