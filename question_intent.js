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
// Compare the question's predicate, not just the same subject.
// For "犬は植物ですか？", "いいえ。犬は動物です。" is NOT a contradiction.
// This checks word-level consistency, never the truth of the facts.
function statementAboutSameSubject(answer,subject,predicate){
  if(!subject||!predicate)return null;
  const pattern=subject+'は';
  const index=answer.indexOf(pattern);
  if(index<0)return null;
  const rest=answer.slice(index+pattern.length).split(/[。.!！\n]/u,1)[0].trim();
  if(!rest.startsWith(predicate))return null;
  const tail=rest.slice(predicate.length).trim();
  const negative=/^(?:では(?:ありません|ない|なく)|じゃ(?:ありません|ない)|でない|でありません|でないです)/u.test(tail);
  const positive=!negative&&/^(?:です|だ|である|になります|となります)(?:\s|$)/u.test(tail);
  if(!negative&&!positive)return null;
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
    const q=String(question||'').trim().replace(/[？?。!！\s]+$/gu,'');
    const relation=q.match(/^(.{1,45}?)は(.{1,90}?)ですか$/u);
    const predicate=relation&&relation[1].trim()===info.subject?relation[2].trim():null;
    const statement=statementAboutSameSubject(text,info.subject,predicate);
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


// A generic relevance check: never insert a known answer or a factual lookup.
// Only ask whether the output appears to respond to the kind of question.
export function judgeAnswerRelevance(question,answer){
  const q=String(question||'').trim(),text=String(answer||'').trim();
  const info=identifyQuestion(q);
  const isMathQuestion=/(?:\d\s*[+\-−×÷*/]\s*\d|計算|算数|合計|割り算|掛け算|足し算|引き算|何倍)/u.test(q);
  const mathResponse=/(?:\d+(?:\.\d+)?\s*[+\-−×÷*/]\s*\d+|[+\-−×÷*/]\s*\d+\s*[＝=]\s*\d+|\d+\s*[＝=]\s*\d+)/u.test(text);
  const findings=[];
  let score=0,severe=false;
  if(!isMathQuestion&&mathResponse){
    severe=true;
    score-=10;
    findings.push('数字を計算していない質問に、無関係な数式で回答しています');
  }
  if(info.kind==='polar'&&!severe){
    const startsYesNo=YES.test(text)||NO.test(text);
    const subjectMentioned=!!info.subject&&text.includes(info.subject);
    const predicate=q.match(/は(.{2,50}?)(?:ですか|ますか|でしょうか|なの)[？?。\s]*$/u)?.[1];
    const predicateMentioned=!!predicate&&text.includes(predicate);
    if(!startsYesNo&&!subjectMentioned&&!predicateMentioned&&text.length>0){
      score-=1.8;
      findings.push('はい・いいえ、主語、質問内容のいずれも回答に見つかりません');
      // Conservative guard for obviously unrelated, sprawling enumerations.
      // Short answers, admissions of uncertainty, and code tasks are exempt.
      const listItems=text.split(/[、，,]/u).filter(x=>x.trim().length>0);
      const uncertainty=/(?:分かりません|わかりません|不明です|確認できません|判断できません|答えられません|確信がありません)/u.test(text);
      const codeTask=/(?:Python|コード|プログラム|関数|実装|スクリプト)/iu.test(q);
      if(!uncertainty&&!codeTask&&text.length>=24&&listItems.length>=4){
        score-=8.2;
        severe=true;
        findings.push('質問の話題に触れず、関連の確認できない言葉を長く列挙しています');
      }
    }
  }
  return {score,severe,findings,checked:true,factChecked:false};
}
