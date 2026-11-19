// ZeroAI v1.8 local arithmetic verifier: no eval(), no API, no pretrained model.
// Deliberately narrow parser; returns null rather than inventing an operation.
export function evaluateExpression(expression){
  let q=String(expression).normalize('NFKC').replaceAll('×','*').replaceAll('÷','/').replace(/\s+/g,'');
  if(!q||q.length>130||!/^[\d.+*/()\-]+$/.test(q))throw Error('未対応の数式');
  let t=q.match(/\d+(?:\.\d+)?|\.\d+|[()+*/\-]/g)||[];
  if(t.join('')!==q||t.length>70)throw Error('数式が複雑または不正です');
  let pos=0;
  const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const c=a%b;a=b;b=c;}return a||1n;};
  function fraction(a,b=1n){if(!b)throw Error('ゼロで割ることはできません');if(b<0n){a=-a;b=-b;}const d=gcd(a,b);return [a/d,b/d];}
  function fromDecimal(s){const a=s.split('.');const digits=(a[0]||'0')+(a[1]||'');return fraction(BigInt(digits),10n**BigInt(a[1]?.length||0));}
  function sum(a,b,sub=false){return fraction(a[0]*b[1]+(sub?-1n:1n)*b[0]*a[1],a[1]*b[1]);}
  function mul(a,b){return fraction(a[0]*b[0],a[1]*b[1]);}
  function div(a,b){return fraction(a[0]*b[1],a[1]*b[0]);}
  function atom(){let v=t[pos++];if(v==='+'||v==='-'){const x=atom();return v==='-'?[-x[0],x[1]]:x;}if(v==='('){const x=add();if(t[pos++]!==')')throw Error('括弧が閉じていません');return x;}
    if(!v||!/^\d*\.?\d+$/.test(v))throw Error('数値が不正です');return fromDecimal(v);
  }
  function multiply(){let a=atom();while(t[pos]==='*'||t[pos]==='/'){let op=t[pos++],b=atom();a=op==='*'?mul(a,b):div(a,b);}return a;}
  function add(){let a=multiply();while(t[pos]==='+'||t[pos]==='-'){let op=t[pos++],b=multiply();a=sum(a,b,op==='-');}return a;}
  const a=add();if(pos!==t.length)throw Error('余分な文字があります');
  if((a[0]<0n?-a[0]:a[0])>1000000000000000000n*a[1])throw Error('計算結果が大きすぎます');
  const sign=a[0]<0n?'-':'',n=a[0]<0n?-a[0]:a[0],whole=n/a[1],rem=n%a[1];
  if(rem===0n)return sign+whole.toString();
  let digits='',r=rem;
  for(let i=0;i<13;i++){r*=10n;digits+=(r/a[1]).toString();r%=a[1];if(r===0n)break;}
  // 12 decimal places, rounded half up, for repeating fractions.
  if(digits.length>12){let d=BigInt(digits.slice(0,12));if(digits[12]>='5')d++;
    const scale=10n**12n,carry=d/scale;d%=scale;
    return sign+(whole+carry).toString()+(d?' '+d.toString().padStart(12,'0').replace(/0+$/,''):'').replace(' ','.');
  }
  return sign+whole.toString()+'.'+digits.replace(/0+$/,'');
}
export function solveMath(question){
  const q=String(question).normalize('NFKC').trim();
  if(!q||q.length>300||/Python|プログラム|コード|関数|スクリプト|実装/i.test(q))return null;
  let s=q.replaceAll('×','*').replaceAll('÷','/').replaceAll('＋','+').replaceAll('−','-');
  // Only plain arithmetic expressions are accepted; natural text cannot
  // be interpreted as executable code.
  for(const [word,op] of [['かける','*'],['掛ける','*'],['たす','+'],['足す','+'],
                          ['ひく','-'],['引く','-'],['わる','/'],['割る','/']]){
    s=s.replaceAll(word,op);
  }
  s=s.replace(/^(?:計算してください|計算して|計算)\s*[:：]?\s*/,'')
     .replace(/\s*(?:の答え(?:を教えて|は)?|を計算してください|を計算して|は(?:いくつ|いくら|何)?(?:ですか)?)?[\s=?？。!！]*$/,'');
  if(/^[\d.\s+*/()\-]+$/.test(s)&&/[+*/\-]/.test(s)){
    try{const value=evaluateExpression(s);return {expression:s,value,answer:`${s.replaceAll('*','×').replaceAll('/','÷')} = ${value} です。`,kind:'arithmetic'};}
    catch(e){return {expression:s,value:'',answer:`計算できません：${String(e.message||e)}`,kind:'arithmetic_error'};}
  }
  const arithmeticPhrases=[[/((?:\d){1,9})\s*と\s*(\d{1,9})\s*を足/,'+'],
    [/(\d{1,9})\s*から\s*(\d{1,9})\s*を引/,'-'],
    [/(\d{1,9})\s*と\s*(\d{1,9})\s*を(?:掛|かけ)/,'*'],
    [/(\d{1,9})\s*を\s*(\d{1,9})\s*で(?:割|わ)/,'/']];
  for(const [pattern,op] of arithmeticPhrases){const m=q.match(pattern);if(!m)continue;
    const expr=`${m[1]} ${op} ${m[2]}`;try{const value=evaluateExpression(expr);
      return {expression:expr,value,answer:`${expr.replace('*','×').replace('/','÷')} = ${value} です。`,kind:'written_arithmetic'};}catch{return null;}
  }
  if(/余(?:っ|り|る)|不足|足りな|別々|追加で/.test(q))return null;
  let m=q.match(/(\d{1,9})\s*(個|枚|本|円).*?(\d{1,9})\s*人/);
  if(m&&!/\d+\s*(?:個|枚|本)\s*ずつ/.test(q)&&/分け|配る|配り|1人(?:あたり|ずつ)|一人(?:あたり|ずつ)/.test(q)){
    if(+m[3]===0)return null;
    const v=evaluateExpression(`${m[1]}/${m[3]}`);
    return {expression:`${m[1]} / ${m[3]}`,value:v,answer:`${m[1]} ÷ ${m[3]} = ${v}。1人あたり${v}${m[2]}です。`,kind:'sharing'};
  }
  m=q.match(/(\d{1,9})\s*(個|枚|本)\s*ずつ.*?(\d{1,9})\s*人/);
  if(m&&/全部|合計|合わせ|総数|何個|何枚|何本/.test(q)){
    const v=evaluateExpression(`${m[1]}*${m[3]}`);
    return {expression:`${m[1]} * ${m[3]}`,value:v,answer:`${m[1]} × ${m[3]} = ${v}${m[2]}です。`,kind:'multiplication_story'};
  }
  m=q.match(/(\d{1,9})\s*(個|枚|本).*?(\d{1,9})\s*(個|枚|本)/);
  if(m&&m[2]===m[4]){
    if(/食べ|使っ|なくな|減り|取り除|渡し/.test(q)&&BigInt(m[1])>=BigInt(m[3])){
      const v=evaluateExpression(`${m[1]}-${m[3]}`);
      return {expression:`${m[1]} - ${m[3]}`,value:v,answer:`${m[1]} − ${m[3]} = ${v}${m[2]}です。`,kind:'subtraction_story'};
    }
    if(/もらっ|増え|合わせ|追加|買い足/.test(q)){
      const v=evaluateExpression(`${m[1]}+${m[3]}`);
      return {expression:`${m[1]} + ${m[3]}`,value:v,answer:`${m[1]} + ${m[3]} = ${v}${m[2]}です。`,kind:'addition_story'};
    }
  }
  return null;
}


// Returns a verified result for unambiguous numeric expressions only.
// Unlike a language-model guess, this does not need the ZeroAI checkpoint.
export function solveDirectMath(question){
  const result=solveMath(question);
  return result&&(result.kind==='arithmetic'||result.kind==='arithmetic_error') ? result : null;
}

export function routeMath(question,{codeMode=false,wordProblems=true}={}){
  return solveDirectMath(question)||(!codeMode&&wordProblems?solveMath(question):null);
}
