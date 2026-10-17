from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User


def test_valid_bearer_wins_over_stale_cookie(db):
    user = User(name="A", email="a@x.io", password_hash=hash_password("pw123456"), role="ADMIN")
    db.add(user); db.commit()
    client = TestClient(app)
    client.cookies.set("fraudex_access_token", "expired.or.garbage")
    token = create_access_token({"sub": str(user.id), "role": "ADMIN"})
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "a@x.io"


def test_avatar_round_trip(db):
    user = User(name="B", email="b@x.io", password_hash=hash_password("pw123456"), role="EMPLOYEE")
    db.add(user); db.commit()
    client = TestClient(app)
    h = {"Authorization": f"Bearer {create_access_token({'sub': str(user.id), 'role': 'EMPLOYEE'})}"}
    photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
    assert client.get("/users/me/avatar", headers=h).json() == {"avatar": None}
    assert client.put("/users/me/avatar", json={"avatar": photo}, headers=h).status_code == 200
    assert client.get("/users/me/avatar", headers=h).json() == {"avatar": photo}
    assert client.put("/users/me/avatar", json={"avatar": "javascript:alert(1)"}, headers=h).status_code == 400
    assert client.delete("/users/me/avatar", headers=h).status_code == 204
    assert client.get("/users/me/avatar", headers=h).json() == {"avatar": None}
