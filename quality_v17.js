// ZeroAI v1.7 candidate selection. This module contains NO factual answer table.
// Heuristics help rank model-generated candidates; they are NOT a fact checker.
const T = /[一-龯]{2,}|[ァ-ヴー]{2,}|[a-zA-Z_]{3,}/g;
const IGNORE = new Set(['あなた','ください','どちら','どんな','どこの','どこ','どれ','教えて','Python','python','関数']);
export function terms(question){return [...new Set(question.match(T)||[])].filter(x=>!IGNORE.has(x));}
export function numericTask(q){
  const match=q.match(/(\d{1,5})\s*から\s*(\d{1,5})\s*まで/) || q.match(/\b(\d{1,5})\s*(?:to|through)\s*(\d{1,5})\b/i);
  if(!match||!/(合計|足す|足し|総和|sum|total)/i.test(q))return null;
  const a=+match[1], b=+match[2];if(a>b||b-a>10000)return null;
  return {start:a,end:b,parity:/(偶数|even)/i.test(q)?'even':/(奇数|odd)/i.test(q)?'odd':null};
}
function content(code){const m=code.match(/```(?:python|py)?\s*\n([\s\S]*?)(?:```|$)/i);return (m?m[1]:code).trim();}
export function inspectCode(question,reply){
  const code=content(reply);
  const func=code.match(/(?:^|\n)\s*(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*:/);
  if(!func)return {score:-3,reason:'関数が見つかりません。Python構文と実行結果は未検証',functionName:null,syntax:'not_checked'};
  const task=numericTask(question);
  if(!task)return {score:1,reason:'関数形式を検出。Python構文と意味は未検証',functionName:func[1],syntax:'not_checked'};
  let score=1;const issues=[];
  const params=func[2].split(',').map(x=>x.trim()).filter(Boolean);
  const required=params.filter(x=>!x.includes('=')&&x!=='*'&&x!=='/');
  if(required.length){score-=2;issues.push('固定範囲なのに必須引数がある');}else score+=0.7;
  if(!/\bsum\s*\(/.test(code)&&!/\bfor\b/.test(code)){score-=1.5;issues.push('合計計算が見つからない');}
  if(!/\brange\s*\(/.test(code)){score-=2;issues.push('rangeがない');}else score+=0.5;
  const constants=new Set([...code.matchAll(/\b\d+\b/g)].map(m=>+m[0]));
  if(constants.has(task.start)&&(constants.has(task.end)||constants.has(task.end+1)))score+=0.5;
  if(task.parity){
    const m=code.match(/%\s*2\s*(==|!=)\s*([01])/);
    if(!m){score-=0.7;issues.push('偶奇条件が見つからない');}
    else{
      const even=(m[1]==='=='&&m[2]==='0')||(m[1]==='!='&&m[2]==='1');
      if((even?'even':'odd')!==task.parity){score-=3;issues.push('偶数・奇数の条件が質問と逆');}
      else score+=.5;
    }
  }
  return {score,reason:issues.join('・')||'コード構造が課題と関連（正しい動作の保証ではない）',functionName:func[1],syntax:'not_checked'};
}
export function paraphraseNumericQuestion(question){
  const task=numericTask(question);
  if(!task)return null;
  const par=task.parity==='even'?'偶数の':task.parity==='odd'?'奇数の':'';
  const p=`${task.start}から${task.end}までの${par}合計を返す関数をPythonで作ってください。`;
  return p===question.trim()?null:p;
}
export function staticNumericCheck(question,reply){
  // Safe arithmetic recognizer, not a Python interpreter. Only a narrow return expression is supported.
  const task=numericTask(question);
  if(!task)return {status:'unsupported',detail:'数値範囲の問題ではありません'};
  const code=content(reply);
  const fn=code.match(/(?:^|\n)\s*(?:async\s+)?def\s+[a-zA-Z_]\w*\s*\(([^)]*)\)\s*:/);
  if(!fn||fn[1].trim())return {status:'unsupported',detail:'必須引数があるか関数がありません'};
  const returnLine=code.match(/^\s+return\s+(.+?)\s*$/m);
  if(!returnLine)return {status:'unsupported',detail:'return式が見つかりません'};
  let expr=returnLine[1].trim();
  // The expression must contain exactly one whitelisted sum(range) call.
  const m=expr.match(/^sum\(range\(\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(-?\d+))?\s*\)\)$/);
  if(!m)return {status:'unsupported',detail:'安全な静的計算の対象外'};
  const a=+m[1],b=+m[2],step=m[3]===undefined?1:+m[3];
  if(!step||Math.abs((b-a)/step)>10001)return {status:'unsupported',detail:'範囲が大きすぎるか不正'};
  let actual=0;
  for(let x=a, n=0;step>0?x<b:x>b;x+=step,n++){
    if(n>10000)return {status:'unsupported',detail:'上限超過'};
    actual+=x;
  }
  let expected=0;
  for(let x=task.start;x<=task.end;x++)if(!task.parity||(task.parity==='even'?x%2===0:x%2!==0))expected+=x;
  return actual===expected?
    {status:'pass',detail:`静的計算：${actual} は期待値 ${expected} と一致`}:
    {status:'fail',detail:`静的計算：${actual} は期待値 ${expected} と不一致`};
}
export function scoreCandidate(question,candidate,codeMode=false){
  const text=String(candidate.text||'').trim(), lp=Number(candidate.avgLogprob);
  let score=Number.isFinite(lp)?lp:-100;
  if(!text)score-=8;
  if(codeMode){const report=inspectCode(question,text),check=staticNumericCheck(question,text);const bonus=check.status==='pass'?8:check.status==='fail'?-8:0;return {score:score+report.score+bonus,reason:report.reason+'／'+check.detail,verification:check.status==='pass'?'限定的な静的計算一致（実行未検証）':check.status==='fail'?'数値条件との不一致を検出（要修正）':'コードの動作は未検証'};}
  const t=terms(question),hits=t.filter(x=>text.toLowerCase().includes(x.toLowerCase()));
  if(t.length)score+=0.95*(hits.length/t.length)-0.2*(1-hits.length/t.length);
  if(text.includes(question.trim().replace(/[。！？? ]+$/,'')))score-=0.6;
  if(/[？?]$/.test(text))score-=0.15;
  return {score,reason:'質問語の一致: '+(hits.join('、')||'なし'),verification:'意味・事実の正誤は未検証'};
}
export function rank(question,candidates,codeMode=false){
  const reports=candidates.map(c=>scoreCandidate(question,c,codeMode));
  let index=0;for(let i=1;i<reports.length;i++)if(reports[i].score>reports[index].score)index=i;
  return {index,reports};
}
export function logProbability(logits,id){
  let max=-Infinity;for(let i=0;i<logits.length;i++)if(logits[i]>max)max=logits[i];
  let z=0;for(let i=0;i<logits.length;i++)z+=Math.exp(logits[i]-max);
  return logits[id]-max-Math.log(z);
}
