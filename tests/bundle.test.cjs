'use strict';
// 貼るファイル一式（dist/multi/）が今のソースと一致すること。ソースを直したら node tools/bundle/build.cjs を実行する
const { execFileSync } = require('child_process'), path = require('path');
execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'bundle', 'build.cjs'), '--check'], { stdio: 'inherit' });
// まとめたものを1つのコンテキストで読み込めること（構文・名前の衝突）
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const d = path.join(__dirname, '..', 'dist', 'multi'), ctx = {};
vm.createContext(ctx);
vm.runInContext(['Base.gs', 'Core.gs', 'AllUnits.gs'].map(f => fs.readFileSync(path.join(d, f), 'utf8')).join('\n'), ctx);
assert.ok(Object.keys(ctx.UNIT_DEFS).length >= 14);
assert.strictEqual(typeof ctx.Base.me, 'function');
console.log('bundle ok');
