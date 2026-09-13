import os

import psycopg2
from psycopg2.extras import RealDictCursor

# 优先读环境变量 DATABASE_URL(Render 等平台注入),本地开发可设默认值
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/expense_tracker"
)

DEFAULT_CATEGORIES = {
    "expense": ["餐饮", "交通", "购物", "娱乐", "居住", "医疗", "教育", "其他"],
    "income": ["工资", "兼职", "奖金", "红包", "理财收益", "其他收入"],
}


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def init_db():
    # 数据库本身由平台创建,这里只负责建表、索引和种子数据
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(50) NOT NULL UNIQUE,
                    type VARCHAR(10) NOT NULL DEFAULT 'expense'
                        CHECK (type IN ('expense', 'income'))
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    gender VARCHAR(10),
                    birthday DATE,
                    avatar VARCHAR(16),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS records (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL,
                    type VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
                    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
                    category_id INT NOT NULL REFERENCES categories(id),
                    date DATE NOT NULL,
                    note VARCHAR(200) DEFAULT ''
                )
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS budgets (
                    user_id INT NOT NULL,
                    month VARCHAR(7) NOT NULL,
                    total DECIMAL(12,2) NOT NULL DEFAULT 0,
                    category_budget TEXT,
                    PRIMARY KEY (user_id, month)
                )
            """)
            for ctype, names in DEFAULT_CATEGORIES.items():
                for name in names:
                    c.execute(
                        "INSERT INTO categories(name, type) VALUES (%s, %s) "
                        "ON CONFLICT (name) DO NOTHING",
                        (name, ctype),
                    )
            # 练习记录(吉他 / 钢琴):爬格子、音阶、曲目等
            c.execute("""
                CREATE TABLE IF NOT EXISTS practice_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL,
                    date DATE NOT NULL,
                    instrument VARCHAR(10) NOT NULL,
                    kind VARCHAR(20) NOT NULL,
                    bpm INT,
                    minutes INT NOT NULL,
                    note VARCHAR(200)
                )
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_practice_user_date ON practice_logs(user_id, date)")

            # 随想笔记:按用户存心情随想,替代浏览器 localStorage
            c.execute("""
                CREATE TABLE IF NOT EXISTS mood_notes (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL,
                    mood VARCHAR(16) NOT NULL DEFAULT '😊',
                    decor VARCHAR(128) DEFAULT '',
                    text VARCHAR(500) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_notes_user_time ON mood_notes(user_id, created_at)")
        conn.commit()
    finally:
        conn.close()
