from flask import Flask, render_template, request, jsonify
import database

app = Flask(__name__)

# DB初期化
database.init_db()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/question", methods=["GET"])
def get_question():
    excluded = request.args.get("excluded", "")
    excluded_ids = [int(x) for x in excluded.split(",") if x.isdigit()]
    question = database.get_question(excluded_ids=excluded_ids)
    return jsonify({"success": True, "question": question})

@app.route("/api/answer", methods=["POST"])
def check_answer():
    data = request.get_json() or {}
    song_id = data.get("question_id")
    selected_title = data.get("selected_title")

    if not song_id or not selected_title:
        return jsonify({"success": False, "error": "Invalid request"}), 400

    result = database.verify_answer(song_id, selected_title)
    return jsonify({"success": True, **result})

@app.route("/api/score", methods=["POST"])
def submit_score():
    data = request.get_json() or {}
    player_name = str(data.get("name", "")).strip()[:15] or "名無しのアイライファー"
    score = int(data.get("score", 0))
    correct_count = int(data.get("correct_count", 0))
    total_questions = int(data.get("total_questions", 10))
    avg_time = float(data.get("avg_time", 0.0))
    max_combo = int(data.get("max_combo", 0))

    new_id = database.save_score(
        player_name=player_name,
        score=score,
        correct_count=correct_count,
        total_questions=total_questions,
        avg_time=round(avg_time, 2),
        max_combo=max_combo
    )

    ranking = database.get_ranking(limit=10)
    user_rank = None
    for idx, item in enumerate(ranking, start=1):
        if item["id"] == new_id:
            user_rank = idx
            break

    return jsonify({
        "success": True,
        "id": new_id,
        "rank": user_rank,
        "ranking": ranking
    })

@app.route("/api/ranking", methods=["GET"])
def get_ranking():
    ranking = database.get_ranking(limit=10)
    return jsonify({"success": True, "ranking": ranking})

@app.route("/api/songs", methods=["GET"])
def get_songs():
    songs = database.get_all_songs()
    return jsonify({"success": True, "songs": songs})

@app.route("/api/stats", methods=["GET"])
def get_stats():
    stats = database.get_stats()
    return jsonify({"success": True, "stats": stats})

if __name__ == "__main__":
    print("=" * 55)
    print("💖 iLiFE! イントロクイズ - サーバー起動中...")
    print("ブラウザで http://127.0.0.1:5050 を開いてください")
    print("=" * 55)
    app.run(host="127.0.0.1", port=5050, debug=True)
