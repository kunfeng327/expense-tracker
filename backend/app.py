from flask import Flask, request, jsonify, g
from flask_cors import CORS
from database import get_conn, init_db
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from datetime import datetime, date
import json

app = Flask(__name__)
CORS(app)  # 开发时允许 Vite (5173端口) 跨域访问

SECRET_KEY = "expense-tracker-secret-key-change-me"
serializer = URLSafeTimedSerializer(SECRET_KEY, salt="auth")
TOKEN_MAX_AGE = 7 * 24 * 3600  # token 有效期 7 天


def make_token(user_id, username):
    return serializer.dumps({"id": user_id, "username": username})


def parse_token(token):
    try:
        return serializer.loads(token, max_age=TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


@app.before_request
def auth_guard():
    # 认证接口和页面不拦截
    if not request.path.startswith("/api") or request.path.startswith("/api/auth"):
        return None
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    payload = parse_token(token) if token else None
    if not payload:
        return jsonify(error="未登录或登录已过期"), 401
    g.user_id = payload["id"]  # 后续接口通过 g.user_id 区分用户数据
    return None

# 统一把 Decimal 等类型安全序列化为 JSON


def ok(data):
    resp = app.response_class(
        response=json.dumps(data, ensure_ascii=False, default=float),
        status=200, mimetype="application/json")
    return resp


# ---------- 认证 API ----------

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not (3 <= len(username) <= 20):
        return jsonify(error="用户名长度需 3-20 个字符"), 400
    if len(password) < 6:
        return jsonify(error="密码至少 6 位"), 400
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute(
                "INSERT INTO users(username, password_hash) VALUES (%s, %s)",
                (username, generate_password_hash(password)),
            )
            uid = c.lastrowid
        conn.commit()
    except Exception:
        conn.close()
        return jsonify(error="用户名已被注册"), 400
    conn.close()
    return ok({"token": make_token(uid, username), "username": username})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    conn = get_conn()
    with conn.cursor() as c:
        c.execute("SELECT * FROM users WHERE username=%s", (username,))
        user = c.fetchone()
    conn.close()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify(error="用户名或密码错误"), 400
    return ok({"token": make_token(user["id"], user["username"]), "username": user["username"]})


@app.route("/api/auth/me", methods=["GET"])
def me():
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    payload = parse_token(token) if token else None
    if not payload:
        return jsonify(error="未登录或登录已过期"), 401
    return ok({"username": payload["username"]})


# ---------- 个人资料 API ----------

@app.route("/api/profile", methods=["GET"])
def get_profile():
    conn = get_conn()
    with conn.cursor() as c:
        c.execute("SELECT username, gender, birthday, avatar, created_at FROM users WHERE id=%s", (g.user_id,))
        row = c.fetchone()
    conn.close()
    if not row:
        return jsonify(error="用户不存在"), 404
    row["birthday"] = row["birthday"].isoformat() if row.get("birthday") else None
    row["created_at"] = row["created_at"].isoformat() if row.get("created_at") else None
    return ok(row)


@app.route("/api/profile", methods=["POST"])
def set_profile():
    data = request.get_json() or {}
    gender = data.get("gender")
    birthday = data.get("birthday")
    avatar = (data.get("avatar") or "").strip() or None
    if gender not in (None, "", "male", "female", "other"):
        return jsonify(error="性别取值不合法"), 400
    gender = gender or None
    if birthday in ("", None):
        birthday = None
    else:
        try:
            birthday = datetime.strptime(birthday, "%Y-%m-%d").date()
            if birthday > date.today():
                return jsonify(error="生日不能是未来日期"), 400
        except ValueError:
            return jsonify(error="生日格式应为 YYYY-MM-DD"), 400
    if avatar and len(avatar) > 16:
        return jsonify(error="头像太长了"), 400
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute(
                "UPDATE users SET gender=%s, birthday=%s, avatar=%s WHERE id=%s",
                (gender, birthday, avatar, g.user_id),
            )
        conn.commit()
    finally:
        conn.close()
    return ok({"gender": gender, "birthday": birthday.isoformat() if birthday else None, "avatar": avatar})


@app.route("/api/profile", methods=["DELETE"])
def delete_account():
    """注销账号:验证密码后删除用户及其全部数据,不可恢复"""
    data = request.get_json() or {}
    password = data.get("password") or ""
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("SELECT password_hash FROM users WHERE id=%s", (g.user_id,))
            user = c.fetchone()
            if not user or not check_password_hash(user["password_hash"], password):
                return jsonify(error="密码错误,无法注销"), 400
            # 删除该用户的所有关联数据
            c.execute("DELETE FROM mood_notes WHERE user_id=%s", (g.user_id,))
            c.execute("DELETE FROM practice_logs WHERE user_id=%s", (g.user_id,))
            c.execute("DELETE FROM budgets WHERE user_id=%s", (g.user_id,))
            c.execute("DELETE FROM records WHERE user_id=%s", (g.user_id,))
            c.execute("DELETE FROM users WHERE id=%s", (g.user_id,))
        conn.commit()
    finally:
        conn.close()
    return ok({"deleted": True})


@app.route("/api/records", methods=["GET"])
def list_records():
    month = request.args.get("month")
    conn = get_conn()
    with conn.cursor() as c:
        sql = """
            SELECT r.id, r.type, r.amount, r.category_id, DATE_FORMAT(r.date, '%%Y-%%m-%%d') AS date,
                   r.note, c.name AS category, c.type AS category_type
            FROM records r JOIN categories c ON r.category_id = c.id
            WHERE r.user_id = %s
        """
        params = [g.user_id]
        if month:
            sql += " AND r.date LIKE %s"
            params.append(month + "%")
        sql += " ORDER BY r.date DESC, r.id DESC"
        c.execute(sql, params)
        rows = c.fetchall()
    conn.close()
    return ok(rows)


@app.route("/api/records", methods=["POST"])
def add_record():
    data = request.get_json()
    if not data or data.get("type") not in ("expense", "income"):
        return jsonify(error="类型无效"), 400
    try:
        amount = float(data["amount"])
        assert amount > 0
    except Exception:
        return jsonify(error="金额无效"), 400
    conn = get_conn()
    with conn.cursor() as c:
        c.execute(
            "INSERT INTO records(user_id, type, amount, category_id, date, note) VALUES (%s,%s,%s,%s,%s,%s)",
            (g.user_id, data["type"], amount, int(data["category_id"]), data["date"], data.get("note", "")),
        )
        rid = c.lastrowid
    conn.commit()
    conn.close()
    return ok({"id": rid})


@app.route("/api/records/<int:rid>", methods=["PUT"])
def update_record(rid):
    data = request.get_json()
    if not data:
        return jsonify(error="无效数据"), 400
    conn = get_conn()
    with conn.cursor() as c:
        c.execute(
            "UPDATE records SET type=%s, amount=%s, category_id=%s, date=%s, note=%s WHERE id=%s AND user_id=%s",
            (data["type"], float(data["amount"]), int(data["category_id"]),
             data["date"], data.get("note", ""), rid, g.user_id),
        )
    conn.commit()
    conn.close()
    return ok({"ok": True})


@app.route("/api/records/<int:rid>", methods=["DELETE"])
def delete_record(rid):
    conn = get_conn()
    with conn.cursor() as c:
        c.execute("DELETE FROM records WHERE id=%s AND user_id=%s", (rid, g.user_id))
    conn.commit()
    conn.close()
    return ok({"ok": True})


@app.route("/api/categories", methods=["GET"])
def list_categories():
    ctype = request.args.get("type")
    conn = get_conn()
    with conn.cursor() as c:
        if ctype:
            c.execute("SELECT * FROM categories WHERE type=%s ORDER BY id", (ctype,))
        else:
            c.execute("SELECT * FROM categories ORDER BY id")
        rows = c.fetchall()
    conn.close()
    return ok(rows)


@app.route("/api/categories", methods=["POST"])
def add_category():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    ctype = data.get("type", "expense")
    if not name or ctype not in ("expense", "income"):
        return jsonify(error="名称或类型无效"), 400
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("INSERT INTO categories(name, type) VALUES (%s, %s)", (name, ctype))
            cid = c.lastrowid
        conn.commit()
    except Exception:
        conn.close()
        return jsonify(error="分类已存在"), 400
    conn.close()
    return ok({"id": cid})


@app.route("/api/categories/<int:cid>", methods=["DELETE"])
def delete_category(cid):
    conn = get_conn()
    with conn.cursor() as c:
        c.execute("SELECT COUNT(*) AS n FROM records WHERE category_id=%s", (cid,))
        if c.fetchone()["n"]:
            conn.close()
            return jsonify(error="该分类下有记录,无法删除"), 400
        c.execute("DELETE FROM categories WHERE id=%s", (cid,))
    conn.commit()
    conn.close()
    return ok({"ok": True})


@app.route("/api/budget/<month>", methods=["GET"])
def get_budget(month):
    conn = get_conn()
    with conn.cursor() as c:
        c.execute("SELECT * FROM budgets WHERE month=%s AND user_id=%s", (month, g.user_id))
        row = c.fetchone()
    conn.close()
    if row:
        return ok({"month": month, "total": float(row["total"]),
                   "category_budget": json.loads(row["category_budget"] or "{}")})
    return ok({"month": month, "total": 0, "category_budget": {}})


@app.route("/api/budget/<month>", methods=["POST"])
def set_budget(month):
    data = request.get_json() or {}
    total = float(data.get("total", 0))
    cat = json.dumps(data.get("category_budget", {}), ensure_ascii=False)
    conn = get_conn()
    with conn.cursor() as c:
        c.execute(
            "INSERT INTO budgets(user_id, month, total, category_budget) VALUES (%s,%s,%s,%s) "
            "ON DUPLICATE KEY UPDATE total=VALUES(total), category_budget=VALUES(category_budget)",
            (g.user_id, month, total, cat),
        )
    conn.commit()
    conn.close()
    return ok({"ok": True})


@app.route("/api/stats/<month>", methods=["GET"])
def get_stats(month):
    conn = get_conn()
    with conn.cursor() as c:
        summary = {"expense": 0.0, "income": 0.0}
        c.execute(
            "SELECT type, SUM(amount) s FROM records WHERE user_id=%s AND date LIKE %s GROUP BY type",
            (g.user_id, month + "%"),
        )
        for r in c.fetchall():
            summary[r["type"]] = float(r["s"])

        c.execute(
            "SELECT c.name AS name, SUM(r.amount) AS value FROM records r "
            "JOIN categories c ON r.category_id=c.id "
            "WHERE r.user_id=%s AND r.date LIKE %s AND r.type='expense' GROUP BY c.name ORDER BY value DESC",
            (g.user_id, month + "%"),
        )
        by_category = [{"name": r["name"], "value": float(r["value"])} for r in c.fetchall()]

        c.execute(
            "SELECT DATE_FORMAT(date, '%%Y-%%m-%%d') AS date, SUM(amount) AS value FROM records "
            "WHERE user_id=%s AND date LIKE %s AND type='expense' GROUP BY date ORDER BY date",
            (g.user_id, month + "%"),
        )
        by_day = [{"date": r["date"], "value": float(r["value"])} for r in c.fetchall()]
    conn.close()
    return ok({"summary": summary, "by_category": by_category, "by_day": by_day})


# ---------- 练习记录 API(吉他 / 钢琴) ----------

@app.route("/api/practice", methods=["GET"])
def list_practice():
    conn = get_conn()
    with conn.cursor() as c:
        c.execute(
            "SELECT id, DATE_FORMAT(date, '%%Y-%%m-%%d') AS date, instrument, kind, bpm, minutes, note "
            "FROM practice_logs WHERE user_id=%s ORDER BY date DESC, id DESC LIMIT 200",
            (g.user_id,),
        )
        rows = c.fetchall()
    conn.close()
    return ok(rows)


@app.route("/api/practice", methods=["POST"])
def add_practice():
    data = request.get_json() or {}
    instrument = data.get("instrument")
    kind = data.get("kind")
    bpm = data.get("bpm")
    minutes = data.get("minutes")
    date = data.get("date")
    note = (data.get("note") or "").strip() or None
    if instrument not in ("guitar", "piano"):
        return jsonify(error="乐器只支持 guitar / piano"), 400
    if kind not in ("spider", "scale", "song", "technique"):
        return jsonify(error="练习类型不合法"), 400
    if date:
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            return jsonify(error="日期格式应为 YYYY-MM-DD"), 400
    else:
        date = datetime.now().strftime("%Y-%m-%d")
    try:
        bpm = int(bpm) if bpm not in (None, "") else None
        minutes = int(minutes) if minutes not in (None, "") else None
    except (TypeError, ValueError):
        return jsonify(error="BPM 和时长需为数字"), 400
    if bpm is not None and not (20 <= bpm <= 400):
        return jsonify(error="BPM 需在 20-400 之间"), 400
    if minutes is not None and not (1 <= minutes <= 24 * 60):
        return jsonify(error="时长需在 1-1440 分钟之间"), 400
    if minutes is None:
        return jsonify(error="请填写练习时长"), 400
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute(
                "INSERT INTO practice_logs(user_id, date, instrument, kind, bpm, minutes, note) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (g.user_id, date, instrument, kind, bpm, minutes, note),
            )
            pid = c.lastrowid
        conn.commit()
    finally:
        conn.close()
    return ok({"id": pid})


@app.route("/api/practice/<int:pid>", methods=["DELETE"])
def delete_practice(pid):
    conn = get_conn()
    with conn.cursor() as c:
        c.execute("DELETE FROM practice_logs WHERE id=%s AND user_id=%s", (pid, g.user_id))
    conn.commit()
    conn.close()
    return ok({"ok": True})


# ---------- 随想笔记 API ----------

@app.route("/api/notes", methods=["GET"])
def list_notes():
    conn = get_conn()
    with conn.cursor() as c:
        c.execute(
            "SELECT id, mood, decor, text, "
            "DATE_FORMAT(created_at, '%%Y-%%m-%%dT%%H:%%i:%%s') AS time "
            "FROM mood_notes WHERE user_id=%s ORDER BY created_at DESC, id DESC LIMIT 200",
            (g.user_id,),
        )
        rows = c.fetchall()
    conn.close()
    for r in rows:
        r["decor"] = json.loads(r["decor"] or "[]")
    return ok(rows)


@app.route("/api/notes", methods=["POST"])
def add_note():
    data = request.get_json() or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify(error="写点什么再保存吧~"), 400
    if len(text) > 500:
        return jsonify(error="随想最多 500 字"), 400
    mood = (data.get("mood") or "😊")[:16]
    decor = json.dumps([d for d in (data.get("decor") or []) if isinstance(d, str)][:12], ensure_ascii=False)
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute(
                "INSERT INTO mood_notes(user_id, mood, decor, text) VALUES (%s,%s,%s,%s)",
                (g.user_id, mood, decor, text),
            )
            nid = c.lastrowid
        conn.commit()
    finally:
        conn.close()
    return ok({"id": nid})


@app.route("/api/notes/<int:nid>", methods=["DELETE"])
def delete_note(nid):
    conn = get_conn()
    with conn.cursor() as c:
        c.execute("DELETE FROM mood_notes WHERE id=%s AND user_id=%s", (nid, g.user_id))
    conn.commit()
    conn.close()
    return ok({"ok": True})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
