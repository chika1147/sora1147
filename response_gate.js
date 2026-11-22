// Independent final-response gate on the main UI thread.
// This is deliberately AFTER the Worker: stale workers and preliminary output
// cannot bypass it when the current app.js is loaded. It does not know facts.
import {judgeAnswerRelevance} from './question_intent.js';
import {checkGeneratedQuality} from './quality_guard.js';
import {routeMath} from './math_v18_fix.js';
export const UI_BUILD='QA5-20261122';
export function finalizeResponse(packet){
  if(!packet||packet.type!=='done'||packet.qualityWarning)return packet;
  const question=String(packet.question||'');
  const output=String(packet.output||'');
  let failure=null;
  if(packet.source==='local_calculation'){
    if(!routeMath(question,{codeMode:!!packet.codeMode,wordProblems:true})){
      failure={code:'unexpected_calculation',reason:'計算ではない質問に計算の回答が返されました'};
    }
  }else{
    const valid=checkGeneratedQuality(output);
    if(!valid.ok)failure={code:valid.code,reason:valid.reason};
    if(!failure){
      const relevance=judgeAnswerRelevance(question,output);
      if(relevance.severe)failure={code:'unrelated_answer',reason:relevance.findings.join('・')};
    }
  }
  if(!failure)return packet;
  return {...packet,rawOutput:packet.rawOutput??packet.output,
    qualityWarning:failure,
    output:'ZeroAIは質問と関係のない回答を生成したため、表示を止めました（'+failure.reason+'）。'+
      'これは学習済みモデルの回答精度の問題です。短い質問や512トークンで再試行できます。'};
}
