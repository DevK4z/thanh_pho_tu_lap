/* Lớp backend: đăng nhập và kho dữ liệu.
   - Có window.FIREBASE_CONFIG: dùng Firebase Auth (Google, Facebook, khách ẩn danh) và Firestore.
   - Không có: chế độ thử, lưu trong localStorage, chỉ đăng nhập khách.
   Cả hai cung cấp cùng một API kiểu Firestore: db.doc(path) / db.collection(path) với get, set, update, onSnapshot, orderBy, limit. */
(function(){
'use strict';

var SDK='https://www.gstatic.com/firebasejs/10.12.2/';
var cfg=window.FIREBASE_CONFIG;

function loadScript(src){return new Promise(function(ok,fail){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=function(){fail(new Error('Không tải được '+src));};document.head.appendChild(s);});}
function err(code,message){var e=new Error(message||code);e.code=code;return e;}

/* ---------- Firebase ---------- */
function firebaseBackend(){
  var auth=null,db=null;
  function toUser(u){
    if(!u)return null;
    var p=u.isAnonymous?'guest':((u.providerData[0]||{}).providerId||'').replace('.com','');
    return {uid:u.uid,name:u.displayName||'',provider:p,photo:u.photoURL||''};
  }
  function popup(provider){
    return auth.signInWithPopup(provider).catch(function(e){
      // Trình duyệt chặn popup (thường gặp trên điện thoại hoặc trong app Facebook/Zalo): chuyển trang để đăng nhập.
      if(e&&(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment'))return auth.signInWithRedirect(provider);
      throw e;
    });
  }
  var B={
    mode:'firebase',providers:{google:true,facebook:true,guest:true},db:null,
    start:function(){
      return loadScript(SDK+'firebase-app-compat.js')
        .then(function(){return Promise.all([loadScript(SDK+'firebase-auth-compat.js'),loadScript(SDK+'firebase-firestore-compat.js')]);})
        .then(function(){
          firebase.initializeApp(cfg);
          auth=firebase.auth();db=firebase.firestore();B.db=db;
          return auth.getRedirectResult().catch(function(e){B.redirectError=e;});
        });
    },
    onAuth:function(cb){return auth.onAuthStateChanged(function(u){cb(toUser(u));});},
    signIn:function(kind,name){
      if(kind==='google'){var g=new firebase.auth.GoogleAuthProvider();g.setCustomParameters({prompt:'select_account'});return popup(g);}
      if(kind==='facebook')return popup(new firebase.auth.FacebookAuthProvider());
      return auth.signInAnonymously().then(function(r){return r.user.updateProfile({displayName:name});});
    },
    signOut:function(){return auth.signOut();},
    newId:function(){return db.collection('_').doc().id;}
  };
  return B;
}

/* ---------- chế độ thử: localStorage ---------- */
function localBackend(){
  var KEY='tptl-local-db',UKEY='tptl-local-user';
  var data={},subs=[],authCbs=[];
  function load(){try{data=JSON.parse(localStorage.getItem(KEY))||{};}catch(e){data={};}}
  function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
  function notify(){Promise.resolve().then(function(){subs.slice().forEach(function(fn){fn();});});}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){return Promise.reject(err('quota_exceeded'));}notify();return Promise.resolve();}
  function watch(fn){subs.push(fn);fn();return function(){subs=subs.filter(function(x){return x!==fn;});};}
  function lastSeg(p){return p.split('/').pop();}
  function setPath(o,key,v){var ks=key.split('.'),i;for(i=0;i<ks.length-1;i++){if(!o[ks[i]]||typeof o[ks[i]]!=='object')o[ks[i]]={};o=o[ks[i]];}o[ks[ks.length-1]]=v;}
  function docSnap(path){var d=data[path];return {id:lastSeg(path),exists:d!==undefined,metadata:{hasPendingWrites:false},data:function(){return clone(d);}};}
  function docRef(path){
    return {
      id:lastSeg(path),
      get:function(){return Promise.resolve(docSnap(path));},
      set:function(v,opt){data[path]=opt&&opt.merge&&data[path]?Object.assign(data[path],clone(v)):clone(v);return persist();},
      update:function(p){if(!data[path])return Promise.reject(err('not-found','Không tìm thấy dữ liệu.'));var d=data[path];Object.keys(p).forEach(function(k){setPath(d,k,clone(p[k]));});return persist();},
      onSnapshot:function(o,cb){cb=typeof o==='function'?o:cb;return watch(function(){cb(docSnap(path));});}
    };
  }
  function query(coll,ord,lim){
    function run(){
      var pre=coll+'/';
      var docs=Object.keys(data).filter(function(k){return k.indexOf(pre)===0&&k.slice(pre.length).indexOf('/')<0;}).map(docSnap);
      if(ord)docs.sort(function(a,b){var x=a.data()[ord.f],y=b.data()[ord.f];return (x<y?-1:x>y?1:0)*(ord.dir==='desc'?-1:1);});
      if(lim)docs=docs.slice(0,lim);
      return {docs:docs,size:docs.length,empty:!docs.length};
    }
    return {
      doc:function(id){return docRef(coll+'/'+(id||B.newId()));},
      orderBy:function(f,dir){return query(coll,{f:f,dir:dir},lim);},
      limit:function(n){return query(coll,ord,n);},
      get:function(){return Promise.resolve(run());},
      onSnapshot:function(o,cb){cb=typeof o==='function'?o:cb;return watch(function(){cb(run());});}
    };
  }
  function getUser(){try{return JSON.parse(localStorage.getItem(UKEY));}catch(e){return null;}}
  function setUser(u){try{if(u)localStorage.setItem(UKEY,JSON.stringify(u));else localStorage.removeItem(UKEY);}catch(e){}authCbs.forEach(function(cb){cb(u);});}
  var B={
    mode:'local',providers:{google:false,facebook:false,guest:true},
    db:{doc:docRef,collection:function(p){return query(p);}},
    start:function(){
      load();
      // Đồng bộ giữa các tab cùng trình duyệt, để thử nhiều người trong một nhóm.
      window.addEventListener('storage',function(e){if(e.key===KEY){load();notify();}});
      return Promise.resolve();
    },
    onAuth:function(cb){authCbs.push(cb);cb(getUser());},
    signIn:function(kind,name){
      if(kind!=='guest')return Promise.reject(err('unsupported'));
      setUser({uid:'g'+B.newId(),name:name,provider:'guest',photo:''});return Promise.resolve();
    },
    signOut:function(){setUser(null);return Promise.resolve();},
    newId:function(){return Date.now().toString(36)+Math.random().toString(36).slice(2,10);}
  };
  return B;
}

window.Backend=cfg&&cfg.apiKey?firebaseBackend():localBackend();
})();
