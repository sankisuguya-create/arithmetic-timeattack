/**
 * 成長する図形 — 生成器
 *
 * 生成器は「画面の大きさと育ち始める点」を受け取り、タイルの配列を返すだけの純粋な関数。
 * 並べ替え・文字の際の薄め・3層の育ち・描画は、使う側の共通エンジンが受け持つ（SPEC.md）。
 *
 *   make(g) → [{ p: [[x,y], ...], cls: 1|0, dir: 0..4 }, ...]
 *     g   = { W, H, ox, oy, edge, margin }
 *           W,H     画面の大きさ（CSS px）
 *           ox,oy   育ち始める点
 *           edge    タイル1枚の目安の大きさ（px）
 *           margin  分割の途中で捨てる判定に使う余白（px。edge×2 が目安）
 *     p   閉じた多角形の頂点（最後の点から最初の点へ閉じる）。1枚まるごと描く単位
 *     cls 1＝色1（学年の色）の層で塗る、0＝色2（サイトの色）の層で塗る
 *     dir 同じ色の中の明暗の段（0..4）。宝石の切子面のように少しずつ変える
 *
 * ブラウザでは window.GrowingFigures、Node では module.exports に入る。
 * 依存は無い。DOM にも触れない（Node で検査できる：check.cjs）。
 */
(function (root) {
  'use strict';
  var PHI = (1 + Math.sqrt(5)) / 2;

  function lerp(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
  function farthest(g) {
    var f = 0;
    [[0, 0], [g.W, 0], [0, g.H], [g.W, g.H]].forEach(function (p) {
      var dx = p[0] - g.ox, dy = p[1] - g.oy; f = Math.max(f, Math.sqrt(dx * dx + dy * dy));
    });
    return f;
  }
  function onScreen(g, pts, m) {
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return x1 > -m && x0 < g.W + m && y1 > -m && y0 < g.H + m;
  }
  function dirOf(a, b) {
    var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return ((Math.round(ang / (Math.PI / 5)) % 5) + 5) % 5;
  }

  /* ペンローズ（P3）。ロビンソン三角形の置き換えを繰り返し、辺BCを共有する2枚を組にして菱形にする。
     色1＝太い菱形（72°）、色2＝細い菱形（36°） */
  function penrose(g) {
    var R = g.edge, k = 0, far = farthest(g), T = [], i, j;
    while (R < far + g.edge * 2) { R *= PHI; k++; }
    for (i = 0; i < 10; i++) {
      var b = [g.ox + R * Math.cos((2 * i - 1) * Math.PI / 10), g.oy + R * Math.sin((2 * i - 1) * Math.PI / 10)],
          c = [g.ox + R * Math.cos((2 * i + 1) * Math.PI / 10), g.oy + R * Math.sin((2 * i + 1) * Math.PI / 10)];
      if (i % 2 === 0) { var t = b; b = c; c = t; }
      T.push([0, [g.ox, g.oy], b, c]);
    }
    for (var s = 0; s < k; s++) {
      var N = [];
      for (j = 0; j < T.length; j++) {
        var c0 = T[j][0], A = T[j][1], B = T[j][2], C = T[j][3];
        if (c0 === 0) { var P = lerp(A, B, 1 / PHI); N.push([0, C, P, B], [1, P, C, A]); }
        else { var Q = lerp(B, A, 1 / PHI), S = lerp(B, C, 1 / PHI); N.push([1, S, C, A], [1, Q, S, B], [0, S, Q, A]); }
      }
      // 画面（＋余白）に掛からない三角形は、それ以上分割せずに捨てる。
      // 余白を菱形2枚分とるのは、画面の縁で菱形の片割れだけが残らないようにするため
      T = N.filter(function (t) { return onScreen(g, [t[1], t[2], t[3]], g.margin); });
    }
    function key(p) { return Math.round(p[0] * 8) + ',' + Math.round(p[1] * 8); }
    var pair = {}, out = [];
    for (j = 0; j < T.length; j++) {
      var tr = T[j], kb = key(tr[2]), kc = key(tr[3]),
          kk = tr[0] + '|' + (kb < kc ? kb + '|' + kc : kc + '|' + kb), o = pair[kk];
      if (!o) { pair[kk] = tr; continue; }
      delete pair[kk];
      out.push({ p: [tr[1], tr[2], o[1], tr[3]], cls: tr[0], dir: dirOf(tr[1], o[1]) });
    }
    return out;
  }

  /* de Bruijn の多重格子。N 方向の平行線の束を重ね、2本の線の交点ごとに菱形を1枚作る。
     N が奇数なら N 回対称、偶数なら 2N 回対称（N=4 で8回、N=6 で12回）。
     色1＝角が広い菱形（最小角が55°より大きい）、色2＝細い菱形。
     格子のずれ GAM を全部同じにすると3本以上の線が1点で交わり、重なりや隙間が出る。
     わずかにずらしてある（0.2 + 0.0137×j） */
  function multigrid(N, gam) {
    return function (g) {
      var E = [], GAM = [], j, step = (N % 2) ? 2 * Math.PI / N : Math.PI / N;
      for (j = 0; j < N; j++) { E.push([Math.cos(j * step), Math.sin(j * step)]); GAM.push(gam === undefined ? 0.2 + 0.0137 * j : gam); }
      var s = g.edge, R = farthest(g) + g.edge * 2, K = Math.ceil(2 * R / (N * s) * 1.15) + 2, out = [];
      for (var r = 0; r < N; r++) for (var q = r + 1; q < N; q++) {
        var er = E[r], eq = E[q], det = er[0] * eq[1] - er[1] * eq[0];
        var d = ((q - r) * step) % (2 * Math.PI), mn = Math.min(d, 2 * Math.PI - d);
        var cls = Math.min(mn, Math.PI - mn) > 55 * Math.PI / 180 ? 1 : 0;
        for (var kr = -K; kr <= K; kr++) for (var kq = -K; kq <= K; kq++) {
          var a = kr + GAM[r], b = kq + GAM[q];
          var x = (a * eq[1] - b * er[1]) / det, y = (b * er[0] - a * eq[0]) / det;   // 2本の線の交点
          var bx = 0, by = 0;
          for (j = 0; j < N; j++) {
            if (j === r || j === q) continue;
            var Kj = Math.ceil(x * E[j][0] + y * E[j][1] - GAM[j]); bx += Kj * E[j][0]; by += Kj * E[j][1];
          }
          var pts = [[kr, kq], [kr + 1, kq], [kr + 1, kq + 1], [kr, kq + 1]].map(function (v) {
            return [g.ox + s * (bx + v[0] * er[0] + v[1] * eq[0]), g.oy + s * (by + v[0] * er[1] + v[1] * eq[1])];
          });
          if (!onScreen(g, pts, g.edge)) continue;
          out.push({ p: pts, cls: cls, dir: (r + q) % 5 });
        }
      }
      return out;
    };
  }

  /* ひまわり（葉序）。n 番目の点を 半径 c√n・角度 n×137.5° に置き、各点の縄張り（ボロノイ細胞）をタイルにする。
     隣の細胞は番号が n±フィボナッチ数 のものに限られるので、候補はそれだけ見ればよい（1枚あたり約30回の切り取り）。
     色は「対数螺旋の腕」で分ける：角度から log(半径) に比例したねじれを引き、8本の腕に切って交互に塗る。
     輪郭の段階では細胞の並びのフィボナッチ数本の螺旋が、色の段階では別の向きにねじれた8本の腕が見える。
     番号の偶奇で塗る案は、色がまだらになり螺旋に見えなかったので採らない */
  function sunflower(g) {
    var GA = Math.PI * (3 - Math.sqrt(5)), c = g.edge * 0.62, far = farthest(g) + g.edge * 3;
    var Nmax = Math.ceil((far / c) * (far / c)), F = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];
    var P = [[g.ox, g.oy]], n;   // 0 番は育ち始める点そのもの（中心に穴を空けない）
    for (n = 1; n <= Nmax + 3000; n++) {
      var r = c * Math.sqrt(n), t = n * GA; P.push([g.ox + r * Math.cos(t), g.oy + r * Math.sin(t)]);
    }
    function clip(poly, p, q) {   // p の側の半平面（p と q の垂直二等分線）で切る
      var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = q[0] - p[0], ny = q[1] - p[1], out = [];
      for (var i = 0; i < poly.length; i++) {
        var A = poly[i], B = poly[(i + 1) % poly.length];
        var da = (A[0] - mx) * nx + (A[1] - my) * ny, db = (B[0] - mx) * nx + (B[1] - my) * ny;
        if (da <= 0) out.push(A);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) { var u = da / (da - db); out.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]); }
      }
      return out;
    }
    var out = [];
    for (n = 0; n <= Nmax; n++) {
      var p = P[n];
      if (p[0] < -g.edge * 2 || p[0] > g.W + g.edge * 2 || p[1] < -g.edge * 2 || p[1] > g.H + g.edge * 2) continue;
      var h = c * 4, poly = [[p[0] - h, p[1] - h], [p[0] + h, p[1] - h], [p[0] + h, p[1] + h], [p[0] - h, p[1] + h]];
      for (var i = 0; i < F.length; i++) {
        if (n - F[i] >= 0) poly = clip(poly, p, P[n - F[i]]);
        if (n + F[i] < P.length) poly = clip(poly, p, P[n + F[i]]);
      }
      if (poly.length < 3) continue;
      var th = (n * GA) % (2 * Math.PI), tw = th - 1.6 * Math.log(Math.sqrt(n) || 1);
      var arm = Math.floor((((tw / (2 * Math.PI)) % 1) + 1) % 1 * 8);
      out.push({ p: poly, cls: arm % 2, dir: n % 5 });
    }
    return out;
  }

  /* ================================================================
   *  丸みのある図形（円弧だけで囲まれたタイル）
   *  3つとも利用者の評価で採用。丸み・回転対称・同心の育ち方が揃う
   * ================================================================ */
  var TAU = 2 * Math.PI;
  /* 中心 c・半径 r の円の上を、点 p から点 q まで短い向きに進む円弧の点列（p は含み q は含まない） */
  function arc(c,p,q,step,longWay){
    var a0=Math.atan2(p[1]-c[1],p[0]-c[0]), a1=Math.atan2(q[1]-c[1],q[0]-c[0]), d=a1-a0;
    while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
    if(longWay) d=d>0?d-TAU:d+TAU;                     // 長い向きに回る
    var r=Math.hypot(p[0]-c[0],p[1]-c[1]), n=Math.max(2,Math.ceil(Math.abs(d)/(step||0.12))), out=[];
    for(var k=0;k<n;k++){var t=a0+d*k/n;out.push([c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)])}
    return out;
  }
  /* 多角形から円板（中心 c・半径 R）を取り除いた残り。円の内側に入った区間は、円周に沿った弧に置き換える。
     弧は「元の多角形の内側を通る向き」に回る。ふつうは短い向きだが、取り除く円の中心が多角形の内側にあると
     長い向きになる（大きな円から、中心が中に入った小さな円を取り除くとき。内向きの丸い渦格子の仕切りで起きた）。
     短い向きの弧の中点が多角形の内側かどうかで決める。全部が内側なら null */
  function inPoly(pt,poly){var c=false;for(var i=0,j=poly.length-1;i<poly.length;j=i++){var a=poly[i],b=poly[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
  function minusDisk(pts,c,R,shortOnly){   // shortOnly：削り跡をいつも短い向きの弧にする（円がタイルよりずっと大きいとき。凹んだタイルで向きの判定が外れるのを防ぐ）
    var n=pts.length,R2=R*R,ins=pts.map(function(p){var dx=p[0]-c[0],dy=p[1]-c[1];return dx*dx+dy*dy<R2});   // Math.hypot は遅いので2乗で比べる
    var s0=ins.indexOf(false); if(s0<0) return null; if(ins.indexOf(true)<0) return pts;
    function hit(A,B){var dx=B[0]-A[0],dy=B[1]-A[1],fx=A[0]-c[0],fy=A[1]-c[1],a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-R*R,D=Math.sqrt(Math.max(0,b*b-4*a*cc));
      var t1=(-b-D)/(2*a),t2=(-b+D)/(2*a),t=(t1>=0&&t1<=1)?t1:t2;return[A[0]+dx*t,A[1]+dy*t]}
    var out=[],exitP=null;
    for(var k=0;k<n;k++){
      var i=(s0+k)%n,j=(i+1)%n,A=pts[i],B=pts[j];
      if(!ins[i]) out.push(A);
      if(!ins[i]&&ins[j]){exitP=hit(A,B);out.push(exitP)}                 // 円の内側へ入る点
      if(ins[i]&&!ins[j]){
        var Y=hit(A,B), a0=Math.atan2(exitP[1]-c[1],exitP[0]-c[0]), a1=Math.atan2(Y[1]-c[1],Y[0]-c[0]), dd=a1-a0;
        while(dd>Math.PI)dd-=TAU; while(dd<-Math.PI)dd+=TAU;
        var am=a0+dd/2, longWay=!shortOnly&&!inPoly([c[0]+R*Math.cos(am),c[1]+R*Math.sin(am)],pts);
        out=out.concat(arc(c,exitP,Y,0.07,longWay).slice(1));out.push(Y);exitP=null;    // 円周をたどって出る点へ
      }
    }
    return out;
  }
  function add(p,q){return[p[0]+q[0],p[1]+q[1]]}
  function sub(p,q){return[p[0]-q[0],p[1]-q[1]]}
  function mid(p,q){return[(p[0]+q[0])/2,(p[1]+q[1])/2]}
  function range(g,a){var R=Math.max(g.W,g.H)*1.2/a+3;return Math.ceil(R)}

  /* 同心円の中心：半径 R0 の円板を、円板1枚と輪（6・12・18…に等分）で埋める。
     輪ごとに半区画ずらし、放射の線が一直線に通らないようにする（的のような機械的な見え方を避ける） */
  function concentric(g, R0, rings) {
    var O0 = [g.ox, g.oy], out = [];
    for (var rk = 0; rk < rings; rk++) {
      var r1 = R0 * (rk + 1) / rings, r0 = R0 * rk / rings, m = rk ? 6 * rk : 1;
      for (var sg = 0; sg < m; sg++) {
        var sh = (rk & 1) ? Math.PI / m : 0, t0 = TAU * sg / m - Math.PI / 2 + sh, t1 = TAU * (sg + 1) / m - Math.PI / 2 + sh;
        var pts = [], st = Math.max(4, Math.ceil((t1 - t0) / 0.05)), q;
        for (q = 0; q <= st; q++) { var a1 = t0 + (t1 - t0) * q / st; pts.push([O0[0] + r1 * Math.cos(a1), O0[1] + r1 * Math.sin(a1)]); }
        if (rk) for (q = st; q >= 0; q--) { var a0 = t0 + (t1 - t0) * q / st; pts.push([O0[0] + r0 * Math.cos(a0), O0[1] + r0 * Math.sin(a0)]); }
        out.push({ p: pts, cls: rk ? (sg + rk) & 1 : 1, dir: rk % 5 });
      }
    }
    return out;
  }

  /* 5重の同心円（区切りの無い輪）。輪はドーナツ形なので、外の円 p と穴 h（内の円）を持つタイルにする。
     タイルの形式の拡張：h があれば穴（描く側は p と h を1本のパスにして塗る。穴の向きは逆回り） */
  function rings(g, R0, count) {
    var out = [], NQ = 120;
    function circle(r, rev) { var pts = []; for (var q = 0; q < NQ; q++) { var a0 = TAU * (rev ? NQ - q : q) / NQ; pts.push([g.ox + r * Math.cos(a0), g.oy + r * Math.sin(a0)]); } return pts; }
    for (var k = 0; k < count; k++) {
      var t = { p: circle(R0 * (k + 1) / count, false), cls: 1 - (k & 1), dir: k % 5 };
      if (k) t.h = circle(R0 * k / count, true);
      out.push(t);
    }
    return out;
  }

  /* 生命の花（6回対称）：三角格子の各点を中心に、隣の点を通る円を描く。
     円どうしが切り分ける「花びら」（格子の辺ごとに1枚）と「反った三角」（格子の三角ごとに1枚）がタイル。
     中心から育つと、6枚の花びらの花が同心の六角に広がる。色1＝花びら、色2＝反った三角 */
  function flower(g){
    var a=g.edge*1.95, e0=[a,0], e1=[a/2,a*Math.sqrt(3)/2], e2=[-a/2,a*Math.sqrt(3)/2], N=range(g,a), out=[];
    function P(i,j){return[g.ox+i*e0[0]+j*e1[0],g.oy+i*e0[1]+j*e1[1]]}
    function rot(v,s){var c=0.5,sn=s*Math.sqrt(3)/2;return[v[0]*c-v[1]*sn,v[0]*sn+v[1]*c]}
    for(var i=-N;i<=N;i++)for(var j=-N;j<=N;j++){
      var O=P(i,j);
      if(O[0]<-2*a||O[0]>g.W+2*a||O[1]<-2*a||O[1]>g.H+2*a) continue;
      [e0,e1,e2].forEach(function(e,k){                      // 花びら：辺 O→V。両脇の格子点 W1・W2 を中心とする2本の弧で囲む
        var V=add(O,e), W1=add(O,rot(e,1)), W2=add(O,rot(e,-1));
        var pts=arc(W1,O,V).concat(arc(W2,V,O));
        if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:1,dir:k});
      });
      [[O,add(O,e0),add(O,e1),3],[add(O,e0),add(add(O,e0),e1),add(O,e1),4]].forEach(function(T){   // 反った三角：上向きと下向き
        var A=T[0],B=T[1],C=T[2];
        function D(X,Y,Z){return sub(add(X,Y),Z)}          // 辺 XY の向こう側の格子点（そこを中心とする弧が辺をふくらませる）
        var pts=arc(D(A,B,C),A,B).concat(arc(D(B,C,A),B,C),arc(D(C,A,B),C,A));
        if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:0,dir:T[3]});
      });
    }
    return out;
  }

  /* 円弧の曼荼羅（4回対称）：正方形のマスに四分円の弧を2本ずつ置く（スミスのトルシェ）。
     弧の向きを「中心からの距離の輪」と「象限」で決め、90°回すと向きが入れ替わる規則にしてあるので、
     全体が4回対称の、丸い迷路のような同心の文様になる。
     マスの中の3片（角の四分円2つと、間の帯）がタイル。色は片が含む格子点の偶奇（弧の両側で必ず色が変わる） */
  function mandala(g){
    var a=g.edge*1.42, h=a/2, N=range(g,a), out=[];
    for(var i=-N;i<N;i++)for(var j=-N;j<N;j++){
      var x0=g.ox+i*a, y0=g.oy+j*a;
      if(x0<-2*a||x0>g.W+a||y0<-2*a||y0>g.H+a) continue;
      var cx=i+0.5, cy=j+0.5, ring=Math.floor(Math.sqrt(cx*cx+cy*cy)/1.6);
      var o=(ring+(cx*cy>0?1:0))%2;                          // 90°回すと cx*cy の符号が変わる → 向きが入れ替わる
      var A=[x0,y0],B=[x0+a,y0],C=[x0+a,y0+a],D=[x0,y0+a], mAB=mid(A,B),mBC=mid(B,C),mCD=mid(C,D),mDA=mid(D,A);
      var par=function(di,dj){return (i+di+j+dj)&1};
      var disc, band;
      if(o===0){      // 四分円は A と C の角。帯は B と D を含む
        out.push({p:[A].concat(arc(A,mAB,mDA),[mDA]),cls:par(0,0),dir:0});
        out.push({p:[C].concat(arc(C,mCD,mBC),[mBC]),cls:par(1,1),dir:1});
        band=[mAB,B,mBC].concat(arc(C,mBC,mCD),[mCD,D,mDA]).concat(arc(A,mDA,mAB));
        out.push({p:band,cls:par(1,0),dir:4});
      }else{          // 四分円は B と D の角。帯は A と C を含む
        out.push({p:[B].concat(arc(B,mBC,mAB),[mAB]),cls:par(1,0),dir:2});
        out.push({p:[D].concat(arc(D,mDA,mCD),[mCD]),cls:par(0,1),dir:3});
        band=[mDA,A,mAB].concat(arc(B,mAB,mBC),[mBC,C,mCD]).concat(arc(D,mCD,mDA));
        out.push({p:band,cls:par(0,0),dir:4});
      }
    }
    return out.filter(function(t){return onScreen(g,t.p,g.edge)});
  }


  /* 丸い渦格子で使う：対数極座標 (s = log r, θ) の道具。この座標では対数螺旋も円も直線になる。
     花びらの仕切り（半径が2倍の円）ごとに腕の本数を2倍にして、どこでもマスの大きさを揃える */
  function bands6(g,width,r0mul){
    var r0=g.edge*(r0mul||1.6), far=farthest(g)+g.edge*2, out=[], r=r0;
    var n=6*Math.pow(2,Math.max(0,Math.ceil(Math.log(TAU*r0/width/6)/Math.LN2)));
    while(r<far){out.push({s0:Math.log(r),s1:Math.log(2*r),n:n});r*=2;n*=2}
    return {r0:r0,list:out};
  }
  function xy(g,s,th){var r=Math.exp(s);return[g.ox+r*Math.cos(th),g.oy+r*Math.sin(th)]}
  function clipS(poly,s0,s1){
    function cut(P,v,up){var out=[];for(var i=0;i<P.length;i++){var A=P[i],B=P[(i+1)%P.length],da=up?A[0]-v:v-A[0],db=up?B[0]-v:v-B[0];if(da>=0)out.push(A);if((da>0&&db<0)||(da<0&&db>0)){var t=da/(da-db);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t])}}return out}
    return cut(cut(poly,s0,true),s1,false);
  }

  /* 丸い渦格子（真円の鱗）：丸い渦格子と同じ格子点（右回り・左回りの螺旋の交点。花びらの仕切りで本数2倍）に、
     真円を1枚ずつ置き、内側の円ほど手前に重ねる（屋根瓦・青海波の重ね方）。
     タイル＝その円から、手前に重なる円を取り除いた見えている部分。縁はすべて真円の弧になる。
     半径は、同じ輪の隣の円と接する大きさ（格子の間隔の√2/2 倍）を少し大きくして、重ねたときにすき間が残らないようにする。
     仕切りの両側では、内と外の帯の円がそのまま重なる（内の帯の円を手前にする）。
     色は右回りの腕ごとに交互。中心は同心円 */
  function whirl(g, inward) {
    var W0 = g.edge * 1.2, t = 1, B = bands6(g, W0), discs = [], out = [];
    B.list.forEach(function (b, bi) {
      var n = b.n, u = Math.PI / (n * t), k = 1 / u;
      // 帯の外へ半歩はみ出す格子点まで円を置く（隣の帯の円と重なって、仕切りにすき間を作らない）
      var lo = b.s0 - 1.5 * u, hi = b.s1 + (bi === B.list.length - 1 ? 3 : 1.5) * u;
      var d0 = Math.floor(lo * k) - 1, d1 = Math.ceil(hi * k) + 1;
      var rho = u * Math.SQRT2 / 2 * Math.SQRT2 * 1.04;          // 対数極座標での半径（斜めの隣までの距離の半分×√2 ×1.04）
      var mg = g.edge + TAU * Math.exp(hi) / n * 2;
      for (var i = 0; i < n; i++) for (var d = d0; d <= d1; d++) {
        var j = i + d, sN = (j - i) * u, th = (i + j) * Math.PI / n;
        if (sN < lo || sN > hi) continue;
        var c = xy(g, sN, th), r = Math.exp(sN) * rho;
        if (c[0] < -mg || c[0] > g.W + mg || c[1] < -mg || c[1] > g.H + mg) continue;
        discs.push({ c: c, r: r, s: sN, band: bi, cls: i & 1, dir: ((d % 5) + 5) % 5 });
      }
    });
    // 画面に掛からない円は最初に捨てる（以降の比べる数を減らす）
    discs = discs.filter(function (D) { return !(D.c[0] + D.r < 0 || D.c[0] - D.r > g.W || D.c[1] + D.r < 0 || D.c[1] - D.r > g.H); });
    // 近くの円だけを比べるための升目。キーは数（文字列のキーと forEach の関数は、生成の時間の大半を食っていた）
    var cell = g.edge * 4, grid = new Map(), GW = 4096;
    function cellsOf(D, fn) {
      var gx0 = Math.floor((D.c[0] - D.r) / cell), gx1 = Math.floor((D.c[0] + D.r) / cell),
          gy0 = Math.floor((D.c[1] - D.r) / cell), gy1 = Math.floor((D.c[1] + D.r) / cell);
      for (var x = gx0; x <= gx1; x++) for (var y = gy0; y <= gy1; y++) fn((x + 64) * GW + (y + 64));
    }
    discs.forEach(function (D, idx) { cellsOf(D, function (key) { var a = grid.get(key); if (!a) grid.set(key, a = []); a.push(idx); }); });
    var stamp = new Int32Array(discs.length), mark = 0;
    // D に重なる円を1度ずつ fn に渡す
    function nearby(D, idx, fn) {
      mark++;
      cellsOf(D, function (key) {
        var a = grid.get(key); if (!a) return;
        for (var m = 0; m < a.length; m++) { var o = a[m]; if (o === idx || stamp[o] === mark) continue; stamp[o] = mark; fn(o); }
      });
    }
    var R0 = Math.exp(B.list[0].s0);
    // 重ねる順。外向き（inward が偽）：内側の円ほど手前 → 見えるのは各円の外側の縁（鱗の丸みが外を向く）。
    // 内向き：同じ帯の中では外側の円ほど手前 → 鱗の丸みが中心を向く。帯を先に比べ、同じ帯なら中心からの距離、同じなら番号で決める
    function inFront(E, eo, D, dox) {
      var sgn = inward ? -1 : 1;
      // 帯どうしは、向きによらず内の帯（大きい円）を手前にする。外の帯の小さな円を手前にすると、
      // 仕切りの近くで小さな円の列が大きな円を横切って2つに切り分け、1枚のタイルにならなくなる
      if (E.band !== D.band) return E.band < D.band;
      if (Math.abs(E.s - D.s) > 1e-9) return sgn * (E.s - D.s) < 0;
      return eo < dox;
    }
    // 手前の円が奥の円の中にすっぽり入ると、奥の円に穴が空く（穴のあるタイルは作れない）。
    // 仕切りの近くで小さな円が大きな円の中に入るときに起きるので、その小さな円は置かない（大きな円の一部になる）
    var hidden = {};
    discs.forEach(function (D, idx) {
      nearby(D, idx, function (o) {
        var E = discs[o];
        if (E.r >= D.r || !inFront(E, o, D, idx)) return;
        var dx = E.c[0] - D.c[0], dy = E.c[1] - D.c[1];
        if (Math.sqrt(dx * dx + dy * dy) + E.r <= D.r) hidden[o] = 1;
      });
    });
    discs.forEach(function (D, idx) {
      if (hidden[idx]) return;
      var front = [];
      nearby(D, idx, function (o) {
        if (hidden[o]) return;
        var E = discs[o];
        if (!inFront(E, o, D, idx)) return;
        var dx = E.c[0] - D.c[0], dy = E.c[1] - D.c[1];
        if (dx * dx + dy * dy >= (E.r + D.r) * (E.r + D.r)) return;
        front.push(E);
      });
      var pts = [], q, NQ = 90;
      for (q = 0; q < NQ; q++) { var a0 = TAU * q / NQ; pts.push([D.c[0] + D.r * Math.cos(a0), D.c[1] + D.r * Math.sin(a0)]); }
      front.sort(function (A, Bq) { return Math.hypot(A.c[0] - D.c[0], A.c[1] - D.c[1]) - Math.hypot(Bq.c[0] - D.c[0], Bq.c[1] - D.c[1]); });
      for (var f = 0; f < front.length && pts; f++) pts = minusDisk(pts, front[f].c, front[f].r);
      if (pts) pts = minusDisk(pts, [g.ox, g.oy], R0);
      if (pts && pts.length > 2 && onScreen(g, pts, 0)) out.push({ p: pts, cls: D.cls, dir: D.dir });
    });
    return out.concat(rings(g, R0, 5));
  }

  /* 渦の花びら（6回対称・螺旋）：螺旋の腕を、外へふくらむ弧で切った一画一画。一画は上が丸く、下が前の一画の丸みを受けて反る
     （花びら・鱗の形）。境目の丸みは「その境目の下の帯の腕の幅」で1つずつふくらむので、
     仕切りで腕が2本に分かれても、境目は上下の一画で同じ曲線になり、隙間ができない。色は腕ごとに交互 */
  function petals(g){
    var W0=g.edge*0.85,K=1.3,t=0.8,B=bands6(g,W0),out=[],rows=[];
    // 境目の列を作る：{s, n（ふくらみの幅を決める腕の本数）, h（ふくらみの高さ）}
    B.list.forEach(function(b){
      var m=Math.max(1,Math.round((b.s1-b.s0)*(1+t*t)*b.n/(TAU*K)));
      for(var k=0;k<m;k++) rows.push({s0:b.s0+(b.s1-b.s0)*k/m, s1:b.s0+(b.s1-b.s0)*(k+1)/m, n:b.n});
    });
    var bd=rows.map(function(r,k){return {s:r.s0,n:k?rows[k-1].n:r.n/2,h:(r.s1-r.s0)*0.42}});
    bd.push({s:rows[rows.length-1].s1,n:rows[rows.length-1].n,h:0});
    function sOn(k,v,n){var b=bd[k];return b.s+b.h*Math.abs(Math.sin(Math.PI*v*b.n/n))}
    function P(v,s,n){return xy(g,s,TAU*v/n+t*s)}
    // 中心の花：6の倍数枚の花びら。外の縁は最初の境目の丸み
    var n0=bd[0].n;
    for(var i=0;i<n0;i++){
      var pts=[[g.ox,g.oy]];
      for(var q=0;q<=8;q++){var v=i+q/8;pts.push(P(v,sOn(0,v,n0),n0))}
      out.push({p:pts,cls:1-(i&1),dir:i%5});
    }
    // 画面の外の一画は、点を打つ前に中心の位置だけで捨てる（外側の帯は腕の本数が多く、大半が画面の外）
    function near(p,m){return p[0]>-m&&p[0]<g.W+m&&p[1]>-m&&p[1]<g.H+m}
    rows.forEach(function(r,k){
      var mg=g.edge+TAU*Math.exp(r.s1)/r.n*2;
      for(var i=0;i<r.n;i++){
        if(!near(P(i+0.5,(r.s0+r.s1)/2,r.n),mg)) continue;
        var pts=[],q,S=16;
        for(q=0;q<=S;q++){var v=i+q/S;pts.push(P(v,sOn(k,v,r.n),r.n))}                  // 下の境目（反り）
        var sA=sOn(k,i+1,r.n),sB=sOn(k+1,i+1,r.n);
        for(q=1;q<4;q++) pts.push(P(i+1,sA+(sB-sA)*q/4,r.n));                                 // 右の腕
        for(q=S;q>=0;q--){var v2=i+q/S;pts.push(P(v2,sOn(k+1,v2,r.n),r.n))}               // 上の境目（丸み）
        var sC=sOn(k+1,i,r.n),sD=sOn(k,i,r.n);
        for(q=1;q<4;q++) pts.push(P(i,sC+(sD-sC)*q/4,r.n));                                   // 左の腕
        if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:i&1,dir:(i+k)%5});
      }
    });
    return out;
  }


  /* 巻き尺の渦（長さのたんいの背景）：一定の幅の帯がアルキメデスの渦（r = a + bθ）を巻く。帯の幅は1周で広がる長さ 2πb と同じなので、
     となりの周の帯とすき間なく接する（巻いた巻き尺）。帯を1目盛りずつ同じ長さに区切り、10目盛りごとに色を替える。
     1周の長さは10目盛りの倍数にならないので、色の帯が周ごとに少しずつずれ、別の渦が浮かんで見える */
  function tape(g) {
    var W = g.edge * 1.35, b = W / TAU, a = g.edge * 1.2, L = g.edge * 1.05, far = farthest(g) + W * 2, out = [];
    var thMax = (far - a) / b, th = 0, idx = 0, cur = 0;
    // 帯の中心線（r = a + bθ + W/2）の長さで区切る。区切りの角度を細かい刻みで積算して求める
    var cuts = [0];
    for (var tt = 0; tt < thMax; tt += 0.004) {
      var rc = a + b * tt + W / 2; cur += rc * 0.004;
      if (cur >= L) { cuts.push(tt); cur -= L; }
    }
    function P(t, off) { var rr = a + b * t + off; return [g.ox + rr * Math.cos(t), g.oy + rr * Math.sin(t)]; }
    for (var k = 0; k + 1 < cuts.length; k++) {
      var t0 = cuts[k], t1 = cuts[k + 1], pts = [], st = Math.max(2, Math.ceil((t1 - t0) / 0.04)), q;
      for (q = 0; q <= st; q++) pts.push(P(t0 + (t1 - t0) * q / st, W));     // 外の縁
      for (q = st; q >= 0; q--) pts.push(P(t0 + (t1 - t0) * q / st, 0));     // 内の縁
      if (!onScreen(g, pts, 0)) continue;
      out.push({ p: pts, cls: Math.floor(k / 10) & 1, dir: k % 5 });
    }
    // 中心：渦の始まりまでを埋める（半径 a の円板と、最初の1周の内側のすき間）
    var hub = [];
    for (q = 0; q <= 120; q++) { var t2 = TAU * q / 120; hub.push(P(t2, 0)); }
    out.push({ p: hub, cls: 1, dir: 0 });
    return out;
  }

  /* ================================================================
   *  3年の単元に向けた図形（利用者の評価でストックとして採用）
   *  clockstar 時こくと時間 / pascal たし算とひき算の筆算 / chair かけ算の筆算 / fibgrid 表とグラフ /
   *  farey 分数 / padovan 三角形と角 / decimal 小数
   * ================================================================ */
  var SQ3 = Math.sqrt(3);

  /* ---------- 文字盤の星：12回対称。多重格子（6方向・同じずれ）の 60°菱形を短い対角線で正三角形2枚に割る ---------- */
  function clockstar(g) {
    var raw = multigrid(6, 0.5)({ W: g.W, H: g.H, ox: g.ox, oy: g.oy, edge: g.edge * 1.25, margin: g.margin }), out = [];
    function ang(p, i) {
      var a = p[(i + 3) % 4], b = p[i], c = p[(i + 1) % 4];
      var u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
      return Math.acos((u[0] * v[0] + u[1] * v[1]) / Math.hypot(u[0], u[1]) / Math.hypot(v[0], v[1])) * 180 / Math.PI;
    }
    raw.forEach(function (t) {
      var p = t.p, a0 = ang(p, 0), mn = Math.min(a0, 180 - a0);
      if (mn > 75) { out.push({ p: p, cls: 1, dir: t.dir }); return; }            // 正方形
      if (mn < 45) { out.push({ p: p, cls: 1, dir: (t.dir + 2) % 5 }); return; }  // 細い菱形（30°）
      var o = a0 > 90 ? 0 : 1;                                                    // 鈍角の頂点を結ぶ（短い対角線）
      out.push({ p: [p[o], p[(o + 1) % 4], p[(o + 2) % 4]], cls: 0, dir: t.dir });
      out.push({ p: [p[(o + 2) % 4], p[(o + 3) % 4], p[o]], cls: 0, dir: (t.dir + 1) % 5 });
    });
    return out;
  }

  /* ---------- パスカルの偶奇：六角のマスを中心から輪に数え、輪 n の各辺の k 番目に C(n,k) を置く。
     どのマスも内側の隣2つの和になる（6つの扇それぞれがパスカルの三角形）。奇数を色1。C(n,k) が奇数 ⇔ (k & n) === k ---------- */
  function pascal(g) {
    var R = g.edge * 0.5, far = farthest(g) + R * 3, N = Math.ceil(far / (R * 1.5)) + 1, out = [];
    var D = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    function hex(q, r) {
      var cx = g.ox + R * SQ3 * (q + r / 2), cy = g.oy + R * 1.5 * r, p = [];
      for (var i = 0; i < 6; i++) { var a = Math.PI / 6 + i * Math.PI / 3; p.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      return p;
    }
    out.push({ p: hex(0, 0), cls: 1, dir: 0 });
    for (var n = 1; n <= N; n++) {
      var q = D[4][0] * n, r = D[4][1] * n;
      for (var s = 0; s < 6; s++) for (var k = 0; k < n; k++) {
        var p = hex(q, r);
        if (onScreen(g, p, 0)) out.push({ p: p, cls: (k & n) === k ? 1 : 0, dir: 0 });
        q += D[s][0]; r += D[s][1];
      }
    }
    return out;
  }

  /* ---------- くり上がりの六角（たし算）：パスカルの偶奇と同じ六角のマスと並び（中心から輪に数え、輪 n の各辺の k 番目）。
     どのマスも k ＋（n − k）＝ n の筆算で、色2＝どこかの位で くり上がるマス。
     一の位のくり上がりが10段ごとの階段を、十の位のくり上がりがその10倍の階段を作り、10ずつの入れ子が浮かぶ。
     明暗の段（dir）は くり上がる位の数 ---------- */
  function carry(g) {
    var R = g.edge * 0.5, far = farthest(g) + R * 3, N = Math.ceil(far / (R * 1.5)) + 1, out = [];
    var D = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    function hex(q, r) {
      var cx = g.ox + R * SQ3 * (q + r / 2), cy = g.oy + R * 1.5 * r, p = [];
      for (var i = 0; i < 6; i++) { var a = Math.PI / 6 + i * Math.PI / 3; p.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      return p;
    }
    function nc(a, b) { var c = 0; for (; a > 0 || b > 0; a = Math.floor(a / 10), b = Math.floor(b / 10)) if (a % 10 + b % 10 >= 10) c++; return c; }
    out.push({ p: hex(0, 0), cls: 1, dir: 0 });
    for (var n = 1; n <= N; n++) {
      var q = D[4][0] * n, r = D[4][1] * n;
      for (var s = 0; s < 6; s++) for (var k = 0; k < n; k++) {
        var p = hex(q, r);
        if (onScreen(g, p, 0)) { var c = nc(k, n - k); out.push({ p: p, cls: c ? 0 : 1, dir: Math.min(4, c * 2) }); }
        q += D[s][0]; r += D[s][1];
      }
    }
    return out;
  }

  /* 円周率の数字（Rabinowitz–Wagon の栓抜き）。くり下がりの三角の縁に流し込む */
  var PI_DIGITS = null;
  function piDigits(n) {
    if (PI_DIGITS && PI_DIGITS.length >= n) return PI_DIGITS;
    var len = Math.floor(n * 10 / 3) + 2, a = [], out = [], nines = 0, pre = -1, i, j;
    for (i = 0; i < len; i++) a[i] = 2;
    for (j = 0; j < n + 1; j++) {
      var q = 0;
      for (i = len - 1; i >= 0; i--) { var x = 10 * a[i] + q * (i + 1); a[i] = x % (2 * i + 1); q = Math.floor(x / (2 * i + 1)); }
      a[0] = q % 10; q = Math.floor(q / 10);
      if (q === 9) nines++;
      else if (q === 10) { out.push(pre + 1); for (; nines > 0; nines--) out.push(0); pre = 0; }
      else { if (pre >= 0) out.push(pre); pre = q; for (; nines > 0; nines--) out.push(9); }
    }
    PI_DIGITS = out;
    return out;
  }

  /* ---------- くり下がりの三角（ひき算）：三角形のマスを6つの扇に並べる。扇の n 段目は 2n−1 枚の三角（外向き・内向きが交互）。
     段の j 番目のマスは m − j の筆算で、色2＝どこかの位で くり下がるマス。ひかれる数 m は段ごとに2ずつ増える。
     一の位のくり下がりが三角の帯を、十の位のくり下がりがその外の大きな三角を作る。
     扇ごとに m の始まりをずらす（SHIFT）。そろえると6つの扇が同じ位相になり、大きな三角が市松に並んで周期的に見える。
     明暗の段（dir）は くり下がる位の数 ---------- */
  function borrow(g) {
    var a = g.edge * 1.05, far = farthest(g) + a * 2, N = Math.ceil(far / (a * SQ3 / 2)) + 1, out = [];
    var SHIFT = [0, 3, 7, 1, 5, 9];
    function P(i, j, s) {                           // 扇 s の格子点 i·u + j·v（u, v は60°ずつ回した単位）
      var t = s * Math.PI / 3, u = [Math.cos(t), Math.sin(t)], v = [Math.cos(t + Math.PI / 3), Math.sin(t + Math.PI / 3)];
      return [g.ox + a * (i * u[0] + j * v[0]), g.oy + a * (i * u[1] + j * v[1])];
    }
    function nb(x, y) { var c = 0; for (; y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) if (x % 10 < y % 10) c++; return c; }
    function tile(p, m, j) { var c = nb(m, j); out.push({ p: p, cls: c ? 0 : 1, dir: Math.min(4, c * 2) }); }
    for (var s = 0; s < 6; s++) for (var n = 1; n <= N; n++) {
      var m = 2 * n - 2 + SHIFT[s];
      for (var e = 0; e < n; e++) {
        var i = n - 1 - e, p = [P(i, e, s), P(i + 1, e, s), P(i, e + 1, s)];     // 外向き（j＝2e）
        if (onScreen(g, p, 0)) tile(p, m, 2 * e);
        if (e < n - 1) {                                                           // 内向き（j＝2e+1）
          var q = [P(i, e, s), P(i, e + 1, s), P(i - 1, e + 1, s)];
          if (onScreen(g, q, 0)) tile(q, m, 2 * e + 1);
        }
      }
    }
    return out;
  }

  /* ---------- 椅子のタイル：L字（2×2 の箱から1隅を欠いた形）を、半分の大きさのL字4つに分ける置き換え。
     o＝欠けた隅の向き（0..3、90°ずつ）。色は向きの組（0と2／1と3）で分ける ---------- */
  function chair(g) {
    var target = g.edge * 0.95, m = g.edge * 2;
    var L = target; while (L < 2 * (Math.max(g.W, g.H) + 2 * m)) L *= 2;
    var cx = g.W + m, cy = g.H + m;   // 欠けた隅（右下）の角を画面の右下の外に置き、画面を覆う3/4の側に入れる
    // 子：[箱の中心のずれ（親の箱の1/4単位）, 向きの差]
    var KIDS = [[0, 0, 0], [-1, -1, 0], [1, -1, 1], [-1, 1, 3]];
    function rot(x, y, o) { for (var i = 0; i < o; i++) { var t = x; x = -y; y = t; } return [x, y]; }
    function poly(c) {   // c = [cx, cy, 箱の一辺, o]
      var h = c[2] / 2, P = [[-1, -1], [1, -1], [1, 0], [0, 0], [0, 1], [-1, 1]];
      return P.map(function (v) { var w = rot(v[0], v[1], c[3]); return [c[0] + w[0] * h, c[1] + w[1] * h]; });
    }
    var T = [[cx, cy, L, 0]];
    while (T[0][2] > target * 1.01) {
      var N = [];
      for (var i = 0; i < T.length; i++) {
        var t = T[i], u = t[2] / 4;
        for (var j = 0; j < 4; j++) {
          var d = rot(KIDS[j][0], KIDS[j][1], t[3]);
          var c = [t[0] + d[0] * u, t[1] + d[1] * u, t[2] / 2, (t[3] + KIDS[j][2]) % 4];
          if (onScreen(g, poly(c), c[2] * 0.1)) N.push(c);
        }
      }
      T = N;
    }
    return T.map(function (c) {
      var k = Math.floor(c[0] / c[2]) + Math.floor(c[1] / c[2]);
      return { p: poly(c), cls: c[3] % 2, dir: (c[3] + ((k % 3) + 3) % 3) % 5 };
    });
  }

  /* ---------- フィボナッチの格子：列の幅と行の高さが長 L・短 S（L/S＝黄金比）で、フィボナッチ語の順に並ぶ。
     色1＝長×長と短×短、色2＝長×短 ---------- */
  function fibgrid(g) {
    var PHI = (1 + Math.sqrt(5)) / 2, S = g.edge * 0.62, L = S * PHI;
    function cuts(lo, hi, o, beta) {
      function X(n) { return S * n + (L - S) * Math.floor(n / PHI + beta); }
      var n0 = Math.floor((lo - o) / S) - 2, n1 = Math.ceil((hi - o) / S) + 2, xs = [];
      for (var n = n0; n <= n1; n++) xs.push([o + X(n) - X(0), X(n + 1) - X(n) > (S + L) / 2]);
      return xs;
    }
    var C = cuts(0, g.W, g.ox, 0.5), R = cuts(0, g.H, g.oy, 0.19), out = [];
    for (var i = 0; i < C.length - 1; i++) {
      var x0 = C[i][0], x1 = C[i + 1][0]; if (x1 < 0 || x0 > g.W) continue;
      for (var j = 0; j < R.length - 1; j++) {
        var y0 = R[j][0], y1 = R[j + 1][0]; if (y1 < 0 || y0 > g.H) continue;
        var a = C[i][1], b = R[j][1];
        out.push({ p: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], cls: a === b ? 1 : 0, dir: a ? (b ? 0 : 2) : (b ? 3 : 1) });
      }
    }
    return out;
  }

  /* ---------- ファレイの円盤：上半平面のファレイ分割（頂点は既約分数 p/q）を ρ=e^{iπ/3} が中心に来るように円板へ写す。
     隣り合う a/b・c/d の間には (a+c)/(b+d) の三角形が入る。大きい三角形は中心 ρ から6つに割る（モジュラー群の三角形）。
     小さくなった先は、測地線と円周で囲まれた残りを1枚にする。円の外には円での鏡映の写しを置く（リーマン球面の南北） ---------- */
  function farey(g) {
    var Rd = Math.min(g.W, g.H) * 0.44, cx = g.W / 2, cy = g.H / 2, STEP = 4, out = [];
    var RX = 0.5, RY = SQ3 / 2;
    function cdiv(a, b) { var d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }
    function toDisk(z) { return cdiv([z[0] - RX, z[1] - RY], [z[0] - RX, z[1] + RY]); }
    function ideal(v) { return cdiv([v[0] - RX * v[1], -RY * v[1]], [v[0] - RX * v[1], RY * v[1]]); }   // p/q（q=0 は ∞）
    function scr(w) { return [cx + Rd * w[0], cy - Rd * w[1]]; }
    // 円の外は、円での鏡映（反転 w → w/|w|²）で内側の写しを置く。中心 0 は無限遠へ行くので、両隣の向きの遠い2点に置き換える
    function mirror(ws) {
      var o = [];
      for (var i = 0; i < ws.length; i++) {
        var w = ws[i], m = w[0] * w[0] + w[1] * w[1];
        if (m > 1e-12) { o.push([w[0] / m, w[1] / m]); continue; }
        [ws[(i + ws.length - 1) % ws.length], ws[(i + 1) % ws.length]].forEach(function (q) {
          var l = Math.hypot(q[0], q[1]); o.push([q[0] / l * 40, q[1] / l * 40]);
        });
      }
      return o;
    }
    function geo(P, Q) {   // 円板の2点を結ぶ測地線（P を含み Q を含まない）。向きに依らず同じ点列になるよう正規の向きで作る
      var flip = P[0] > Q[0] || (P[0] === Q[0] && P[1] > Q[1]); if (flip) { var t = P; P = Q; Q = t; }
      var det = P[0] * Q[1] - P[1] * Q[0], pts = [];
      var len = Math.hypot(P[0] - Q[0], P[1] - Q[1]) * Rd;
      if (Math.abs(det) < 1e-9 || len < STEP) { pts = [P, Q]; }
      else {
        var a = (P[0] * P[0] + P[1] * P[1] + 1) / 2, b = (Q[0] * Q[0] + Q[1] * Q[1] + 1) / 2;
        var c = [(a * Q[1] - b * P[1]) / det, (b * P[0] - a * Q[0]) / det], r = Math.hypot(P[0] - c[0], P[1] - c[1]);
        var a0 = Math.atan2(P[1] - c[1], P[0] - c[0]), a1 = Math.atan2(Q[1] - c[1], Q[0] - c[0]), d = a1 - a0;
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        // 円の外の写しは最大で4倍ほどに伸びるので、その分細かく打つ
        var n = Math.max(1, Math.ceil(Math.abs(d) * r * Rd * 2 / STEP));
        for (var k = 0; k <= n; k++) { var t2 = a0 + d * k / n; pts.push([c[0] + r * Math.cos(t2), c[1] + r * Math.sin(t2)]); }
        pts[0] = P; pts[n] = Q;
      }
      if (flip) pts.reverse();
      pts.pop();
      return pts;
    }
    function emit(ws, cls, dir) {
      if (ws.length < 3) return;
      var s = ws.map(scr); if (onScreen(g, s, 0)) out.push({ p: s, cls: cls, dir: dir });
      var m = mirror(ws).map(scr); if (onScreen(g, m, 0)) out.push({ p: m, cls: 1 - cls, dir: (dir + 2) % 5 });
    }
    function tile(ws, cls, dir) {
      var p = [];
      for (var i = 0; i < ws.length; i++) p = p.concat(geo(ws[i], ws[(i + 1) % ws.length]));
      emit(p, cls, dir);
    }
    function mob(M, z) { return cdiv([M[0] * z[0] + M[1], M[0] * z[1]], [M[2] * z[0] + M[3], M[2] * z[1]]); }
    var BASE = [[0.5, RY], [0, 1], [1, 1], [0.5, 0.5]];   // ρ, i, 1+i, (1+i)/2
    function triangle(u, v, depth) {   // 頂点 u＝0、v＝∞、u+v＝1 に当たる三角形
      var M = [v[0], u[0], v[1], u[1]], n = [u[0] + v[0], u[1] + v[1]];
      var wc = toDisk(mob(M, BASE[0])), rc = Math.hypot(wc[0], wc[1]), size = (1 - rc) * Rd * Math.max(1, 1 / Math.max(rc, 0.25));
      var U = ideal(u), V = ideal(v), N = ideal(n);
      if (size < g.edge * 0.6) { tile([U, N, V], depth & 1, depth % 5); return; }
      var wi = toDisk(mob(M, BASE[1])), w1 = toDisk(mob(M, BASE[2])), wh = toDisk(mob(M, BASE[3]));
      var six = [[U, wi], [wi, V], [V, w1], [w1, N], [N, wh], [wh, U]];
      for (var k = 0; k < 6; k++) tile([six[k][0], six[k][1], wc], k & 1, (depth + (k >> 1)) % 5);
    }
    function region(a, b, t, depth) {   // 辺 a–b の、t と反対の側
      var s = [a[0] + b[0], a[1] + b[1]];
      if ((s[0] === t[0] && s[1] === t[1]) || (s[0] === -t[0] && s[1] === -t[1])) s = [a[0] - b[0], a[1] - b[1]];
      var A = ideal(a), B = ideal(b), chord = Math.hypot(A[0] - B[0], A[1] - B[1]) * Rd;
      // 残りの領域（測地線 A–B と円周の弧）の点列。t の無い側の弧を回る
      var aa = Math.atan2(A[1], A[0]), ab = Math.atan2(B[1], B[0]), T = ideal(t), at = Math.atan2(T[1], T[0]);
      function between(x, lo, hi) { var d1 = ((hi - lo) % TAU + TAU) % TAU, d2 = ((x - lo) % TAU + TAU) % TAU; return d2 < d1; }
      var d = ((aa - ab) % TAU + TAU) % TAU; if (between(at, ab, aa)) d -= TAU;   // B から A へ回る角
      var n = Math.max(1, Math.ceil(Math.abs(d) * Rd / STEP)), arcP = [];
      for (var k = 0; k < n; k++) { var th = ab + d * k / n; arcP.push([Math.cos(th), Math.sin(th)]); }
      var poly = geo(A, B).concat(arcP);
      if (!onScreen(g, poly.map(scr), 0) && !onScreen(g, mirror(poly).map(scr), 0)) return;
      if (chord < g.edge * 0.8) { emit(poly, depth & 1, depth % 5); return; }
      var bb2 = (s[0] === a[0] + b[0] && s[1] === a[1] + b[1]) ? b : [-b[0], -b[1]];
      triangle(a, bb2, depth);
      region(a, s, b, depth + 1);
      region(s, b, a, depth + 1);
    }
    var u0 = [0, 1], v0 = [1, 0], n0 = [1, 1];
    triangle(u0, v0, 0);
    region(u0, n0, v0, 1); region(n0, v0, u0, 1); region(v0, u0, n0, 1);
    return out;
  }

  /* ---------- パドバンの三角渦：正三角形を渦に並べる。外形を六角形（辺の長さ s[0..5]、向きは60°刻み）で持ち、
     辺 i に外向きの正三角形を足すと s[i-1]・s[i+1] が s[i] だけ伸びて s[i] は0になる。i を1つずつ回すと辺は
     1,1,1,2,2,3,4,5,7,9,12…（パドバン数）。各三角形を、どれも同じくらいの大きさのタイルになるよう三角格子で割る（小さい三角形は1枚のまま）。どの三角形も縁から中心まで同じ比で入れ子の3段に分け、段ごと・三角形ごとに色を交互にする（大きい三角形ほど段が太い＝相似の入れ子） ---------- */
  function padovan(g) {
    var tsz = g.edge * 1.15, u = g.edge * 0.22, far = farthest(g) + tsz * 2, out = [];   // u＝パドバンの1、tsz＝タイルの1辺
    var DV = []; for (var k = 0; k < 6; k++) DV.push([Math.cos(k * Math.PI / 3), -Math.sin(k * Math.PI / 3)]);
    var V = [[0, 0], [1, 0], [1, 0], [0.5, -SQ3 / 2], [0.5, -SQ3 / 2], [0, 0]], s = [1, 0, 1, 0, 1, 0];
    // 最初の三角形の重心を育ち始める点に置く
    var gx = 0.5, gy = -SQ3 / 6;
    V = V.map(function (p) { return [p[0] - gx, p[1] - gy]; });
    function emit(P0, P1, P2, Lm, idx) {
      var pts = [P0, P1, P2].map(function (p) { return [g.ox + p[0] * u, g.oy + p[1] * u]; });
      if (!onScreen(g, pts, u * Lm * 0.1)) return;
      var m = Math.max(1, Math.round(Lm * u / tsz));   // 1辺を m 等分して、どの三角形も同じくらいの大きさのタイルに割る
      var ex = [(pts[1][0] - pts[0][0]) / m, (pts[1][1] - pts[0][1]) / m], ey = [(pts[2][0] - pts[0][0]) / m, (pts[2][1] - pts[0][1]) / m];
      function P(a, b) { return [pts[0][0] + a * ex[0] + b * ey[0], pts[0][1] + a * ex[1] + b * ey[1]]; }
      function band(r) { return Math.floor(r * 6 / m); }   // 縁から中心まで同じ比で3段（相似の入れ子）
      for (var a = 0; a < m; a++) for (var b = 0; a + b < m; b++) {
        var c = m - 1 - a - b, ring = Math.min(a, b, c), tri = [P(a, b), P(a + 1, b), P(a, b + 1)];
        if (onScreen(g, tri, 0)) out.push({ p: tri, cls: (band(ring) + idx) & 1, dir: (idx + (ring >> 1)) % 5 });
        if (a + b < m - 1) {
          var c2 = m - 2 - a - b, ring2 = Math.min(a, b, c2), tri2 = [P(a + 1, b), P(a + 1, b + 1), P(a, b + 1)];
          if (onScreen(g, tri2, 0)) out.push({ p: tri2, cls: (band(ring2) + idx) & 1, dir: (idx + (ring2 >> 1) + 2) % 5 });
        }
      }
    }
    emit(V[0], V[1], V[3], 1, 0);
    var i = 0, idx = 1, Lm = 1;
    function covers() {   // 画面の四隅（＋余白）が外形の六角形の内側か
      var C = [[-tsz, -tsz], [g.W + tsz, -tsz], [-tsz, g.H + tsz], [g.W + tsz, g.H + tsz]];
      return C.every(function (c) {
        var x = (c[0] - g.ox) / u, y = (c[1] - g.oy) / u;
        for (var e = 0; e < 6; e++) {
          if (s[e] === 0) continue;
          var a = V[e], d = DV[e];   // 最初の三角形の重心（原点）と同じ側にあるか
          if (((x - a[0]) * d[1] - (y - a[1]) * d[0]) * ((0 - a[0]) * d[1] - (0 - a[1]) * d[0]) < 0) return false;
        }
        return true;
      });
    }
    while (!covers() && Lm * u < far * 12) {
      Lm = s[i];
      var im = (i + 5) % 6, ip = (i + 1) % 6, A = [V[i][0] + Lm * DV[im][0], V[i][1] + Lm * DV[im][1]];
      emit(V[i], V[ip], A, Lm, idx);
      s[im] += Lm; s[ip] += Lm; s[i] = 0; V[i] = A; V[ip] = A.slice();
      i = (i + 1) % 6; idx++;
    }
    return out;
  }

  /* ---------- 十進の渦：対数極座標 (θ, s=log r) で、腕の線 s − kθ = 一定（k = ln10/2π、1周で10倍）と
     放射の線 θ = 一定 で切る。半径が2倍になる円（仕切り）ごとに腕と放射の本数を2倍にして、マスの大きさをそろえる。
     中心は10等分の輪と円。色は腕ごとに交互 ---------- */
  function decimal(g) {
    var K = Math.log(10) / TAU, n0 = 10, c0 = 30;
    var R0 = g.edge * 0.8 * n0 / Math.log(10), far = farthest(g) + g.edge * 2, out = [];
    function toXY(th, s) { var r = Math.exp(s); return [g.ox + r * Math.cos(th), g.oy + r * Math.sin(th)]; }
    function edgePts(P, Q) {   // (θ,s) の線分を、画面で細かく打った点列に（P を含み Q を含まない）
      var r = Math.exp(Math.max(P[1], Q[1])), len = Math.hypot((Q[0] - P[0]) * r, (Q[1] - P[1]) * r);
      var n = Math.max(1, Math.ceil(len / 4)), pts = [];
      for (var k = 0; k < n; k++) pts.push(toXY(P[0] + (Q[0] - P[0]) * k / n, P[1] + (Q[1] - P[1]) * k / n));
      return pts;
    }
    function clip(poly, lo, hi) {   // s の範囲で切る
      function cut(pl, keep, val) {
        var o = [];
        for (var i = 0; i < pl.length; i++) {
          var A = pl[i], B = pl[(i + 1) % pl.length], ia = keep(A[1]), ib = keep(B[1]);
          if (ia) o.push(A);
          if (ia !== ib) { var t = (val - A[1]) / (B[1] - A[1]); o.push([A[0] + (B[0] - A[0]) * t, val]); }
        }
        return o;
      }
      poly = cut(poly, function (s) { return s >= lo; }, lo);
      if (poly.length < 3) return poly;
      return cut(poly, function (s) { return s <= hi; }, hi);
    }
    // 中心：円と10等分の輪
    var rc = R0 * 0.45, cpts = [];
    for (var q = 0; q < 60; q++) cpts.push([g.ox + rc * Math.cos(q * TAU / 60), g.oy + rc * Math.sin(q * TAU / 60)]);
    out.push({ p: cpts, cls: 1, dir: 0 });
    for (var j = 0; j < 10; j++) {
      var P = edgePts([j * TAU / 10, Math.log(rc)], [(j + 1) * TAU / 10, Math.log(rc)]).concat([toXY((j + 1) * TAU / 10, Math.log(rc))]);
      var Q = edgePts([(j + 1) * TAU / 10, Math.log(R0)], [j * TAU / 10, Math.log(R0)]).concat([toXY(j * TAU / 10, Math.log(R0))]);
      out.push({ p: P.concat(Q), cls: j & 1, dir: j % 5 });
    }
    for (var b = 0; R0 * Math.pow(2, b) < far; b++) {
      var n = n0 << b, c = c0 << b, du = Math.log(10) / n, dth = TAU / c;
      var lo = Math.log(R0) + b * Math.LN2, hi = lo + Math.LN2;
      var rb = Math.exp(hi), tsz = rb * Math.max(dth, du) * 2 + g.edge;
      for (var jj = 0; jj < c; jj++) {
        var t0 = jj * dth, t1 = t0 + dth;
        // 帯の中のこの扇が画面から遠ければ、形を作らずに飛ばす（外側の帯は大半が画面の外）
        var ex0 = 1e9, ex1 = -1e9, ey0 = 1e9, ey1 = -1e9;
        [[t0, lo], [t1, lo], [t0, hi], [t1, hi]].forEach(function (q) { var xy = toXY(q[0], q[1]); ex0 = Math.min(ex0, xy[0]); ex1 = Math.max(ex1, xy[0]); ey0 = Math.min(ey0, xy[1]); ey1 = Math.max(ey1, xy[1]); });
        if (ex1 < -tsz || ex0 > g.W + tsz || ey1 < -tsz || ey0 > g.H + tsz) continue;
        var i0 = Math.floor((lo - K * t1) / du) - 1, i1 = Math.ceil((hi - K * t0) / du) + 1;
        for (var i = i0; i < i1; i++) {
          var ua = i * du, ub = ua + du;
          var poly = clip([[t0, ua + K * t0], [t1, ua + K * t1], [t1, ub + K * t1], [t0, ub + K * t0]], lo, hi);
          if (poly.length < 3) continue;
          var pts = [];
          for (var e = 0; e < poly.length; e++) pts = pts.concat(edgePts(poly[e], poly[(e + 1) % poly.length]));
          if (!onScreen(g, pts, 0)) continue;
          var arm = ((i % n) + n) % n;
          out.push({ p: pts, cls: arm & 1, dir: jj % 5 });
        }
      }
    }
    return out;
  }

  /* ================================================================
   *  鱗のピル（利用者の評価でストックとして採用：輪ごとに逆×渦の腕、同じ向き×フィボナッチ）
   *  ピル＝長方形の短辺に半円（直径＝帯の幅）が付いた形。曲がったピルは同心の2本の弧を半円2つで結んだ形。
   *  試作の経緯（輪郭のある版・すき間のある版・3つのパラメータの8通り）は ideas/pills.js
   * ================================================================ */
  /* 鱗のピル：曲がる・隙間なし。どの継ぎ目でも、片方のピルの端をもう片方の端の後ろに入れ、輪をピルだけで埋める。
     見える形はどれも「片方の端がふくらみ、もう片方がえぐれた」同じ形（鱗）。中心の円は長さ0のピル。
     dirMode：'same'＝どの輪も同じ向きに重ねる、'alt'＝輪ごとに向きを逆にする（隣の輪が逆回りに見える）
     colMode：'alt'＝輪の中で A/B 交互、'fib'＝フィボナッチ語、'arm'＝対数螺旋の腕（色の層に渦が浮かぶ） */
  function pillFib(j) { return Math.floor((j + 2) / PHI) - Math.floor((j + 1) / PHI); }   // フィボナッチ語（1 が約62%）
  function makeScales(dirMode, colMode) {
    return function (g) {
      var w = g.edge * 0.72, SLOT = 2.6 * w, r0 = w * 0.8, far = farthest(g) + w * 2, out = [];
      function P(u, v) { return [g.ox + v * Math.cos(u), g.oy + v * Math.sin(u)]; }
      function side(v, ua, ub) {
        var d = ub - ua, n = Math.max(1, Math.ceil(Math.abs(d) / Math.min(0.25, Math.sqrt(0.2 / v)))), o = [];
        for (var k = 0; k < n; k++) o.push(P(ua + d * k / n, v));
        return o;
      }
      function cap(v0, v1, u, s) {
        var c = P(u, (v0 + v1) / 2), h = (v1 - v0) / 2, cr = [Math.cos(u), Math.sin(u)], ct = [-Math.sin(u) * s, Math.cos(u) * s];
        var n = Math.max(6, Math.ceil(Math.PI * h / 3)), o = [];
        for (var k = 0; k < n; k++) {
          var a = Math.PI * k / n;
          o.push([c[0] + h * (Math.cos(a) * cr[0] + Math.sin(a) * ct[0]), c[1] + h * (Math.cos(a) * cr[1] + Math.sin(a) * ct[1])]);
        }
        return o;
      }
      function rev(pts, first) { return [first].concat(pts.slice(1).reverse()); }
      var ARMS = 8, TW = 1.6;
      function color(k, i, n, uc, vm) {
        if (colMode === 'alt') return i & 1;
        if (colMode === 'fib') return pillFib(i + k * 7);
        var t = uc - TW * Math.log(vm / r0 + 1);
        return Math.floor((((t / TAU) % 1 + 1) % 1) * ARMS) & 1;
      }
      var disk = []; for (var q = 0; q < 60; q++) disk.push(P(q * TAU / 60, r0));
      out.push({ p: disk, cls: 1, dir: 0 });
      for (var k = 0, v0 = r0; v0 < far; k++, v0 += w) {
        var v1 = v0 + w, vm = v0 + w / 2, n = Math.max(3, Math.round(TAU * vm / SLOT));
        if (colMode === 'alt' && n % 2) n++;                       // 交互は偶数でないと1周で食い違う
        var al = TAU / n, off = k * Math.PI * (3 - Math.sqrt(5)), fwd = dirMode === 'same' || (k & 1) === 0;
        // fwd：どのピルも終わりの端が次のピルの始まりの後ろ（始まり＝ふくらむ、終わり＝えぐれる）。逆はその鏡
        for (var i = 0; i < n; i++) {
          var s0 = off + i * al, s1 = s0 + al;
          var mc = P(s0 + al / 2, vm), rad = vm * al / 2 + w * 2;
          if (mc[0] < -rad || mc[0] > g.W + rad || mc[1] < -rad || mc[1] > g.H + rad) continue;
          var sg = fwd ? -1 : 1;   // 継ぎ目の半円がふくらむ向き（手前のピルの端）
          var poly = side(v1, s0, s1).concat(cap(v0, v1, s1, sg), side(v0, s1, s0), rev(cap(v0, v1, s0, sg), P(s0, v0)));
          if (!onScreen(g, poly, 0)) continue;
          out.push({ p: poly, cls: color(k, i, n, s0 + al / 2, vm), dir: (k + i) % 5 });
        }
      }
      return out;
    };
  }



  /* ================================================================
   *  円と球（起点が2つ。利用者の評価で採用、単元「円と球」の床）
   *  円＝鱗のピル・渦（makeScales('alt','arm')）を育ち始める点 (ox, oy) から。
   *  球＝フィボナッチ球を、画面の反対側の隅寄りに置いた円板に写したもの。球は床（円の模様）の上に乗っている：
   *  円のタイルは球の輪郭で削り（minusDisk）、球の中にまるごと入るタイルは持たない。
   *  育つ順：タイルに o（0〜1）を持たせる。円と球それぞれの中で起点からの距離の順位を枚数で割った値なので、
   *  共通エンジンが o の順に並べると、円と球が同じ割合ずつ交互に育つ（どちらも同じ正答数で全部そろう）。
   *  球：点 i を z=1-(2i+1)/N、経度 i×黄金角に置き、x 軸まわりに −0.62、y 軸まわりに 0.38 傾けて正射影する。
   *  手前の半球の点のボロノイ細胞（円板で切る）をタイルにする（縁に近いほど細胞が詰まり、球に見える）。
   *  色は元の経度で8つの舟形に分けて交互（ビーチボールの縫い目）。明暗は光（左上手前から）の当たり方を5段の dir に写す
   * ================================================================ */
  function sphereCenter(g) {
    var wide = g.W >= g.H;
    return { c: wide ? [g.W * 0.86, g.H * 0.28] : [g.W * 0.5, g.H * 0.7], R: Math.min(g.W, g.H) * 0.3 };
  }
  function fibSphere(g, c, R) {
    var edge = g.edge, N = Math.max(80, Math.round(2 * Math.PI * R * R / (edge * edge * 0.95))), GA = Math.PI * (3 - Math.sqrt(5));
    var cx = Math.cos(-0.62), sx = Math.sin(-0.62), cy = Math.cos(0.38), sy = Math.sin(0.38), pts = [];
    for (var i = 0; i < N; i++) {
      var z = 1 - (2 * i + 1) / N, r = Math.sqrt(1 - z * z), th = i * GA, x = r * Math.cos(th), y = r * Math.sin(th);
      var lon = Math.atan2(y, x), y1 = y * cx - z * sx, z1 = y * sx + z * cx, x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
      if (z2 < -0.02) continue;
      pts.push({ X: c[0] + R * x2, Y: c[1] - R * y1, n: [x2, y1, z2], gore: Math.floor((lon + Math.PI) / (Math.PI / 4)) & 7 });
    }
    var disk = []; for (var q = 0; q < 120; q++) disk.push([c[0] + R * Math.cos(q * Math.PI / 60), c[1] + R * Math.sin(q * Math.PI / 60)]);
    function clip(poly, p, o) {
      var mx = (p.X + o.X) / 2, my = (p.Y + o.Y) / 2, nx = o.X - p.X, ny = o.Y - p.Y, out = [];
      for (var i = 0; i < poly.length; i++) {
        var A = poly[i], B = poly[(i + 1) % poly.length], da = (A[0] - mx) * nx + (A[1] - my) * ny, db = (B[0] - mx) * nx + (B[1] - my) * ny;
        if (da <= 0) out.push(A);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) { var u = da / (da - db); out.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]); }
      }
      return out;
    }
    var L = [-0.45, 0.55, 0.7], ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]), rr = edge * 4.5, out = [];
    // 明るさ k（−0.28〜0.22）を、共通エンジンの5段の明暗（dir 0..4 ＝ 0, −0.1, +0.14, −0.18, +0.24）の近い段に写す
    var STEP = [[-0.18, 3], [-0.1, 1], [0, 0], [0.14, 2], [0.24, 4]];
    pts.forEach(function (p) {
      var poly = disk;
      for (var j = 0; j < pts.length; j++) {
        var o = pts[j]; if (o === p) continue;
        var dx = o.X - p.X, dy = o.Y - p.Y; if (dx * dx + dy * dy < rr * rr) poly = clip(poly, p, o);
      }
      if (poly.length < 3) return;
      var lam = Math.max(0, (p.n[0] * L[0] + p.n[1] * L[1] + p.n[2] * L[2]) / ll), k = -0.28 + 0.5 * lam, best = 0;
      for (var s = 1; s < 5; s++) if (Math.abs(STEP[s][0] - k) < Math.abs(STEP[best][0] - k)) best = s;
      out.push({ p: poly, cls: p.gore & 1, dir: STEP[best][1] });
    });
    return out;
  }
  function circleSphere(g) {
    var S = sphereCenter(g), R2 = S.R * S.R, circ = [], sph;
    function vis(p) {
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (var i = 0; i < p.length; i++) { x0 = Math.min(x0, p[i][0]); x1 = Math.max(x1, p[i][0]); y0 = Math.min(y0, p[i][1]); y1 = Math.max(y1, p[i][1]); }
      return !(x1 <= 0 || x0 >= g.W || y1 <= 0 || y0 >= g.H);
    }
    makeScales('alt', 'arm')(g).forEach(function (t) {
      if (!vis(t.p)) return;
      var p = t.p, any = false;
      for (var i = 0; i < p.length; i++) { var dx = p[i][0] - S.c[0], dy = p[i][1] - S.c[1]; if (dx * dx + dy * dy < R2) { any = true; break; } }
      if (any) { p = minusDisk(p, S.c, S.R, true); if (!p || p.length < 3) return; }
      circ.push({ p: p, cls: t.cls, dir: t.dir });
    });
    sph = fibSphere(g, S.c, S.R).filter(function (t) { return vis(t.p); });
    function order(list, o) {
      list.forEach(function (t) {
        var cx = 0, cy = 0; t.p.forEach(function (q) { cx += q[0]; cy += q[1]; });
        cx /= t.p.length; cy /= t.p.length; t._d = (cx - o[0]) * (cx - o[0]) + (cy - o[1]) * (cy - o[1]);
      });
      list.sort(function (a, b) { return a._d - b._d; });
      list.forEach(function (t, i) { t.o = (i + 0.5) / list.length; delete t._d; });
    }
    order(circ, [g.ox, g.oy]); order(sph, S.c);
    return circ.concat(sph);
  }

  /** Factorization Diagrams。中心を空け、子の上を親の中心へ向ける。
   * 円の数は n と一致。2×2 だけは4方向にまとめ、素因数の積は保つ。
   * 2×2 の4つは、どの深さでも画面に対して正方形（斜め45°の4か所）に置く。親の向きに合わせて回すと
   * 菱形（＋の形）や斜めの列になり、直角に並んで見えない（8＝2×2×2 が×の形になっていた）。
   * 2 が奇数個の時は、まとめずに残す1個を内側ではなく外側に回す（8＝2×(2×2) で正方形が2つ並ぶ） */
  function factorPoints(n, radius) {
    if (!(n >= 2 && n <= 10000 && n % 1 === 0)) return [];
    var factors = [], v = n, out = [];
    for (var p = 2; p * p <= v; p++) while (v % p === 0) { factors.push(p); v /= p; }
    if (v > 1) factors.push(v);
    factors.reverse();
    function nest(i, x, y, r, up, path) {
      if (i === factors.length) { out.push({x:x, y:y, r:r * 0.72, cls:path[path.length-1] % 2, dir:2}); return; }
      var count = factors[i], step = 1, twos = 0;
      for (var t = i; t < factors.length && factors[t] === 2; t++) twos++;
      if (count === 2 && twos >= 2 && twos % 2 === 0) { count = 4; step = 2; }
      var sine = Math.sin(Math.PI/count), child = r * sine/(1+sine) * 0.9, ring = r-child;
      for (var j=0; j<count; j++) {
        var angle = count === 4 ? Math.PI/4 + j*Math.PI/2 : up + j*2*Math.PI/count;
        nest(i+step, x+ring*Math.cos(angle), y+ring*Math.sin(angle), child, angle+Math.PI, path.concat(j));
      }
    }
    nest(0,0,0,radius || 135,-Math.PI/2,[]);
    return out;
  }
  /** 720 = 5×3×3×4×4。空白を残す単一の円図（敷き詰め模様ではない）。 */
  function factor720(g) {
    var dots = factorPoints(720, Math.min(g.W,g.H)*0.47);
    return dots.map(function(d,i){
      var poly = [];
      for(var j=0;j<32;j++){var a=j*2*Math.PI/32;poly.push([g.W/2+d.x+d.r*Math.cos(a),g.H/2+d.y+d.r*Math.sin(a)]);}
      return {p:poly, cls:d.cls, dir:d.dir, o:((i%144)*5+Math.floor(i/144))/720};
    });
  }

  var GENERATORS = {
    factor720: { name: '素因数分解720（5方向の円）', make: factor720, coverage: 'sparse', tileCount: 720 },
    penrose:   { name: 'ペンローズ（5回対称）', make: penrose },
    octagon:   { name: '八角の星（8回対称）',   make: multigrid(4) },
    heptagon:  { name: '七角（7回対称）',       make: multigrid(7) },
    dodecagon: { name: '十二角（12回対称）',    make: multigrid(6) },
    sunflower: { name: 'ひまわり（葉序）',      make: sunflower },
    // 丸い渦格子は内向き（鱗の丸みが中心を向く）を採用。外向きは whirl(g, false) で出せる（SPEC.md「見送った図形」）
    whirl:     { name: '丸い渦格子（6回対称・真円の鱗）', make: function (g) { return whirl(g, true); } },
    flower:    { name: '生命の花（6回対称）',   make: flower },
    mandala:   { name: '円弧の曼荼羅（4回対称）', make: mandala },
    decagon:   { name: '十角の星（10回対称）',   make: multigrid(5, 0.5) },
    petals:    { name: '渦の花びら（6回対称）',  make: petals },
    tape:      { name: '巻き尺の渦',             make: tape },
    clockstar: { name: '文字盤の星（12回対称・正方形と三角形）', make: clockstar },
    pascal:    { name: 'パスカルの偶奇（六角のマス）',          make: pascal },
    chair:     { name: '椅子のタイル（L字の置き換え）',         make: chair },
    fibgrid:   { name: 'フィボナッチの格子',                    make: fibgrid },
    farey:     { name: 'ファレイの円盤（ポアンカレ円板）',      make: farey },
    padovan:   { name: 'パドバンの三角渦',                      make: padovan },
    decimal:   { name: '十進の渦（1周で10倍）',                 make: decimal },
    scaleswirl: { name: '鱗のピル・渦（輪ごとに逆向き・渦の腕で染め分け）', make: makeScales('alt', 'arm') },
    scalefib:   { name: '鱗のピル・フィボナッチ（同じ向き・フィボナッチ語で染め分け）', make: makeScales('same', 'fib') },
    circlesphere: { name: '円と球（起点2つ：鱗のピルの渦とフィボナッチ球）', make: circleSphere },
    carry:     { name: 'くり上がりの六角（たし算）',             make: carry },
    borrow:    { name: 'くり下がりの三角（ひき算）',             make: borrow }
  };

  var api = { GENERATORS: GENERATORS, multigrid: multigrid, factorPoints: factorPoints };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GrowingFigures = api;
})(this);
