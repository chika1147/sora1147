// v1.8 extra intent signals: no fixed fact lookup or external AI.
import {scoreCandidate} from './quality_v17.js';
import {judgeAnswerConsistency} from './question_intent.js';
export function relationParaphrases(q){
  const m=String(q).trim().match(/^(.{1,35}?)はどこの国の首都(?:ですか)?[？?。\s]*(?:国名を答えてください[。.]?)?$/);
  if(!m)return [];
  const subject=m[1].trim();
  return [`${subject}は何という国の首都ですか？ 国名だけを答えてください。`,
          `「${subject}は◯◯の首都です」の◯◯に入る国名を答えてください。`];
}
export function intentScore(q,text){
  let score=0,notes=[];
  if(q.includes('首都')&&/(どこの国|何という国|国名)/.test(q)){
    if(text.includes('首都')){score+=1.5;notes.push('首都関係を明示');}
    if(/に(?:あり|存在し|位置し)ま/.test(text)&&!text.includes('首都')){score-=1.8;notes.push('所在のみ説明');}
    if(text.includes('首相')&&!text.includes('首都')){score-=1.5;notes.push('首相と混同');}
  }
  if(/なぜ|理由/.test(q)&&!/から|ため|理由|ので/.test(text)){score-=.45;notes.push('理由不明');}
  if(/いくつ|何個|計算/.test(q)&&!/\d/.test(text)){score-=.55;notes.push('数値なし');}
  return {score,reason:notes.join('・')||'追加の意味信号なし（正誤未判定）'};
}
export function rankV18(q,candidates,codeMode){
  const reports=candidates.map(c=>{
    const base=scoreCandidate(q,c,codeMode);
    if(codeMode)return base;
    const extra=intentScore(q,String(c.text||''));
    const consistency=judgeAnswerConsistency(q,String(c.text||''));
    const notes=consistency.findings.length?consistency.findings.join('・'):'目立つ自己矛盾は未検出';
    return {...base,score:base.score+extra.score+consistency.score,
      reason:base.reason+'／'+extra.reason+'／'+notes,
      consistency,verification:base.verification+
        '（質問タイプと文面の矛盾を検査。事実の正誤は未検証）'};
  });
  let index=0;for(let i=1;i<reports.length;i++)if(reports[i].score>reports[index].score)index=i;
  return {index,reports};
}
