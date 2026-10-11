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
  var endpoint = 'https://ezgfvvqwokxvqmheijmd.supabase.co/functions/v1/vyasa-chat';
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
  panel.innerHTML='<div class="vy-head"><img alt="Vyasa AI"><div><div class="vy-title">Vyasa 1.0</div><div class="vy-sub"></div></div><span class="vy-spacer"></span><button class="vy-icon" type="button" data-action="new" aria-label="Start new conversation" title="New conversation">↺</button><button class="vy-icon" type="button" data-action="close" aria-label="Close assistant">×</button></div><div class="vy-messages" role="log" aria-live="polite" aria-relevant="additions"></div><form class="vy-foot"><input class="vy-input" autocomplete="off" maxlength="4000" aria-label="Your question" placeholder="Ask about '+name+'…" required><button class="vy-send" type="submit">Send</button></form><p class="vy-note">Answers are guidance, not a live check of your records.</p>';
  panel.querySelector('.vy-head img').src=icon;
  panel.querySelector('.vy-sub').textContent=name+' · Prabhas SaaS';
  root.appendChild(panel);
  var messages=panel.querySelector('.vy-messages'),form=panel.querySelector('form'),input=panel.querySelector('input'),send=form.querySelector('button');
  var history=[],conversationId=null,busy=false,loaded=false,authWasPresent=false;
  var guestKey='prabhas-vyasa:'+app+':guest';
  // Ephemeral history stays in memory. No raw chat stored in localStorage.
  function context(){
    var h=document.querySelector('main h1,main h2,[role="main"] h1,h1');
    return {surface:'apps',site:'prabhassaas',app:app,app_key:app,
      path:location.pathname.slice(0,240),title:(document.title||'').slice(0,180),
      heading:(h?h.textContent:'').trim().slice(0,180)};
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
    return {data:data,authenticated:!!auth};
  }
  function bubble(role,text){
    var el=document.createElement('div');
    el.className='vy-bubble';el.dataset.role=role;el.textContent=text;
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
      if(sess){
        try{
          var result=await request({action:'history',context:context()});
          conversationId=result.data.conversation_id||null;
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
      var current=await token();if(authWasPresent&&!current){history=[];conversationId=null;messages.replaceChildren();bubble('assistant','Please sign in again to continue your private conversation.');return;}
      var response=await request({action:'message',message:q,conversation_id:conversationId,
        context:context(),ephemeral_history:current?[]:history.slice(-12)});
      pending.textContent=String(response.data.reply||'No response');
      conversationId=response.data.conversation_id||conversationId;
      authWasPresent=authWasPresent||!!current;
      if(!current){history.push({role:'user',content:q},{role:'assistant',content:pending.textContent});history=history.slice(-12);}
      if(current)feedback(response.data.interaction_id);
    }catch(err){pending.textContent=err instanceof Error?err.message:'Could not contact Vyasa.';}
    finally{busy=false;send.disabled=false;input.disabled=false;input.focus();messages.scrollTop=messages.scrollHeight;}
  });
})();
