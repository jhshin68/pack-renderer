// explore_tiling_count.js
// rows×cols 사각형을 k개 그룹(각 P셀, 연결성)으로 분할하는 경우의 수 카운트.
// BFS 기반 partition enumeration (time-bounded).
'use strict';

function countPartitions(rows, cols, P, { timeoutMs = 5000, sampleEach = 1, maxCount = 1e9 } = {}) {
  const N = rows * cols;
  if (N % P !== 0) return { total: 0, timedOut: false };
  const K = N / P;

  const idx = (r, c) => r * cols + c;
  const neighbors = new Array(N);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const arr = [];
    if (r > 0) arr.push(idx(r-1, c));
    if (r < rows - 1) arr.push(idx(r+1, c));
    if (c > 0) arr.push(idx(r, c-1));
    if (c < cols - 1) arr.push(idx(r, c+1));
    neighbors[idx(r, c)] = arr;
  }

  const owner = new Int32Array(N).fill(-1);
  let count = 0;
  const start = Date.now();
  let timedOut = false;

  // 표준 기법: 항상 가장 작은 인덱스의 미분할 셀에서 새 그룹 시작 → 중복 없음
  function dfs(nextGroup) {
    if (Date.now() - start > timeoutMs) { timedOut = true; return true; }
    if (count >= maxCount) return true;
    if (nextGroup === K) { count++; return false; }

    // 가장 작은 미할당 셀 찾기
    let seed = -1;
    for (let i = 0; i < N; i++) if (owner[i] === -1) { seed = i; break; }
    if (seed === -1) return false;

    // 이 seed에서 시작하는 연결된 P셀 부분집합 모두 열거
    const groupCells = [seed];
    owner[seed] = nextGroup;
    const frontier = new Set();
    for (const n of neighbors[seed]) if (owner[n] === -1) frontier.add(n);

    function expand(need) {
      if (Date.now() - start > timeoutMs) { timedOut = true; return true; }
      if (need === 0) {
        // 현재 groupCells 확정 → 다음 그룹으로
        return dfs(nextGroup + 1);
      }
      const frontArr = Array.from(frontier);
      for (const cand of frontArr) {
        if (owner[cand] !== -1) continue;
        owner[cand] = nextGroup;
        groupCells.push(cand);
        frontier.delete(cand);
        const added = [];
        for (const n of neighbors[cand]) {
          if (owner[n] === -1 && !frontier.has(n)) {
            frontier.add(n);
            added.push(n);
          }
        }
        const stop = expand(need - 1);
        // backtrack
        owner[cand] = -1;
        groupCells.pop();
        frontier.add(cand);
        for (const n of added) frontier.delete(n);
        if (stop) return true;
      }
      return false;
    }

    const stop = expand(P - 1);
    owner[seed] = -1;
    return stop;
  }

  dfs(0);
  return { total: count, timedOut };
}

// 실행 케이스
const cases = [
  { rows: 3, cols: 3, P: 3 },   // 3S3P — sanity
  { rows: 3, cols: 5, P: 3 },   // 5S3P
  { rows: 3, cols: 6, P: 3 },   // 6S3P
  { rows: 4, cols: 4, P: 4 },   // 4S4P
  { rows: 5, cols: 4, P: 5 },   // 4S5P
  { rows: 5, cols: 5, P: 5 },   // 5S5P
  { rows: 5, cols: 6, P: 5 },   // 6S5P
  { rows: 5, cols: 10, P: 5 },  // 10S5P — TARGET
  { rows: 5, cols: 13, P: 5 },  // 13S5P
];

console.log('holder  S×P   partitions   time   note');
console.log('------  ----  -----------  -----  ------------------');
for (const { rows, cols, P } of cases) {
  const N = rows * cols;
  const S = N / P;
  const t0 = Date.now();
  const { total, timedOut } = countPartitions(rows, cols, P, { timeoutMs: 8000, maxCount: 5_000_000 });
  const dt = Date.now() - t0;
  const note = timedOut ? (total >= 5_000_000 ? 'cap hit' : 'TIMEOUT (partial)') : 'exact';
  console.log(
    (rows + '×' + cols).padEnd(7) +
    (S + 'S' + P + 'P').padEnd(6) +
    String(total).padStart(11) + '  ' +
    String(dt).padStart(4) + 'ms  ' +
    note
  );
}
