/* 홈 화면 앱용 연결부.
   화면 코드(gas/Page.html)는 GAS 의 google.script.run 을 부른다 — 여기서 그 이름을 흉내 내
   같은 호출을 fetch 로 GAS doPost 에 보낸다. 화면 코드는 한 줄도 안 바꾸고 두 곳에서 돈다.
   보안: 기기 키는 이 기기 localStorage 에만 있고, 요청 본문에만 실린다(URL·리퍼러 없음). */
(function(){
  'use strict';
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) {} return; }

  var API = 'https://script.google.com/macros/s/AKfycbxDovFHJD8ZQh832DTE-J1Uhj71N0Q1mDap4EUOlfKJPsQIMMcSZ2HRZG-n7gap0lRCvA/exec';
  var KEY = 'hk_key';
  var READ = { getData:1, getChildSchedule:1, getHomeData:1, getRealEstate:1, pf_data:1, getTrip:1,
               sell_data:1, div_data:1, hist_data:1, eng_data:1 };
  var QUIET = { eng_logSay:1 };

  // 기기 등록: 등록 링크(#k=…)로 열면 키를 저장하고 주소창에서 바로 지운다
  var m = location.hash.match(/[#&]k=([A-Za-z0-9_-]{40,64})/);
  if (m) {
    try { localStorage.setItem(KEY, m[1]); } catch (e) {}
    history.replaceState(null, '', location.pathname + location.search);
  }
  function key(){ try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  function purge(){
    try {
      Object.keys(localStorage).forEach(function(k){ if (k.indexOf('hc:') === 0) localStorage.removeItem(k); });
    } catch (e) {}
  }

  var lastTouch = 0;
  ['pointerdown', 'keydown', 'input'].forEach(function(ev){
    document.addEventListener(ev, function(){ lastTouch = Date.now(); }, true);
  });

  function call(fn, args, tries){
    tries = tries || 0;
    return fetch(API, {
      method: 'POST', redirect: 'follow', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ k: key(), fn: fn, args: args })
    }).then(function(r){
      if (!r.ok) throw new Error('서버 응답 ' + r.status);
      return r.json();
    }).catch(function(e){
      // 구글이 가끔 404·5xx 를 한 번 돌려준다(배포 직후·부하). 읽기만 두 번까지 다시 시도한다 — 쓰기는 중복 위험이라 안 한다
      if (READ[fn] && tries < 2) return new Promise(function(res){ setTimeout(res, 1200 * (tries + 1)); }).then(function(){ return call(fn, args, tries + 1); });
      throw e;
    }).then(function(j){
      if (!j.ok) {
        if (j.err === 'auth') { gate(); throw new Error('등록되지 않은 기기예요'); }
        throw new Error(j.err || '오류');
      }
      return j.v;
    });
  }

  // 읽기 호출은 마지막 결과를 먼저 보여주고(즉시), 새 값이 오면 바꾼다.
  // 그 사이 사용자가 화면을 만졌으면 덮지 않고 알림만 띄운다(입력하던 게 날아가지 않게).
  function run(fn, args, ok, fail){
    if (!key()) { gate(); return; }
    var ck = READ[fn] ? 'hc:' + fn + ':' + JSON.stringify(args) : null;
    var cached = null, t0 = Date.now();
    if (ck) { try { cached = localStorage.getItem(ck); } catch (e) {} }
    if (cached) setTimeout(function(){ if (ok) ok(JSON.parse(cached)); }, 0);
    call(fn, args).then(function(v){
      var s = JSON.stringify(v);
      if (ck) {
        try { localStorage.setItem(ck, s); }
        catch (e) { purge(); try { localStorage.setItem(ck, s); } catch (e2) {} }
      } else if (!QUIET[fn]) purge();      // 뭔가 바꿨으면 저장해 둔 화면은 낡았다
      if (!cached) { if (ok) ok(v); return; }
      if (s === cached) return;
      if (lastTouch > t0) toast('새 정보가 왔어요 · 눌러서 반영', function(){ if (ok) ok(v); });
      else if (ok) ok(v);
    }).catch(function(e){
      if (cached) { toast('연결이 안 돼서 저장된 화면을 보여줘요'); return; }
      if (fail) fail(e);
      else if (!QUIET[fn]) toast(e.message);
    });
  }

  function mk(ok, fail){
    var base = {
      withSuccessHandler: function(f){ return mk(f, fail); },
      withFailureHandler: function(f){ return mk(ok, f); },
      withUserObject: function(){ return p; }
    };
    var p = new Proxy(base, { get: function(t, name){
      if (name in t) return t[name];
      if (typeof name !== 'string') return undefined;
      return function(){ run(name, Array.prototype.slice.call(arguments), ok, fail); };
    }});
    return p;
  }
  window.google = { script: { run: mk(null, null) } };

  /* 알림 */
  function toast(msg, onTap){
    var t = document.getElementById('hkToast');
    if (!t) {
      t = document.createElement('div'); t.id = 'hkToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);'
        + 'background:#1f2733;color:#fff;padding:11px 16px;border-radius:12px;font-size:14px;z-index:999;'
        + 'box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:90vw;display:none;cursor:pointer';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.display = 'block';
    t.onclick = function(){ t.style.display = 'none'; if (onTap) onTap(); };
    clearTimeout(t._h); t._h = setTimeout(function(){ t.style.display = 'none'; }, onTap ? 8000 : 3500);
  }

  /* 미등록 기기 */
  function gate(){
    if (document.getElementById('hkGate')) return;
    var show = function(){
      var g = document.createElement('div'); g.id = 'hkGate';
      g.style.cssText = 'position:fixed;inset:0;background:#f4f6f9;z-index:1000;display:flex;align-items:center;'
        + 'justify-content:center;padding:24px;font-family:system-ui,sans-serif;text-align:center';
      g.innerHTML = '<div style="max-width:360px"><div style="font-size:52px">🔒</div>'
        + '<h2 style="margin:10px 0">등록된 기기만 열 수 있어요</h2>'
        + '<p style="color:#6b7484;line-height:1.6;font-size:14px">우리 집 <b>등록 코드</b>를 입력하세요. 한 번만 하면 이 기기는 계속 열려요.</p>'
        + '<input id="hkCode" type="password" inputmode="numeric" autocomplete="off" maxlength="32" placeholder="등록 코드" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:10px;font-size:18px;text-align:center;letter-spacing:4px">'
        + '<div id="hkMsg" style="min-height:20px;margin-top:8px;color:#dc2626;font-size:13px"></div>'
        + '<button id="hkGo" style="width:100%;margin-top:6px;padding:12px;border:none;border-radius:10px;background:#2563eb;color:#fff;font-size:16px;font-weight:700">등록</button></div>';
      document.body.appendChild(g);
      var go = document.getElementById('hkGo'), inp = document.getElementById('hkCode'), msg = document.getElementById('hkMsg');
      var submit = function(){
        var code = inp.value.trim(); if (!code) return;
        go.disabled = true; go.textContent = '확인 중…'; msg.textContent = '';
        fetch(API, { method: 'POST', redirect: 'follow', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'pair', args: [code] }) })
          .then(function(r){ if (!r.ok) throw new Error('서버 응답 ' + r.status); return r.json(); })
          .then(function(j){
            if (j.ok && j.v && j.v.key) { try { localStorage.setItem(KEY, j.v.key); } catch (e) {} location.reload(); return; }
            go.disabled = false; go.textContent = '등록'; inp.value = '';
            msg.textContent = j.err === 'locked' ? '시도가 너무 많아요. ' + j.wait + '분 뒤에 다시 해 주세요'
              : j.err === 'code' ? '코드가 달라요 (남은 ' + j.left + '번)' : '잠시 뒤에 다시 해 주세요';
          }).catch(function(e){ go.disabled = false; go.textContent = '등록'; msg.textContent = '연결 실패: ' + e.message; });
      };
      go.onclick = submit;
      inp.onkeydown = function(ev){ if (ev.key === 'Enter') submit(); };
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }

  /* 이 기기 등록 해제 (분실·교체 대비) */
  document.addEventListener('DOMContentLoaded', function(){
    if (!key()) { gate(); return; }
    var hd = document.querySelector('.hd');
    if (hd) {
      var b = document.createElement('button');
      b.textContent = '🔒'; b.title = '이 기기 등록 해제';
      b.style.cssText = 'border:none;background:none;font-size:16px;cursor:pointer;padding:4px';
      b.onclick = function(){
        if (!confirm('이 기기의 등록을 해제할까요?\n저장된 화면도 지워지고, 다시 쓰려면 등록 링크가 필요해요.')) return;
        purge(); try { localStorage.removeItem(KEY); } catch (e) {}
        location.reload();
      };
      hd.appendChild(b);
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
})();
