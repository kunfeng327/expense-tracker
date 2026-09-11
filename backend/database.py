import pymysql
from werkzeug.security import generate_password_hash
from config import DB_CONFIG

DEFAULT_CATEGORIES = {
    "expense": ["餐饮", "交通", "购物", "娱乐", "居住", "医疗", "教育", "其他"],
    "income": ["工资", "兼职", "奖金", "红包", "理财收益", "其他收入"],
}


def get_conn(with_db=True):
    cfg = dict(DB_CONFIG)
    if not with_db:
        cfg.pop("database")
    return pymysql.connect(**cfg, cursorclass=pymysql.cursors.DictCursor,
                            autocommit=False)


def init_db():
    # 先建库(不存在时)
    conn = get_conn(with_db=False)
    with conn.cursor() as c:
        c.execute(
            "CREATE DATABASE IF NOT EXISTS expense_tracker "
            "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
    conn.commit()
    conn.close()

    conn = get_conn()
    with conn.cursor() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                type VARCHAR(10) NOT NULL DEFAULT 'expense'
                    CHECK (type IN ('expense', 'income'))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
                amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
                category_id INT NOT NULL,
                date DATE NOT NULL,
                note VARCHAR(200) DEFAULT '',
                FOREIGN KEY (category_id) REFERENCES categories(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                month VARCHAR(7) PRIMARY KEY,
                total DECIMAL(12,2) NOT NULL DEFAULT 0,
                category_budget TEXT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        for ctype, names in DEFAULT_CATEGORIES.items():
            for name in names:
                c.execute(
                    "INSERT IGNORE INTO categories(name, type) VALUES (%s, %s)",
                    (name, ctype),
                )
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        # 用户资料字段:性别 / 生日 / 头像 emoji
        _add_column_if_missing(c, "users", "gender", "VARCHAR(10) NULL")
        _add_column_if_missing(c, "users", "birthday", "DATE NULL")
        _add_column_if_missing(c, "users", "avatar", "VARCHAR(16) NULL")
        # 练习记录(吉他 / 钢琴):爬格子、音阶、曲目等
        c.execute("""
            CREATE TABLE IF NOT EXISTS practice_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                date DATE NOT NULL,
                instrument VARCHAR(10) NOT NULL,
                kind VARCHAR(20) NOT NULL,
                bpm INT NULL,
                minutes INT NOT NULL,
                note VARCHAR(200) NULL,
                INDEX idx_user_date (user_id, date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # 旧表迁移:records / budgets 增加 user_id(已有数据归给第一个用户)
        _add_column_if_missing(c, "records", "user_id", "INT")
        _add_column_if_missing(c, "budgets", "user_id", "INT")
        c.execute("UPDATE records SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL")
        c.execute("UPDATE budgets SET user_id = (SELECT MIN(id) FROM users) WHERE user_id IS NULL")
        # budgets 主键从 month 改为 (user_id, month),支持多用户各设各的预算
        c.execute("SHOW INDEX FROM budgets WHERE Key_name='PRIMARY'")
        cols = [r["Column_name"] for r in c.fetchall()]
        if cols == ["month"]:
            c.execute("ALTER TABLE budgets DROP PRIMARY KEY, ADD PRIMARY KEY(user_id, month)")


def _add_column_if_missing(cursor, table, column, ddl):
    cursor.execute(
        "SELECT COUNT(*) AS n FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s",
        (table, column),
    )
    if not cursor.fetchone()["n"]:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
