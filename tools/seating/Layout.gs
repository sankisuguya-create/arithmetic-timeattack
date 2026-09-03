/**
 * Layout.gs — 平面図の解析
 *
 * 平面図シートのセルが、そのまま教室の床。
 *   空白セル            … 通路・空間（机ではない）
 *   「#」で始まるセル    … 注記（#教卓 など）。机ではない
 *   それ以外のセル       … 机。セルの値がその席の班ID
 *
 * 列数×行数のパラメータを持たないのは、島型・コの字・変則配置を
 * パラメータで表現しようとすると必ず表現しきれない形が出るため。
 * 「描いた通り」に勝る指定方法がない。
 *
 * 班のサイズも平面図が決める。3人班と5人班が混ざっても設定は要らない。
 */

/**
 * 物理的な隣接は「上下左右のセルが両方とも机」であるときだけ成立する。
 * 斜めは数えない（斜めの席は会話が発生しにくく、関係の指標として質が落ちる）。
 * 机の間に空白セルを1つ置けば隣接は切れる。通路をそう表現する。
 */
function readPlan_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.PLAN);
  if (!sh) throw new Error('「' + SHEETS.PLAN + '」シートがありません。先に初期設定を実行してください。');

  var rng = sh.getDataRange();
  var r0 = rng.getRow(), c0 = rng.getColumn();
  var raw = rng.getValues().map(function (row) {
    return row.map(function (v) { return String(v).trim(); });
  });
  var rows = raw.length, cols = raw[0].length;

  var cells = [], seats = [], notes = [];
  for (var i = 0; i < rows; i++) {
    cells.push([]);
    for (var j = 0; j < cols; j++) {
      var v = raw[i][j];
      var id = colLetter_(c0 + j) + (r0 + i);
      if (!v) {
        cells[i].push({ kind: 'empty', id: id });
      } else if (v.charAt(0) === '#') {
        var note = { kind: 'note', id: id, text: v.substring(1), r: i, c: j };
        cells[i].push(note);
        notes.push(note);
      } else {
        var seat = { kind: 'seat', id: id, group: v, r: i, c: j };
        cells[i].push(seat);
        seats.push(seat);
      }
    }
  }

  return {
    rows: rows, cols: cols, r0: r0, c0: c0,
    raw: raw, cells: cells, seats: seats, notes: notes,
    groups: groupsOf_(seats),
    adj: adjacencyOf_(cells, rows, cols)
  };
}

/** 班の並び順は平面図を左上から読んだ初出順。色と印刷の並びをこれで決める */
function groupsOf_(seats) {
  var order = [], byId = {};
  for (var i = 0; i < seats.length; i++) {
    var g = seats[i].group;
    if (!byId[g]) { byId[g] = { id: g, seatIds: [] }; order.push(byId[g]); }
    byId[g].seatIds.push(seats[i].id);
  }
  return order;
}

/** 右隣と真下だけ見れば、各ペアを一度ずつ数えられる */
function adjacencyOf_(cells, rows, cols) {
  var pairs = [];
  for (var i = 0; i < rows; i++) {
    for (var j = 0; j < cols; j++) {
      if (cells[i][j].kind !== 'seat') continue;
      if (j + 1 < cols && cells[i][j + 1].kind === 'seat') {
        pairs.push([cells[i][j].id, cells[i][j + 1].id]);
      }
      if (i + 1 < rows && cells[i + 1][j].kind === 'seat') {
        pairs.push([cells[i][j].id, cells[i + 1][j].id]);
      }
    }
  }
  return pairs;
}

function colLetter_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

/**
 * 席を並べる順。名簿順に流し込むときの行き先の順序になる。
 *   横順 … 行ごとに左から右へ
 *   縦順 … 列ごとに上から下へ
 *   班順 … 班の初出順に、班の中は横順
 */
function seatOrder_(plan, mode) {
  var seats = plan.seats.slice();
  if (mode === '縦順') {
    seats.sort(function (a, b) { return (a.c - b.c) || (a.r - b.r); });
  } else if (mode === '班順') {
    var rank = {};
    var gs = plan.groups;
    for (var i = 0; i < gs.length; i++) rank[gs[i].id] = i;
    seats.sort(function (a, b) {
      return (rank[a.group] - rank[b.group]) || (a.r - b.r) || (a.c - b.c);
    });
  } else {
    seats.sort(function (a, b) { return (a.r - b.r) || (a.c - b.c); });
  }
  return seats;
}
