/* ZeroAI chat shell: preserves the original model engine and IndexedDB model. */
(()=>{'use strict';
const $=id=>document.getElementById(id), key='zeroai-chat-shell-v1';
let chats=[],active=null,pending=null,previousOutput='',lastAnswer='';
try{const saved=JSON.parse(localStorage.getItem(key)||'{}');chats=Array.isArray(saved.chats)?saved.chats:[];active=saved.active||null;}catch{}
function persist(){try{localStorage.setItem(key,JSON.stringify({chats,active}));}catch{}}
function current(){return chats.find(c=>c.id===active);}
function newChat(){const c={id:String(Date.now())+Math.random().toString(36).slice(2),title:'新しいチャット',messages:[]};chats.unshift(c);active=c.id;pending=null;persist();render();$('text').value='';$('text').focus();closeMenu();}
function add(role,text){const c=current();if(!c)return;c.messages.push({role,text});if(role==='user'&&c.title==='新しいチャット')c.title=text.slice(0,35);persist();render();}
function render(){const list=$('zeroHistory'),thread=$('zeroThread');list.replaceChildren();for(const c of chats){const b=document.createElement('button');b.type='button';b.textContent=c.title;b.className=c.id===active?'active':'';b.onclick=()=>{active=c.id;pending=null;persist();render();closeMenu();};list.append(b);}
thread.replaceChildren();const c=current();if(!c||!c.messages.length){const welcome=document.createElement('div');welcome.id='zeroWelcome';welcome.innerHTML='<div class="zero-symbol">✳</div><h2>今日は何を話そうか？</h2><p>ZeroAIはあなたの端末で動く自作AIです。</p><div class="zeroExamples"><button data-q="こんにちは！あなたの名前は？">✦ 自己紹介して</button><button data-q="125 × 24 + 350">∑ 計算してみる</button><button data-q="東京はどこの国の首都ですか？">◇ 日本語で質問</button></div>';thread.append(welcome);welcome.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{$('text').value=b.dataset.q;$('text').focus();});}
else for(const m of c.messages){const d=document.createElement('div');d.className='zero-msg '+m.role;d.textContent=m.text;thread.append(d);}
thread.scrollTop=thread.scrollHeight;}
function closeMenu(){$('sidebar')?.classList.remove('open');document.querySelector('.zero-sidebar').classList.remove('open');}
$('zeroNew').onclick=newChat;
$('zeroMenu').onclick=()=>document.querySelector('.zero-sidebar').classList.toggle('open');
$('zeroSettings').onclick=()=>{$('zeroModel').classList.toggle('open');closeMenu();};
$('zeroTopState').onclick=()=>{$('zeroModel').classList.toggle('open');};
$('zeroTopState').style.cursor='pointer';
$('text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('send').click();}});
$('send').addEventListener('click',()=>{const question=$('text').value.trim();if(!question||$('send').disabled)return;if(!current())newChat();add('user',question);pending={id:active,question};previousOutput=$('output').textContent;lastAnswer='';$('text').value='';});
const output=$('output');const observer=new MutationObserver(()=>{if(!pending)return;const value=output.textContent.trim();if(!value||value===previousOutput||value==='（空の回答）')return;lastAnswer=value;});
observer.observe(output,{childList:true,characterData:true,subtree:true});
const send=$('send');new MutationObserver(()=>{if(!pending||send.disabled)return;const p=pending;pending=null;const answer=output.textContent.trim();if(answer&&answer!==previousOutput){const c=chats.find(x=>x.id===p.id);if(c){c.messages.push({role:'assistant',text:answer});persist();if(active===p.id)render();}}}).observe(send,{attributes:true,attributeFilter:['disabled']});
$('stop').addEventListener('click',()=>{pending=null;});
$('clear').addEventListener('click',()=>{pending=null;});
if(!current())newChat();else render();
})();