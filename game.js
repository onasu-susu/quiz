// へぇ〜！雑学クイズ
const ROUND = 10; // 1回の問題数
const POINT = 10; // 1問の点数（10問で100点満点）
const TIME = 15; // 1問の制限時間（秒）
const $ = (sel) => document.querySelector(sel);

const screens = { title: $("#title"), play: $("#play"), result: $("#result") };
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => (el.hidden = k !== name));
  window.scrollTo(0, 0);
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ハイスコアは、この端末のブラウザにだけ覚えておく（使えない環境ではなにもしない）
function loadBest() {
  try { return JSON.parse(localStorage.getItem("hee-quiz-best-100") || "{}"); } catch { return {}; }
}
function saveBest(best) {
  try { localStorage.setItem("hee-quiz-best-100", JSON.stringify(best)); } catch {}
}

// ---------- タイトル ----------
const catName = (cat) => (cat === "all" ? "ぜんぶ" : CATEGORIES[cat].name);

function renderTitle() {
  const best = loadBest();
  const box = $(".cats");
  box.replaceChildren(...Object.entries(CATEGORIES).map(([key, c]) => {
    const b = document.createElement("button");
    b.className = "cat";
    b.dataset.cat = key;
    const n = QUESTIONS.filter((q) => q.cat === key).length;
    b.innerHTML = `<span class="icon">${c.icon}</span><b>${c.name}</b><small>${n}問${best[key] !== undefined ? ` ・ 最高 ${best[key]}点` : ""}</small>`;
    return b;
  }));
  $(".total").textContent = QUESTIONS.length;
  $(".best").textContent = best.all !== undefined ? `ランダム10問の最高記録：${best.all}点` : "";
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (b) start(b.dataset.cat);
});

// ---------- 問題 ----------
let game;

// 「ぜんぶから」は、問題の多いジャンルにかたよらないよう、ジャンルを選んでからその中の1問を出す
function pick(cat) {
  if (cat !== "all") return shuffle(QUESTIONS.filter((q) => q.cat === cat)).slice(0, ROUND);
  const byCat = {};
  shuffle(QUESTIONS).forEach((q) => (byCat[q.cat] = byCat[q.cat] || []).push(q));
  const cats = Object.keys(byCat);
  const list = [];
  let order = [];
  while (list.length < ROUND) {
    if (!order.length) order = shuffle(cats);
    const q = byCat[order.pop()].pop();
    if (q) list.push(q);
  }
  return list;
}

// まちがいの選択肢：決まっていればそれを、候補（pool）があればそこから3つ選ぶ
function wrongChoices(q) {
  if (q.c) return q.c;
  return shuffle(q.pool.filter((x) => x !== q.a)).slice(0, 3);
}

function start(cat) {
  game = { cat, list: pick(cat), i: 0, score: 0, combo: 0, maxCombo: 0, log: [] };
  showScreen("play");
  ask();
}

let timer, left, startedAt;

function ask() {
  const q = game.list[game.i];
  $(".count").textContent = `${game.i + 1} / ${game.list.length} 問`;
  $(".cat-label").textContent = `${CATEGORIES[q.cat].icon} ${CATEGORIES[q.cat].name}`;
  $(".question").textContent = q.q;
  $(".feedback").hidden = true;
  const box = $(".choices");
  box.replaceChildren(...shuffle([q.a, ...wrongChoices(q)]).map((text, n) => {
    const b = document.createElement("button");
    b.className = "choice";
    b.innerHTML = `<span class="key">${n + 1}</span>`;
    b.append(text);
    b.addEventListener("click", () => answer(text, b));
    return b;
  }));

  // 制限時間
  left = TIME;
  startedAt = performance.now();
  const bar = $(".timer i");
  bar.style.transition = "none";
  bar.style.width = "100%";
  bar.parentElement.classList.remove("hurry");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = `width ${TIME}s linear`;
    bar.style.width = "0%";
  }));
  clearInterval(timer);
  timer = setInterval(() => {
    left = TIME - (performance.now() - startedAt) / 1000;
    if (left <= 5) bar.parentElement.classList.add("hurry");
    if (left <= 0) answer(null, null);
  }, 100);
}

function answer(text, button) {
  if (!$(".feedback").hidden) return; // もう答えた
  clearInterval(timer);
  const bar = $(".timer i");
  bar.style.width = getComputedStyle(bar).width;
  bar.style.transition = "none";

  const q = game.list[game.i];
  const ok = text === q.a;
  if (ok) {
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.score += POINT;
  } else {
    game.combo = 0;
  }
  game.log.push({ q, ok, picked: text });

  document.querySelectorAll(".choice").forEach((b) => {
    b.disabled = true;
    if (b.lastChild.textContent === q.a) b.classList.add("right");
  });
  if (button && !ok) button.classList.add("wrong");

  $(".score").textContent = `${game.score} 点`;
  const combo = $(".combo");
  combo.hidden = game.combo < 2;
  combo.textContent = `🔥 ${game.combo}連続`;

  const verdict = $(".verdict");
  verdict.className = "verdict " + (ok ? "ok" : "ng");
  verdict.textContent = ok ? `⭕ 正解！ +${POINT}点` : text === null ? `⏰ 時間切れ… 正解は「${q.a}」` : `❌ ざんねん… 正解は「${q.a}」`;
  $(".note").textContent = "💡 " + q.note;
  $(".next").textContent = game.i + 1 < game.list.length ? "次へ" : "結果を見る";
  $(".feedback").hidden = false;
  $(".next").focus({ preventScroll: true });
}

$(".next").addEventListener("click", () => {
  game.i++;
  if (game.i < game.list.length) ask();
  else finish();
});

document.addEventListener("keydown", (e) => {
  if (screens.play.hidden) return;
  if ($(".feedback").hidden && /^[1-4]$/.test(e.key)) {
    const b = document.querySelectorAll(".choice")[Number(e.key) - 1];
    if (b) b.click();
  }
});

// ---------- 結果 ----------
const RANKS = [
  { min: 10, icon: "👑", name: "雑学キング" },
  { min: 8, icon: "🎓", name: "物知り博士" },
  { min: 6, icon: "📚", name: "雑学通" },
  { min: 4, icon: "🌱", name: "へぇ〜見習い" },
  { min: 0, icon: "🐣", name: "これから伸びる人" },
];

function finish() {
  const right = game.log.filter((l) => l.ok).length;
  const total = game.log.length;
  const rank = RANKS.find((r) => right >= Math.round((r.min / 10) * total));
  $(".rank-icon").textContent = rank.icon;
  $(".rank").textContent = rank.name;
  $(".final").innerHTML = `<b>${game.score}</b> 点 <small>/ ${total * POINT}点</small><br><small>${total}問中 ${right}問 正解 ・ 最大 ${game.maxCombo}連続</small>`;

  const best = loadBest();
  const record = $(".record");
  if (best[game.cat] === undefined || game.score > best[game.cat]) {
    record.textContent = best[game.cat] !== undefined ? `🎉 自己ベスト更新！（前回まで ${best[game.cat]}点）` : "🎉 はじめての記録！";
    best[game.cat] = game.score;
    saveBest(best);
  } else {
    record.textContent = `自己ベスト：${best[game.cat]}点`;
  }

  $(".review").replaceChildren(...game.log.map((l) => {
    const li = document.createElement("li");
    li.className = l.ok ? "ok" : "ng";
    const q = document.createElement("b");
    q.textContent = `${l.ok ? "⭕" : "❌"} ${l.q.q}`;
    const a = document.createElement("span");
    a.textContent = `答え：${l.q.a}`;
    const n = document.createElement("small");
    n.textContent = l.q.note;
    li.append(q, a, n);
    return li;
  }));
  game.right = right;
  game.rankName = rank.name;
  showScreen("result");
}

$(".retry").addEventListener("click", () => start(game.cat));
$(".home").addEventListener("click", () => { renderTitle(); showScreen("title"); });
$(".share").addEventListener("click", async () => {
  const text = `へぇ〜！雑学クイズ（${catName(game.cat)}）で ${game.score}点！ ${game.list.length}問中${game.right}問正解の「${game.rankName}」でした 🎉`;
  const url = location.href.split("#")[0];
  try {
    if (navigator.share) await navigator.share({ text, url });
    else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      $(".share").textContent = "コピーしました！";
      setTimeout(() => ($(".share").textContent = "結果をシェア"), 2000);
    }
  } catch {}
});

renderTitle();
