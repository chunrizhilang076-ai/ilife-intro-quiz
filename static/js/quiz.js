// iLiFE! Intro Quiz - Game Logic & State Management

// DOM Elements
const startScreen = document.getElementById('startScreen');
const quizScreen = document.getElementById('quizScreen');
const resultScreen = document.getElementById('resultScreen');
const startQuizBtn = document.getElementById('startQuizBtn');
const retryQuizBtn = document.getElementById('retryQuizBtn');

// HUD
const currentQNum = document.getElementById('currentQNum');
const comboBadge = document.getElementById('comboBadge');
const scoreVal = document.getElementById('scoreVal');
const timerBar = document.getElementById('timerBar');

// Player & Controls
const equalizer = document.getElementById('equalizer');
const playerStatus = document.getElementById('playerStatus');
const replayBtn = document.getElementById('replayBtn');
const hintBtn = document.getElementById('hintBtn');
const hintBox = document.getElementById('hintBox');
const hintAlbum = document.getElementById('hintAlbum');
const hintYear = document.getElementById('hintYear');
const hintText = document.getElementById('hintText');

// Choices & Feedback
const choicesGrid = document.getElementById('choicesGrid');
const choiceButtons = choicesGrid.querySelectorAll('.choice-btn');
const resultFeedback = document.getElementById('resultFeedback');
const feedbackBadge = document.getElementById('feedbackBadge');
const correctTitleDisplay = document.getElementById('correctTitleDisplay');
const feedbackDetail = document.getElementById('feedbackDetail');
const nextQBtn = document.getElementById('nextQBtn');

// Result Screen
const finalScoreVal = document.getElementById('finalScoreVal');
const finalCorrectVal = document.getElementById('finalCorrectVal');
const finalComboVal = document.getElementById('finalComboVal');
const finalTimeVal = document.getElementById('finalTimeVal');
const titleRankBadge = document.getElementById('titleRankBadge');
const scoreForm = document.getElementById('scoreForm');
const playerNameInput = document.getElementById('playerNameInput');
const saveScoreBtn = document.getElementById('saveScoreBtn');
const saveMsg = document.getElementById('saveMsg');

// Modals
const songListBtn = document.getElementById('songListBtn');
const rankingBtn = document.getElementById('rankingBtn');
const viewLeaderboardBtn = document.getElementById('viewLeaderboardBtn');
const songsModal = document.getElementById('songsModal');
const rankingModal = document.getElementById('rankingModal');
const songsTableBody = document.getElementById('songsTableBody');
const leaderboardList = document.getElementById('leaderboardList');
const headerSongCount = document.getElementById('headerSongCount');
const modalSongCount = document.getElementById('modalSongCount');

// Game State
let TOTAL_QUESTIONS = 10;
const QUESTION_TIME_LIMIT = 12; // 1問あたり12秒
let currentQuestionIndex = 0;
let score = 0;
let combo = 0;
let maxCombo = 0;
let correctCount = 0;
let totalAnswerTime = 0;

// 出題数モード選択
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    window.synthPlayer.playClickSound();
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    TOTAL_QUESTIONS = parseInt(btn.dataset.count, 10) || 10;
  });
});

let currentQuestion = null;
let excludedSongIds = [];
let questionStartTime = 0;
let timerInterval = null;
let isAnswered = false;

// Sound test button
const soundTestBtn = document.getElementById('soundTestBtn');
if (soundTestBtn) {
  soundTestBtn.addEventListener('click', async () => {
    await window.synthPlayer.playTestSound();
  });
}

// 画面のどこかを初めてクリックした時にAudioContextを確実にアンロック
window.addEventListener('click', () => {
  window.synthPlayer.init();
}, { once: true });

// --------------------------------------------------
// イベントリスナー
// --------------------------------------------------
startQuizBtn.addEventListener('click', async () => {
  await window.synthPlayer.init();
  window.synthPlayer.playClickSound();
  startQuiz();
});

retryQuizBtn.addEventListener('click', () => {
  window.synthPlayer.playClickSound();
  startQuiz();
});

replayBtn.addEventListener('click', async () => {
  await window.synthPlayer.init();
  if (currentQuestion && currentQuestion.melody) {
    playCurrentIntro();
  }
});

hintBtn.addEventListener('click', () => {
  window.synthPlayer.playClickSound();
  hintBox.classList.toggle('hidden');
});

choiceButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    if (isAnswered) return;
    const selectedTitle = btn.querySelector('.choice-text').textContent;
    handleChoice(selectedTitle, btn);
  });
});

nextQBtn.addEventListener('click', () => {
  window.synthPlayer.playClickSound();
  if (currentQuestionIndex < TOTAL_QUESTIONS) {
    loadNextQuestion();
  } else {
    showResults();
  }
});

// モーダル開閉
songListBtn.addEventListener('click', () => {
  window.synthPlayer.playClickSound();
  openSongsModal();
});

rankingBtn.addEventListener('click', () => {
  window.synthPlayer.playClickSound();
  openRankingModal();
});

viewLeaderboardBtn.addEventListener('click', () => {
  window.synthPlayer.playClickSound();
  openRankingModal();
});

document.querySelectorAll('.close-modal-btn, .modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.classList.contains('close-modal-btn')) {
      songsModal.classList.add('hidden');
      rankingModal.classList.add('hidden');
    }
  });
});

// スコア登録
scoreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim() || '名無しのアイライファー';
  saveScoreBtn.disabled = true;
  saveMsg.className = 'save-msg';
  saveMsg.textContent = 'ランキングに登録しています...';

  const avgTime = correctCount > 0 ? (totalAnswerTime / correctCount) : 0;

  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        score: score,
        correct_count: correctCount,
        total_questions: TOTAL_QUESTIONS,
        avg_time: avgTime,
        max_combo: maxCombo
      })
    });
    const data = await res.json();
    if (data.success) {
      saveMsg.className = 'save-msg success';
      saveMsg.textContent = data.rank ? `第 ${data.rank} 位にランクインしました！🎉` : 'スコアを保存しました！';
      renderRankingList(data.ranking);
    } else {
      throw new Error(data.error || '登録失敗');
    }
  } catch (err) {
    saveMsg.className = 'save-msg error';
    saveMsg.textContent = 'エラー: ' + err.message;
  } finally {
    saveScoreBtn.disabled = false;
  }
});

// --------------------------------------------------
// クイズ進行ロジック
// --------------------------------------------------
function startQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  correctCount = 0;
  totalAnswerTime = 0;
  excludedSongIds = [];

  scoreVal.textContent = '0';
  comboBadge.classList.add('hidden');

  startScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');

  loadNextQuestion();
}

async function loadNextQuestion() {
  currentQuestionIndex++;
  const qBadgeEl = document.querySelector('.q-badge');
  if (qBadgeEl) {
    qBadgeEl.innerHTML = `第 <span id="currentQNum">${currentQuestionIndex}</span> / ${TOTAL_QUESTIONS} 問`;
  }
  isAnswered = false;

  // UIリセット
  resultFeedback.classList.add('hidden');
  hintBox.classList.add('hidden');
  timerBar.style.width = '100%';
  timerBar.style.background = 'linear-gradient(90deg, #00f0ff, #ff4081)';

  choiceButtons.forEach(btn => {
    btn.disabled = false;
    btn.className = 'choice-btn';
  });

  playerStatus.textContent = '楽曲データを読み込み中... 🎵';

  try {
    const excludedStr = excludedSongIds.join(',');
    const res = await fetch(`/api/question?excluded=${excludedStr}`);
    const data = await res.json();

    if (!data.success || !data.question) {
      throw new Error('問題の取得に失敗しました');
    }

    currentQuestion = data.question;
    excludedSongIds.push(currentQuestion.question_id);

    // 選択肢をセット
    currentQuestion.choices.forEach((choiceTitle, idx) => {
      if (choiceButtons[idx]) {
        choiceButtons[idx].querySelector('.choice-text').textContent = choiceTitle;
      }
    });

    // ヒント情報をセット
    hintAlbum.textContent = currentQuestion.album;
    hintYear.textContent = currentQuestion.year;
    hintText.textContent = currentQuestion.hint;

    // イントロ再生開始
    playCurrentIntro();

    // タイマースタート
    startQuestionTimer();

  } catch (err) {
    console.error(err);
    playerStatus.textContent = '出題エラーが発生しました。';
  }
}

// Audio Player State (原曲プレビュー再生用)
let originalAudio = null;
let originalAudioTimeout = null;
let introDuration = 3.5; // イントロ再生秒数（デフォルト3.5秒）

function stopAllAudio() {
  if (originalAudio) {
    originalAudio.pause();
    originalAudio.currentTime = 0;
    originalAudio = null;
  }
  if (originalAudioTimeout) {
    clearTimeout(originalAudioTimeout);
    originalAudioTimeout = null;
  }
  window.synthPlayer.stop();
  equalizer.classList.remove('animating');
}

// イントロ再生（原曲プレビュー優先、なければシンセ）
function playCurrentIntro(customDuration = null) {
  stopAllAudio();
  if (!currentQuestion) return;

  equalizer.classList.add('animating');
  const dur = customDuration || introDuration;

  if (currentQuestion.preview_url) {
    // 🎧 公式の原曲プレビュー音源を再生！
    playerStatus.textContent = `🎧 原曲のイントロを再生中 (${dur}秒)... 🎵`;
    
    try {
      originalAudio = new Audio(currentQuestion.preview_url);
      originalAudio.volume = 0.8;
      
      originalAudio.play().then(() => {
        // 指定秒数後に自動停止（フェードアウト）
        originalAudioTimeout = setTimeout(() => {
          if (originalAudio) {
            originalAudio.pause();
            originalAudio = null;
          }
          equalizer.classList.remove('animating');
          playerStatus.textContent = 'イントロ再生完了（もう一度聴くボタンで再確認！）';
        }, dur * 1000);
      }).catch(err => {
        console.warn('原曲オーディオ自動再生エラー、シンセにフォールバック:', err);
        fallbackToSynth(dur);
      });
    } catch (e) {
      fallbackToSynth(dur);
    }
  } else {
    fallbackToSynth(dur);
  }
}

function fallbackToSynth(dur) {
  playerStatus.textContent = 'イントロを再生中 (シンセ音源)... 🎵';
  window.synthPlayer.playIntro(
    currentQuestion.melody,
    currentQuestion.bpm || 180,
    dur,
    () => {
      equalizer.classList.remove('animating');
      playerStatus.textContent = '再生終了（もう一度聴くボタンで再確認！）';
    }
  );
}

function startQuestionTimer() {
  clearInterval(timerInterval);
  questionStartTime = performance.now();

  const totalMs = QUESTION_TIME_LIMIT * 1000;

  timerInterval = setInterval(() => {
    if (isAnswered) {
      clearInterval(timerInterval);
      return;
    }

    const elapsedMs = performance.now() - questionStartTime;
    const remainingPct = Math.max(0, 100 - (elapsedMs / totalMs) * 100);
    timerBar.style.width = `${remainingPct}%`;

    if (remainingPct < 30) {
      timerBar.style.background = 'linear-gradient(90deg, #ff903b, #ff4081)';
    }

    if (elapsedMs >= totalMs) {
      clearInterval(timerInterval);
      handleTimeout();
    }
  }, 100);
}

function handleTimeout() {
  if (isAnswered) return;
  isAnswered = true;
  stopAllAudio();
  window.synthPlayer.playIncorrectSound();
  equalizer.classList.remove('animating');

  combo = 0;
  updateComboUI();

  // 選択肢無効化
  choiceButtons.forEach(btn => btn.disabled = true);

  // 正解を確認
  verifyAndShowFeedback('', null, true);
}

async function handleChoice(selectedTitle, clickedBtn) {
  if (isAnswered) return;
  isAnswered = true;
  clearInterval(timerInterval);
  stopAllAudio();
  equalizer.classList.remove('animating');

  const answerTimeSec = (performance.now() - questionStartTime) / 1000;

  // 選択肢無効化
  choiceButtons.forEach(btn => btn.disabled = true);

  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: currentQuestion.question_id,
        selected_title: selectedTitle
      })
    });
    const result = await res.json();

    if (result.correct) {
      // 正解！
      window.synthPlayer.playCorrectSound();
      clickedBtn.classList.add('correct');
      correctCount++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      totalAnswerTime += answerTimeSec;

      // スコア計算: 基本点(1000) + タイムボーナス(最大500) × コンボ倍率
      const timeBonus = Math.max(0, Math.floor((QUESTION_TIME_LIMIT - answerTimeSec) * 50));
      const comboMult = 1.0 + (combo - 1) * 0.2;
      const questionScore = Math.floor((1000 + timeBonus) * comboMult);
      score += questionScore;
      scoreVal.textContent = score.toLocaleString();

      updateComboUI();
      showFeedback(true, result.answer, `タイムボーナス +${timeBonus}点！ ${result.hint}`, result.artwork_url, result.preview_url);
    } else {
      // 不正解
      window.synthPlayer.playIncorrectSound();
      clickedBtn.classList.add('wrong');
      combo = 0;
      updateComboUI();

      // 正解ボタンをハイライト
      choiceButtons.forEach(btn => {
        if (btn.querySelector('.choice-text').textContent === result.answer) {
          btn.classList.add('correct');
        }
      });

      showFeedback(false, result.answer, result.hint, result.artwork_url, result.preview_url);
    }
  } catch (err) {
    console.error(err);
  }
}

async function verifyAndShowFeedback(selectedTitle, clickedBtn, isTimeout = false) {
  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: currentQuestion.question_id,
        selected_title: '__TIMEOUT__'
      })
    });
    const result = await res.json();

    choiceButtons.forEach(btn => {
      if (btn.querySelector('.choice-text').textContent === result.answer) {
        btn.classList.add('correct');
      }
    });

    showFeedback(false, result.answer, `時間切れ！ 正解は『${result.answer}』でした。${result.hint}`, result.artwork_url, result.preview_url);
  } catch (err) {
    console.error(err);
  }
}

const feedbackArtwork = document.getElementById('feedbackArtwork');
const playFullBtn = document.getElementById('playFullBtn');
let lastPreviewUrl = null;

if (playFullBtn) {
  playFullBtn.addEventListener('click', () => {
    if (lastPreviewUrl) {
      stopAllAudio();
      originalAudio = new Audio(lastPreviewUrl);
      originalAudio.volume = 0.85;
      originalAudio.play();
      playFullBtn.querySelector('span').textContent = '🎵 再生中... (クリックで停止)';
      playFullBtn.onclick = () => {
        stopAllAudio();
        playFullBtn.querySelector('span').textContent = '🎧 原曲の続きを聴く';
        playFullBtn.onclick = null;
      };
    }
  });
}

function showFeedback(isCorrect, answerTitle, detail, artworkUrl = null, previewUrl = null) {
  feedbackBadge.className = isCorrect ? 'feedback-badge correct' : 'feedback-badge wrong';
  feedbackBadge.textContent = isCorrect ? '正解！💖' : '残念…！';
  correctTitleDisplay.textContent = `『${answerTitle}』`;
  feedbackDetail.textContent = detail;
  lastPreviewUrl = previewUrl || (currentQuestion ? currentQuestion.preview_url : null);

  if (feedbackArtwork) {
    if (artworkUrl) {
      feedbackArtwork.src = artworkUrl;
      feedbackArtwork.style.display = 'block';
    } else {
      feedbackArtwork.style.display = 'none';
    }
  }

  if (playFullBtn) {
    playFullBtn.style.display = lastPreviewUrl ? 'inline-flex' : 'none';
    playFullBtn.querySelector('span').textContent = '🎧 原曲の続きを聴く';
  }

  resultFeedback.classList.remove('hidden');

  if (currentQuestionIndex >= TOTAL_QUESTIONS) {
    nextQBtn.textContent = '結果発表を見る 👑';
  } else {
    nextQBtn.textContent = '次の問題へ ➡';
  }
}

function updateComboUI() {
  if (combo > 1) {
    comboBadge.textContent = `${combo} COMBO 🔥`;
    comboBadge.classList.remove('hidden');
  } else {
    comboBadge.classList.add('hidden');
  }
}

// --------------------------------------------------
// リザルト発表
// --------------------------------------------------
function showResults() {
  quizScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  finalScoreVal.textContent = score.toLocaleString();
  const correctValEl = document.querySelector('.stat-item:nth-child(1) .s-val');
  if (correctValEl) {
    correctValEl.innerHTML = `<strong>${correctCount}</strong> / ${TOTAL_QUESTIONS}`;
  }
  finalComboVal.textContent = `${maxCombo} 🔥`;

  const avgTime = correctCount > 0 ? (totalAnswerTime / correctCount).toFixed(1) : '0.0';
  finalTimeVal.textContent = `${avgTime}s`;

  // 称号判定
  let titleName = '見習いアイライファー';
  if (correctCount === 10 && score >= 14000) {
    titleName = '👑 伝説の神推しアイライファー！';
  } else if (correctCount >= 9) {
    titleName = '💖 ガチ恋最前列マスター！';
  } else if (correctCount >= 7) {
    titleName = '✨ アイドル属性体感中！';
  } else if (correctCount >= 5) {
    titleName = '🎵 サイクロンライフ満喫者';
  } else {
    titleName = '🔰 はじめてのアイライフスターター';
  }
  titleRankBadge.textContent = `称号: ${titleName}`;
}

// --------------------------------------------------
// モーダル・API連携
// --------------------------------------------------
async function openSongsModal() {
  songsModal.classList.remove('hidden');
  try {
    const res = await fetch('/api/songs');
    const data = await res.json();
    if (data.success && data.songs) {
      modalSongCount.textContent = data.songs.length;
      headerSongCount.textContent = data.songs.length;
      songsTableBody.innerHTML = data.songs.map((s, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${escapeHtml(s.title)}</strong></td>
          <td>${escapeHtml(s.album || '-')}</td>
          <td>${s.year || '-'}</td>
          <td>${escapeHtml(s.hint || '')}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    songsTableBody.innerHTML = '<tr><td colspan="5">読み込みエラー</td></tr>';
  }
}

async function openRankingModal() {
  rankingModal.classList.remove('hidden');
  try {
    const res = await fetch('/api/ranking');
    const data = await res.json();
    if (data.success && data.ranking) {
      renderRankingList(data.ranking);
    }
  } catch (err) {
    leaderboardList.innerHTML = '<li class="loading">読み込みエラー</li>';
  }
}

function renderRankingList(list) {
  if (!list || list.length === 0) {
    leaderboardList.innerHTML = '<li class="loading">まだ記録がありません。一番最初のアイライファーになろう！</li>';
    return;
  }
  leaderboardList.innerHTML = list.map((item, idx) => {
    const rank = idx + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const topClass = rank === 1 ? 'top-1' : '';
    return `
      <li class="lb-item ${topClass}">
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${escapeHtml(item.player_name)}</span>
        <span class="lb-meta">${item.correct_count}/10正解 (${item.avg_time}s)</span>
        <span class="lb-score">${item.score.toLocaleString()} 点</span>
      </li>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// 初期化時に曲数を取得
fetch('/api/stats')
  .then(res => res.json())
  .then(data => {
    if (data.success && data.stats) {
      headerSongCount.textContent = data.stats.song_count;
    }
  })
  .catch(() => {});
