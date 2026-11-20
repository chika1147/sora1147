// ZeroAI v1.8 conversation-history window (NOT a 10k native-attention model).
// Existing 512-position learned embeddings stay untouched.
// Allows retaining up to 10,000 token IDs of dialogue history, feeding recent
// complete turns within the selected attention capacity (512..10,000).
export const HISTORY_TOKEN_LIMIT=10000;

export function makeConversationPrompt(tok, history, question, blockSize, wantedOutput=64) {
  if(!tok||typeof tok.encode!=='function')throw Error('Tokenizer is required');
  if(!Number.isInteger(blockSize)||blockSize<32||blockSize>10000)throw Error('Invalid context capacity');
  const outputReserve=Math.min(160,Math.max(8,Math.trunc(Number(wantedOutput)||64)));
  const promptBudget=blockSize-outputReserve-1;
  const begin=tok.encode('<user>\n'), end=tok.encode('\n<bot>\n');
  if(begin.length+end.length+1>promptBudget)throw Error('No room for input tokens');
  const qIds=tok.encode(String(question||''));
  const maxQuestion=promptBudget-begin.length-end.length;
  // Never silently discard the beginning of a long document. Doing so
  // makes tests of memory/recall invalid and misleads users about 10k support.
  if(qIds.length>maxQuestion){
    throw new RangeError(
      '質問が長すぎます（'+qIds.length.toLocaleString('ja-JP')+
      ' tokens）。この設定で入力できるのは最大'+maxQuestion.toLocaleString('ja-JP')+
      ' tokensです。文章の先頭を切り捨てずに停止しました。文書を分割して送るか、推論文脈の上限を確認してください。'
    );
  }
  const questionTail=qIds;
  const truncatedQuestion=false;
  const promptTail=[...begin,...questionTail,...end];
  let room=promptBudget-promptTail.length;
  // Budget old messages by their exact tokenizer IDs, never by JS string length.
  const raw=Array.isArray(history)?history.slice(-800):[];
  const kept=[];
  let seenTokens=0;
  for(let i=raw.length-1;i>=0;i--){
    const m=raw[i];
    if(!m||(m.role!=='user'&&m.role!=='assistant'))continue;
    const value=String(m.text||'');
    const size=tok.encode(value).length;
    if(size>HISTORY_TOKEN_LIMIT-seenTokens)break;
    seenTokens+=size;kept.unshift({role:m.role,text:value});
  }
  // Only complete user+assistant turns are fed back into the model.
  // Incomplete turns cannot accidentally become assistant instructions.
  const pairs=[];
  for(let i=0;i<kept.length-1;i++){
    if(kept[i].role==='user'&&kept[i+1].role==='assistant'){
      pairs.push([kept[i].text,kept[i+1].text]);i++;
    }
  }
  const encoded=[];
  let keptTurns=0,usedTokens=0;
  for(let i=pairs.length-1;i>=0;i--){
    const [u,a]=pairs[i];
    const ids=tok.encode('<user>\n'+u+'\n<bot>\n'+a+'\n<end>\n');
    if(ids.length>room)break;
    encoded.unshift(ids);room-=ids.length;usedTokens+=ids.length;keptTurns++;
  }
  const ids=[...encoded.flat(),...promptTail];
  if(ids.length>promptBudget)throw Error('Prompt budget exceeded');
  return {ids,retainedHistoryTokens:seenTokens,usedHistoryTokens:usedTokens,
    keptTurns,truncatedQuestion,questionTokenCount:qIds.length,
    nativeContext:blockSize,storedHistoryLimit:HISTORY_TOKEN_LIMIT,
    promptTokenCount:ids.length,outputReserve};
}
