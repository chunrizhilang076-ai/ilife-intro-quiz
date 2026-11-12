import urllib.request
import json
import sqlite3
import os
import re

DB_PATH = os.path.join(os.path.dirname(__file__), "ilife_quiz.db")

def normalize_title(t):
    """マッチング用のタイトル正規化（感嘆符や半角全角を統一）"""
    t = t.lower()
    t = re.sub(r'[\s!！♡\(\)（）\-\_\~～]', '', t)
    return t

def update_previews():
    print("Apple Music / iTunes API から iLiFE! 公式プレビュー音源を取得中...")
    url = 'https://itunes.apple.com/search?term=iLiFE!&country=jp&entity=song&limit=200'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
    except Exception as e:
        print(f"APIエラー: {e}")
        return

    results = data.get('results', [])
    print(f"取得したトラック数: {len(results)}")

    # プレビュー辞書の作成 (正規化タイトル -> track)
    preview_map = {}
    for item in results:
        t_name = item.get('trackName', '')
        art_name = item.get('artistName', '')
        coll_name = item.get('collectionName', '')
        # iLiFE! 関連の楽曲のみ
        if 'ilife' in art_name.lower() or 'ilife' in coll_name.lower() or 'ilife' in t_name.lower():
            norm = normalize_title(t_name)
            # 優先度: previewUrl があるものを登録
            if item.get('previewUrl') and norm not in preview_map:
                preview_map[norm] = item

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # カラムがなければ追加
    try:
        cursor.execute("ALTER TABLE songs ADD COLUMN preview_url TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE songs ADD COLUMN artwork_url TEXT")
    except sqlite3.OperationalError:
        pass

    cursor.execute("SELECT id, title FROM songs")
    db_songs = cursor.fetchall()

    matched_count = 0
    for song_id, title in db_songs:
        norm = normalize_title(title)
        matched_item = preview_map.get(norm)

        # 部分一致で検索
        if not matched_item:
            for k, v in preview_map.items():
                if norm in k or k in norm:
                    matched_item = v
                    break

        if matched_item:
            p_url = matched_item.get('previewUrl')
            # 高解像度ジャケット画像
            art_url = matched_item.get('artworkUrl100', '').replace('100x100bb.jpg', '400x400bb.jpg')
            cursor.execute("UPDATE songs SET preview_url = ?, artwork_url = ? WHERE id = ?", (p_url, art_url, song_id))
            matched_count += 1
            print(f"✅ 【原曲紐付け成功】{title} -> {matched_item.get('trackName')}")
        else:
            print(f"⚠️ 【未紐付け】{title}")

    conn.commit()
    conn.close()
    print(f"\n合計 {matched_count} / {len(db_songs)} 曲に公式原曲プレビュー音源を紐付けました！")

if __name__ == '__main__':
    update_previews()
