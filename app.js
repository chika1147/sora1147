import {routeMath,solveDirectMath} from './math_v18_fix.js';
import {finalizeResponse,UI_BUILD} from './response_gate.js?qa5=20261122';
const $=id=>document.getElementById(id);
const status=$('status'), message=$('message'), output=$('output');
const dbName='zeroai-offline-v1'; // v1.6 IndexedDB checkpoint remains intact!
let worker=null,loaded=false,busy=false;
const comparisons=[];
let activeModelStep=null,activeModelSlot='original';
const modelKeys=slot=>slot==='experiment'
  ?{manifest:'experimental_manifest',tokenizer:'experimental_tokenizer',weights:'experimental_weights'}
  :{manifest:'manifest',tokenizer:'tokenizer',weights:'weights'};
const modelVersion=step=>Number(step)===43531?'v1.9.1 実験版':'v1.8 / '+String(step||'?')+' step';
// Chat shell event bridge. The engine stays independent of the UI.
let requestSequence=0,activeRequestId=null;
let inactivityWarningTimer=null;
function clearInactivityWarning(){if(inactivityWarningTimer!==null)clearTimeout(inactivityWarningTimer);inactivityWarningTimer=null;}
function markWorkerAlive(){
  clearInactivityWarning();
  if(activeRequestId!==null){
    const requestId=activeRequestId;
    inactivityWarningTimer=setTimeout(()=>{
      if(activeRequestId===requestId)bridge('slow',{id:requestId,text:'処理が長引いています。画面が動くなら停止できます。'});
    },45000);
  }
}
function bridge(type,detail={}){window.dispatchEvent(new CustomEvent('zeroai:'+type,{detail}));}
function show(s,type='info'){status.textContent=s;status.dataset.state=type;bridge('status',{text:s,state:type});}
function setBusy(value){busy=value;$('send').disabled=value||!loaded;$('stop').disabled=!value;$('text').disabled=value;}
function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('model');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function dbPut(name,value){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('model','readwrite');tx.objectStore('model').put(value,name);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function dbPutMany(entries){
  const db=await dbOpen();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('model','readwrite'),store=tx.objectStore('model');
    for(const [name,value] of entries)store.put(value,name);
    tx.oncomplete=()=>{db.close();resolve();};
    tx.onerror=()=>{const error=tx.error;db.close();reject(error);};
    tx.onabort=()=>{const error=tx.error;db.close();reject(error||Error('モデルの保存が中断されました'));};
  });
}
async function dbGet(name){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('model','readonly');const r=tx.objectStore('model').get(name);r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>{db.close();reject(r.error);};});}
async function dbClear(){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('model','readwrite');tx.objectStore('model').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function sha256(buffer){const digest=await crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function getActiveSlot(){
  const saved=await dbGet('active_slot');
  return saved==='experiment'?'experiment':'original';
}
async function refreshModelSelector(slot){
  const main=await dbGet('manifest'),experiment=await dbGet('experimental_manifest');
  const select=$('activeModelSlot');
  if(!select)return;
  const mainOpt=select.querySelector('option[value="original"]');
  const expOpt=select.querySelector('option[value="experiment"]');
  mainOpt.textContent=main?'元モデル（'+main.checkpoint_step+' step）':'元モデル（未登録）';
  expOpt.textContent=experiment?'実験モデル（'+experiment.checkpoint_step+' step）':'実験モデル（未登録）';
  mainOpt.disabled=!main;expOpt.disabled=!experiment;
  select.value=slot;
  const current=slot==='experiment'?experiment:main;
  $('modelVersionInfo').textContent=current
    ?'現在の使用モデル：'+modelVersion(current.checkpoint_step)+'／'+current.checkpoint_step+' step。重みはこの端末にのみ保存。'
    :'まだモデルがありません。ZIPを解凍し、3ファイルを取り込んでください。';
}
async function loadCurrentModel(){
  const slot=await getActiveSlot();
  const keys=modelKeys(slot);
  const [man,tok,bin]=await Promise.all([dbGet(keys.manifest),dbGet(keys.tokenizer),dbGet(keys.weights)]);
  await refreshModelSelector(slot);
  if(!man||!tok||!bin){
    if(worker)worker.terminate();
    worker=null;loaded=false;activeModelStep=null;setBusy(false);
    show('モデル未登録。設定から3ファイルを取り込んでね。');return;
  }
  activeModelSlot=slot;activeModelStep=Number(man.checkpoint_step);
  if(!man||!tok||!bin){show('モデル未登録。下の3ファイルを読み込んでね。');return;}
  if(worker)worker.terminate();
  loaded=false;worker=new Worker('./engine.worker.js?modelslots=20261122',{type:'module'});
  worker.onmessage=e=>{
    let d=e.data;
    if(d.type==='ready'){
      // QA3/QA4 have the same message format. A newer UI still runs its
      // own final-output checks, even if an older Worker was cached.
      const compatible=[UI_BUILD,'QA3-20261122','QA4-20261122'].includes(String(d.engineBuild||''));
      if(!compatible){
        loaded=false;setBusy(false);
        show('推論エンジンの形式が確認できません。UI: '+UI_BUILD+
          ' / エンジン: '+(d.engineBuild||'旧版')+'。サイトを再読み込みしてください。','error');
        return;
      }
      loaded=true;
      const runtime=String(d.engineRuntimeBuild||d.engineBuild);
      const mode=d.engineBuild===UI_BUILD?'':'（互換モード '+runtime+'）';
      show('ZeroAI '+modelVersion(d.step)+'｜'+UI_BUILD+mode+
        '｜推論上限'+d.context.toLocaleString()+' tokens｜学習時'+d.trainedContext+' tokens','ok');
      bridge('modelversion',{version:modelVersion(d.step),step:d.step,slot:activeModelSlot});
      setBusy(false);
    }
    if(d.type==='notice'){message.textContent=d.text;markWorkerAlive();}
    if(d.type==='phase'){message.textContent=d.text;markWorkerAlive();bridge('phase',{id:activeRequestId,stage:d.stage,text:d.text});}
    if(d.type==='prefill'){
      markWorkerAlive();
      bridge('prefill',{id:activeRequestId,done:d.done,total:d.total,percent:d.percent,variant:d.variant,variants:d.variants});
    }
    if(d.type==='progress'){
      markWorkerAlive();
      // The model's live tokens have NOT passed quality checks. Do not put
      // unverified arithmetic or broken Japanese into chat history.
      const tokens=Math.max(0,Number(d.tokens)||0);
      bridge('progress',{id:activeRequestId,text:'回答生成中… '+tokens+' tokens（検証前）'});
    }
    if(d.type==='done'){
      clearInactivityWarning();
      // A second, independent gate on the UI thread. An older Worker,
      // unexpected math route, or bad final token stream cannot bypass this.
      d=finalizeResponse(d);
      output.textContent=d.output||'（空の回答）';
      message.textContent=d.source==='local_calculation'&&!d.qualityWarning ? (d.math.kind==='arithmetic_error' ? `計算不可：${d.math.answer}（ZeroAIの推測は使っていません）` : `【Webローカル計算で検証済み】${d.math.expression} = ${d.math.value}（AIの推測ではありません）`) : `${d.candidates.length}候補からZeroAIの回答を選択／${d.tokens}トークン。${d.verification}`;
      $('diagnostics').textContent=d.candidates.map((c,i)=>`候補${i+1}${c.selected?' 【採用】':''}  score=${c.score.toFixed(3)}  logp=${c.avgLogprob.toFixed(3)}  ${c.source||'原文'}\n${c.reason}\n${c.text}`).join('\n\n');
      if(d.qualityWarning){
        message.textContent='回答品質の警告：'+d.qualityWarning.reason+'。原因確認は「設定・モデル管理」の診断情報からできます。';
        $('diagnostics').textContent='【品質検出】'+d.qualityWarning.code+'\n【元の生成内容】\n'+String(d.rawOutput||'')+'\n\n'+$('diagnostics').textContent;
      }
      comparisons.push({question:d.question,answer:d.output,candidates:d.candidates,codeMode:d.codeMode,model_step:man.checkpoint_step,version:modelVersion(man.checkpoint_step),qualityWarning:d.qualityWarning||null});
      bridge('answer',{id:activeRequestId,question:d.question,answer:d.output||'（空の回答）',source:d.source||'model',contextInfo:d.contextInfo||null});
      activeRequestId=null;
      setBusy(false);
      if($('speak').checked&&!d.qualityWarning&&d.output&&!/```/.test(d.output)){
        speechSynthesis.cancel();const say=new SpeechSynthesisUtterance(d.output);say.lang='ja-JP';say.rate=0.95;speechSynthesis.speak(say);
      }
    }
    if(d.type==='error'){clearInactivityWarning();show(d.error,'error');bridge('error',{id:activeRequestId,error:d.error});activeRequestId=null;setBusy(false);}
  };
  worker.onerror=e=>{clearInactivityWarning();const err='推論エラー：'+e.message;show(err,'error');bridge('error',{id:activeRequestId,error:err});activeRequestId=null;setBusy(false);};
  show('モデルを読み込み中…');
  const copied=bin.slice(0);worker.postMessage({type:'load',manifest:man,tokenizer:tok,weights:copied},[copied]);
}
$('import').addEventListener('change',async e=>{
  const files=Array.from(e.target.files||[]);
  if(!files.length)return;
  try{
    const byName=Object.fromEntries(files.map(f=>[f.name,f]));
    const manFile=byName['manifest.json'],tokFile=byName['tokenizer.json'],weightFile=byName['weights.bin'];
    if(!manFile||!tokFile||!weightFile)throw Error('manifest.json / tokenizer.json / weights.bin の3つを選んでね');
    show('モデルの整合性を確認中…');
    const man=JSON.parse(await manFile.text()),tokText=await tokFile.text(),tok=JSON.parse(tokText),bin=await weightFile.arrayBuffer();
    if(man.format!=='zeroai-iphone-f32-v1'||man.dtype!=='float32-le')throw Error('ZeroAIの変換済みモデルではありません');
    if(man.weight_float_count*4!==bin.byteLength)throw Error('モデルサイズが不一致です');
    const [tokHash,weightHash]=await Promise.all([sha256(new TextEncoder().encode(tokText)),sha256(bin)]);
    if(man.tokenizer_sha256!==tokHash||man.weights_sha256!==weightHash)throw Error('重みかトークナイザのSHA256が一致しません');
    const hasOriginal=!!(await dbGet('manifest'));
    const target=hasOriginal?'experiment':'original';
    const keys=modelKeys(target);
    // Atomic transaction: a failed large import must NEVER partially replace
    // a model, and the previous original model is never overwritten.
    await dbPutMany([
      [keys.manifest,man],[keys.tokenizer,tok],[keys.weights,bin],
      ['active_slot',target]
    ]);
    show('端末内にモデルを保存しました。元のモデルは保持されています。','ok');
    await loadCurrentModel();
  }catch(error){show(String(error?.message||error),'error');}
  e.target.value='';
});
$('changeModel').addEventListener('click',async()=>{
  if(busy){show('回答生成中はモデルを切り替えられません。','error');return;}
  const next=$('activeModelSlot').value,keys=modelKeys(next);
  if(!await dbGet(keys.manifest)){show('選択したモデルは未登録です。','error');return;}
  try{
    await dbPut('active_slot',next);
    await loadCurrentModel();
  }catch(err){show('モデル切替エラー：'+String(err?.message||err),'error');}
});
$('send').addEventListener('click',()=>{
  if(!loaded||busy)return;
  const question=$('text').value.trim();if(!question)return;
  // Always intercept plain arithmetic, even when Python-code-mode is ON
  // or the optional word-problem checkbox is OFF.
  const codeMode=$('codeMode').checked||/(Python|コード|関数|def\s+)/i.test(question);
  const local=routeMath(question,{codeMode,wordProblems:$('mathMode').checked});
  // Obtain past messages BEFORE dispatching this new user question.
  const history=typeof window.zeroaiGetHistory==='function'?window.zeroaiGetHistory():[];
  const requestId=++requestSequence;
  activeRequestId=requestId;
  bridge('question',{id:requestId,question,source:local?'local_calculation':'model'});
  if(local){
    output.textContent=local.answer;
    message.textContent=local.kind==='arithmetic_error'
      ? `【計算できません】${local.answer} ／ AIによる推測回答は出しません。`
      : `【Webローカル計算で検証済み】${local.expression} = ${local.value} ／ AIによる推測回答ではありません。`;
    $('diagnostics').textContent=`入力: ${question}\n処理: ${local.kind}\n式: ${local.expression}\n結果: ${local.value||'計算不可'}\nエンジン: JavaScript BigInt (外部APIなし)`;
    comparisons.push({question,answer:local.answer,source:'local_calculation',expression:local.expression,value:local.value});
    bridge('answer',{id:requestId,question,answer:local.answer,source:'local_calculation'});
    activeRequestId=null;
    return;
  }
  output.textContent='';message.textContent='端末内で候補生成中。通信は使用しません。';setBusy(true);
  markWorkerAlive();
  worker.postMessage({type:'generate',question,history,maxTokens:Number($('maxTokens').value),
    temperature:Number($('temperature').value),topK:Math.max(1,Number($('topK').value)),
    candidates:Number($('candidates').value),useMath:$('mathMode').checked,topP:0.95,codeMode:codeMode,
    contextLimit:Math.max(512,Math.min(10000,Number($('contextLimit')?.value)||10000))});
});
$('stop').addEventListener('click',()=>{clearInactivityWarning();if(activeRequestId!==null)bridge('error',{id:activeRequestId,error:'生成を停止しました。'});activeRequestId=null;if(worker)worker.terminate();worker=null;loaded=false;setBusy(false);show('生成を停止。モデルを再読み込み中…');loadCurrentModel().catch(e=>show(e.message,'error'));});
$('clear').addEventListener('click',async()=>{if(!confirm('端末内の元モデルと実験モデルを両方削除します。元に戻せません。本当に削除しますか？'))return;await dbClear();if(worker)worker.terminate();worker=null;loaded=false;output.textContent='';show('モデルを削除しました。');setBusy(false);});
$('read').addEventListener('click',()=>{const text=output.textContent.trim();if(!text)return;speechSynthesis.cancel();const say=new SpeechSynthesisUtterance(text);say.lang='ja-JP';speechSynthesis.speak(say);});
$('export').addEventListener('click',()=>{
  if(!comparisons.length){message.textContent='まず1つ以上の質問を生成してね。';return;}
  const blob=new Blob([JSON.stringify({version:'v1.8-web',records:comparisons},null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);
  link.download='zeroai_web_results_v191.json';link.click();URL.revokeObjectURL(link.href);
});
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))
  navigator.serviceWorker.register('./sw.js?modelslots=20261122',{updateViaCache:'none'}).catch(e=>console.warn('Offline cache unavailable',e));
loadCurrentModel().catch(e=>show(String(e),'error'));

const mathCheck=$('mathCheck');
if(mathCheck) mathCheck.addEventListener('click',()=>{
  const q='125 * 24';
  const result=solveDirectMath(q);
  output.textContent=result?.answer||'数式エンジンの検出に失敗しました。';
  message.textContent=result?.value==='3000'?'【計算テスト合格】3000 / Webローカル計算':'【計算テスト失敗】';
  $('diagnostics').textContent=`MathFix 2026-11-19 / test=${q} / expected=3000 / actual=${result?.value||'none'}`;
});
