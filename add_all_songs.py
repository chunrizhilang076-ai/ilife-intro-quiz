import urllib.request
import json
import sqlite3
import os
import re

DB_PATH = os.path.join(os.path.dirname(__file__), "ilife_quiz.db")

def normalize_title(t):
    return re.sub(r'[\s!！♡\(\)（）\-\_\~～\?？]', '', t.lower())

def fetch_and_expand_songs():
    print("iLiFE! の全楽曲・ソロ曲・最新曲をiTunes APIから収集・拡張中...")
    
    # 複数クエリで漏れなく収集
    queries = ['iLiFE!', 'iLiFE ソロ', '心花りり', 'あいす iLiFE', '福丸うさ']
    all_results = []
    seen_track_ids = set()

    for q in queries:
        url = f'https://itunes.apple.com/search?term={urllib.parse.quote(q)}&country=jp&entity=song&limit=200'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req) as res:
                data = json.loads(res.read().decode('utf-8'))
                for item in data.get('results', []):
                    t_id = item.get('trackId')
                    if t_id and t_id not in seen_track_ids:
                        seen_track_ids.add(t_id)
                        all_results.append(item)
        except Exception as e:
            print(f"クエリエラー ({q}): {e}")

    print(f"収集トラック総数: {len(all_results)}")

    # カラオケやインストを除外して良質な楽曲を抽出
    valid_songs = []
    seen_titles = set()

    ignore_keywords = ['カラオケ', 'karaoke', 'instrumental', 'ガイド無し', '立体音響', 'cover', 'se', 'prelude', 'prologue', 'beginning of']

    for item in all_results:
        t_name = item.get('trackName', '')
        art_name = item.get('artistName', '')
        coll_name = item.get('collectionName', '')
        preview_url = item.get('previewUrl')

        if not preview_url:
            continue

        # iLiFE関連かチェック
        is_ilife = (
            'ilife' in art_name.lower() or 'ilife' in coll_name.lower() or 'ilife' in t_name.lower()
            or 'あいす' in t_name or 'りり' in t_name or 'うさ' in t_name or 'かれん' in t_name or 'のあ' in t_name or 'みに' in t_name
        )
        if not is_ilife:
            continue

        # 除外キーワード
        lower_name = t_name.lower()
        if any(ign in lower_name for ign in ignore_keywords):
            continue

        # バージョン違いでタイトルを整理（例: (2025ver.)などは含めるが重複を避ける）
        norm = normalize_title(t_name)
        if norm in seen_titles:
            continue
        seen_titles.add(norm)

        # アートワーク
        art_url = item.get('artworkUrl100', '').replace('100x100bb.jpg', '400x400bb.jpg')
        album = item.get('collectionName', 'シングル / 配信')
        year = int(item.get('releaseDate', '2023')[:4]) if item.get('releaseDate') else 2023

        # ヒント・タグ付け
        if 'ソロ' in t_name:
            hint = f"メンバーソロ曲！ アルバム『{album}』収録。"
            difficulty = 3
        elif any(hit in t_name for hit in ['スターターパック', '初恋リバイバル', '会いにKiTE', 'サイクロンライフ', 'むげんだいすき', 'BRAVE GROOVE']):
            hint = f"iLiFE! を代表する超人気アンセム！ アルバム『{album}』収録。"
            difficulty = 1
        else:
            hint = f"ライブ・サブスクで大人気の名曲！ アルバム『{album}』収録。"
            difficulty = 2

        valid_songs.append({
            'title': t_name,
            'album': album,
            'year': year,
            'hint': hint,
            'difficulty': difficulty,
            'preview_url': preview_url,
            'artwork_url': art_url
        })

    print(f"登録候補の厳選楽曲数: {len(valid_songs)}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    added_count = 0
    updated_count = 0

    for s in valid_songs:
        # 既存曲があるかチェック
        cursor.execute("SELECT id FROM songs WHERE title = ? OR title LIKE ?", (s['title'], f"%{s['title']}%"))
        row = cursor.fetchone()

        if row:
            cursor.execute("""
                UPDATE songs 
                SET preview_url = ?, artwork_url = ?, album = ?, year = ?
                WHERE id = ?
            """, (s['preview_url'], s['artwork_url'], s['album'], s['year'], row[0]))
            updated_count += 1
        else:
            # 新規挿入
            cursor.execute("""
                INSERT INTO songs (title, album, year, hint, difficulty, preview_url, artwork_url, bpm, melody_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, 180, '[]')
            """, (s['title'], s['album'], s['year'], s['hint'], s['difficulty'], s['preview_url'], s['artwork_url']))
            added_count += 1
            print(f"✨ 【新規追加】{s['title']} ({s['album']})")

    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM songs")
    total_in_db = cursor.fetchone()[0]
    conn.close()

    print(f"\n🎉 完了！ 新規追加: {added_count}曲 / 更新: {updated_count}曲 / DB内全曲数: {total_in_db}曲")

if __name__ == '__main__':
    fetch_and_expand_songs()
