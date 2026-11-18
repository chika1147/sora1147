import {ByteLevelBPE} from './tokenizer.js';
import {ZeroAIModel,sample} from './model.js';
let model=null,tok=null;
function report(type,fields={}){self.postMessage({type,...fields});}
self.onmessage=async event=>{
  const data=event.data;
  try {
    if(data.type==='load') {
      model=new ZeroAIModel(data.manifest,data.weights);
      tok=new ByteLevelBPE(data.tokenizer);
      for(const [token,id] of Object.entries(data.manifest.special_token_ids)) {
        if(tok.special[token]!==id) throw Error('Tokenizer special ID mismatch: '+token);
      }
      report('ready',{step:data.manifest.checkpoint_step,vocab:model.cfg.vocab_size,context:model.cfg.block_size});
    } else if(data.type==='generate') {
      if(!model||!tok)throw Error('Model not loaded');
      const question=String(data.question).trim();
      if(!question)throw Error('Enter a Japanese prompt');
      const prompt=`<user>\n${question}\n<bot>\n`;
      let ids=tok.encode(prompt);
      const maxNew=Math.min(Math.max(1,Number(data.maxTokens)||64),model.cfg.block_size-1);
      if(ids.length+maxNew>model.cfg.block_size) {
        if(ids.length>=model.cfg.block_size-2) throw Error('Prompt is longer than 512 tokens');
        report('notice',{text:'Context size 512: generation will stop when full'});
      }
      const session=model.session();
      let logits=session.prefill(ids);
      const result=[];
      const stopIds=new Set([tok.special['<end>'],tok.special['<user>'],tok.special['<bot>'],tok.special['<eof>']]);
      for(let n=0;n<maxNew&&session.pos<model.cfg.block_size;n++) {
        const id=sample(logits,Number(data.temperature)||0.45,Number(data.topK)||20,Number(data.topP)||0.95);
        if(stopIds.has(id)) break;
        result.push(id);
        if(n%2===0||n===maxNew-1) report('progress',{output:tok.decode(result),tokens:result.length});
        logits=session.step(id);
        // Give browser the chance to deliver UI updates, while generation runs in the worker.
        if(n%4===3) await new Promise(resolve=>setTimeout(resolve,0));
      }
      report('done',{output:tok.decode(result),tokens:result.length});
    }
  } catch(e) {report('error',{error:String(e?.message||e)});}
};
