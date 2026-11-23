// common.js : 세 페이지가 함께 쓰는 예제 데이터, 계산, 그림 조각, 단계 엔진
{
const SONGS = [
  { tag: 'A', name: '반짝반짝 작은 별', notes: [[60, 2], [60, 2], [67, 2], [67, 2], [69, 2], [69, 2], [67, 4]] },
  { tag: 'B', name: '떴다 떴다 비행기', notes: [[64, 3], [62, 1], [60, 2], [62, 2], [64, 2], [64, 2], [64, 4]] },
  { tag: 'C', name: 'ABC 노래', notes: [[65, 2], [65, 2], [72, 2], [72, 2], [74, 2], [74, 2], [72, 4]] }
];
// 입력: 반짝반짝 작은 별을 5도 올리고(키 변경) 길이를 2배로(느리게), 앞에 다른 음 하나
const QUERY = [[62, 4], [67, 4], [67, 4], [74, 4], [74, 4], [76, 4], [76, 4], [74, 8]];

// 실험 결과 (C++, 수록곡 구절, 입력 16칸, 질의 1개 검색 시간)
const MEASURED = {
  linear: [['1만 항목', 5385], ['10만 항목', 49211], ['100만 항목', 522433]],
  sorted: [['1만 항목', 2.83], ['10만 항목', 3.90], ['100만 항목', 10.0]],
  hash: [['1만 항목', 1.51], ['10만 항목', 1.43], ['100만 항목', 1.59]]
};

const START_NOTE = 1, START_REST = 2;
const CW = 36, RH = 38, LBL = 176, PX = 24, PY = 20;
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const kindOf = n => n.p < 0 ? '쉼' : '음';

// ---------- 계산: 변화 글자 (② 정렬 배열, ③ 체이닝 해시) ----------
function makeLetters(m, dict) {
  const n = m.notes.length;
  m.edge = Array(n).fill(0); m.nop = Array(n).fill(0); m.patch = Array(n).fill(-1);
  let last = -1;
  m.notes.forEach((now, p) => {
    if (p > 0) {
      const bf = m.notes[p - 1], g = gcd(now.d, bf.d), kinds = kindOf(bf) + '>' + kindOf(now);
      const change = now.p >= 0 && last >= 0 ? now.p - last : 0;
      m.edge[p] = dict(`${kinds} ${now.d / g}/${bf.d / g} ${change}`);
      m.nop[p] = dict(`${kinds} ${now.d / g}/${bf.d / g} 0`);
    }
    if (now.p >= 0) last = now.p;
  });
  let next = -1;
  for (let s = n - 1; s >= 0; s--) { if (m.notes[s].p >= 0) next = s; else m.patch[s] = next; }
}
const plen = (m, s) => m.notes.length - s;
function letter(m, s, k) {
  if (k === 0) return m.notes[s].p < 0 ? START_REST : START_NOTE;
  const p = s + k;
  return p === m.patch[s] ? m.nop[p] : m.edge[p];
}
function common(a, sa, b, sb) {
  const la = plen(a, sa), lb = plen(b, sb);
  let k = 0;
  while (k < la && k < lb && letter(a, sa, k) === letter(b, sb, k)) k++;
  return k;
}
function less(a, sa, b, sb) {
  const k = common(a, sa, b, sb), la = plen(a, sa), lb = plen(b, sb);
  if (k === la || k === lb) return la < lb;
  return letter(a, sa, k) < letter(b, sb, k);
}
// ---------- 계산: 원래 값 직접 비교 (① 순차 배열, ③의 확인 단계) ----------
function rawMatch(a, sa, b, sb) {
  const n = Math.min(plen(a, sa), plen(b, sb)), a0 = a.notes[sa], b0 = b.notes[sb];
  let k = 0, diff = null;
  for (; k < n; k++) {
    const x = a.notes[sa + k], y = b.notes[sb + k];
    if ((x.p < 0) !== (y.p < 0)) break;          // 음과 쉼이 다름
    if (x.d * b0.d !== y.d * a0.d) break;        // 길이 비율이 첫 칸과 다름
    if (x.p >= 0) { const d = y.p - x.p; if (diff === null) diff = d; else if (d !== diff) break; }  // 높이 차이가 다름
  }
  return k;
}
// ---------- 계산: 해시값 ----------
const BASE = 911382323n, MOD = 1000000007n;
function hashOf(m, s, L) { let h = 0n; for (let k = 0; k < L; k++) h = (h * BASE + BigInt(letter(m, s, k))) % MOD; return h; }

function buildModel() {
  const mk = (tag, name, arr) => ({ tag, name, notes: arr.map(([p, d]) => ({ p, d })) });
  const songs = SONGS.map(s => mk(s.tag, s.name, s.notes)), query = mk('Q', '입력 구절', QUERY);
  query.q = true;
  const map = new Map(), dict = t => { if (!map.has(t)) map.set(t, map.size + 3); return map.get(t); };
  [...songs, query].forEach(m => makeLetters(m, dict));
  // 가장 긴 일치 (세 방식 모두 같은 답)
  let L = 0;
  const all = [];
  query.notes.forEach((_, i) => songs.forEach(m => m.notes.forEach((_, j) => { const k = rawMatch(query, i, m, j); all.push({ i, m, j, k }); L = Math.max(L, k); })));
  const best = all.filter(x => x.k === L && L > 0);
  return { songs, query, L, best, names: [...new Set(best.map(x => x.m.name))] };
}

// ---------- 그림 조각 (HTML) ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = (t, cls = '') => `<span class="chip ${cls}">${esc(t)}</span>`;
const labHTML = m => `<div class="lab">${chip(m.tag, m.q ? 'q' : '')}<span>${esc(m.name)}</span></div>`;
// 음 모양: 칸 하나에 음 하나. 위아래 위치 = 음 높이(곡마다 가장 낮은 음 기준), 막대 길이 = 음 길이(곡마다 가장 긴 음 기준)
function contourHTML(m, o = {}) {
  const ps = m.notes.filter(n => n.p >= 0).map(n => n.p), lo = Math.min(...ps), dmax = Math.max(...m.notes.map(n => n.d));
  return `<div class="ct">${m.notes.map((n, k) => {
    const cls = `col${o.on && o.on(k) ? ' on' : ''}${o.miss === k ? ' miss' : ''}${o.dim && o.dim(k) ? ' dim' : ''}`;
    if (n.p < 0) return `<span class="${cls}"><i class="rest"></i></span>`;
    return `<span class="${cls}"><i style="top:${36 - (n.p - lo) * 2.4}px;width:${12 + 22 * n.d / dmax}px"></i></span>`;
  }).join('')}</div>`;
}
// 변화 글자 칸: 첫 칸은 시작 표시(● 음, ○ 쉼), 나머지는 변화 번호. 같은 변화 = 같은 번호
function tilesHTML(m, s, len, o = {}) {
  let h = '';
  for (let k = 0; k < len; k++) {
    const c = letter(m, s, k);
    const inR = o.range && k >= o.range[0] && k < o.range[1];
    const cls = `tl${o.on > k ? ' on' : o.tint > k || inR ? ' tint' : ''}${o.miss === k ? ' miss' : ''}${(o.dimFrom != null && k >= o.dimFrom) || (o.range && !inR) ? ' dim' : ''}`;
    h += `<span class="${cls}">${k === 0 ? `<span class="${c === START_REST ? 'ring' : 'dot'}"></span>` : c}</span>`;
  }
  return `<div class="row">${h}</div>`;
}
const pieceHTML = (m, s, o = {}) => `<div class="pc">${chip(m.tag + s, o.chip || (m.q ? 'q' : ''))}${tilesHTML(m, s, o.len ?? plen(m, s), o)}</div>`;

// ---------- 함께 쓰는 단계 ----------
// 변화 글자로 바꾸기 (② ③)
function changeStep(M) {
  const X = PX + LBL, top = k => PY + k * 96;
  const rows = (mode) => {
    const it = [];
    M.songs.forEach((m, k) => {
      const y = mode === 'tiles' ? PY + k * 52 : top(k);
      it.push({ id: 'lab-' + m.tag, x: PX, y, html: labHTML(m) });
      if (mode !== 'tiles') it.push({ id: 'ct-' + m.tag, x: X, y: y - 6, html: contourHTML(m) });
      if (mode !== 'contour') {
        const twin = M.songs.some(o => o !== m && plen(o, 0) === plen(m, 0) && common(m, 0, o, 0) === plen(m, 0));
        const same = mode === 'tiles' && twin ? plen(m, 0) : 0;
        it.push({ id: 'tl-' + m.tag, x: X, y: mode === 'tiles' ? y : y + 46, html: tilesHTML(m, 0, plen(m, 0), { on: same }) });
      }
    });
    return it;
  };
  const W = X + 7 * CW + PX;
  return {
    phase: '구축', label: '변화 기호', title: '음 높이 대신 앞 음과의 변화를 기호로 기록',
    frames: [
      { title: '저장할 원곡 3곡', draw: () => ({ W, H: top(3) - 30, items: rows('contour') }) },
      { draw: () => ({ W, H: top(3) - 10, items: rows('both') }) },
      { title: '키가 달라도 같은 노래는 같은 기호', draw: () => ({ W, H: PY + 3 * 52, items: rows('tiles') }) }
    ]
  };
}
// 결과 (세 방식 공통)
function resultStep(M) {
  const X = PX + LBL, W = X + 8 * CW + PX, qY = PY + 3 * 60 + 24;
  const items = [];
  M.songs.forEach((m, k) => {
    const segs = M.best.filter(b => b.m === m);
    items.push({ id: 'lab-' + m.tag, x: PX, y: PY + k * 60 + 6, html: labHTML(m) });
    items.push({ id: 'ct-' + m.tag, x: X, y: PY + k * 60, html: contourHTML(m, { on: j => segs.some(b => j >= b.j && j < b.j + M.L), dim: j => !segs.some(b => j >= b.j && j < b.j + M.L) }) });
  });
  const qi = new Set(M.best.map(b => b.i));
  items.push({ id: 'lab-Q', x: PX, y: qY + 6, html: labHTML(M.query) });
  items.push({ id: 'ct-Q', x: X, y: qY, html: contourHTML(M.query, { on: j => [...qi].some(i => j >= i && j < i + M.L), dim: j => ![...qi].some(i => j >= i && j < i + M.L) }) });
  return {
    phase: '결과', label: '결과', title: `가장 긴 일치 ${M.L}칸, 해당 곡 ${M.names.length}곡`,
    frames: [{ draw: () => ({ W, H: qY + 52, items }) }]
  };
}
// 데이터 증가 (실험 결과 막대)
function costStep(key, title, unit) {
  const rows = MEASURED[key], max = Math.max(...rows.map(r => r[1]));
  const fmt = v => unit === 'ms' ? (v / 1000 >= 100 ? Math.round(v / 1000) : (v / 1000).toFixed(1)) + 'ms' : v.toFixed(1) + 'µs';
  const html = `<div class="cap">실험 측정 검색 시간 (입력 16칸)</div><div style="height:16px"></div><div class="bars">${rows.map(([k, v]) =>
    `<span class="k">${k}</span><span class="tr"><i style="width:${v / max * 100}%"></i></span><span class="v">${fmt(v)}</span>`).join('')}</div>`;
  return { phase: '결과', label: '데이터 증가', title, frames: [{ draw: () => ({ W: 608, H: 200, items: [{ id: 'cost', x: PX, y: PY, html }] }) }] };
}

// ---------- 단계 엔진 ----------
function startPage(cfg) {
  const $ = id => document.getElementById(id);
  const stage = $('stage'), box = $('box'), fitEl = $('fit'), calm = matchMedia('(prefers-reduced-motion: reduce)');
  const frames = [];
  cfg.steps.forEach((st, si) => st.frames.forEach(fr => frames.push({ ...fr, si })));
  const nodes = new Map();
  let f = 0, cur = null, SC = 1;
  const phases = [...new Set(cfg.steps.map(s => s.phase))];
  $('steps').innerHTML = phases.map(ph => `<div class="grp"><span class="ph">${ph}</span><div class="pills">${cfg.steps.map((s, i) => s.phase === ph ? `<button type="button" data-s="${i}">${s.label}</button>` : '').join('')}</div></div>`).join('');

  function apply(items) {
    const seen = new Set();
    for (const it of items) {
      let el = nodes.get(it.id);
      if (!el) {
        el = document.createElement('div');
        stage.appendChild(el); nodes.set(it.id, el);
        const p = it.from || it;
        el.style.transition = 'none'; el.style.transform = `translate(${p.x}px,${p.y}px)`; el.style.opacity = 0;
        el.getBoundingClientRect(); el.style.transition = '';
      }
      if (el._h !== it.html) { el.innerHTML = it.html || ''; el._h = it.html; }
      el.className = 'it ' + (it.cls || '');
      el.style.width = it.w != null ? it.w + 'px' : '';
      el.style.height = it.h != null ? it.h + 'px' : '';
      el.style.transform = `translate(${it.x}px,${it.y}px)`;
      el.style.opacity = it.o ?? 1;
      el.style.zIndex = it.z ?? 2;
      el.style.pointerEvents = 'none';
      seen.add(it.id);
    }
    for (const [id, el] of nodes) if (!seen.has(id)) el.style.opacity = 0;
  }
  function size() {
    const W = Math.max(cur.W, cfg.W || 0);
    SC = Math.min(1, Math.max(.5, fitEl.clientWidth / W));
    stage.style.width = W + 'px'; stage.style.height = cur.H + 'px'; stage.style.transform = `scale(${SC})`;
    box.style.width = W * SC + 'px'; box.style.height = cur.H * SC + 'px';
  }
  function follow() {
    if (cur.focus == null) return;
    const top = document.querySelector('.bar').offsetHeight, bottom = document.querySelector('.cta').offsetHeight;
    const y = box.getBoundingClientRect().top + cur.focus * SC;
    if (y > top + 24 && y < innerHeight - bottom - 60) return;
    scrollTo({ top: Math.max(0, scrollY + y - top - (innerHeight - top - bottom) / 2), behavior: calm.matches ? 'auto' : 'smooth' });
  }
  function render() {
    const fr = frames[f], st = cfg.steps[fr.si];
    cur = fr.draw();
    apply(cur.items); size();
    $('phase').textContent = st.phase;
    $('title').textContent = fr.title || st.title;
    $('prog').style.width = (f / (frames.length - 1) * 100) + '%';
    document.querySelectorAll('#steps button').forEach(b => { const s = +b.dataset.s; b.classList.toggle('on', s === fr.si); b.classList.toggle('done', s < fr.si); });
    $('prev').disabled = f === 0;
    $('next').textContent = f === frames.length - 1 ? cfg.next.label : '다음';
    follow();
  }
  const go = k => { f = Math.max(0, Math.min(frames.length - 1, k)); render(); };
  $('next').addEventListener('click', () => { if (f === frames.length - 1) location.href = cfg.next.href; else go(f + 1); });
  $('prev').addEventListener('click', () => go(f - 1));
  $('steps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(frames.findIndex(z => z.si === +b.dataset.s)); });
  document.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(f + 1); if (e.key === 'ArrowLeft') go(f - 1); });
  new ResizeObserver(() => { if (cur) size(); }).observe(fitEl);
  render();
}

Object.assign(window, { SONGS, CW, RH, LBL, PX, PY, START_NOTE, plen, letter, common, less, rawMatch, hashOf, buildModel, esc, chip, labHTML, contourHTML, tilesHTML, pieceHTML, changeStep, resultStep, costStep, startPage });
}
