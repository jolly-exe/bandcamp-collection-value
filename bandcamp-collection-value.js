// ==UserScript==
// @name         Bandcamp Collection Value
// @namespace    https://bandcamp.com
// @version      1.0
// @description  A userscript that calculates the total value of your Bandcamp purchases and converts it to any currency.
// @author       Jolly
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/jolly-exe/bandcamp-collection-value
// @match        https://bandcamp.com/*/purchases
// @grant        GM_xmlhttpRequest
// @connect      api.frankfurter.app
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'bc-value-calc';
  const DEFAULT_TARGET = 'USD';
  const SUPPORTED = [
    'USD','EUR','GBP','PLN','JPY','CAD','AUD','CHF','SEK','NOK',
    'DKK','CZK','HUF','BRL','MXN','NZD','HKD','SGD','INR','CNY',
    'KRW','TRY','ZAR','ILS','THB','PHP','IDR',
  ];
  const loadConf = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); } catch { return {}; } };
  const saveConf = (p) => localStorage.setItem(STORAGE_KEY, JSON.stringify({...loadConf(),...p}));
  let TGT = loadConf().target || DEFAULT_TARGET;

  const CP = [
    [/\bCAD\b/,'CAD'],[/\bUSD\b/,'USD'],[/\bEUR\b/,'EUR'],[/\bGBP\b/,'GBP'],
    [/\bAUD\b/,'AUD'],[/\bNZD\b/,'NZD'],[/\bJPY\b/,'JPY'],[/\bPLN\b/,'PLN'],
    [/\bCHF\b/,'CHF'],[/\bSEK\b/,'SEK'],[/\bNOK\b/,'NOK'],[/\bDKK\b/,'DKK'],
    [/\bCZK\b/,'CZK'],[/\bHUF\b/,'HUF'],[/\bBRL\b/,'BRL'],[/\bMXN\b/,'MXN'],
    [/\bHKD\b/,'HKD'],[/\bSGD\b/,'SGD'],[/\bINR\b/,'INR'],[/\bCNY\b/,'CNY'],
    [/\bKRW\b/,'KRW'],[/\bTRY\b/,'TRY'],[/\bZAR\b/,'ZAR'],[/\bILS\b/,'ILS'],
    [/\bTHB\b/,'THB'],[/\bPHP\b/,'PHP'],[/\bIDR\b/,'IDR'],
    [/CA\$/i,'CAD'],[/A\$/,'AUD'],[/NZ\$/i,'NZD'],[/HK\$/i,'HKD'],
    [/MX\$/i,'MXN'],[/S\$/,'SGD'],[/R\$/,'BRL'],[/Rp\b/,'IDR'],
    [/zł/i,'PLN'],[/Kč/,'CZK'],[/\bFt\b/,'HUF'],[/\bFr\b/,'CHF'],[/\bkr\b/i,'SEK'],
    [/€/,'EUR'],[/£/,'GBP'],[/¥/,'JPY'],[/₹/,'INR'],[/₽/,'RUB'],
    [/₩/,'KRW'],[/₺/,'TRY'],[/₪/,'ILS'],[/฿/,'THB'],[/₱/,'PHP'],
    [/\$/,'USD'],
  ];

  function fmt(a,c){return a.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+' '+c;}

  const NUM_RE = /\d[\d.,\s']*/;
  function parsePrice(t){
    if(!t)return null;t=t.trim();if(!/\d/.test(t))return null;
    const m=t.match(NUM_RE);if(!m)return null;
    let n=m[0].replace(/[\s']/g,'');
    const dotI=n.lastIndexOf('.'),comI=n.lastIndexOf(',');
    if(dotI>=0&&comI>=0){if(dotI>comI)n=n.replace(/,/g,'');else n=n.replace(/\./g,'').replace(',','.');}
    else if(comI>=0){if(n.length-comI-1<=2)n=n.replace(',','.');else n=n.replace(/,/g,'');}
    else if(dotI>=0&&n.length-dotI-1===3&&n.indexOf('.')===dotI)n=n.replace('.','');
    const a=parseFloat(n);if(isNaN(a)||a<=0)return null;
    for(let i=0;i<CP.length;i++){if(CP[i][0].test(t))return{amount:a,currency:CP[i][1]};}
    return{amount:a,currency:'USD'};
  }

  const PH='\u2026';
  const panel=document.createElement('div');
  panel.id='bcv';panel.className='bcv-min';
  panel.innerHTML=`
<style>
#bcv,#bcv *{box-sizing:border-box;margin:0;padding:0;text-decoration:none!important;}
#bcv{
  --bcv-dur:550ms;
  --bcv-ease:cubic-bezier(0.16,1,0.3,1);
  --bcv-mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Courier New",monospace;
  --bcv-accent:#1da0c3;
  --bcv-accent-h:#22aed4;
  position:fixed;bottom:24px;right:24px;z-index:99999;
  background:rgba(28,28,30,0.88);
  backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  color:#f0f0f0;
  font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif!important;
  border:1px solid rgba(255,255,255,0.1);
  user-select:none;overflow:hidden;
  width:290px;height:var(--bcv-h,300px);padding:18px;border-radius:22px;
  display:flex;align-items:center;justify-content:center;
  transform:translateZ(0) scale(1);backface-visibility:hidden;
  will-change:width,height,padding,border-radius,box-shadow,transform;
  box-shadow:0 16px 48px rgba(0,0,0,0.4),0 4px 16px rgba(0,0,0,0.1);
  transition:
    width var(--bcv-dur) var(--bcv-ease),
    height var(--bcv-dur) var(--bcv-ease),
    padding var(--bcv-dur) var(--bcv-ease),
    border-radius var(--bcv-dur) var(--bcv-ease),
    box-shadow var(--bcv-dur) var(--bcv-ease),
    background-color 300ms ease,border-color 300ms ease,transform 250ms var(--bcv-ease);
}
#bcv.bcv-min{
  width:56px;height:56px;padding:0;border-radius:28px;
  background:var(--bcv-accent);border-color:transparent;cursor:pointer;
  box-shadow:0 6px 20px rgba(29,160,195,0.4),0 2px 8px rgba(0,0,0,0.2);
}
#bcv.bcv-min:hover{
  background:var(--bcv-accent-h);transform:translateZ(0) scale(1.06);
  box-shadow:0 8px 24px rgba(29,160,195,0.5),0 4px 12px rgba(0,0,0,0.2);
}
#bcv.bcv-min:active{transform:translateZ(0) scale(0.96);}

#bcv .bcv-face{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  opacity:0;pointer-events:none;transform:scale(0.5);
  will-change:opacity,transform;
  transition:opacity 150ms ease-in,transform var(--bcv-dur) var(--bcv-ease);
}
#bcv.bcv-min .bcv-face{
  opacity:1;pointer-events:auto;transform:scale(1);
  transition:opacity 250ms ease-out 100ms,transform var(--bcv-dur) var(--bcv-ease) 50ms;
}

#bcv .bcv-body{
  opacity:1;width:254px;flex-shrink:0;
  transform:scale(1) translateY(0);transform-origin:center;
  will-change:opacity,transform;
  transition:opacity 350ms ease-out 100ms,transform var(--bcv-dur) var(--bcv-ease) 0ms;
}
#bcv.bcv-min .bcv-body{
  opacity:0;pointer-events:none;
  transform:scale(0.8) translateY(12px);
  transition:opacity 120ms ease-in,transform 200ms ease-in;
}

#bcv .bcv-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
#bcv .bcv-hdr h3{
  display:flex!important;align-items:center;gap:6px;
  font:bold 12px/1.3 -apple-system,sans-serif!important;
  text-transform:uppercase;letter-spacing:0.08em;color:var(--bcv-accent-h);
}
#bcv .bcv-close{
  background:rgba(255,255,255,0.08);border:none;border-radius:50%;color:#aaa;cursor:pointer;
  width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;
  transition:background 200ms,color 200ms,transform 200ms var(--bcv-ease);flex-shrink:0;outline:none;
}
#bcv .bcv-close:hover{background:rgba(255,255,255,0.18);color:#fff;}
#bcv .bcv-close:active{transform:scale(0.85);}
#bcv .bcv-close svg{width:12px;height:12px;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;}

#bcv .bcv-card{
  background:rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;margin-bottom:16px;
}
#bcv .bcv-item{
  display:flex;justify-content:space-between;padding:11px 14px;
  border-bottom:1px solid rgba(255,255,255,0.05);
  font-size:13px;color:rgba(255,255,255,0.55);align-items:flex-start;gap:14px;
}
#bcv .bcv-item:last-child{border-bottom:none;}
#bcv .bcv-item span:first-child{flex-shrink:0;padding-top:1px;}
#bcv .bcv-item span:last-child,#bcv .bcv-item select{
  color:#fff;font-weight:600;text-align:right;
  font-family:var(--bcv-mono);font-size:13px;
}
#bcv .bcv-select-wrap{display:inline-flex;align-items:center;gap:5px;}
#bcv .bcv-chevron{
  display:inline-block;width:5px;height:5px;flex-shrink:0;pointer-events:none;
  border-right:1.5px solid rgba(255,255,255,0.6);
  border-bottom:1.5px solid rgba(255,255,255,0.6);
  border-radius:1px;
  transform:rotate(45deg);
  margin-bottom:3px;
}
#bcv select{
  background:transparent;color:var(--bcv-accent-h);border:none;
  font-family:var(--bcv-mono);font-size:13px;font-weight:600;
  padding:0;cursor:pointer;outline:none;
  -webkit-appearance:none;appearance:none;
}

#bcv .bcv-total{
  margin-bottom:16px;padding:0 2px;
  display:flex;justify-content:space-between;align-items:baseline;
  font-size:15px;font-weight:500;color:rgba(255,255,255,0.5);
}
#bcv .bcv-total span:last-child{
  color:var(--bcv-accent-h);font-weight:700;font-family:var(--bcv-mono);font-size:17px;
}

#bcv .bcv-btns{display:flex;gap:8px;margin-bottom:12px;}
#bcv .bcv-btn{
  border:none;border-radius:10px;cursor:pointer;
  font:600 13px/1 -apple-system,sans-serif;
  transition:background 150ms,transform 150ms var(--bcv-ease),opacity 150ms;outline:none;
}
#bcv .bcv-btn:active:not(:disabled){transform:scale(0.96);}
#bcv .bcv-btn:disabled{opacity:0.35;cursor:not-allowed;transform:none;}
#bcv .bcv-btn-pri{background:var(--bcv-accent);color:#fff;flex:1;padding:12px 0;}
#bcv .bcv-btn-pri:hover:not(:disabled){background:var(--bcv-accent-h);}
#bcv .bcv-btn-sec{background:rgba(255,255,255,0.1);color:#fff;flex:1;padding:12px 0;}
#bcv .bcv-btn-sec:hover:not(:disabled){background:rgba(255,255,255,0.15);}

#bcv .bcv-status{font-size:11px;color:rgba(255,255,255,0.35);text-align:center;line-height:1.4;font-weight:500;}
</style>

<div class="bcv-face" title="Open Value Calculator">
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none"><circle cx="12" cy="12" r="11" fill="#fff" fill-opacity=".95"/><circle cx="12" cy="12" r="3.2" fill="#1da0c3"/></svg>
</div>

<div class="bcv-body">
  <div class="bcv-hdr">
    <h3><svg viewBox="0 0 24 24" width="14" height="14" fill="none" style="display:inline-block;flex-shrink:0"><circle cx="12" cy="12" r="11" fill="#1da0c3"/><circle cx="12" cy="12" r="3.2" fill="#1a1a1a"/></svg>Collection Value</h3>
    <button class="bcv-close" type="button" title="Minimize">
      <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <div class="bcv-card">
    <div class="bcv-item"><span>Loaded</span><span id="bcv-loaded">${PH}</span></div>
    <div class="bcv-item"><span>Original</span><span id="bcv-orig">${PH}</span></div>
    <div class="bcv-item"><span>Convert to</span><div class="bcv-select-wrap"><select id="bcv-target"></select><span class="bcv-chevron"></span></div></div>
  </div>
  <div class="bcv-total"><span>\u2248</span><span id="bcv-conv">${PH}</span></div>
  <div class="bcv-btns">
    <button id="bcv-load" class="bcv-btn bcv-btn-sec" type="button">Load All</button>
    <button id="bcv-calc" class="bcv-btn bcv-btn-pri" type="button">Calculate</button>
  </div>
  <div class="bcv-status" id="bcv-status">Load all items, then Calculate</div>
</div>`;
  document.body.appendChild(panel);

  const $=id=>document.getElementById(id);
  const DOM={
    loaded:$('bcv-loaded'),orig:$('bcv-orig'),target:$('bcv-target'),
    conv:$('bcv-conv'),status:$('bcv-status'),calc:$('bcv-calc'),
    load:$('bcv-load'),countNode:null
  };

  panel.style.transition='none';
  panel.style.visibility='hidden';
  panel.classList.remove('bcv-min');
  panel.style.height='auto';
  const _h=panel.scrollHeight;
  panel.style.height='';
  panel.classList.add('bcv-min');
  panel.style.visibility='';
  panel.offsetHeight;
  panel.style.transition='';
  panel.style.setProperty('--bcv-h',_h+'px');

  function remeasure(){
    if(panel.classList.contains('bcv-min'))return;
    panel.style.transition='none';
    panel.style.height='auto';
    const h=panel.scrollHeight;
    panel.style.setProperty('--bcv-h',h+'px');
    panel.style.height='';
    panel.offsetHeight;
    panel.style.transition='';
  }

  const tsel=DOM.target;
  for(let i=0;i<SUPPORTED.length;i++){
    const c=SUPPORTED[i],o=document.createElement('option');
    o.value=c;o.textContent=c;if(c===TGT)o.selected=true;tsel.appendChild(o);
  }
  tsel.addEventListener('change',()=>{TGT=tsel.value;saveConf({target:TGT});DOM.conv.textContent=PH;setStatus('Currency changed \u2014 click Calculate');});

  panel.querySelector('.bcv-face').addEventListener('click',e=>{
    e.stopPropagation();panel.classList.remove('bcv-min');setTimeout(remeasure,560);
  });
  panel.querySelector('.bcv-close').addEventListener('click',e=>{e.stopPropagation();panel.classList.add('bcv-min');});

  function setStatus(m){DOM.status.textContent=m;}

  const S={allLoaded:false,loading:false,calc:false};

  const COUNT_RE=/(\d+)\s+of\s+(\d+)/;
  function checkLoaded(){
    if(!DOM.countNode){
      DOM.countNode=document.querySelector('.page-items-number');
      if(!DOM.countNode||!DOM.countNode.parentElement)return null;
    }
    const m=DOM.countNode.parentElement.textContent.match(COUNT_RE);
    return m?{shown:+m[1],total:+m[2]}:null;
  }

  function updateUI(){
    const info=checkLoaded();
    if(!S.loading&&info)S.allLoaded=info.shown>=info.total;
    if(info){
      DOM.loaded.textContent=info.shown>=info.total
        ?info.total+'/'+info.total
        :info.shown+'/'+info.total;
    }else{
      DOM.loaded.textContent=S.allLoaded?'all loaded':'more available';
    }
    DOM.loaded.style.color=S.allLoaded?'var(--bcv-accent-h)':'#e6b450';
    DOM.calc.disabled=!S.allLoaded||S.calc||S.loading;
    DOM.load.disabled=S.allLoaded||S.loading;
    if(S.allLoaded&&!S.calc&&DOM.conv.textContent===PH)setStatus('Ready \u2014 click Calculate');
  }

  let rafId=null;
  function debouncedUpdateUI(){if(rafId)cancelAnimationFrame(rafId);rafId=requestAnimationFrame(updateUI);}

  function setupObserver(){
    const target=document.querySelector('.page-items-number');
    if(!target||!target.parentElement)return false;
    DOM.countNode=target;
    const obs=new MutationObserver(debouncedUpdateUI);
    obs.observe(target.parentElement,{characterData:true,childList:true,subtree:true});
    return true;
  }

  updateUI();
  if(!setupObserver()){
    const fallback=setInterval(()=>{updateUI();if(setupObserver())clearInterval(fallback);},1000);
  }

  function waitForCountChange(prevShown,ms){
    return new Promise(resolve=>{
      const node=DOM.countNode||document.querySelector('.page-items-number');
      if(!node)return resolve(prevShown);
      let done=false;
      const finish=v=>{if(done)return;done=true;obs.disconnect();clearTimeout(timer);resolve(v);};
      const obs=new MutationObserver(()=>{
        const info=checkLoaded();
        if(info&&info.shown>prevShown)finish(info.shown);
      });
      obs.observe(node.parentElement,{characterData:true,childList:true,subtree:true});
      const timer=setTimeout(()=>finish(prevShown),ms);
    });
  }

  async function loadAll(){
    S.loading=true;updateUI();setStatus('Loading\u2026');
    const startInfo=checkLoaded();
    let lastShown=startInfo?startInfo.shown:0;
    let stalls=0;

    while(stalls<3){
      const b=document.querySelector('.view-all-button');
      if(b&&b.offsetParent!==null){
        b.scrollIntoView({block:'center',behavior:'instant'});
        b.click();
      }else{
        window.scrollTo({top:document.body.scrollHeight,behavior:'instant'});
      }
      const newShown=await waitForCountChange(lastShown,6000);
      if(newShown===lastShown){
        stalls++;
      }else{
        stalls=0;
        lastShown=newShown;
        setStatus('Loaded '+newShown+' items\u2026');
      }
      const info=checkLoaded();
      if(info&&info.shown>=info.total)break;
      await new Promise(r=>setTimeout(r,150));
    }

    S.loading=false;
    setStatus('Loaded '+lastShown+' items. Click Calculate.');
    window.scrollTo({top:0,behavior:'smooth'});
    updateUI();
  }

  DOM.load.addEventListener('click',()=>{
    if(S.loading||S.allLoaded)return;
    loadAll().catch(e=>{console.error('[bcv]',e);S.loading=false;setStatus('Load failed');updateUI();});
  });

  function scrapePrices(){
    const prices=[],seen=new Set();
    const sels=['.item-total','.purchases-item .price','td.price','.purchase-item .amount','.price','[class*="item-total"]'];
    for(let i=0;i<sels.length;i++){
      const els=document.querySelectorAll(sels[i]);
      if(!els.length)continue;
      for(let j=0;j<els.length;j++){
        const e=els[j];if(seen.has(e))continue;seen.add(e);
        const p=parsePrice(e.textContent);if(p)prices.push(p);
      }
      if(prices.length)return prices;
    }
    return prices;
  }

  function fetchRates(currencies){
    const u=Array.from(new Set(currencies)).filter(c=>c!==TGT);
    if(!u.length)return Promise.resolve({rates:{[TGT]:1},miss:[]});
    return new Promise((ok,no)=>{
      GM_xmlhttpRequest({
        method:'GET',
        url:'https://api.frankfurter.app/latest?from='+TGT+'&to='+u.join(','),
        onload(r){
          try{
            const d=JSON.parse(r.responseText),rates={};
            const re=Object.entries(d.rates||{});
            for(let i=0;i<re.length;i++)rates[re[i][0]]=1/re[i][1];
            rates[TGT]=1;
            ok({rates,miss:u.filter(c=>!(c in rates))});
          }catch(e){no(e);}
        },
        onerror:no,ontimeout:no,
      });
    });
  }

  async function calculate(){
    if(!S.allLoaded||S.calc)return;
    S.calc=true;updateUI();setStatus('Scanning\u2026');
    const prices=scrapePrices();
    if(!prices.length){setStatus('No prices found.');S.calc=false;updateUI();return;}
    const byC={};
    for(let i=0;i<prices.length;i++){const p=prices[i];byC[p.currency]=(byC[p.currency]||0)+p.amount;}
    DOM.orig.textContent=Object.entries(byC).map(([c,a])=>fmt(a,c)).join(' + ');
    remeasure();
    setStatus('Fetching rates\u2026');
    try{
      const{rates,miss}=await fetchRates(prices.map(p=>p.currency));
      let total=0,skip=0;
      for(let i=0;i<prices.length;i++){const p=prices[i],r=rates[p.currency];if(r===undefined)skip++;else total+=p.amount*r;}
      DOM.conv.textContent=fmt(total,TGT);
      let m='Done \u00b7 '+prices.length+' items \u00b7 frankfurter.app';
      if(skip)m+=' \u00b7 '+skip+' skipped ('+miss.join(',')+')';
      setStatus(m);
    }catch(e){console.error('[bcv]',e);setStatus('Rate fetch failed.');}
    S.calc=false;updateUI();remeasure();
  }

  DOM.calc.addEventListener('click',calculate);
})();
