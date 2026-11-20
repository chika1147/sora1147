// Streaming UTF-8 aware sampling for ZeroAI ByteLevel BPE, entirely offline.
export function newUtf8State(){return {need:0,lo:128,hi:191};}
export function appendUtf8Bytes(state,bytes){
  let {need,lo,hi}=state;
  for(const b of bytes){
    if(need){
      if(b<lo||b>hi)return null;
      need--;lo=128;hi=191;continue;
    }
    if(b<=127)continue;
    if(b>=194&&b<=223){need=1;continue;}
    if(b===224){need=2;lo=160;hi=191;continue;}
    if(b>=225&&b<=236){need=2;continue;}
    if(b===237){need=2;lo=128;hi=159;continue;}
    if(b>=238&&b<=239){need=2;continue;}
    if(b===240){need=3;lo=144;hi=191;continue;}
    if(b>=241&&b<=243){need=3;continue;}
    if(b===244){need=3;lo=128;hi=143;continue;}
    return null;
  }
  return {need,lo,hi};
}
export function sampleUtf8Token(logits,tok,state,stopIds,temperature=0.7,topK=25,topP=0.95){
  if(!(temperature>0))throw Error('Temperature must be positive');
  const ordered=Array.from({length:logits.length},(_,i)=>i).sort((a,b)=>logits[b]-logits[a]);
  const candidates=[],target=Math.max(1,Math.min(logits.length,Math.trunc(topK)||25));
  for(const id of ordered){
    let next=null;
    if(tok.specialReverse.has(id)){
      if(stopIds.has(id)&&state.need===0)next=state;
    }else{
      const bytes=tok.tokenBytes(id);
      if(bytes)next=appendUtf8Bytes(state,bytes);
    }
    if(next){
      candidates.push({id,state:next});
      if(candidates.length>=target)break;
    }
  }
  if(!candidates.length)throw Error('UTF-8として生成できるトークンがありません');
  const best=logits[candidates[0].id]/temperature;
  const prob=candidates.map(c=>Math.exp(logits[c.id]/temperature-best));
  let total=prob.reduce((a,b)=>a+b,0);
  if(!(total>0))return candidates[0];
  let limit=prob.length,seen=0;
  for(let i=0;i<prob.length;i++){
    seen+=prob[i]/total;
    if(seen>=topP){limit=i+1;break;}
  }
  total=prob.slice(0,limit).reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<limit;i++){r-=prob[i];if(r<=0)return candidates[i];}
  return candidates[limit-1];
}
