import assert from 'node:assert/strict';
import fs from 'node:fs';
import {solveMath, solveDirectMath, routeMath,evaluateExpression} from './math_v18_fix.js';
let count=0;
const check=(name,fn)=>{fn();count++;};
for(const [q,value] of [
    ['125 * 24','3000'],['125×24は？','3000'],['125 × 24 はいくつ？','3000'],
    ['125かける24は？','3000'],['計算してください：125 * 24','3000'],
    ['18 ÷ 6 = ?','3'],['(5+3)*2','16'],['128 × 24','3072'],
    ['12+7','19'],['9-14','-5'],['144÷12','12'],
    ['1.2+2.3','3.5'],['3+4*5','23'],['0-5','-5'],['1/4','0.25']
])check(q,()=>assert.equal(solveMath(q)?.value,value));
check('word problem',()=>assert.equal(solveMath('りんごが18個あります。6人で分けると1人何個ですか？')?.value,'3'));
check('subtraction story',()=>assert.equal(solveMath('りんごが8個あります。3個食べたら何個残る？')?.value,'5'));
check('plain math, codeMode ON',()=>assert.equal(routeMath('125 * 24',{codeMode:true,wordProblems:false})?.value,'3000'));
check('plain math, mathMode OFF',()=>assert.equal(routeMath('125 * 24',{codeMode:false,wordProblems:false})?.value,'3000'));
check('story, mathMode ON',()=>assert.equal(routeMath('りんごが18個あります。6人で分けると1人何個ですか？',{codeMode:false,wordProblems:true})?.value,'3'));
check('story, mathMode OFF',()=>assert.equal(routeMath('りんごが18個あります。6人で分けると1人何個ですか？',{codeMode:false,wordProblems:false}),null));
check('story, codeMode ON',()=>assert.equal(routeMath('りんごが18個あります。6人で分けると1人何個ですか？',{codeMode:true,wordProblems:true}),null));
check('division-by-zero, no GPT guess',()=>assert.equal(solveDirectMath('1/0')?.kind,'arithmetic_error'));
check('bad expression not executed',()=>assert.throws(()=>evaluateExpression('__import__("os")')));
check('no math in Python code request',()=>assert.equal(solveMath('Pythonで125*24を計算するコードを書いて'),null));
check('no math in trivia',()=>assert.equal(solveMath('東京はどこの国の首都ですか？'),null));
check('refuse ambiguous word problem',()=>assert.equal(solveMath('18個を6人で分けて2個余ると？'),null));
check('UI invokes routeMath',()=>assert.match(fs.readFileSync(new URL('./app.js',import.meta.url),'utf8'),/const local=routeMath\(question,/));
check('worker invokes routeMath',()=>assert.match(fs.readFileSync(new URL('./engine.worker.js',import.meta.url),'utf8'),/const calculated=routeMath\(question,/));
check('math UI notice',()=>assert.match(fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),/125×24 の計算テスト/));
console.log(JSON.stringify({suite:'ZeroAI v1.8 MathFix web',passed:count,failed:0},null,2));
