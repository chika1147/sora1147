import assert from 'node:assert/strict';
import {evaluateExpression,solveMath} from './math_v18.js';
import {intentScore,relationParaphrases,rankV18} from './quality_v18.js';
import {staticNumericCheck,inspectCode} from './quality_v17.js';
let count=0;
const check=(fn)=>{fn();count++;};
const cases=[['12+7','19'],['9-14','-5'],['128×24','3072'],['144÷12','12'],
             ['1.2+2.3','3.5'],['(5+3)*2','16'],['-7+12','5'],['9/4','2.25'],['3+4*5','23']];
for(const [expr,value] of cases)check(()=>assert.equal(evaluateExpression(expr),value));
for(const expr of ['__import__("os")','2 ** 32','8/0','foo','2;3'])
  check(()=>assert.throws(()=>evaluateExpression(expr)));
check(()=>assert.equal(solveMath('りんごが12個あります。3人で分けると？').value,'4'));
check(()=>assert.equal(solveMath('3個ずつ4人に配ると全部で何個？').value,'12'));
check(()=>assert.equal(solveMath('りんごが8個あります。3個食べたら何個残る？').value,'5'));
check(()=>assert.equal(solveMath('東京はどこの国の首都ですか？'),null));
check(()=>assert.equal(solveMath('Pythonで1から10まで足す関数を書いてください。'),null));
const q='東京はどこの国の首都ですか？';
check(()=>assert.equal(relationParaphrases(q).length,2));
check(()=>assert(!relationParaphrases(q).join(' ').includes('日本')));
check(()=>assert(intentScore(q,'東京は日本の首都です。').score>intentScore(q,'東京都は日本にあります。').score));
const candidates=[{text:'東京都は日本にあります。',avgLogprob:-.3},{text:'東京は日本の首都です。',avgLogprob:-.4}];
check(()=>assert.equal(rankV18(q,candidates,false).index,1));
const codeQ='Pythonで1から10まで足す関数を書いてください。';
check(()=>assert.equal(staticNumericCheck(codeQ,'def f():\n    return sum(range(1,11))').status,'pass'));
check(()=>assert.equal(staticNumericCheck(codeQ,'def f():\n    return sum(range(1,10))').status,'fail'));
check(()=>assert.equal(staticNumericCheck(codeQ,'def f(values):\n    return sum(values)').status,'unsupported'));
console.log(JSON.stringify({suite:'ZeroAI v1.8 web JS',passed:count,failed:0},null,2));
