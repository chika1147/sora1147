// ZeroAI tokenizer: GPT-2-style ByteLevel BPE, no external library or API.
const PRETOKEN = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
const utf8 = new TextEncoder();
const decoder = new TextDecoder('utf-8');
function alphabet() {
  const values=[];
  for(let b=33;b<=126;b++) values.push(b);
  for(let b=161;b<=172;b++) values.push(b);
  for(let b=174;b<=255;b++) values.push(b);
  const chars=values.slice();
  let next=256;
  for(let b=0;b<256;b++) if(!values.includes(b)) {values.push(b);chars.push(next++);}
  const symbols=new Array(256);
  for(let i=0;i<values.length;i++) symbols[values[i]]=String.fromCodePoint(chars[i]);
  return symbols;
}
const alphabetSymbols=alphabet();
const alphabetBytes = new Map(alphabetSymbols.map((symbol,i)=>[symbol,i]));
const key=(a,b)=>a+'\0'+b;
export class ByteLevelBPE {
  constructor(data) {
    const m=data.model, pre=data.pre_tokenizer, dec=data.decoder;
    if(m?.type!=='BPE'||m.unk_token!==null||pre?.type!=='ByteLevel'||pre.add_prefix_space!==false||pre.use_regex===false||dec?.type!=='ByteLevel'||data.normalizer!==null)
      throw Error('Unsupported tokenizer: expected exact ZeroAI ByteLevel BPE format');
    if(!Array.isArray(m.merges)) throw Error('Tokenizer merges must be strings');
    this.vocab = m.vocab;
    this.reverse = [];
    for(const [s,id] of Object.entries(this.vocab)) this.reverse[id]=s;
    this.ranks = new Map();
    m.merges.forEach((item,i)=> {
      // Newer Hugging Face tokenizers serialize merges as [left,right] pairs;
      // older versions serialize them as strings such as 'a b'.
      let a,b;
      if(Array.isArray(item)&&item.length===2) [a,b]=item;
      else if(typeof item==='string') {
        const p=item.indexOf(' ');
        if(p<0) throw Error('Invalid BPE merge string');
        a=item.slice(0,p); b=item.slice(p+1);
      } else throw Error('Invalid BPE merge entry');
      this.ranks.set(key(a,b),i);
    });
    this.special = {};
    this.specialReverse = new Map();
    for(const item of (data.added_tokens||[])) if(item.special) {this.special[item.content]=item.id;this.specialReverse.set(item.id,item.content);}
    for(const tok of ['<user>','<bot>','<end>','<eof>']) if(!Number.isInteger(this.special[tok])) throw Error('Missing token '+tok);
    this.specialSorted = Object.keys(this.special).sort((a,b)=>b.length-a.length);
    this.byteCache=new Map();
  }
  encode(text) {
    const output=[];
    let at=0;
    while(at < text.length) {
      let where=text.length, special=null;
      for(const s of this.specialSorted) {const i=text.indexOf(s,at); if(i>=0&&i<where){where=i;special=s;}}
      this.encodeOrdinary(text.slice(at,where),output);
      if(special===null) break;
      output.push(this.special[special]);
      at=where+special.length;
    }
    return output;
  }
  encodeOrdinary(part,output) {
    if(!part) return;
    for(const found of part.matchAll(PRETOKEN)) {
      const piece=found[0];
      let symbols=Array.from(utf8.encode(piece),v=>alphabetSymbols[v]);
      while(symbols.length>1) {
        let best=-1, rank=Infinity;
        for(let i=0;i<symbols.length-1;i++) {
          const r=this.ranks.get(key(symbols[i],symbols[i+1]));
          if(r!==undefined&&r<rank){rank=r;best=i;}
        }
        if(best<0) break;
        const a=symbols[best], b=symbols[best+1];
        const updated=[];
        for(let i=0;i<symbols.length;) {
          if(i+1<symbols.length&&symbols[i]===a&&symbols[i+1]===b) {updated.push(a+b);i+=2;}
          else updated.push(symbols[i++]);
        }
        symbols=updated;
      }
      for(const symbol of symbols) {
        const id=this.vocab[symbol];
        if(id===undefined) throw Error('Tokenizer missing symbol');
        output.push(id);
      }
    }
  }
  tokenBytes(id){
    if(this.specialReverse.has(id))return null;
    if(this.byteCache.has(id))return this.byteCache.get(id);
    const symbol=this.reverse[id];
    if(typeof symbol!=='string')return null;
    const bytes=[];
    for(const ch of symbol){
      const byte=alphabetBytes.get(ch);
      if(byte===undefined)throw Error('Tokenizer byte symbol is invalid');
      bytes.push(byte);
    }
    const result=Uint8Array.from(bytes);
    this.byteCache.set(id,result);
    return result;
  }
  decodePartial(ids){
    const bytes=[];
    for(const id of ids){
      if(this.specialReverse.has(id))continue;
      const token=this.tokenBytes(id);
      if(!token)throw Error('Unknown token ID: '+id);
      for(const b of token)bytes.push(b);
    }
    // stream:true does not turn an unfinished final Japanese byte sequence
    // into U+FFFD during partial rendering. The next token may complete it.
    return new TextDecoder('utf-8').decode(Uint8Array.from(bytes),{stream:true});
  }
  decode(ids,{skipSpecial=true}={}) {
    const bytes=[];let result='';
    const flush=()=>{ if(bytes.length){result+=decoder.decode(Uint8Array.from(bytes));bytes.length=0;} };
    for(const id of ids) {
      if(this.specialReverse.has(id)) {flush();if(!skipSpecial)result+=this.specialReverse.get(id);continue;}
      const symbol=this.reverse[id];
      if(typeof symbol!=='string') throw Error('Unknown token id: '+id);
      for(const ch of symbol) {
        const b=alphabetBytes.get(ch);
        if(b===undefined) throw Error('Invalid byte alphabet');
        bytes.push(b);
      }
    }
    flush();return result;
  }
}
