import sqlite3

conn = sqlite3.connect('ilife_quiz.db')
c = conn.cursor()

# 無関係な曲を削除
c.execute("""
    DELETE FROM songs 
    WHERE title LIKE '%feat.%' 
       OR title LIKE '%higher life%' 
       OR title = 'iLife' 
       OR title LIKE '%原曲歌手%' 
       OR album LIKE '%Ubuntu%'
       OR title LIKE '%reprise%'
       OR title LIKE '%Extended%'
""")
conn.commit()

c.execute("SELECT COUNT(*) FROM songs WHERE preview_url IS NOT NULL")
preview_count = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM songs")
total_count = c.fetchone()[0]

print(f"クリーンアップ完了！ 全収録曲数: {total_count}曲 (原曲プレビュー付き: {preview_count}曲)")

# サンプル表示
c.execute("SELECT title, album, year FROM songs ORDER BY RANDOM() LIMIT 10")
for r in c.fetchall():
    print(f"- {r[0]} ({r[1]}, {r[2]}年)")

conn.close()
