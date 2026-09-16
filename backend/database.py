import os

# 云端部署:设置环境变量 DATABASE_URL(postgres) 即用 Postgres(Supabase/Render 等)
# 本地开发:未设置 DATABASE_URL 时沿用 config.py 的 MySQL 配置
USE_PG = bool(os.environ.get("DATABASE_URL"))

if USE_PG:
    import psycopg2
    import psycopg2.extras

    def get_conn(with_db=True):
        return psycopg2.connect(os.environ["DATABASE_URL"],
                                cursor_factory=psycopg2.extras.RealDictCursor)
else:
    import pymysql
    from config import DB_CONFIG

    def get_conn(with_db=True):
        cfg = dict(DB_CONFIG)
        if not with_db:
            cfg.pop("database")
        return pymysql.connect(**cfg, cursorclass=pymysql.cursors.DictCursor,
                               autocommit=False)

# ---------- 方言辅助:同一套代码兼容 MySQL / Postgres ----------

# INSERT 后取自增 id
def last_id(cursor):
    if USE_PG:
        cursor.execute("SELECT LASTVAL() AS id")
        return cursor.fetchone()["id"]
    return cursor.lastrowid

# 日期转 'YYYY-MM-DD' 的 SQL 片段
DATE_FMT_D = "TO_CHAR(%s, 'YYYY-MM-DD')" if USE_PG else "DATE_FORMAT(%s, '%%Y-%%m-%%d')"
# 时间转 'YYYY-MM-DDTHH:MM:SS'
DATE_FMT_TS = ("TO_CHAR(%s, 'YYYY-MM-DD\"T\"HH24:MI:SS')" if USE_PG
               else "DATE_FORMAT(%s, '%%Y-%%m-%%dT%%H:%%i:%%s')")
# DATE 列做 LIKE 前缀匹配(Postgres 需先转 text)
DATE_LIKE = "%s::text LIKE" if USE_PG else "%s LIKE"
# 预算 upsert
UPSERT_BUDGET = (
    "INSERT INTO budgets(user_id, month, total, category_budget) VALUES (%s,%s,%s,%s) "
    "ON CONFLICT (user_id, month) DO UPDATE SET total=EXCLUDED.total, category_budget=EXCLUDED.category_budget"
) if USE_PG else (
    "INSERT INTO budgets(user_id, month, total, category_budget) VALUES (%s,%s,%s,%s) "
    "ON DUPLICATE KEY UPDATE total=VALUES(total), category_budget=VALUES(category_budget)"
)
# 分类去重插入
INSERT_IGNORE = "INSERT INTO categories(name, type) VALUES (%s, %s) ON CONFLICT DO NOTHING" if USE_PG \
    else "INSERT IGNORE INTO categories(name, type) VALUES (%s, %s)"

DEFAULT_CATEGORIES = {
    "expense": ["餐饮", "交通", "购物", "娱乐", "居住", "医疗", "教育", "其他"],
    "income": ["工资", "兼职", "奖金", "红包", "理财收益", "其他收入"],
}

# 建表 DDL 的自增主键写法
PK_INT = "SERIAL PRIMARY KEY" if USE_PG else "INT AUTO_INCREMENT PRIMARY KEY"
TABLE_SUFFIX = "" if USE_PG else " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"


def init_db():
    conn = get_conn()
    with conn.cursor() as c:
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS categories (
                id {PK_INT},
                name VARCHAR(50) NOT NULL UNIQUE,
                type VARCHAR(10) NOT NULL DEFAULT 'expense'
                    CHECK (type IN ('expense', 'income'))
            ){TABLE_SUFFIX}
        """)
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS records (
                id {PK_INT},
                user_id INT,
                type VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
                amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
                category_id INT NOT NULL,
                date DATE NOT NULL,
                note VARCHAR(200) DEFAULT '',
                FOREIGN KEY (category_id) REFERENCES categories(id)
            ){TABLE_SUFFIX}
        """)
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS budgets (
                month VARCHAR(7) NOT NULL,
                user_id INT NOT NULL DEFAULT 0,
                total DECIMAL(12,2) NOT NULL DEFAULT 0,
                category_budget TEXT,
                PRIMARY KEY (user_id, month)
            ){TABLE_SUFFIX}
        """)
        for ctype, names in DEFAULT_CATEGORIES.items():
            for name in names:
                c.execute(INSERT_IGNORE, (name, ctype))
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS users (
                id {PK_INT},
                username VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ){TABLE_SUFFIX}
        """)
        # 用户资料字段:性别 / 生日 / 头像 emoji
        _add_column_if_missing(c, "users", "gender", "VARCHAR(10) NULL")
        _add_column_if_missing(c, "users", "birthday", "DATE NULL")
        _add_column_if_missing(c, "users", "avatar", "VARCHAR(16) NULL")
        # 练习记录(吉他 / 钢琴)
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS practice_logs (
                id {PK_INT},
                user_id INT NOT NULL,
                date DATE NOT NULL,
                instrument VARCHAR(10) NOT NULL,
                kind VARCHAR(20) NOT NULL,
                bpm INT NULL,
                minutes INT NOT NULL,
                note VARCHAR(200) NULL
            ){TABLE_SUFFIX}
        """)
        # 随想笔记
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS mood_notes (
                id {PK_INT},
                user_id INT NOT NULL,
                mood VARCHAR(16) NOT NULL DEFAULT '😊',
                decor VARCHAR(128) DEFAULT '',
                text VARCHAR(500) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ){TABLE_SUFFIX}
        """)
        # 圣经阅读进度:每账号一行,记录当前读到哪卷哪章、最后推进日期
        c.execute(f"""
            CREATE TABLE IF NOT EXISTS bible_progress (
                user_id INT PRIMARY KEY,
                book VARCHAR(20) NOT NULL,
                chapter INT NOT NULL,
                last_date DATE NULL
            ){TABLE_SUFFIX}
        """)
        # 旧表迁移:records / budgets 增加 user_id(已有数据归给第一个用户)
        _add_column_if_missing(c, "records", "user_id", "INT")
        c.execute("UPDATE records SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL")
        c.execute("UPDATE budgets SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL OR user_id = 0")

        # 索引(建在迁移之后,确保 user_id 列已存在)
        if USE_PG:
            c.execute("CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id, date)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_practice_user ON practice_logs(user_id, date)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_notes_user ON mood_notes(user_id, created_at)")
        else:
            for table, idx, cols in [("records", "idx_user_date", "user_id, date"),
                                     ("practice_logs", "idx_pl_user_date", "user_id, date"),
                                     ("mood_notes", "idx_mn_user_time", "user_id, created_at")]:
                _add_index_if_missing(c, table, idx, cols)
    conn.commit()
    conn.close()


def _add_index_if_missing(cursor, table, index, cols):
    if USE_PG:
        cursor.execute(f'CREATE INDEX IF NOT EXISTS {index} ON {table}({cols})')
        return
    cursor.execute(
        "SELECT COUNT(*) AS n FROM information_schema.STATISTICS "
        "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND INDEX_NAME=%s",
        (table, index),
    )
    if not cursor.fetchone()["n"]:
        cursor.execute(f"CREATE INDEX {index} ON {table}({cols})")


def _add_column_if_missing(cursor, table, column, ddl):
    if USE_PG:
        cursor.execute(
            "SELECT COUNT(*) AS n FROM information_schema.columns "
            "WHERE table_schema=current_schema() AND table_name=%s AND column_name=%s",
            (table, column),
        )
        if not cursor.fetchone()["n"]:
            cursor.execute(f'ALTER TABLE {table} ADD COLUMN "{column}" {ddl}')
    else:
        cursor.execute(
            "SELECT COUNT(*) AS n FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s",
            (table, column),
        )
        if not cursor.fetchone()["n"]:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
