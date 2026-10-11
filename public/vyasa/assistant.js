/* Prabhas SaaS — shared Vyasa 1.0 browser assistant. Zero external JS dependencies.
   Keep this source in sync with deployed app copies. Do not pass document bodies,
   passwords, credentials, financial data or raw account records as page context.
   Authentication is provided by the host app through window.PrabhasVyasaAuth. */
(function () {
  'use strict';
  if (window.__prabhasVyasaMounted) return;
  var script = document.currentScript;
  var app = (script && script.dataset.vyasaApp || '').toLowerCase();
  var appNames = {
    seedhabill: 'Seedha Bill', lekhya: 'Lekhya', sanchay: 'Sanchay',
    samvaad: 'Samvaad', dastavej: 'Dastavej', shilp3d: 'Shilp3D',
    admin: 'Prabhas Admin', accounts: 'Prabhas Account'
  };
  if (!Object.prototype.hasOwnProperty.call(appNames, app)) return;
  if (/\/(login|sign-in|signin|signup|register|reset|callback|logout)(\/|$)/i.test(location.pathname)) return;
  window.__prabhasVyasaMounted = true;
  var name = appNames[app];
  var accent = (script && script.dataset.vyasaAccent) || '#7A1F2B';
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) accent = '#7A1F2B';
  var side = script && script.dataset.vyasaSide === 'left' ? 'left' : 'right';
  var localEndpoint = script && script.dataset.vyasaEndpoint === '/api/vyasa';
  var endpoint = localEndpoint ? '/api/vyasa' : 'https://ezgfvvqwokxvqmheijmd.supabase.co/functions/v1/vyasa-chat';
  var icon = 'https://www.prabhassaas.in/images/ai/vyasa-1.0.png';
  var host = document.createElement('div');
  host.id = 'prabhas-vyasa-assistant';
  host.style.setProperty('--vyasa-accent', accent);
  document.body.appendChild(host);
  var root = host.attachShadow({mode:'open'});
  var style = document.createElement('style');
  style.textContent = `
:host{all:initial;--vyasa-accent:#7A1F2B;font-family:inherit;color:#171b25}
*,*::before,*::after{box-sizing:border-box}
button,input{font:inherit}button{cursor:pointer}
.vy-launch{position:fixed;bottom:calc(18px + env(safe-area-inset-bottom));${side}:18px;z-index:2147483000;display:flex;align-items:center;gap:9px;border:0;border-radius:28px;background:var(--vyasa-accent);color:#fff;padding:10px 16px 10px 10px;box-shadow:0 7px 28px #0003;font-weight:700;font-size:13px}
.vy-launch img{display:block;width:30px;height:30px;object-fit:contain;border-radius:50%;background:#fff}
.vy-panel{position:fixed;bottom:calc(76px + env(safe-area-inset-bottom));${side}:18px;z-index:2147483001;width:min(390px,calc(100vw - 24px));height:min(610px,calc(100dvh - 105px));display:none;flex-direction:column;overflow:hidden;border:1px solid #e5e0dc;border-radius:18px;background:#fff;color:#171b25;box-shadow:0 15px 55px #1113;font-size:14px;line-height:1.45}
.vy-panel[data-open="1"]{display:flex}
.vy-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--vyasa-accent);color:#fff;flex:none}
.vy-head img{width:34px;height:34px;border-radius:50%;background:#fff;object-fit:contain}
.vy-title{font-weight:750;font-size:15px}.vy-sub{font-size:11px;opacity:.9}
.vy-spacer{flex:1}.vy-icon{background:transparent;color:inherit;border:0;padding:5px;font-size:21px;line-height:1}
.vy-messages{display:flex;flex-direction:column;align-items:stretch;gap:10px;overflow-y:auto;flex:1;padding:14px;background:#fbfaf8;overscroll-behavior:contain}
.vy-bubble{align-self:flex-start;max-width:94%;white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 12px;border-radius:13px;background:#fff;border:1px solid #ebe8e3;font-size:13px}
.vy-bubble[data-role="user"]{align-self:flex-end;background:var(--vyasa-accent);color:#fff;border-color:transparent}

.vy-bubble[data-role="assistant"]{white-space:normal;line-height:1.55}
.vy-bubble .vy-content>*:first-child{margin-top:0}
.vy-bubble .vy-content>*:last-child{margin-bottom:0}
.vy-content p{margin:0 0 9px;white-space:pre-wrap}
.vy-content h3,.vy-content h4{font-size:13px;line-height:1.4;margin:12px 0 6px;font-weight:750;color:#222732}
.vy-content ul,.vy-content ol{padding-left:20px;margin:4px 0 10px}
.vy-content li{padding-left:2px;margin:3px 0;white-space:pre-wrap}
.vy-content strong{font-weight:750}
.vy-content code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.94em;background:#f3f3f5;border-radius:4px;padding:1px 3px}
.vy-content pre{white-space:pre;overflow:auto;background:#f3f3f5;border-radius:8px;padding:9px;margin:6px 0 10px}
.vy-content pre code{background:none;padding:0}
.vy-table-wrap{max-width:100%;overflow-x:auto;margin:7px 0 10px;border:1px solid #e8e5e1;border-radius:8px}
.vy-content table{border-collapse:collapse;min-width:100%;font-size:12px}
.vy-content th,.vy-content td{text-align:left;vertical-align:top;padding:7px 9px;border-bottom:1px solid #e8e5e1;white-space:pre-wrap}
.vy-content th{background:#f7f6f4;font-weight:750}
.vy-content tr:last-child td{border-bottom:0}
.vy-small{font-size:11px;color:#69707d;padding:2px 4px}
.vy-feedback{display:flex;gap:5px;justify-content:flex-start;margin:-6px 0 0 0}
.vy-feedback button{border:1px solid #d9d4cf;background:#fff;border-radius:7px;color:#555;padding:4px 7px;font-size:13px}
.vy-feedback button:disabled{opacity:.55;cursor:default}
.vy-foot{display:flex;align-items:center;gap:8px;border-top:1px solid #e7e3df;padding:10px 12px;background:#fff;flex:none}
.vy-input{border:1px solid #d9d4cf;border-radius:10px;min-width:0;flex:1;padding:11px 10px;color:#171b25;background:white;font-size:14px}
.vy-send{border:0;border-radius:10px;background:var(--vyasa-accent);padding:11px 13px;color:#fff;font-weight:700}
.vy-send:disabled{opacity:.5;cursor:default}
.vy-note{font-size:10px;color:#6d7381;padding:0 14px 10px;background:#fff}
@media(max-width:550px){.vy-launch{bottom:calc(12px + env(safe-area-inset-bottom));${side}:12px}.vy-panel{inset:8px 8px calc(76px + env(safe-area-inset-bottom)) 8px;width:auto;height:auto;max-height:none;border-radius:16px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;
  root.appendChild(style);
  var trigger = document.createElement('button');
  trigger.className='vy-launch'; trigger.type='button'; trigger.setAttribute('aria-label','Open Vyasa AI assistant');
  var launchIcon = document.createElement('img'); launchIcon.src=icon;launchIcon.alt='Vyasa AI';
  trigger.appendChild(launchIcon); trigger.appendChild(document.createTextNode('Ask Vyasa'));
  root.appendChild(trigger);
  var panel = document.createElement('section');panel.className='vy-panel';panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','Vyasa AI for '+name);panel.dataset.open='0';
  panel.innerHTML='<div class="vy-head"><img alt="Vyasa AI"><div><div class="vy-title">Vyasa 1.0</div><div class="vy-sub"></div></div><span class="vy-spacer"></span><button class="vy-icon" type="button" data-action="new" aria-label="Start new conversation" title="New conversation">↺</button><button class="vy-icon" type="button" data-action="close" aria-label="Close assistant">×</button></div><div class="vy-messages" role="log" aria-live="polite" aria-relevant="additions"></div><form class="vy-foot"><input class="vy-input" autocomplete="off" maxlength="4000" aria-label="Your question" placeholder="Ask about '+name+'…" required><button class="vy-send" type="submit">Send</button></form><p class="vy-note">Questions you type are sent to Vyasa. Your documents and records are not read automatically.</p>';
  panel.querySelector('.vy-head img').src=icon;
  panel.querySelector('.vy-sub').textContent=name+' · Prabhas SaaS';
  root.appendChild(panel);
  var messages=panel.querySelector('.vy-messages'),form=panel.querySelector('form'),input=panel.querySelector('input'),send=form.querySelector('button');
  var history=[],conversationId=null,busy=false,loaded=false,authWasPresent=false;
  var guestKey='prabhas-vyasa:'+app+':guest';
  // Ephemeral history stays in memory. No raw chat stored in localStorage.
  function context(){
    // No DOM text: headings can contain customer names, invoice numbers or
    // private document titles. Only allow stable, non-sensitive route labels.
    var allowed=/^(dashboard|home|inventory|stock|products|sales|pos|purchases|purchase|returns|invoices|invoice|payments|ledger|accounting|reports|gst|tax|documents|pdf|editor|design|drawing|layers|settings|profile|billing|subscriptions|users|integrations|warehouse|warehouses|register|transactions|forms|ocr|history|analytics|support|clients|vendors|parties|banking|materials|projects|canvas|help|admin|account|subscription|receipts|pricing)$/;
    var parts=location.pathname.toLowerCase().split('/').filter(Boolean).slice(0,3);
    var route=parts.filter(function(p){return allowed.test(p)}).slice(0,2);
    return {surface:'apps',site:'prabhassaas',app:app,app_key:app,
      path:'/'+route.join('/'),title:name,heading:route.join(' / ')};
  }
  async function token(){
    try{
      var getter=window.PrabhasVyasaAuth;
      if(typeof getter==='function'){
        var out=await getter();
        return typeof out==='string'&&out.length>80?out:null;
      }
      // Known SSO client exposed by the Prabhas Account application.
      if(app==='accounts'&&window.__sb&&window.__sb.auth){
        var response=await window.__sb.auth.getSession();
        return response.data&&response.data.session&&response.data.session.access_token||null;
      }
    }catch(_){}
    return null;
  }
  async function request(body){
    var auth=await token();
    var headers={'Content-Type':'application/json'};
    if(auth)headers.Authorization='Bearer '+auth;
    var res=await fetch(endpoint,{method:'POST',headers:headers,body:JSON.stringify(body)});
    var data=await res.json().catch(function(){return {}});
    if(!res.ok||data.ok===false)throw Error(data.message||data.error||'Vyasa is temporarily unavailable.');
    return {data:data,authenticated:!!auth || (localEndpoint && data.authenticated===true)};
  }

  // Deterministic, HTML-free presentation for new and historic assistant replies.
  // Preserve the original text in memory: presentation must not rewrite the transcript.
  function inlineText(parent, text) {
    var pattern=/(\`[^\`]+\`|\*\*[^*\n]+\*\*)/g;
    var cursor=0, match;
    while((match=pattern.exec(text))){
      if(match.index>cursor)parent.appendChild(document.createTextNode(text.slice(cursor,match.index)));
      var raw=match[0], node=document.createElement(raw.slice(0,2)==='**'?'strong':'code');
      node.textContent=raw.slice(raw.startsWith('**')?2:1,raw.startsWith('**')?-2:-1);
      parent.appendChild(node);cursor=pattern.lastIndex;
    }
    if(cursor<text.length)parent.appendChild(document.createTextNode(text.slice(cursor)));
  }
  function formatAssistant(el, raw) {
    el.replaceChildren(); el.dataset.rawContent=raw;
    var box=document.createElement('div');box.className='vy-content';el.appendChild(box);
    var lines=raw.replace(/\r\n?/g,'\n').split('\n'), i=0;
    function add(tag,value){var node=document.createElement(tag);inlineText(node,value);box.appendChild(node);return node;}
    while(i<lines.length){
      var line=lines[i], trimmed=line.trim();
      if(!trimmed){i++;continue;}
      if(/^\`\`\`/.test(trimmed)){
        var code=[],closed=false;i++;
        while(i<lines.length){if(/^\`\`\`/.test(lines[i].trim())){closed=true;i++;break;}code.push(lines[i++]);}
        var pre=document.createElement('pre'), c=document.createElement('code');c.textContent=code.join('\n');pre.appendChild(c);box.appendChild(pre);continue;
      }
      var heading=/^#{1,4}\s+(.+)$/.exec(trimmed);
      if(heading){add('h3',heading[1]);i++;continue;}
      var rule=/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1]||'');
      if(trimmed.includes('|')&&rule){
        var headings=trimmed.replace(/^\||\|$/g,'').split('|').map(function(x){return x.trim()});
        if(headings.length>1&&headings.length<=8){
          var wrap=document.createElement('div'),table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
          wrap.className='vy-table-wrap';headings.forEach(function(h){var th=document.createElement('th');inlineText(th,h);tr.appendChild(th)});
          thead.appendChild(tr);table.appendChild(thead);i+=2;var tbody=document.createElement('tbody');
          while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){
            var cells=lines[i].trim().replace(/^\||\|$/g,'').split('|');
            if(cells.length!==headings.length)break;
            var row=document.createElement('tr');cells.forEach(function(v){var td=document.createElement('td');inlineText(td,v.trim());row.appendChild(td)});
            tbody.appendChild(row);i++;
          }
          table.appendChild(tbody);wrap.appendChild(table);box.appendChild(wrap);continue;
        }
      }
      var item=/^\s{0,3}([-*] |\d+[.)] )(.+)$/.exec(line);
      if(item){
        var ordered=/\d/.test(item[1][0]),list=document.createElement(ordered?'ol':'ul');box.appendChild(list);
        while(i<lines.length){
          var next=/^\s{0,3}([-*] |\d+[.)] )(.+)$/.exec(lines[i]);
          if(!next||/\d/.test(next[1][0])!==ordered)break;
          var li=document.createElement('li');inlineText(li,next[2]);list.appendChild(li);i++;
        }
        continue;
      }
      var paragraph=[line];i++;
      while(i<lines.length&&lines[i].trim()&&!/^#{1,4}\s|^\s{0,3}(?:[-*] |\d+[.)] )|^\`\`\`/.test(lines[i])) {
        if(lines[i].includes('|')&&/^\s*\|?\s*:?-{3,}:?/.test(lines[i+1]||''))break;
        paragraph.push(lines[i++]);
      }
      add('p',paragraph.join('\n'));
    }
  }
  function setBubbleText(el, value){
    var raw=String(value);
    if(el.dataset.role==='assistant')formatAssistant(el,raw);
    else el.textContent=raw;
  }
  function bubble(role,text){
    var el=document.createElement('div');
    el.className='vy-bubble';el.dataset.role=role;setBubbleText(el,text);
    messages.appendChild(el);messages.scrollTop=messages.scrollHeight;
    return el;
  }
  function feedback(id){
    if(!id)return;
    var bar=document.createElement('div');bar.className='vy-feedback';
    for(var value of [1,-1]){
      var btn=document.createElement('button');btn.type='button';
      btn.textContent=value===1?'👍 Helpful':'👎 Not helpful';
      btn.setAttribute('aria-label',value===1?'Mark helpful':'Mark unhelpful');
      (function(v){btn.addEventListener('click',async function(){
        for(var item of bar.querySelectorAll('button'))item.disabled=true;
        try{await request({action:'feedback',interaction_id:id,feedback:v,resolution_status:'unknown'});}
        catch(_){for(var item of bar.querySelectorAll('button'))item.disabled=false;}
      });})(value);
      bar.appendChild(btn);
    }
    messages.appendChild(bar);
  }
  async function open(){
    panel.dataset.open='1';trigger.setAttribute('aria-expanded','true');
    if(!loaded){
      loaded=true;
      var sess=await token();authWasPresent=!!sess;
      if(sess || localEndpoint){
        try{
          var result=await request({action:'history',context:context()});
          conversationId=result.data.conversation_id||null;
          authWasPresent=result.authenticated;
          var stored=result.data.messages||[];
          for(var m of stored.slice(-25))if(m.role==='user'||m.role==='assistant')bubble(m.role,String(m.content||''));
        }catch(_){}
      }
      if(!messages.children.length)bubble('assistant','Hi! How can I help you with '+name+'?');
    }
    input.focus();
  }
  trigger.addEventListener('click',function(){if(panel.dataset.open==='1'){panel.dataset.open='0';trigger.setAttribute('aria-expanded','false');}else void open()});
  panel.querySelector('[data-action="close"]').addEventListener('click',function(){panel.dataset.open='0';trigger.focus()});
  panel.querySelector('[data-action="new"]').addEventListener('click',async function(){
    if(busy)return;messages.replaceChildren();history=[];conversationId=null;
    try{if(await token())await request({action:'new',context:context()}).then(function(r){conversationId=r.data.conversation_id||null});}catch(_){}
    bubble('assistant','Hi! How can I help you?');input.focus();
  });
  form.addEventListener('submit',async function(ev){
    ev.preventDefault();if(busy)return;
    var q=input.value.trim();if(!q)return;input.value='';busy=true;send.disabled=true;input.disabled=true;
    bubble('user',q);var pending=bubble('assistant','Thinking…');
    try{
      var current=await token();if(authWasPresent&&!current&&!localEndpoint){history=[];conversationId=null;messages.replaceChildren();bubble('assistant','Please sign in again to continue your private conversation.');return;}
      var response=await request({action:'message',message:q,conversation_id:conversationId,
        context:context(),ephemeral_history:(current||localEndpoint&&authWasPresent)?[]:history.slice(-12)});
      setBubbleText(pending,String(response.data.reply||'No response'));
      conversationId=response.data.conversation_id||conversationId;
      authWasPresent=authWasPresent||response.authenticated;
      if(!response.authenticated){history.push({role:'user',content:q},{role:'assistant',content:pending.dataset.rawContent||pending.textContent});history=history.slice(-12);}
      if(response.authenticated)feedback(response.data.interaction_id);
    }catch(err){setBubbleText(pending,err instanceof Error?err.message:'Could not contact Vyasa.');}
    finally{busy=false;send.disabled=false;input.disabled=false;input.focus();messages.scrollTop=messages.scrollHeight;}
  });
})();
