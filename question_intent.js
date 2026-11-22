// ZeroAI general Japanese question/answer consistency scoring.
// A lightweight diagnostic/reranking aid, NOT a fixed-answer database and
// NOT a substitute for learned language understanding.
const WH=/どこの|どこ|何|なに|誰|だれ|いつ|なぜ|どうして|いくつ|何人|何個|どれ|どちら|どんな|どの|何時|どれくらい|いかに/;
const NO=/^(?:いいえ|いえ|ううん|違います|ちがいます)(?=[\s、。，．.!！]|$)/u;
const YES=/^(?:はい|ええ|うん|そうです)(?=[\s、。，．.!！]|$)/u;
const NEG=/(?:ではありません|ではない|じゃありません|じゃない|でない|ではなく|違います|ちがいます|異なります|ありません|ないです)/u;

export function identifyQuestion(question){
  const q=String(question||'').trim().replace(/[？?。!！\s]+$/gu,'');
  const wh=WH.test(q);
  const polar=!wh&&/(?:ですか|ますか|でしょうか|なの|だろうか|でしょう|か)$/u.test(q);
  const relation=q.match(/^(.{1,45}?)は(.{1,90})$/u);
  return {kind:wh?'wh':polar?'polar':'other',subject:relation?.[1]?.trim()||null,hasNegation:NEG.test(q)};
}
function statementAboutSameSubject(answer,subject){
  if(!subject)return null;
  const pattern=subject+'は';
  const index=answer.indexOf(pattern);
  if(index<0)return null;
  const rest=answer.slice(index+pattern.length).split(/[。.!！\n]/u,1)[0];
  if(!rest.trim())return null;
  // Report only an explicit affirmative/negative statement. Unclear text
  // isn't treated as a contradiction; no factual knowledge is inferred.
  const negative=NEG.test(rest);
  const positive=!negative&&/(?:です|だ|である|になります|となります|といえます)\s*$/u.test(rest.trim());
  return {negative,positive};
}
export function judgeAnswerConsistency(question,answer){
  const info=identifyQuestion(question),text=String(answer||'').trim();
  let score=0;
  const findings=[];
  const no=NO.test(text),yes=YES.test(text);
  if(info.kind==='wh'&&(no||yes)){
    score-=4.0;
    findings.push('情報を尋ねる質問に不要な「はい／いいえ」で答えています');
  }
  if(info.kind==='polar'&&(no||yes)&&!info.hasNegation){
    const statement=statementAboutSameSubject(text,info.subject);
    if(statement){
      if(no&&statement.positive){
        score-=5;
        findings.push('冒頭の否定と、同じ主語についての肯定文が矛盾しています');
      }else if(yes&&statement.negative){
        score-=5;
        findings.push('冒頭の肯定と、同じ主語についての否定文が矛盾しています');
      }
    }
  }
  return {score,questionKind:info.kind,subject:info.subject,findings,
    checked:info.kind!=='other',factChecked:false};
}
