from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token
from app.core.audit import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])

_COOKIE_NAME = "fraudex_access_token"

_COOKIE_SETTINGS = dict(
    key=_COOKIE_NAME,
    httponly=True,
    samesite="lax",
    secure=False,
    path="/",
)

def _authenticate_user(email: str, password: str, db: Session) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user

@router.post("/login", response_model=TokenResponse)
def login(
    response: Response,
    user_data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = _authenticate_user(user_data.email, user_data.password, db)
    token = create_access_token({"sub": str(user.id), "role": user.role})

    response.set_cookie(value=token, **_COOKIE_SETTINGS)

    log_action(db, action="USER_LOGIN", user_id=user.id,
               detail={"email": user.email, "method": "json"})
    db.commit()

    return {"access_token": token, "token_type": "bearer"}

@router.post("/token", response_model=TokenResponse, include_in_schema=False)
def login_swagger(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = _authenticate_user(form_data.username, form_data.password, db)
    token = create_access_token({"sub": str(user.id), "role": user.role})

    response.set_cookie(value=token, **_COOKIE_SETTINGS)

    log_action(db, action="USER_LOGIN", user_id=user.id,
               detail={"email": user.email, "method": "swagger_form"})
    db.commit()

    return {"access_token": token, "token_type": "bearer"}

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response, db: Session = Depends(get_db)):
    response.delete_cookie(key=_COOKIE_NAME, path="/", samesite="lax")
    log_action(db, action="USER_LOGOUT")
    db.commit()
    return {"message": "Logged out successfully"}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
    }
