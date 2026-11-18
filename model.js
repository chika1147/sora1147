// Exact autoregressive ZeroAI GPT CPU inference (PyTorch tensor layout), with KV cache.
// Works in an isolated Web Worker; deliberately no backend or pretrained AI.
const SQRT2 = Math.SQRT2;
function erf(x) {
  // Abramowitz/Stegun 7.1.26; max abs error approximately 1.5e-7.
  const sign=x<0?-1:1;
  x=Math.abs(x);
  const t=1/(1+0.3275911*x);
  const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
  return sign*y;
}
function gelu(v) {return 0.5*v*(1+erf(v/SQRT2));}
export class ZeroAIModel {
  constructor(manifest,buffer) {
    if(manifest.format!=='zeroai-iphone-f32-v1'||manifest.dtype!=='float32-le')
      throw Error('Convert checkpoint to the ZeroAI iPhone FP32 model format');
    if(!ArrayBuffer.isView(buffer) && !(buffer instanceof ArrayBuffer)) throw Error('Invalid weight buffer');
    const bytes=buffer instanceof ArrayBuffer?buffer:buffer.buffer;
    const t=manifest.config;
    if(!t||t.n_embd%t.n_head||!t.vocab_size||!t.block_size||!t.n_layer) throw Error('Bad model config');
    if(bytes.byteLength%4||manifest.weight_float_count!==bytes.byteLength/4) throw Error('Incorrect weight size');
    this.manifest=manifest;
    this.w=new Float32Array(bytes);
    this.tensors=manifest.tensors;
    this.cfg=t;
    for(const [name,entry] of Object.entries(this.tensors)) {
      if(entry.offset<0||entry.count<=0||entry.offset+entry.count>this.w.length) throw Error('Invalid tensor '+name);
    }
    if(t.n_embd!==384||t.n_layer!==8||t.n_head!==6) console.warn('Different model architecture; using manifest');
  }
  tensor(name) {
    const t=this.tensors[name];
    if(!t) throw Error('Missing tensor '+name);
    return t;
  }
  matvec(weight,input,bias=null) {
    const W=this.tensor(weight), [rows,cols]=W.shape;
    if(input.length!==cols) throw Error(`Shape mismatch for ${weight}`);
    const out=new Float32Array(rows),data=this.w;
    const b=bias===null? -1:this.tensor(bias).offset;
    for(let r=0;r<rows;r++) {
      let sum=b<0?0:data[b+r],start=W.offset+r*cols;
      // This is a real matrix-vector multiply. Not a mock response generator.
      for(let c=0;c<cols;c++) sum+=data[start+c]*input[c];
      out[r]=sum;
    }
    return out;
  }
  norm(input,wName,bName) {
    const n=input.length,w=this.tensor(wName).offset,b=this.tensor(bName).offset;
    let mean=0;
    for(let i=0;i<n;i++)mean+=input[i];
    mean/=n;
    let variance=0;
    for(let i=0;i<n;i++) {const d=input[i]-mean;variance+=d*d;}
    const inv=1/Math.sqrt(variance/n+1e-5),out=new Float32Array(n);
    for(let i=0;i<n;i++)out[i]=(input[i]-mean)*inv*this.w[w+i]+this.w[b+i];
    return out;
  }
  session(){return new Session(this);}
}
class Session {
  constructor(model) {
    this.m=model; this.pos=0;
    const {n_embd,block_size,n_layer}=model.cfg;
    this.keys=Array.from({length:n_layer},()=>new Float32Array(block_size*n_embd));
    this.vals=Array.from({length:n_layer},()=>new Float32Array(block_size*n_embd));
  }
  step(token) {
    const m=this.m,c=m.cfg,dim=c.n_embd,nHeads=c.n_head,hDim=dim/nHeads,position=this.pos;
    if(position>=c.block_size) throw Error('Context full; begin a new message (max '+c.block_size+' tokens)');
    if(token<0||token>=c.vocab_size) throw Error('Invalid token ID');
    const e=m.tensor('wte.weight').offset+token*dim,p=m.tensor('wpe.weight').offset+position*dim;
    let x=new Float32Array(dim);
    for(let d=0;d<dim;d++) x[d]=m.w[e+d]+m.w[p+d];
    for(let layer=0;layer<c.n_layer;layer++) {
      const prefix=`blocks.${layer}.`;
      const ln1=m.norm(x,prefix+'ln1.weight',prefix+'ln1.bias');
      const qkv=m.matvec(prefix+'attn.qkv.weight',ln1,prefix+'attn.qkv.bias');
      const cacheK=this.keys[layer],cacheV=this.vals[layer],off=position*dim;
      for(let d=0;d<dim;d++){cacheK[off+d]=qkv[dim+d];cacheV[off+d]=qkv[2*dim+d];}
      const attention=new Float32Array(dim),scale=1/Math.sqrt(hDim);
      for(let h=0;h<nHeads;h++) {
        const head=h*hDim, scores=new Float32Array(position+1);
        let max=-Infinity;
        for(let t=0;t<=position;t++) {
          let s=0,base=t*dim+head;
          for(let d=0;d<hDim;d++)s+=qkv[head+d]*cacheK[base+d];
          scores[t]=s*scale;
          if(scores[t]>max)max=scores[t];
        }
        let z=0;
        for(let t=0;t<=position;t++) {scores[t]=Math.exp(scores[t]-max);z+=scores[t];}
        for(let t=0;t<=position;t++) {
          const a=scores[t]/z,base=t*dim+head;
          for(let d=0;d<hDim;d++)attention[head+d]+=a*cacheV[base+d];
        }
      }
      const proj=m.matvec(prefix+'attn.proj.weight',attention,prefix+'attn.proj.bias');
      for(let d=0;d<dim;d++)x[d]+=proj[d];
      const ln2=m.norm(x,prefix+'ln2.weight',prefix+'ln2.bias');
      const hidden=m.matvec(prefix+'mlp.0.weight',ln2,prefix+'mlp.0.bias');
      for(let i=0;i<hidden.length;i++)hidden[i]=gelu(hidden[i]);
      const h2=m.matvec(prefix+'mlp.2.weight',hidden,prefix+'mlp.2.bias');
      for(let d=0;d<dim;d++)x[d]+=h2[d];
    }
    this.pos++;
    return m.matvec('wte.weight',m.norm(x,'lnf.weight','lnf.bias'));
  }
  prefill(ids) {let logits=null;for(const id of ids)logits=this.step(id);return logits;}
  clone() {
    // Share one prompt prefill across multiple independently generated replies.
    const result=new Session(this.m);
    result.pos=this.pos;
    for(let i=0;i<this.keys.length;i++) {
      result.keys[i].set(this.keys[i]);
      result.vals[i].set(this.vals[i]);
    }
    return result;
  }
}
export function sample(logits,temperature=0.5,topK=20,topP=0.95) {
  if(temperature<=0)throw Error('Temperature must be positive');
  const ids=Array.from({length:logits.length},(_,i)=>i).sort((a,b)=>logits[b]-logits[a]);
  const options=ids.slice(0,Math.max(1,Math.min(topK||logits.length,logits.length)));
  const maximum=logits[options[0]]/temperature;
  const probabilities=options.map(i=>Math.exp(logits[i]/temperature-maximum));
  let z=probabilities.reduce((a,b)=>a+b,0);
  let limited=probabilities.length;
  let cumulative=0;
  for(let i=0;i<probabilities.length;i++) {
    cumulative+=probabilities[i]/z;
    if(cumulative>=topP){limited=i+1;break;}
  }
  z=probabilities.slice(0,limited).reduce((a,b)=>a+b,0);
  let draw=Math.random()*z;
  for(let i=0;i<limited;i++) {draw-=probabilities[i];if(draw<=0)return options[i];}
  return options[limited-1];
}
