const $=id=>document.getElementById(id);
const status=$('status'), message=$('message'), output=$('output');
const dbName='zeroai-offline-v1';
let worker=null,loaded=false,busy=false;
function show(s,type='info'){status.textContent=s;status.dataset.state=type;}
function setBusy(value){busy=value;$('send').disabled=value||!loaded;$('stop').disabled=!value;$('text').disabled=value;}
function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('model');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function dbPut(name,value){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('model','readwrite');tx.objectStore('model').put(value,name);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function dbGet(name){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('model','readonly');const r=tx.objectStore('model').get(name);r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>{db.close();reject(r.error);};});}
async function dbClear(){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('model','readwrite');tx.objectStore('model').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function sha256(buffer){const digest=await crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function loadCurrentModel(){
  const man=await dbGet('manifest'),tok=await dbGet('tokenizer'),bin=await dbGet('weights');
  if(!man||!tok||!bin){show('モデル未登録。下の3ファイルを読み込んでね。');return;}
  if(worker) worker.terminate();
  loaded=false;worker=new Worker('./engine.worker.js',{type:'module'});
  worker.onmessage=e=>{
    const d=e.data;
    if(d.type==='ready'){loaded=true;show(`ZeroAI準備完了｜${d.step} step｜文脈${d.context} tokens`,'ok');setBusy(false);}
    if(d.type==='notice'){message.textContent=d.text;}
    if(d.type==='progress'){output.textContent=d.output;}
    if(d.type==='done'){
      output.textContent=d.output||'（空の回答）';message.textContent=`ZeroAI自身が${d.tokens}トークン生成しました。`;
      setBusy(false);
      if($('speak').checked&&d.output&&!/```/.test(d.output)){
        speechSynthesis.cancel();const say=new SpeechSynthesisUtterance(d.output);say.lang='ja-JP';say.rate=0.95;speechSynthesis.speak(say);
      }
    }
    if(d.type==='error'){show(d.error,'error');setBusy(false);}
  };
  worker.onerror=e=>{show('推論エラー：'+e.message,'error');setBusy(false);};
  show('モデルを読み込み中…');
  const copied=bin.slice(0);worker.postMessage({type:'load',manifest:man,tokenizer:tok,weights:copied},[copied]);
}
$('import').addEventListener('change',async e=>{
  const files=Array.from(e.target.files||[]);
  if(!files.length)return;
  try {
    const byName=Object.fromEntries(files.map(f=>[f.name,f]));
    const manFile=byName['manifest.json'],tokFile=byName['tokenizer.json'],weightFile=byName['weights.bin'];
    if(!manFile||!tokFile||!weightFile)throw Error('manifest.json / tokenizer.json / weights.bin の3つを選んでね');
    show('モデルの整合性を確認中…');
    const man=JSON.parse(await manFile.text()),tokText=await tokFile.text(),tok=JSON.parse(tokText),bin=await weightFile.arrayBuffer();
    if(man.format!=='zeroai-iphone-f32-v1'||man.dtype!=='float32-le')throw Error('ZeroAIの変換済みモデルではありません');
    if(man.weight_float_count*4!==bin.byteLength)throw Error('モデルのサイズが不一致です');
    const [tokHash,weightHash]=await Promise.all([sha256(new TextEncoder().encode(tokText)),sha256(bin)]);
    if(man.tokenizer_sha256!==tokHash)throw Error('トークナイザが学習済みモデルと一致しません');
    if(man.weights_sha256!==weightHash)throw Error('重みのSHA256が一致しません');
    // Save only after full validation; IndexedDB stores model bytes locally on the iPhone.
    await dbPut('manifest',man);await dbPut('tokenizer',tok);await dbPut('weights',bin);
    show('モデルを端末に保存したよ！','ok');await loadCurrentModel();
  } catch(error){show(String(error?.message||error),'error');}
  e.target.value='';
});
$('send').addEventListener('click',()=>{
  if(!loaded||busy)return;
  const question=$('text').value.trim();if(!question)return;
  output.textContent='';message.textContent='端末内で生成中。通信は使用しません。';setBusy(true);
  worker.postMessage({type:'generate',question,maxTokens:Number($('maxTokens').value),temperature:Number($('temperature').value),topK:Math.max(1,Number($('topK').value)),topP:0.95});
});
$('stop').addEventListener('click',()=>{if(worker)worker.terminate();worker=null;loaded=false;setBusy(false);show('生成を停止。モデルを再読み込み中…');loadCurrentModel().catch(e=>show(e.message,'error'));});
$('clear').addEventListener('click',async()=>{if(!confirm('端末に保存したモデルを削除しますか？'))return;await dbClear();if(worker)worker.terminate();worker=null;loaded=false;output.textContent='';show('モデルを削除しました。');setBusy(false);});
$('read').addEventListener('click',()=>{const text=output.textContent.trim();if(!text)return;speechSynthesis.cancel();const say=new SpeechSynthesisUtterance(text);say.lang='ja-JP';speechSynthesis.speak(say);});
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')) navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline cache unavailable',e));
loadCurrentModel().catch(e=>show(String(e),'error'));
