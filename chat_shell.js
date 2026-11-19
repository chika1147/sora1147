/* ZeroAI chat interface: event-based bridge, device-only chat history. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const key='zeroai-chat-shell-v1';
let chats=[],active=null;
const requests=new Map();
try{
  const saved=JSON.parse(localStorage.getItem(key)||'{}');
  chats=Array.isArray(saved.chats)?saved.chats.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)):[];
  active=saved.active||null;
}catch(error){console.warn('Chat history could not be loaded:',error);}
function persist(){
  try{localStorage.setItem(key,JSON.stringify({chats,active}));}
  catch(error){console.warn('Chat history could not be saved:',error);}
}
function current(){return chats.find(c=>c.id===active)||null;}
function closeMenu(){document.querySelector('.zero-sidebar')?.classList.remove('open');}
function newChat(){
  const c={id:String(Date.now())+'-'+Math.random().toString(36).slice(2),title:'新しいチャット',messages:[]};
  chats.unshift(c);active=c.id;persist();render();
  $('text').value='';$('text').focus();closeMenu();
}
function appendMessage(chat,role,text){
  if(!chat)return;
  chat.messages.push({role,text:String(text)});
  if(role==='user'&&chat.title==='新しいチャット')chat.title=String(text).slice(0,45);
  persist();
}
function render(){
  const list=$('zeroHistory'),thread=$('zeroThread');
  list.replaceChildren();
  for(const c of chats){
    const item=document.createElement('div');item.className='zero-history-item';
    const b=document.createElement('button');b.type='button';
    b.textContent=c.title;b.title=c.title;b.className=c.id===active?'active':'';
    b.onclick=()=>{active=c.id;persist();render();closeMenu();};
    const del=document.createElement('button');del.className='zero-delete';del.type='button';
    del.title='このチャットを削除';del.setAttribute('aria-label',c.title+' を削除');del.textContent='×';
    del.onclick=()=>{chats=chats.filter(x=>x.id!==c.id);if(active===c.id)active=chats[0]?.id||null;persist();render();};
    item.append(b,del);list.append(item);
  }
  thread.replaceChildren();
  const c=current();
  if(!c||!c.messages.length){
    const welcome=document.createElement('div');welcome.id='zeroWelcome';
    welcome.innerHTML='<div class="zero-symbol">✳</div><h2>今日は何を話そうか？</h2><p>ZeroAIはあなたの端末で動く自作AIです。</p><div class="zeroExamples"><button data-q="こんにちは！あなたの名前は？">✦ 自己紹介して</button><button data-q="125 × 24 + 350">∑ 計算してみる</button><button data-q="東京はどこの国の首都ですか？">◇ 日本語で質問</button></div>';
    thread.append(welcome);
    welcome.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{$('text').value=b.dataset.q;$('text').focus();});
  }else{
    for(const m of c.messages){
      const d=document.createElement('div');d.className='zero-msg '+(m.role==='user'?'user':'assistant');
      d.textContent=m.text;thread.append(d);
    }
  }
  for(const [id,r] of requests){
    if(r.chatId!==active)continue;
    const d=document.createElement('div');d.className='zero-msg assistant zero-pending';d.dataset.requestId=String(id);
    d.textContent=r.progress||'考え中…';thread.append(d);
  }
  thread.scrollTop=thread.scrollHeight;
}
$('zeroNew').onclick=newChat;
$('zeroMenu').onclick=()=>document.querySelector('.zero-sidebar').classList.toggle('open');
$('zeroSettings').onclick=()=>{$('zeroModel').classList.toggle('open');closeMenu();};
$('zeroTopState').onclick=()=>$('zeroModel').classList.toggle('open');
$('zeroTopState').style.cursor='pointer';
$('zeroTopState').title='モデルの状態と設定を開く';
$('text').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
    e.preventDefault();$('send').click();
  }
});
/* The model/controller owns the send click. Chat UI never clears the input
   before the model has read it and never guesses completion from disabled. */
window.addEventListener('zeroai:question',event=>{
  const {id,question}=event.detail||{};
  if(typeof question!=='string'||id===undefined)return;
  if(!current())newChat();
  const c=current();
  appendMessage(c,'user',question);
  requests.set(id,{chatId:c.id,progress:''});
  $('text').value='';
  render();
});
window.addEventListener('zeroai:progress',event=>{
  const {id,text}=event.detail||{};
  const r=requests.get(id);if(!r)return;
  r.progress=String(text||'考え中…');
  if(active===r.chatId){
    const el=Array.from($('zeroThread').querySelectorAll('.zero-pending')).find(e=>e.dataset.requestId===String(id));
    if(el){el.textContent=r.progress;$('zeroThread').scrollTop=$('zeroThread').scrollHeight;}
  }
});
window.addEventListener('zeroai:answer',event=>{
  const {id,answer}=event.detail||{};
  const r=requests.get(id);if(!r)return;
  const c=chats.find(c=>c.id===r.chatId);
  appendMessage(c,'assistant',answer||'（空の回答）');
  requests.delete(id);
  if(active===r.chatId)render();
});
window.addEventListener('zeroai:error',event=>{
  const {id,error}=event.detail||{};
  const r=requests.get(id);if(!r)return;
  const c=chats.find(c=>c.id===r.chatId);
  appendMessage(c,'assistant','エラー：'+String(error||'回答を生成できませんでした'));
  requests.delete(id);
  if(active===r.chatId)render();
});
window.addEventListener('zeroai:status',event=>{
  const {text,state}=event.detail||{};
  const indicator=$('zeroTopState');
  indicator.textContent=state==='ok'?'● 準備完了':state==='error'?'● エラー':String(text||'モデル未登録').includes('未登録')?'● モデル未登録':'● '+String(text||'確認中').slice(0,14);
  indicator.title=String(text||'モデルの状態と設定を開く');
});
const settings=$('zeroInput').querySelector('.settings');
if(settings)$('zeroModel').append(settings);
for(const label of [...$('zeroInput').querySelectorAll('label[style]')])$('zeroModel').append(label);
for(const id of ['mathCheck','read','export']){
  const node=$(id);if(node)$('zeroModel').append(node);
}
const status=$('status');
if(status?.textContent){
  const text=status.textContent;
  $('zeroTopState').textContent=text.includes('未登録')?'● モデル未登録':'● ローカルAI';
  $('zeroTopState').title=text;
}
if(!current())newChat();else render();
})();