const API='https://m.stock.naver.com';
const DESKTOP='https://stock.naver.com';
const PROXY_BASE='https://stock-insight-proxy.mcraft-tiger-574.workers.dev';
const seed=[{name:'삼성전자',code:'005930'},{name:'삼성전자우',code:'005935'},{name:'SK하이닉스',code:'000660'},{name:'한미반도체',code:'042700'},{name:'두산에너빌리티',code:'034020'},{name:'두산',code:'000150'},{name:'현대차',code:'005380'},{name:'기아',code:'000270'},{name:'LG에너지솔루션',code:'373220'},{name:'삼성SDI',code:'006400'},{name:'NAVER',code:'035420'},{name:'카카오',code:'035720'},{name:'제주반도체',code:'080220'},{name:'대원전선',code:'006340'},{name:'대덕전자',code:'353200'}];
const $=id=>document.getElementById(id), blank='—';let current={...seed[0]},timer=null,seq=0;
function num(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='object')v=v.value??v.formattedValue??v.text??v.price??v.amount??v.closePrice;if(v===null||v===undefined)return null;let s=String(v).trim();if(!s||['-','N/A','자료없음','—'].includes(s))return null;const neg=/^\(.*\)$/.test(s);s=s.replace(/[(),]/g,'').replace(/%|원|배/g,'').trim();const n=Number(s);return Number.isFinite(n)?(neg?-n:n):null}
function fmt(v,u=''){const n=num(v);return n===null?blank:`${n.toLocaleString('ko-KR',{maximumFractionDigits:2})}${u}`}
function objects(root,out=[],seen=new Set()){if(!root||typeof root!=='object'||seen.has(root))return out;seen.add(root);if(Array.isArray(root)){root.forEach(x=>objects(x,out,seen))}else{out.push(root);Object.values(root).forEach(v=>{if(v&&typeof v==='object')objects(v,out,seen)})}return out}
async function getJson(url){const urls=[`${PROXY_BASE}?url=${encodeURIComponent(url)}`,url,`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`];let err;for(const u of urls){try{const r=await fetch(u,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw Error(`HTTP ${r.status}`);let t=await r.text();let d=JSON.parse(t);if(d?.error)throw Error(d.error);return d}catch(e){err=e}}throw Error(err?.message||'API 요청 실패')}
async function first(urls){let err;for(const u of urls){try{return await getJson(u)}catch(e){err=e}}throw err||Error('조회 실패')}
function keyValueRows(raw){const out={};for(const o of objects(raw)){for(const listName of ['totalInfos','infoList','infos','metrics']){const list=o[listName];if(!Array.isArray(list))continue;for(const x of list){if(!x||typeof x!=='object')continue;const keys=[x.code,x.key,x.name,x.title,x.label].filter(Boolean);const value=x.value??x.formattedValue??x.data??x.displayValue??x.text??null;for(const k of keys)out[String(k).trim()]=value;}}}return out}
function metric(raw, keys){const kv=keyValueRows(raw);for(const k of keys){if(kv[k]!==undefined&&kv[k]!==null&&kv[k]!=='')return kv[k]}const wanted=new Set(keys.map(x=>String(x).toLowerCase()));for(const o of objects(raw)){for(const [k,v] of Object.entries(o)){if(wanted.has(k.toLowerCase())&&v!==undefined&&v!==null&&v!=='')return v}}return null}
function metricPattern(raw, patterns){const candidates=[];for(const o of objects(raw)){for(const [k,v] of Object.entries(o)){if(!patterns.some(re=>re.test(k))||v===null||v===undefined||v==='')continue;const value=(typeof v==='object')?(v.value??v.formattedValue??v.text??v.displayValue??v.price??null):v;if(value!==null&&value!==undefined&&value!=='')candidates.push({key:k.toLowerCase(),value})}}candidates.sort((a,b)=>{const rank=x=>(/mean|average|avg|consensus|평균/.test(x.key)?0:1);return rank(a)-rank(b)});return candidates[0]?.value??null}
function findText(raw,keys){for(const o of objects(raw)){for(const k of keys){if(o[k]!==undefined&&o[k]!==null&&o[k]!==''&&typeof o[k]!=='object')return o[k]}}return null}
function capFormat(raw){if(raw===null||raw===undefined)return blank;if(typeof raw==='object')raw=raw.value??raw.formattedValue??raw.text??raw.amount;const s=String(raw??'').trim();if(!s)return blank;const tri=s.match(/([\d,.]+)\s*조/),eok=s.match(/([\d,.]+)\s*억/);if(tri||eok){const t=tri?Number(tri[1].replace(/,/g,'')):0,e=eok?Number(eok[1].replace(/,/g,'')):0;return `${t?`${t.toLocaleString('ko-KR',{maximumFractionDigits:2})}조`:''}${t&&e?' ':''}${e?`${e.toLocaleString('ko-KR',{maximumFractionDigits:2})}억`:''}`.trim()}const n=num(s);if(n===null)return blank;/* integration marketValue is formatted as 억원; numeric-only values are kept in the documented 억원 unit */return n>=10000?`${(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:2})}조`:`${n.toLocaleString('ko-KR',{maximumFractionDigits:2})}억`}
function extractBasic(basic,integration,priceData,consensus,code,name){const p=findText(basic,['closePrice','currentPrice','nowPrice','tradePrice'])??findText(priceData,['closePrice','currentPrice','nowPrice','tradePrice']);const change=findText(basic,['compareToPreviousClosePrice','changePrice','compareToPreviousPrice'])??findText(priceData,['compareToPreviousClosePrice','changePrice','compareToPreviousPrice']);const rate=findText(basic,['fluctuationsRatio','changeRate'])??findText(priceData,['fluctuationsRatio','changeRate']);const cap=metric(integration,['marketValue','marketCap','marketSum','marketCapitalization','시가총액']);const consensusSource={consensus, integration};const target=metric(consensusSource,['meanTargetPrice','targetPrice','targetPriceMean','averageTargetPrice','targetPriceAvg','priceTargetMean','targetPriceAverage','avgTargetPrice','meanTargetPriceValue','consensusTargetPrice','targetPriceMeanValue'])??metricPattern(consensusSource,[/mean.*target.*price/i,/target.*price.*mean/i,/average.*target.*price/i,/target.*price.*average/i,/targetprice/i,/price.*target/i]);const opinion=metric(consensusSource,['investmentOpinion','meanOpinion','opinion','investmentOpinionText','recommMean','meanInvestmentOpinion','investmentOpinionMean','consensusOpinion','recommendation','recommendationText','opinionMean'])??metricPattern(consensusSource,[/mean.*opinion/i,/opinion.*mean/i,/investment.*opinion/i,/recommend/i]);let changeText='시세 정보 없음';const c=num(change),r=num(rate);if(c!==null){changeText=`${c>0?'▲':c<0?'▼':'•'} ${c>0?'+':''}${c.toLocaleString('ko-KR')}${r!==null?` (${r>0?'+':''}${r}%)`:''}`}else if(r!==null)changeText=`${r>0?'▲ +':r<0?'▼ ':'• '}${r}%`;return{name:findText(basic,['stockName','itemName','name'])||name,code,price:fmt(p),change:changeText,per:fmt(metric(integration,['per','PER']),'배'),pbr:fmt(metric(integration,['pbr','PBR']),'배'),eps:fmt(metric(integration,['eps','EPS']),'원'),cap:capFormat(cap),roe:blank,debt:blank,foreignFloat:fmt(metric(integration,['foreignRate','foreignOwnershipRate','foreignRatio','foreignExhaustionRate','외국인소진율']),'%'),target:fmt(target,'원'),opinion:opinion??blank,annualMultiple:blank,ttmMultiple:blank,estTtmMultiple:fmt(metric(integration,['cnsPer','estTtmMultiple','estimatedPER']),'배')}}
function capToEok(raw){if(raw===null||raw===undefined)return null;if(typeof raw==='object')raw=raw.value??raw.formattedValue??raw.text??raw.amount;const s=String(raw??'').trim();if(!s)return null;const tri=s.match(/([\d,.]+)\s*조/),eok=s.match(/([\d,.]+)\s*억/);if(tri||eok){const t=tri?Number(tri[1].replace(/,/g,'')):0,e=eok?Number(eok[1].replace(/,/g,'')):0;return t*10000+e}const n=num(s);if(n===null)return null;if(/원/.test(s)&&!/억|조/.test(s))return n/100000000;return n}
function financeInfo(raw){if(raw?.financeInfo?.rowList&&raw?.financeInfo?.trTitleList)return raw.financeInfo;for(const o of objects(raw)){if(o.financeInfo?.rowList&&o.financeInfo?.trTitleList)return o.financeInfo;if(Array.isArray(o.rowList)&&Array.isArray(o.trTitleList))return o}return null}
function parseFinance(raw){const fi=financeInfo(raw);if(!fi)return{quarters:[],rows:[],headers:[]};const headers=(fi.trTitleList||[]).map(h=>{const key=typeof h==='string'?h:String(h.key??h.period??h.title??'');const label=typeof h==='string'?h:String(h.title??h.period??h.key??'');return{key,label,est:typeof h==='object'&&(String(h.isConsensus??h.isEstimate??'').toUpperCase()==='Y'||/\(E\)|예상|추정/i.test(label))||/\(E\)|예상|추정/i.test(label)}});const rows=(fi.rowList||[]).map(row=>({label:String(row.title??row.name??row.label??row.itemName??'').replace(/\s/g,''),raw:row,columns:row.columns||row.values||row.data||{}}));const cellValue=(row,h)=>{const raw=row?.raw||row;const cols=row?.columns||raw?.columns||raw?.values||raw?.data||{};const candidates=[h.key,h.label,h.key.replace(/\D/g,''),h.label.replace(/[^0-9]/g,'')].filter(Boolean);if(Array.isArray(cols)){const idx=headers.indexOf(h);if(idx>=0&&cols[idx]!==undefined){const c=cols[idx];return num(c?.value??c?.formattedValue??c?.text??c?.data??c)}}else if(cols&&typeof cols==='object'){for(const k of candidates){if(cols[k]!==undefined){const c=cols[k];return num(c?.value??c?.formattedValue??c?.text??c?.data??c)}}for(const [k,c] of Object.entries(cols)){if(candidates.some(x=>x&&String(k).includes(x))){const v=num(c?.value??c?.formattedValue??c?.text??c?.data??c);if(v!==null)return v}}}if(Array.isArray(raw?.values)){const idx=headers.indexOf(h);if(idx>=0)return num(raw.values[idx]?.value??raw.values[idx])}if(Array.isArray(raw?.data)){const idx=headers.indexOf(h);if(idx>=0)return num(raw.data[idx]?.value??raw.data[idx])}return null};const get=(patterns,h)=>{const row=rows.find(x=>patterns.some(re=>re.test(x.label)));return row?cellValue(row,h):null};const quarters=headers.map(h=>{const profit=get([/^영업이익(?:\([^)]*\))?$/,/^영업이익$/],h),sales=get([/^매출액(?:\(억원\))?$/,/^매출액.*$/],h),rawMargin=get([/영업이익률/],h);let margin=rawMargin;if(margin===null&&profit!==null&&sales!==null&&sales!==0)margin=profit/sales*100;return{label:h.label+(h.est&&!/\(E\)/i.test(h.label)?'(E)':''),key:h.key,est:h.est,profit,margin,eps:get([/^EPS(?:\(원\))?$/,/주당순이익/],h),net:get([/^당기순이익(?:\(억원\))?$/,/지배주주순이익/,/^순이익/],h),sales,roe:get([/^ROE(?:\(%\))?$/,/자기자본이익률/],h),debt:get([/^부채비율(?:\(%\))?$/],h)}});return{quarters,rows,headers}}
function latestActual(quarters){return (quarters||[]).filter(q=>!q.est&&!/\(E\)/i.test(q.label)&&/^20\d{2}[.\-/]/.test(q.label)).sort((a,b)=>String(a.key).localeCompare(String(b.key)))}
function annualOperatingProfit(raw){
  // 연간 엔드포인트에서만 확정된 과거 회계연도 영업이익을 선택한다.
  // 분기 자료나 integration의 숫자를 연간 실적으로 잘못 사용하는 fallback은 하지 않는다.
  const currentYear=new Date().getFullYear();
  const parsed=parseFinance(raw);
  const getYear=x=>{const m=String(x.key||x.label||'').match(/20\d{2}/);return m?Number(m[0]):null};
  const actual=parsed.quarters
    .map(q=>({...q,year:getYear(q)}))
    .filter(q=>q.year!==null&&q.year<currentYear&&!q.est&&!/\(E\)|예상|추정/i.test(q.label)&&q.profit!==null)
    .sort((a,b)=>a.year-b.year);
  if(actual.length)return actual[actual.length-1].profit;
  // 재무 API 응답의 필드명이 달라 parseFinance가 읽지 못하는 경우를 위한 직접 해석.
  for(const o of objects(raw)){
    const headers=o.trTitleList||o.titleList||o.headers||o.periodList;
    const rowList=o.rowList||o.rows||o.financialRows;
    if(!Array.isArray(headers)||!Array.isArray(rowList))continue;
    const row=rowList.find(r=>{
      const label=String(r.title??r.name??r.label??r.itemName??r.itemTitle??'').replace(/\s/g,'');
      return /^영업이익(?:\(억원\))?$/.test(label)||/^영업이익\(단위:억원\)$/.test(label);
    });
    if(!row)continue;
    const cols=row.columns||row.values||row.data||row.columnList||row.valueList||{};
    const entries=headers.map((h,i)=>{
      const key=String(typeof h==='string'?h:(h.key??h.period??h.title??h.name??''));
      const label=String(typeof h==='string'?h:(h.title??h.period??h.key??h.name??''));
      const yearMatch=(label+' '+key).match(/20\d{2}/);
      const year=yearMatch?Number(yearMatch[0]):null;
      const flag=String(typeof h==='object'?(h.isConsensus??h.isEstimate??h.estimate??h.isForecast??''):'').toLowerCase();
      const est=['y','yes','true','1'].includes(flag)||/\(E\)|예상|추정|컨센서스/i.test(label)||/\(E\)|예상|추정|컨센서스/i.test(key);
      let cell;
      if(Array.isArray(cols))cell=cols[i];
      else if(cols&&typeof cols==='object'){
        const keys=[key,label,key.replace(/\D/g,''),label.replace(/[^0-9]/g,''),String(h?.key??'')].filter(Boolean);
        for(const k of keys){if(cols[k]!==undefined){cell=cols[k];break}}
        if(cell===undefined){const vals=Object.values(cols);if(vals.length===headers.length)cell=vals[i]}
      }
      if(cell===undefined&&Array.isArray(row.values))cell=row.values[i];
      if(cell===undefined&&Array.isArray(row.data))cell=row.data[i];
      const v=num(cell?.value??cell?.formattedValue??cell?.text??cell?.displayValue??cell?.data??cell?.amount??cell);
      return{year,est,v};
    }).filter(x=>x.year!==null&&x.year<currentYear&&!x.est&&x.v!==null);
    entries.sort((a,b)=>a.year-b.year);
    if(entries.length)return entries[entries.length-1].v;
  }
  return null;
}
function getFinanceMetric(parsed,patterns){const actual=parsed.quarters.filter(q=>!q.est&&!/\(E\)/i.test(q.label));for(let i=actual.length-1;i>=0;i--){for(const re of patterns){if(re.test('')){} }const q=actual[i];if(q.roe!==null||q.debt!==null)return q}return null}
function flowRecords(raw){
  const dateKeys=['tradeDate','date','localDate','localTradedAt','bizdate','tradingDate','bizDate','trdDt','dt','basDt','yyyymmdd','tradeDateYmd','dateString','tradedAt','dealDate','stckBsopDate','ymd'];
  const looksLikeDate=v=>/^\d{4}[-./]?\d{2}[-./]?\d{2}/.test(String(v??''))||/^\d{8}$/.test(String(v??''));
  const found=[];
  const investor=/foreign|foreigner|frgnr|frgn|외국인|organization|organ|institution|orgn|기관/i;
  const buy=/pure.?buy|net.?buy|ntby|순매수|순매매|순매입|매수금액|매매순/i;
  const hasDate=o=>dateKeys.some(k=>o&&o[k]!==undefined&&looksLikeDate(o[k]));
  for(const o of objects(raw)){
    for(const [key,val] of Object.entries(o)){
      if(!Array.isArray(val)||!val.length)continue;
      const hits=val.filter(x=>x&&typeof x==='object'&&(hasDate(x)||Object.keys(x).some(k=>(investor.test(k)&&buy.test(k))||(buy.test(k)&&investor.test(k)))));
      if(hits.length)found.push(...hits);
    }
    if(hasDate(o))found.push(o);
  }
  const unique=[],seen=new Set();
  for(const r of found){
    const date=String(dateKeys.map(k=>r[k]??'').find(Boolean)||'').replace(/\D/g,'');
    if(!date)continue;
    const id=date+'|'+JSON.stringify(r);
    if(!seen.has(id)){seen.add(id);unique.push(r)}
  }
  const dateOf=r=>String(dateKeys.map(k=>r[k]??'').find(Boolean)||'').replace(/\D/g,'');
  unique.sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));
  // 중복된 응답 행이 있어도 하루를 한 번만 집계한다.
  const byDay=new Map();
  for(const r of unique){const d=dateOf(r);if(!byDay.has(d))byDay.set(d,r)}
  return [...byDay.values()].slice(0,40);
}
function flowSummary(raw,type){
  const rows=flowRecords(raw);
  const aliases=type==='foreign'?
    ['foreignPureBuy','foreignerPureBuy','foreignNetBuy','foreignerNetBuy','foreignPureBuyQuant','foreignerPureBuyQuant','foreignNetBuyVolume','foreignerNetBuyVolume','foreignerNetBuyQty','foreignNetBuyQty','foreignerBuySell','foreignNetVolume','foreignPureBuyAmount','foreignerPureBuyAmount','frgnrNtbyQty','frgnNtbyQty','frgnrNetBuyQty','frgnrNetBuy','frgnrPureBuyQty','frgnNtbyAmt','foreignerNetBuyAmount','foreignNetBuyAmount','foreignNetBuyCount','foreignNetBuyValue','frgnrNetBuyAmt','foreignNetBuyAmt','foreignNetBuyValue']:
    ['organizationPureBuy','organPureBuy','institutionPureBuy','organNetBuy','institutionNetBuy','organizationNetBuy','organPureBuyQuant','institutionPureBuyQuant','organNetBuyVolume','institutionNetBuyVolume','organNetBuyQty','institutionNetBuyQty','organBuySell','organizationPureBuyAmount','orgnNtbyQty','orgnNetBuyQty','orgnNetBuy','orgnPureBuyQty','orgnNtbyAmt','organizationNetBuyAmount','institutionNetBuyAmount','organNetBuyAmount','orgnNetBuyAmt','institutionNetBuyValue','organizationNetBuyValue'];
  const investorRe=type==='foreign'?/(foreign|foreigner|frgnr|frgn|외국인)/i:/(organization|organ|institution|orgn|기관)/i;
  const buyRe=/(pure.?buy|net.?buy|ntby|순매수|순매매|순매입|매수금액|매매순)/i;
  const pick=r=>{
    for(const k of aliases){if(r[k]!==undefined&&r[k]!==null){const n=num(r[k]);if(n!==null)return n}}
    const all=[];
    const walk=(obj,path='',depth=0)=>{
      if(!obj||typeof obj!=='object'||depth>3)return;
      for(const [k,v] of Object.entries(obj)){
        const key=String(k),combined=path+' '+key;
        if(v!==null&&v!==undefined&&typeof v!=='object'&&investorRe.test(combined)&&buyRe.test(combined)){
          const n=num(v);if(n!==null)all.push({key:combined,value:n});
        }else if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,combined,depth+1);
      }
    };
    walk(r);
    if(all.length)return all[0].value;
    // 일부 응답은 투자자별 값이 외국인/기관 객체 아래에 netBuy 또는 순매수로 들어온다.
    for(const [k,v] of Object.entries(r)){
      if(!investorRe.test(k)||!v||typeof v!=='object')continue;
      for(const [kk,vv] of Object.entries(v))if(buyRe.test(kk)){const n=num(vv);if(n!==null)return n}
    }
    return null;
  };
  const values=rows.map(r=>({row:r,value:pick(r)})).filter(x=>x.value!==null).slice(0,40);
  if(!values.length)return{count:null,streak:'—'};
  const positives=values.filter(x=>x.value>0).length;
  const runs=[];let run=0;
  for(const x of values){if(x.value>0)run++;else{if(run>1)runs.push(run);run=0}}
  if(run>1)runs.push(run);
  return{count:positives,streak:runs.length?runs.slice(0,3).join('-'):'0'};
}
async function firstUsefulFlow(urls,type){let last=null;for(const url of urls){try{const data=await getJson(url);last=data;if(flowSummary(data,type).count!==null)return data}catch(e){}}if(last!==null)return last;throw Error('수급 데이터 조회 실패')}

function renderChart(qs){
  const chart=$('chart'),labels=$('labels');qs=(qs||[]).slice(-6);
  if(!qs.length||qs.every(q=>q.profit===null)){chart.innerHTML='<div class="chart-empty">분기 영업이익 데이터를 확인할 수 없습니다.</div>';labels.innerHTML='';return}
  const vals=qs.map(v=>v.profit).filter(v=>v!==null),maxP=Math.max(0,...vals),maxN=Math.max(0,...vals.map(v=>-v));
  const W=900,top=64,bottom=258,h=bottom-top;
  const zero=maxP&&maxN?top+h*maxP/(maxP+maxN):maxP?bottom:top;
  const y=v=>v>=0?zero-(maxP?v/maxP*(zero-top):0):zero+(maxN?-v/maxN*(bottom-zero):0);
  const cell=W/qs.length;
  const bars=qs.map((q,i)=>{
    const x=(i+.5)*cell,v=q.profit;
    if(v===null)return`<text x="${x}" y="160" text-anchor="middle" font-size="14" fill="currentColor">자료 없음</text>`;
    const yy=y(v),bh=Math.max(3,Math.abs(zero-yy)),by=v<0?zero:yy;
    const amount=Math.abs(v)>=10000?`${(v/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})}조`:`${v.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`;
    const pct=q.margin===null?'(—)':`(${q.margin.toLocaleString('ko-KR',{maximumFractionDigits:1})}%)`;
    let amountY,marginY;
    if(v>=0){amountY=Math.max(24,by-33);marginY=Math.max(44,by-13)}
    else{amountY=Math.min(294,by+bh+22);marginY=Math.min(322,by+bh+43)}
    return`<g><rect x="${x-34}" y="${by}" width="68" height="${bh}" rx="4" fill="${v<0?'#3979d8':'#df5967'}" opacity="${/\(E\)/i.test(q.label)?'.75':'1'}"/><text x="${x}" y="${amountY}" text-anchor="middle" font-size="15" textLength="${Math.min(cell-8,132)}" lengthAdjust="spacingAndGlyphs" font-weight="750" fill="currentColor">${amount}</text><text x="${x}" y="${marginY}" text-anchor="middle" font-size="13" textLength="${Math.min(cell-10,126)}" lengthAdjust="spacingAndGlyphs" font-weight="650" fill="#929baa">${pct}</text></g>`;
  }).join('');
  chart.innerHTML=`<svg class="profit-svg" viewBox="0 0 ${W} 340" preserveAspectRatio="none" role="img"><line x1="0" y1="${zero}" x2="${W}" y2="${zero}" stroke="#929baa" stroke-dasharray="4 4"/>${bars}</svg>`;
  labels.innerHTML=qs.map(q=>`<span>${escapeHtml(q.label||'—')}</span>`).join('');
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(s){current={...current,...s};$('name').textContent=s.name||'종목명';$('code').textContent=s.code||'';$('price').childNodes[0].textContent=(s.price||blank)+' ';$('change').textContent=s.change||'시세 정보 없음';for(const k of ['per','pbr','eps','cap','annualOp','ttmOp','ttmNet','roe','debt','foreignFloat','annualMultiple','ttmMultiple','estTtmMultiple','target','opinion'])if($(k))$(k).textContent=s[k]||blank;$('epsRows').innerHTML=(s.epsRows||[]).map(r=>`<div>${escapeHtml(r[0])}<b>${escapeHtml(r[1])}</b></div>`).join('')||'<div>분기 EPS 자료 없음</div>';const ch=s.change||'';$('change').style.color=/▲|\+/.test(ch)?'#df5967':/▼/.test(ch)?'#3979d8':'';$('price').style.color=$('change').style.color||'var(--text)';renderChart(s.quarters||[])}
function normalize(item){const code=String(item.code||item.itemCode||item.stockCode||item.reutersCode||'').replace(/\D/g,'');return code?{name:item.name||item.stockName||item.itemName||code,code:code.padStart(6,'0')}:null}
async function search(q){if(/^\d{6}$/.test(q))return[{name:seed.find(x=>x.code===q)?.name||q,code:q}];const d=await first([`${API}/front-api/search/autoComplete?query=${encodeURIComponent(q)}&target=stock,index,marketindicator,coin,ipo`]);const a=d?.result?.items||d?.items||d?.result||[];return(Array.isArray(a)?a:[]).map(normalize).filter(Boolean).slice(0,12)}
function showResults(items,q,msg=''){const box=$('results');box.hidden=!q;if(msg){box.innerHTML=`<div class="result">${escapeHtml(msg)}</div>`;return}if(!items.length){box.innerHTML='<div class="result">검색 결과가 없습니다.</div>';return}box.innerHTML=items.map(x=>`<button class="result" data-code="${x.code}" data-name="${escapeHtml(x.name)}">${escapeHtml(x.name)}<small>${x.code}</small> ›</button>`).join('');box.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>load(b.dataset.code,b.dataset.name))}
async function load(code,name=''){const id=++seq,known=seed.find(x=>x.code===code);current={code,name:name||known?.name||code};$('name').textContent=current.name;$('code').textContent=code;$('change').textContent='데이터 조회 중…';$('status').textContent='네이버 증권 데이터 조회 중…';$('query').value=current.name;$('results').hidden=true;$('chart').innerHTML='<div class="chart-empty">분기 재무 데이터 조회 중…</div>';try{const results=await Promise.allSettled([
first([`${API}/api/stock/${code}/basic`]),
first([`${API}/api/stock/${code}/integration`]),
first([`${API}/api/stock/${code}/finance/quarter`]),
first([`${API}/api/stock/${code}/finance/annual`]),
first([`${API}/api/stock/${code}/price?pageSize=1&page=1`]),
first([`${DESKTOP}/api/domestic/detail/${code}/consensus`]),
firstUsefulFlow([`${DESKTOP}/api/domestic/detail/${code}/trend?tradeType=KRX&startIdx=0&pageSize=40`,`${API}/front-api/stock/domestic/trend?code=${code}&tradeType=KRX`,`${API}/front-api/stock/domestic/trend?code=${code}`],'foreign'),
firstUsefulFlow([`${DESKTOP}/api/domestic/detail/${code}/trend?tradeType=NXT&startIdx=0&pageSize=40`,`${API}/front-api/stock/domestic/trend?code=${code}&tradeType=NXT`,`${API}/front-api/stock/domestic/trend?code=${code}`],'foreign')
]);if(id!==seq)return;const val=i=>results[i].status==='fulfilled'?results[i].value:null;const basic=val(0),integration=val(1),quarter=val(2),annual=val(3),priceRaw=val(4),consensus=val(5),flowKr=val(6),flowNx=val(7);const priceData=Array.isArray(priceRaw)?priceRaw[0]||{}:priceRaw||{};if(!basic&&!integration&&!priceData)throw Error('네이버 증권 API 응답을 받지 못했습니다.');const b=extractBasic(basic||{},integration||{},priceData,consensus||{},code,current.name);const q=parseFinance(quarter),a=parseFinance(annual),iq=parseFinance(integration);const allQ=q.quarters.length?q.quarters:iq.quarters;const actualQ=latestActual(allQ);const annualActual=latestActual(a.quarters);const annualOp=annualOperatingProfit(annual);if(annualOp!==null)b.annualOp=`${annualOp.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`;const last4=actualQ.slice(-4);if(last4.length===4&&last4.every(x=>x.profit!==null)){const sum=last4.reduce((s,x)=>s+x.profit,0);b.ttmOp=`${sum.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`}if(last4.length===4&&last4.every(x=>x.net!==null)){const sum=last4.reduce((s,x)=>s+x.net,0);const opSum=last4.every(x=>x.profit!==null)?last4.reduce((s,x)=>s+x.profit,0):null;b.ttmNet=`${sum.toLocaleString('ko-KR',{maximumFractionDigits:1})}억${opSum!==null&&opSum!==0?` (${(sum/opSum*100).toLocaleString('ko-KR',{maximumFractionDigits:1})}%)`:''}`}const latest=actualQ[actualQ.length-1];if(latest){if(latest.roe!==null)b.roe=fmt(latest.roe,'%');if(latest.debt!==null)b.debt=fmt(latest.debt,'%')}if(b.roe===blank||b.debt===blank){const aq=annualActual[annualActual.length-1];if(aq){if(b.roe===blank&&aq.roe!==null)b.roe=fmt(aq.roe,'%');if(b.debt===blank&&aq.debt!==null)b.debt=fmt(aq.debt,'%')}}const marketCapEok=capToEok(metric(integration||{},['marketValue','marketCap','marketSum','marketCapitalization','시가총액']));const annualOpValue=annualOp!==null?annualOp:null;const ttmOpValue=last4.length===4&&last4.every(x=>x.profit!==null)?last4.reduce((s,x)=>s+x.profit,0):null;const expected4=allQ.filter(x=>x.profit!==null).slice(-4);const estTtmOpValue=expected4.length===4?expected4.reduce((s,x)=>s+x.profit,0):null;if(marketCapEok!==null&&annualOpValue!==null&&annualOpValue!==0)b.annualMultiple=fmt(marketCapEok/annualOpValue,'배');if(marketCapEok!==null&&ttmOpValue!==null&&ttmOpValue!==0)b.ttmMultiple=fmt(marketCapEok/ttmOpValue,'배');if(marketCapEok!==null&&estTtmOpValue!==null&&estTtmOpValue!==0)b.estTtmMultiple=fmt(marketCapEok/estTtmOpValue,'배');const displayQ=allQ.filter(x=>x.profit!==null||x.eps!==null).slice(-6);b.quarters=displayQ;b.epsRows=allQ.slice(-6).map(x=>[x.label,x.eps===null?blank:x.eps.toLocaleString('ko-KR',{maximumFractionDigits:1})]);const flows=[['fKr',flowKr,'foreign'],['fNx',flowNx,'foreign'],['iKr',flowKr,'institution'],['iNx',flowNx,'institution']];for(const [prefix,raw,type] of flows){const f=flowSummary(raw,type);const count=$(prefix+'Count'),streak=$(prefix+'Streak');if(count){count.textContent=f.count===null?'자료 없음':`${f.count}/40일`;count.style.color=f.count!==null&&f.count>10?'#df5967':'';count.style.fontWeight=f.count!==null&&f.count>10?'800':''}if(streak)streak.textContent=f.streak}const statusNames=['기본정보','주요지표','분기재무','연간재무','가격정보','컨센서스','KRX수급','NXT수급'];$('status').textContent=results.map((r,i)=>`${statusNames[i]} ${r.status==='fulfilled'?'OK':'실패'}`).join(' · ');render(b)}catch(e){if(id!==seq)return;$('status').textContent=`조회 오류: ${e.message}`;render({name:current.name,code,change:`조회 실패: ${e.message}`,quarters:[]})}}
$('searchBtn').onclick=async()=>{const q=$('query').value.trim();if(!q)return;try{const r=await search(q);if(r.length===1)load(r[0].code,r[0].name);else showResults(r,q)}catch{const local=seed.filter(x=>x.name.toLowerCase().includes(q.toLowerCase())||x.code.startsWith(q));if(local.length===1)load(local[0].code,local[0].name);else showResults(local,q,'검색 API 오류. 6자리 종목코드로 검색해 주세요.')}};$('query').addEventListener('keydown',e=>{if(e.key==='Enter')$('searchBtn').click()});$('query').addEventListener('input',()=>{const q=$('query').value.trim();$('clear').hidden=!q;clearTimeout(timer);if(!q){$('results').hidden=true;return}timer=setTimeout(async()=>{try{showResults(await search(q),q)}catch{showResults(seed.filter(x=>x.name.toLowerCase().includes(q.toLowerCase())||x.code.startsWith(q)),q)}},350)});$('clear').onclick=()=>{$('query').value='';$('results').hidden=true;$('clear').hidden=true};$('theme').onclick=()=>document.body.classList.toggle('dark');$('refresh').onclick=()=>load(current.code,current.name);$('fav').onclick=()=>$('fav').textContent=$('fav').textContent==='☆'?'★':'☆';$('quick').innerHTML=seed.slice(0,8).map(s=>`<button data-code="${s.code}" data-name="${s.name}">${s.name}</button>`).join('');$('quick').querySelectorAll('button').forEach(b=>b.onclick=()=>load(b.dataset.code,b.dataset.name));load('005930','삼성전자');
