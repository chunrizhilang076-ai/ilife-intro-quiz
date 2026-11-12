import sqlite3
import os
import json
import random
from songs_data import ILIFE_SONGS

DB_PATH = os.path.join(os.path.dirname(__file__), "ilife_quiz.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. 楽曲テーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL UNIQUE,
            album TEXT,
            year INTEGER,
            hint TEXT,
            difficulty INTEGER DEFAULT 1,
            bpm INTEGER DEFAULT 170,
            melody_json TEXT,
            audio_file TEXT DEFAULT NULL
        )
    """)

    # 2. スコア・リーダーボードテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quiz_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            score INTEGER NOT NULL,
            correct_count INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            avg_time REAL,
            max_combo INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 楽曲データをDBに挿入（新規追加時のみ）
    for song in ILIFE_SONGS:
        cursor.execute("""
            INSERT OR IGNORE INTO songs (id, title, album, year, hint, difficulty, bpm, melody_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            song["id"],
            song["title"],
            song.get("album", "シングル"),
            song.get("year", 2023),
            song.get("hint", ""),
            song.get("difficulty", 1),
            song.get("bpm", 170),
            json.dumps(song.get("melody", []))
        ))

    conn.commit()
    conn.close()

def get_all_songs():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, album, year, hint, difficulty, bpm, audio_file FROM songs ORDER BY id ASC")
    songs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return songs

def get_question(excluded_ids=None):
    """ランダムに1問出題。正解1曲＋ランダムなダミー3曲の4択を生成"""
    if excluded_ids is None:
        excluded_ids = []

    conn = get_connection()
    cursor = conn.cursor()

    # 除外リスト以外から正解曲を1つ選出
    placeholders = ",".join("?" for _ in excluded_ids) if excluded_ids else ""
    where_clause = f"WHERE id NOT IN ({placeholders})" if placeholders else ""
    cursor.execute(f"SELECT * FROM songs {where_clause} ORDER BY RANDOM() LIMIT 1", excluded_ids)
    correct_row = cursor.fetchone()

    if not correct_row:
        # 全曲出題済みの場合は全件からランダム
        cursor.execute("SELECT * FROM songs ORDER BY RANDOM() LIMIT 1")
        correct_row = cursor.fetchone()

    correct_song = dict(correct_row)
    correct_song["melody"] = json.loads(correct_song["melody_json"])

    # ダミー選択肢を他の曲から3曲取得
    cursor.execute("SELECT title FROM songs WHERE id != ? ORDER BY RANDOM() LIMIT 3", (correct_song["id"],))
    dummy_titles = [row["title"] for row in cursor.fetchall()]

    # 選択肢シャッフル
    choices = dummy_titles + [correct_song["title"]]
    random.shuffle(choices)

    conn.close()

    # クライアントへ返すデータ（正解タイトルは伏せる）
    return {
        "question_id": correct_song["id"],
        "choices": choices,
        "album": correct_song["album"],
        "year": correct_song["year"],
        "hint": correct_song["hint"],
        "difficulty": correct_song["difficulty"],
        "bpm": correct_song["bpm"],
        "melody": correct_song["melody"],
        "preview_url": correct_song.get("preview_url"),
        "artwork_url": correct_song.get("artwork_url"),
        "audio_file": correct_song["audio_file"]
    }

def verify_answer(song_id: int, selected_title: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT title, hint, album, artwork_url, preview_url FROM songs WHERE id = ?", (song_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"correct": False, "answer": ""}

    is_correct = (row["title"] == selected_title)
    return {
        "correct": is_correct,
        "answer": row["title"],
        "hint": row["hint"],
        "album": row["album"],
        "artwork_url": row["artwork_url"],
        "preview_url": row["preview_url"]
    }

def save_score(player_name: str, score: int, correct_count: int, total_questions: int, avg_time: float, max_combo: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO quiz_scores (player_name, score, correct_count, total_questions, avg_time, max_combo)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (player_name, score, correct_count, total_questions, avg_time, max_combo))
    conn.commit()
    inserted_id = cursor.lastrowid
    conn.close()
    return inserted_id

def get_ranking(limit: int = 10):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, player_name, score, correct_count, total_questions, avg_time, max_combo,
               datetime(created_at, 'localtime') as created_at
        FROM quiz_scores
        ORDER BY score DESC, avg_time ASC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_stats():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as song_count FROM songs")
    song_count = cursor.fetchone()["song_count"]

    cursor.execute("""
        SELECT 
            COUNT(*) as total_plays,
            COALESCE(MAX(score), 0) as high_score,
            COALESCE(AVG(score), 0) as avg_score
        FROM quiz_scores
    """)
    score_stats = dict(cursor.fetchone())
    conn.close()

    return {
        "song_count": song_count,
        "total_plays": score_stats["total_plays"],
        "high_score": score_stats["high_score"],
        "avg_score": round(score_stats["avg_score"], 1)
    }
