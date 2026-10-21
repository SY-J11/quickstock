const API='https://m.stock.naver.com';
const seed=[
{name:'삼성전자',code:'005930'},{name:'삼성전자우',code:'005935'},{name:'SK하이닉스',code:'000660'},{name:'한미반도체',code:'042700'},{name:'두산에너빌리티',code:'034020'},{name:'두산',code:'000150'},{name:'현대차',code:'005380'},{name:'기아',code:'000270'},{name:'LG에너지솔루션',code:'373220'},{name:'삼성SDI',code:'006400'},{name:'NAVER',code:'035420'},{name:'카카오',code:'035720'},{name:'제주반도체',code:'080220'},{name:'대원전선',code:'006340'},{name:'대덕전자',code:'353200'}
];
const $=id=>document.getElementById(id);let current={...seed[0]}, searchTimer=null, requestSeq=0;
const blank='—';
function pick(obj,...keys){for(const k of keys){const v=obj?.[k];if(v!==undefined&&v!==null&&v!==''&&v!=='-')return v;}return null;}
function num(v){if(v===null||v===undefined)return null;const n=Number(String(v).replace(/,/g,'').replace(/%/g,'').replace(/원|배|억|조/g,'').trim());return Number.isFinite(n)?n:null;}
function fmt(v,unit=''){if(v===null||v===undefined||v==='')return blank;return `${v}${unit}`;}
async function getJson(url){
 const targets=[
   url,
   `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
   `https://corsproxy.io/?url=${encodeURIComponent(url)}`
 ];
 let last;
 for(const target of targets){
   try{
     const r=await fetch(target,{method:'GET',headers:{Accept:'application/json'},cache:'no-store'});
     if(!r.ok) throw new Error(`HTTP ${r.status}`);
     const body=await r.text();
     let data;
     try{data=JSON.parse(body)}catch{throw new Error('JSON 형식이 아닌 응답')}
     if(data===null || data===undefined) throw new Error('빈 응답');
     return data;
   }catch(e){last=e;}
 }
 throw new Error(`네이버 데이터 요청 실패: ${last?.message||'네트워크/CORS 오류'}`);
}
async function getFirstJson(urls){
 let last;
 for(const url of urls){try{return await getJson(url)}catch(e){last=e;}}
 throw last||new Error('데이터 요청 실패');
}
function extractBasic(raw,code,name){const d=raw?.stockInfo||raw?.result||raw?.data||raw;const price=pick(d,'closePrice','currentPrice','nowPrice','price');const change=pick(d,'compareToPreviousClosePrice','fluctuations','changePrice');const rate=pick(d,'fluctuationsRatio','changeRate');let changeText='';if(num(change)!==null&&num(change)!==0)changeText=`${num(change)>0?'▲':'▼'} ${num(change)>0?'+':''}${Number(num(change)).toLocaleString('ko-KR')} (${num(rate)!==null?`${num(rate)>0?'+':''}${num(rate)}%`:'등락률 정보 없음'})`;else if(num(rate)!==null)changeText=`${num(rate)>0?'▲':'▼'} ${num(rate)>0?'+':''}${num(rate)}%`;else changeText='시세 정보 없음';
return {name:pick(d,'stockName','itemName','name')||name,code,price:price!==null?Number(num(price)).toLocaleString('ko-KR'):'—',change:changeText,per:fmt(pick(d,'per','PER'),'배'),pbr:fmt(pick(d,'pbr','PBR'),'배'),eps:fmt(pick(d,'eps','EPS'),'원'),cap:formatMarketCap(pick(d,'marketValue','marketCap','marketSum')),roe:fmt(pick(d,'roe','ROE'),'%'),debt:fmt(pick(d,'debtRatio','debtRate'),'%'),foreignFloat:fmt(pick(d,'foreignRate','foreignOwnershipRate','foreignRatio'),'%')};}
function formatMarketCap(v){const n=num(v);if(n===null)return blank; // Naver marketValue is usually 억원
 if(n>=10000)return `${(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})}조${n%10000?` ${(n%10000).toLocaleString('ko-KR',{maximumFractionDigits:0})}억`:''}`;return `${n.toLocaleString('ko-KR')}억`;}
function financeRows(raw){const f=raw?.financeInfo||raw?.result?.financeInfo||raw?.data?.financeInfo||raw;const titles=f?.trTitleList||f?.titleList||[];const rows=f?.rowList||f?.rows||[];const findRow=(...terms)=>rows.find(r=>terms.some(t=>String(r.title||r.name||'').replace(/\s/g,'').includes(t)));const op=findRow('영업이익률','영업이익');const margin=findRow('영업이익률');const profit=rows.find(r=>String(r.title||r.name||'').replace(/\s/g,'')==='영업이익');const net= findRow('당기순이익','순이익');const sales=findRow('매출액');const getValue=(row,key)=>{const c=row?.columns?.[key];return c?.value??c?.formattedValue??row?.[key]?.value??row?.[key]??null;};
 const list=titles.map(t=>({key:String(t.key??t.period??t.title??''),label:String(t.title??t.period??t.key??''),estimated:String(t.isConsensus??t.consensus??'N').toUpperCase()==='Y'})).filter(t=>t.key).slice(-6);
 const quarters=list.map(t=>{const p=num(getValue(profit,t.key));let m=num(getValue(margin,t.key));if(m===null){const s=num(getValue(sales,t.key));if(p!==null&&s!==null&&s!==0)m=p/s*100;}return {label:t.label.replace(/\.$/, '')+(t.estimated&&!t.label.includes('(E)')?'(E)':''),profit:p,margin:m,net:num(getValue(net,t.key))};});
 return {quarters,rawRows:rows};}
function findMetric(rows,terms){const r=rows.find(x=>terms.some(t=>String(x.title||x.name||'').replace(/\s/g,'').includes(t)));return r;}
function renderChart(quarters){
 const chart=$('chart'),labels=$('labels');
 const qs=(quarters||[]).slice(-6);
 chart.classList.add('zero-chart');
 if(!qs.length||qs.every(q=>q.profit===null)){
   chart.innerHTML='<div class="chart-empty">영업이익 데이터를 불러오지 못했습니다.</div>';
   labels.innerHTML='';
   return;
 }
 const values=qs.map(q=>q.profit??0);
 const maxPos=Math.max(0,...values),maxNeg=Math.max(0,...values.map(v=>-v));
 const hasPos=maxPos>0,hasNeg=maxNeg>0;
 const topPad=42,plotH=174,viewH=242;
 const zeroY=hasPos&&hasNeg?topPad+plotH*(maxPos/(maxPos+maxNeg)):hasPos?topPad+plotH:topPad;
 const yFor=v=>v>=0?zeroY-(maxPos?(v/maxPos)*(zeroY-topPad):0):zeroY+(maxNeg?((-v/maxNeg)*(topPad+plotH-zeroY)):0);
 chart.innerHTML=`<svg class="profit-svg" viewBox="0 0 600 ${viewH}" preserveAspectRatio="none" role="img" aria-label="최근 6분기 영업이익 그래프">
 <line x1="0" y1="${zeroY}" x2="600" y2="${zeroY}" stroke="#929baa" stroke-width="1" stroke-dasharray="3 3"/>
 ${qs.map((q,i)=>{
   const x=(i+.5)*600/qs.length,v=q.profit??0,y=yFor(v),h=Math.max(2,Math.abs(zeroY-y));
   const color=v<0?'#3979d8':'#df5967',barY=v<0?zeroY:y,barW=38;
   const absProfit=Math.abs(q.profit??0);
   const valLabel=q.profit===null?'자료없음':(absProfit>=10000?`${(q.profit/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})}조`:`${q.profit.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`);
   const pct=q.margin===null?'(—)':`(${q.margin.toLocaleString('ko-KR',{maximumFractionDigits:1})}%)`;
   const labelY=v>=0?Math.max(12,barY-22):Math.min(viewH-28,barY+h+14);
   const pctY=v>=0?Math.max(24,barY-8):Math.min(viewH-12,barY+h+27);
   return `<g><rect x="${x-barW/2}" y="${barY}" width="${barW}" height="${h}" rx="3" fill="${color}" opacity="${q.label.includes('(E)') ? 0.78 : 1}"/>
   <text x="${x}" y="${labelY}" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">${valLabel}</text>
   <text x="${x}" y="${pctY}" text-anchor="middle" font-size="9" fill="#929baa">${pct}</text></g>`;
 }).join('')}</svg>`;
 labels.innerHTML=qs.map(q=>`<span>${q.label}</span>`).join('');
}
function render(s){current=s;$('name').textContent=s.name||'종목명 확인 중';$('code').textContent=s.code||'';$('price').childNodes[0].textContent=(s.price||blank)+' ';$('change').textContent=s.change||'시세 정보 없음';['per','pbr','eps','cap','annualOp','ttmOp','roe','debt','foreignFloat','annualMultiple','ttmMultiple','estTtmMultiple','target','opinion'].forEach(k=>$(k).textContent=s[k]||blank);$('ttmNet').innerHTML=`${s.ttmNet||blank} <small>(${s.netMargin||blank})</small>`;$('epsRows').innerHTML=(s.epsRows||[]).map(r=>`<div>${r[0]}<b>${r[1]}</b></div>`).join('')||'<div style="grid-column:1/-1">재무 데이터 없음</div>';const ids=['fKrCount','fNxCount','iKrCount','iNxCount'],streakIds=['fKrStreak','fNxStreak','iKrStreak','iNxStreak'];ids.forEach(id=>$(id).textContent=blank);streakIds.forEach(id=>$(id).textContent=blank);renderChart(s.quarters||[]);$('fav').textContent=localStorage.getItem('fav_'+s.code)==='1'?'★':'☆';$('clear').hidden=false;}
function normalizeSearchItem(item){const code=String(item.code||item.itemCode||item.stockCode||'').replace(/\D/g,'');if(!code)return null;return {name:item.name||item.stockName||item.itemName||code,code:code.padStart(6,'0')};}
async function searchNaver(q){const url=`${API}/front-api/search/autoComplete?query=${encodeURIComponent(q)}&target=stock,index,marketindicator,coin,ipo`;const data=await getJson(url);const items=data?.result?.items||data?.items||data?.result||[];return (Array.isArray(items)?items:[]).map(normalizeSearchItem).filter(Boolean).filter((x,i,a)=>a.findIndex(y=>y.code===x.code)===i).slice(0,12);}
function showResults(matches,q,error=''){const box=$('results');if(!q.trim()){box.hidden=true;box.innerHTML='';return;}box.hidden=false;if(error){box.innerHTML=`<div class="result"><span>${error}</span></div>`;return;}if(!matches.length){box.innerHTML='<div class="result"><span>검색 결과가 없습니다.</span><small>종목명 또는 6자리 코드를 확인하세요.</small></div>';return;}box.innerHTML=matches.map(s=>`<button class="result" type="button" data-code="${s.code}" data-name="${s.name.replace(/"/g,'&quot;')}"><span class="resultname">${s.name}</span><small class="resultcode">${s.code}</small><span aria-hidden="true">›</span></button>`).join('');box.querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>selectStock(b.dataset.code,b.dataset.name)));}
async function selectStock(code,name=''){const seq=++requestSeq;const fallback=seed.find(x=>x.code===code);current={name:name||fallback?.name||code,code};$('name').textContent=current.name;$('code').textContent=code;$('change').textContent='네이버 증권 데이터 조회 중…';$('chart').innerHTML='<div class="chart-empty">최근 6분기 데이터를 불러오는 중…</div>';$('labels').innerHTML='';$('results').hidden=true;$('query').value=current.name;$('query').blur();
 try{const [basicResult,integrationResult,financeResult]=await Promise.allSettled([
 getFirstJson([
   `${API}/front-api/stock/domestic/basic?code=${encodeURIComponent(code)}&endType=stock`,
   `${API}/api/stock/${encodeURIComponent(code)}/basic`
 ]),
 getFirstJson([
   `${API}/front-api/stock/domestic/integration?code=${encodeURIComponent(code)}&endType=stock`,
   `${API}/api/stock/${encodeURIComponent(code)}/integration`
 ]),
 getFirstJson([
   `${API}/api/stock/${encodeURIComponent(code)}/finance/quarter`
 ])
 ]);if(seq!==requestSeq)return;
 const basic=basicResult.status==='fulfilled'?basicResult.value:(integrationResult.status==='fulfilled'?integrationResult.value:null);
 if(!basic)throw new Error('시세 API에 연결할 수 없습니다. 네트워크 또는 API 응답을 확인하세요.');
 const finance=financeResult.status==='fulfilled'?financeResult.value:(integrationResult.status==='fulfilled'?integrationResult.value:null);
 const b=extractBasic(basic,code,current.name);const f=financeRows(finance||{});const rows=f.rawRows;const opRow=findMetric(rows,['영업이익']);const netRow=findMetric(rows,['당기순이익','순이익']);const annOp=opRow?Object.values(opRow.columns||{}).map(x=>num(x?.value)).filter(v=>v!==null).slice(-4).reduce((a,v)=>a+v,0):null;const ttmNet=netRow?Object.values(netRow.columns||{}).map(x=>num(x?.value)).filter(v=>v!==null).slice(-4).reduce((a,v)=>a+v,0):null;const opVals=f.quarters.map(q=>q.profit).filter(v=>v!==null);const netVals=f.quarters.map(q=>q.net).filter(v=>v!==null);b.quarters=f.quarters.map(q=>({label:q.label,profit:q.profit,margin:q.margin}));b.annualOp=annOp===null?blank:`${annOp.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`;b.ttmOp=opVals.length?`${opVals.reduce((a,v)=>a+v,0).toLocaleString('ko-KR',{maximumFractionDigits:1})}억`:blank;b.ttmNet=ttmNet===null?blank:`${ttmNet.toLocaleString('ko-KR',{maximumFractionDigits:1})}억`;b.netMargin=ttmNet!==null&&opVals.length?`${(ttmNet/opVals.reduce((a,v)=>a+v,0)*100).toFixed(1)}%`:blank;b.epsRows=[];render(b);$('statusMsg')?.remove();}catch(err){if(seq!==requestSeq)return;render({name:name||fallback?.name||code,code,change:`조회 실패: ${err.message}`,quarters:[]});$('chart').innerHTML='<div class="chart-empty">시세 조회와 분기 재무 조회를 각각 확인하세요. 재무자료가 없으면 그래프는 비워 둡니다.</div>';}}
async function doSearch(){const q=$('query').value.trim();if(!q)return;const seq=++requestSeq;showResults([],q);$('results').innerHTML='<div class="result">종목 검색 중…</div>';try{let matches;if(/^\d{6}$/.test(q)){matches=[{code:q,name:seed.find(s=>s.code===q)?.name||q}];}else{matches=await searchNaver(q);if(!matches.length)matches=seed.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())||s.code.startsWith(q));}if(seq!==requestSeq)return;if(matches.length===1)selectStock(matches[0].code,matches[0].name);else showResults(matches,q);}catch(e){if(seq!==requestSeq)return;const local=seed.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())||s.code.startsWith(q));if(local.length===1)selectStock(local[0].code,local[0].name);else showResults(local,q,'네이버 종목 검색 API에 연결할 수 없습니다. 사이트의 외부 API 접근/CORS를 확인하세요.');}}
$('searchBtn').addEventListener('click',doSearch);$('query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doSearch();}else if(e.key==='Escape')$('results').hidden=true;});$('query').addEventListener('input',()=>{const q=$('query').value.trim();$('clear').hidden=!q;if(searchTimer)clearTimeout(searchTimer);if(!q){$('results').hidden=true;return;}searchTimer=setTimeout(async()=>{try{const matches=await searchNaver(q);showResults(matches,q);}catch(_){showResults(seed.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())||s.code.startsWith(q)),q);}},280);});$('clear').addEventListener('click',()=>{$('query').value='';$('clear').hidden=true;$('results').hidden=true;$('query').focus();});$('theme').addEventListener('click',()=>document.body.classList.toggle('dark'));$('refresh').addEventListener('click',()=>selectStock(current.code,current.name));$('fav').addEventListener('click',()=>{const k='fav_'+current.code;localStorage.setItem(k,localStorage.getItem(k)==='1'?'0':'1');$('fav').textContent=localStorage.getItem(k)==='1'?'★':'☆';});$('quick').innerHTML=seed.slice(0,8).map(s=>`<button type="button" data-code="${s.code}" data-name="${s.name}">${s.name}</button>`).join('');$('quick').querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>selectStock(b.dataset.code,b.dataset.name)));selectStock('005930','삼성전자');
