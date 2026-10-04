from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Cookie name used throughout the app.
_COOKIE_NAME = "fraudex_access_token"

# Cookie settings — HttpOnly prevents JS access (XSS protection).
_COOKIE_SETTINGS = dict(
    key=_COOKIE_NAME,
    httponly=True,
    samesite="lax",
    # secure=True in production (HTTPS only).
    # Set to False here so it works on plain http://localhost.
    secure=False,
    path="/",
)


def _authenticate_user(email: str, password: str, db: Session) -> User:
    """Verify credentials and return the User, or raise 401."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user


# ---------------------------------------------------------------------------
# POST /auth/login  —  JSON body (React frontend)
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
def login(
    response: Response,
    user_data: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate with JSON body {email, password}.

    Sets an HttpOnly cookie AND returns the token in the response body.
    The cookie is the secure production path; the body token lets API
    clients (curl, Postman) work without a cookie jar.
    """
    user = _authenticate_user(user_data.email, user_data.password, db)
    token = create_access_token({"sub": str(user.id), "role": user.role})

    response.set_cookie(value=token, **_COOKIE_SETTINGS)

    return {"access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# POST /auth/token  —  OAuth2 form body (Swagger UI "Authorize" button)
# ---------------------------------------------------------------------------

@router.post("/token", response_model=TokenResponse, include_in_schema=False)
def login_swagger(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2 password-flow endpoint consumed exclusively by Swagger UI.
    Uses form fields 'username' (= email) and 'password'.
    Hidden from the public docs (include_in_schema=False).
    """
    user = _authenticate_user(form_data.username, form_data.password, db)
    token = create_access_token({"sub": str(user.id), "role": user.role})

    response.set_cookie(value=token, **_COOKIE_SETTINGS)

    return {"access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response):
    """
    Clear the HttpOnly authentication cookie.

    The client should also discard any token it holds in memory.
    No auth required — a logged-out or anonymous client calling this
    is harmless.
    """
    response.delete_cookie(key=_COOKIE_NAME, path="/", samesite="lax")
    return {"message": "Logged out successfully"}


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
    }
