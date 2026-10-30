
(function(){
'use strict';

/* ---------- tiện ích ---------- */
var pad=function(n){return String(n).padStart(2,'0');};
var dkey=function(ms){var d=new Date(ms);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var $=function(id){return document.getElementById(id);};
var avg=function(a){return a.reduce(function(x,y){return x+y;},0)/a.length;};
var pct=function(v){return v==null?'–':Math.round(v*100)+'%';};
var num=function(v){return v==null?'–':String(v);};
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function mmss(sec){sec=Math.max(0,Math.round(sec));var m=Math.floor(sec/60),s=sec%60;return pad(m)+':'+pad(s);}
function hm(ms){var d=new Date(ms);return pad(d.getHours())+':'+pad(d.getMinutes());}
function dmy(k){var p=k.split('-');return p[2]+'/'+p[1];}
function fmtMin(m){m=Math.round(m);if(m<60)return m+' phút';var h=Math.floor(m/60),r=m%60;return h+' giờ'+(r?' '+r+' phút':'');}
function niceMax(v){var p=Math.pow(10,Math.floor(Math.log10(v)));var n=v/p;var m=n<=1?1:n<=2?2:n<=5?5:10;return m*p;}
function toast(msg){var t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){t.hidden=true;},4200);}

/* ---------- dữ liệu cố định ---------- */
var ACTS={
  read:{n:'Đọc sách giấy',mode:'offline',d:'Cất điện thoại, đọc sách giấy. Quay lại khi hết giờ để trả lời câu hỏi xác nhận.',gl:'Sách và phần sẽ đọc',ph:'Tên sách, chương hoặc số trang',needNote:true},
  deep:{n:'Học sâu trên máy',mode:'screen',d:'Học hoặc làm bài trên máy tính. Rời trang sẽ được ghi nhận là xao nhãng.',gl:'Việc cần hoàn thành',ph:'Ví dụ: làm xong 20 câu bài tập',needNote:false},
  write:{n:'Viết và suy ngẫm',mode:'screen',d:'Viết nhật ký hoặc bài luận trên máy. Rời trang sẽ được ghi nhận.',gl:'Chủ đề sẽ viết',ph:'Một dòng về chủ đề',needNote:true},
  move:{n:'Vận động',mode:'offline',d:'Chạy bộ, tập thể dục, đạp xe. Cất điện thoại và quay lại khi hết giờ.',gl:'Bài tập',ph:'Ví dụ: chạy bộ quanh sân',needNote:false},
  plant:{n:'Chăm cây',mode:'offline',d:'Trồng, tưới, tỉa cây. Cất điện thoại và quay lại khi hết giờ.',gl:'Việc với cây',ph:'Ví dụ: thay chậu cho cây chanh',needNote:false}
};
var ACT_KEYS=['read','deep','write','move','plant'];
var DURS=[5,10,15,25,45,60,90];
var TIERS=[{t:1,min:5,n:'Mộc'},{t:2,min:15,n:'Tinh'},{t:3,min:30,n:'Quý'},{t:4,min:60,n:'Hiếm'}];
var ITEMS=[
  {id:'cay',n:'Cây xanh',t:1},{id:'hoa',n:'Vườn hoa',t:1},{id:'nhanho',n:'Nhà nhỏ',t:1},
  {id:'vuon',n:'Nhà có vườn',t:2},{id:'quan',n:'Quán trà',t:2},{id:'san',n:'Sân chơi',t:2},
  {id:'thuvien',n:'Thư viện',t:3},{id:'chungcu',n:'Chung cư',t:3},{id:'congvien',n:'Công viên',t:3},
  {id:'thap',n:'Tháp quan sát',t:4},{id:'kinh',n:'Tòa nhà xanh',t:4},{id:'truong',n:'Tòa thị chính',t:4}
];
var HST={
  san:{n:'Biệt thự mái lam',wall:'wood',roof:'rr',awn:'rg',rh:17,w:0.78,d:0.62,h:20,lift:9},
  trinh:{n:'Nhà phố hiện đại',wall:'wb',roof:'rb',awn:'awn',rh:12,w:0.9,d:0.7,h:19},
  ngoi:{n:'Nhà ngói đỏ',wall:'wa',roof:'rr',awn:'rg',rh:18,w:0.82,d:0.66,h:22},
  da:{n:'Biệt thự mái lục',wall:'wc',roof:'rg',awn:'rr',rh:18,w:0.84,d:0.68,h:23}
};
var HKEYS=['san','trinh','ngoi','da'];
var LV=[{lv:1,at:0,n:'Nền móng'},{lv:2,at:30,n:'Dựng khung'},{lv:3,at:90,n:'Lợp mái'},{lv:4,at:240,n:'Hoàn thiện'},{lv:5,at:600,n:'Nhà mẫu của thành phố'}];
var REASONS={tired:'Mệt hoặc buồn ngủ',urgent:'Có việc đột xuất',distracted:'Bị xao nhãng',hard:'Việc quá khó hoặc chán',closed:'Đóng trang giữa chừng',other:'Lý do khác'};

var DEF_Q=[
 {id:'a1',act:'all',q:'Tự kỷ luật khác với bị ép buộc ở điểm nào?',o:['Tự đặt mục tiêu và chọn cách thực hiện','Làm theo mọi yêu cầu của người khác','Không bao giờ nghỉ','Chỉ làm khi có hứng'],a:0},
 {id:'a2',act:'all',q:'Điều nào giúp giữ cam kết lâu dài tốt nhất?',o:['Đặt mục tiêu vừa sức và làm đều mỗi ngày','Làm thật nhiều trong một ngày rồi nghỉ cả tuần','Chờ có cảm hứng','Đặt mục tiêu càng khó càng tốt'],a:0},
 {id:'r1',act:'read',q:'Kỹ thuật nào giúp nhớ lâu hơn sau khi đọc một chương sách?',o:['Đọc lại ngay nhiều lần','Gấp sách và tự nhắc lại ý chính bằng lời của mình','Gạch chân thật nhiều','Đọc nhanh hơn'],a:1},
 {id:'r2',act:'read',q:'Trước khi đọc sâu, việc nào nên làm?',o:['Mở thông báo để không lỡ tin','Xác định hôm nay đọc đến đâu và cần rút ra điều gì','Vừa đọc vừa nghe nhạc có lời','Đọc khi đang buồn ngủ'],a:1},
 {id:'r3',act:'read',q:'Sau một phiên đọc, cách ghi chú hiệu quả là',o:['Chép nguyên văn cả trang','Viết 2–3 câu tóm tắt bằng lời của mình','Không ghi gì','Chụp ảnh các trang'],a:1},
 {id:'d1',act:'deep',q:'Một phiên Pomodoro truyền thống tập trung khoảng bao lâu?',o:['5 phút','25 phút','90 phút','3 giờ'],a:1},
 {id:'d2',act:'deep',q:'Điều gì làm giảm tập trung sâu nhiều nhất?',o:['Đặt điện thoại ở xa','Chuyển qua lại giữa nhiều tab và tin nhắn','Ghi mục tiêu cho phiên học','Ngồi nơi yên tĩnh'],a:1},
 {id:'d3',act:'deep',q:'Trước phiên học sâu nên chuẩn bị gì?',o:['Mở mạng xã hội để thư giãn','Xác định một nhiệm vụ cụ thể','Làm ba việc cùng lúc','Bật mọi thông báo'],a:1},
 {id:'w1',act:'write',q:'Viết tự do vài phút mỗi ngày giúp ích điều gì?',o:['Làm rõ suy nghĩ và cảm xúc','Làm tăng chiều cao','Thay thế giấc ngủ','Không có tác dụng'],a:0},
 {id:'w2',act:'write',q:'Câu nào hợp để mở đầu một đoạn viết sau phiên tập trung?',o:['Hôm nay mình đã làm trọn việc nào và vì sao?','Ai đang trực tuyến?','Có tin gì mới trên mạng xã hội?','Khi nào hết giờ?'],a:0},
 {id:'m1',act:'move',q:'Phần nào của buổi tập giúp giảm nguy cơ chấn thương?',o:['Bỏ qua khởi động','Khởi động kỹ trước khi tập','Tập thật mạnh ngay từ phút đầu','Nhịn uống nước'],a:1},
 {id:'m2',act:'move',q:'Sau khi tập nên làm gì?',o:['Dừng đột ngột và nằm xuống','Thả lỏng, giãn cơ nhẹ và bù nước','Tắm nước lạnh ngay khi đang rất nóng','Ăn thật nhiều đồ ngọt'],a:1},
 {id:'m3',act:'move',q:'Dấu hiệu nào cho thấy nên dừng tập ngay?',o:['Hơi mệt và toát mồ hôi','Chóng mặt, đau tức ngực','Khát nước nhẹ','Tim đập nhanh hơn lúc nghỉ'],a:1},
 {id:'p1',act:'plant',q:'Thời điểm tưới cây phù hợp trong ngày là',o:['Giữa trưa nắng gắt','Sáng sớm hoặc chiều mát','Lúc nửa đêm','Giờ nào cũng như nhau'],a:1},
 {id:'p2',act:'plant',q:'Dấu hiệu cây bị tưới quá nhiều nước là',o:['Lá vàng, đất úng nước','Lá xanh bóng','Cây ra hoa','Đất tơi xốp'],a:0},
 {id:'p3',act:'plant',q:'Vì sao chậu cây cần lỗ thoát nước?',o:['Cho đẹp hơn','Tránh úng rễ','Tiết kiệm đất','Để cây mọc nhanh gấp đôi'],a:1}
];

/* ---------- trạng thái ---------- */
/* root: kho gốc; db: kho của nhóm đang tham gia (groups/{gid}/…); auth: tài khoản đăng nhập; profile: users/{uid} (undefined khi đang tải). */
var S={root:null,db:null,auth:null,profile:undefined,gid:null,group:undefined,groups:null,uid:null,isAdmin:false,ready:false,loaded:false,players:{},me:null,custom:[],
  tab:'town',flow:null,period:7,logs:{},detail:null,resumed:false,q:null,err:null,bootErr:null,lastResult:null,onb:{name:'',style:'san',goal:30},
  guestName:'',pendingName:'',busy:null,gp:{name:'',pick:null}};
var timer=null,wake=null,unsubGroup=[],unsubGroups=null,unsubProfile=null;

/* ---------- ghi dữ liệu ---------- */
function errMsg(e){
  if(e&&e.code==='permission-denied')return 'Không có quyền ghi hoặc đọc dữ liệu này. Hãy tải lại trang hoặc tham gia lại nhóm.';
  if(e&&(e.code==='quota_exceeded'||e.code==='resource-exhausted'))return 'Kho dữ liệu đã đầy hoặc quá tải. Hãy báo trưởng nhóm.';
  if(e&&e.code==='unavailable')return 'Mất kết nối máy chủ. Dữ liệu sẽ được gửi lại khi có mạng.';
  return 'Không lưu được'+(e&&(e.message||e.code)?': '+(e.message||e.code):'.');
}
function enqueue(fn){S.q=(S.q||Promise.resolve()).then(fn).catch(function(e){toast(errMsg(e));});return S.q;}
function applyLocal(p){var me=S.me||{};var n=Object.assign({},me,p);if(p.days)n.days=Object.assign({},me.days||{},p.days);S.me=n;S.players[S.uid]=n;}
/* days chỉ chứa ngày thay đổi: ghi theo đường dẫn "days.<ngày>" để không xóa các ngày khác. */
function save(patch){
  applyLocal(patch);
  var up=Object.assign({},patch);
  if(patch.days){delete up.days;Object.keys(patch.days).forEach(function(k){up['days.'+k]=patch.days[k];});}
  return enqueue(function(){return S.db.doc('players/'+S.uid).update(up);});
}
function saveLog(f,extra){
  var rec=Object.assign({at:Date.now(),day:f.day||dkey(f.startedAt),act:f.act,mode:f.mode,planned:f.plannedSec,away:Math.round(f.awaySec||0),dist:f.dist||0,missed:f.missed||0,qa:f.qa||0,qc:f.qc||0,goal:f.goal||''},extra);
  return enqueue(function(){return S.db.doc('logs/'+S.uid+'/sessions/'+f.sid).set(rec);}).then(function(){delete S.logs[S.uid];});
}

/* ---------- số liệu ---------- */
var Z=function(){return {s:0,c:0,q:0,pl:0,ac:0,cs:0,aw:0,dn:0,ms:0,qa:0,qc:0,fs:0,fn:0};};
function keysBack(n,off){var out=[];var base=new Date();base.setHours(12,0,0,0);for(var i=n-1+(off||0);i>=(off||0);i--){var d=new Date(base);d.setDate(base.getDate()-i);out.push(dkey(d.getTime()));}return out;}
function sumDays(days,keys){var t=Z();var act=0;keys.forEach(function(k){var d=days&&days[k];if(!d)return;for(var f in t)t[f]+=(d[f]||0);if((d.s||0)>0)act++;});t.act=act;return t;}
function metrics(t,nDays,joined){
  var m=Object.assign({},t);
  m.comp=t.s?t.c/t.s:null;
  m.quitRate=t.s?t.q/t.s:null;
  m.kept=t.pl?Math.min(1,t.ac/t.pl):null;
  m.focus=t.fn?Math.round(t.fs/t.fn):null;
  var eff=Math.max(1,Math.min(nDays,Math.floor((Date.now()-(joined||0))/86400000)+1));
  m.cons=Math.min(1,t.act/eff);
  m.disc=t.s?Math.round(100*(0.4*m.comp+0.3*m.kept+0.3*m.cons)):null;
  m.quiz=t.qa?t.qc/t.qa:null;
  return m;
}
function scoreSession(r){
  var quiz=r.qa?r.qc/r.qa:1;
  if(r.mode==='screen'){
    var base=r.activeSec>0?(1-Math.min(1,r.awaySec/r.activeSec))*100:0;
    var pen=3*r.distractions+5*r.missed;
    return Math.round(Math.max(0,base-pen)*(0.75+0.25*quiz));
  }
  return Math.round(0.6*quiz*100+0.4*((r.self||3)/5*100));
}
function levelOf(min){var L=LV[0];LV.forEach(function(l){if(min>=l.at)L=l;});var next=null;for(var i=0;i<LV.length;i++){if(LV[i].at>min){next=LV[i];break;}}return {lv:L.lv,n:L.n,at:L.at,next:next};}
function tierFor(min){var t=0;TIERS.forEach(function(x){if(min>=x.min)t=x.t;});return t;}
function streakOf(days){var n=0;var base=new Date();base.setHours(12,0,0,0);for(var i=0;i<400;i++){var d=new Date(base);d.setDate(base.getDate()-i);var k=dkey(d.getTime());var x=days&&days[k];if(x&&x.c>0)n++;else if(i===0)continue;else break;}return n;}
function delta(a,b){return (a==null||b==null)?null:a-b;}
function trendHTML(d,unit){
  if(d==null)return '<span class="deltas flat">chưa đủ dữ liệu so sánh</span>';
  var r=Math.round(d);
  if(r>=3)return '<span class="deltas up">▲ +'+r+(unit||'')+' so với kỳ trước</span>';
  if(r<=-3)return '<span class="deltas down">▼ '+r+(unit||'')+' so với kỳ trước</span>';
  return '<span class="deltas flat">– ổn định so với kỳ trước</span>';
}

/* ---------- biểu đồ ---------- */
function chartBars(labels,vals,aria){
  var W=420,H=190,L=34,R=8,T=12,B=26;var mx=niceMax(Math.max(10,Math.max.apply(null,vals)));
  var iw=W-L-R,ih=H-T-B,bw=iw/vals.length;
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(aria)+'">';
  [0,0.5,1].forEach(function(f){var y=T+ih*(1-f);s+='<line class="gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/><text class="tx" x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end">'+Math.round(mx*f)+'</text>';});
  vals.forEach(function(v,i){var h=ih*v/mx;var x=L+i*bw+bw*0.18;s+='<rect class="bar" x="'+x.toFixed(1)+'" y="'+(T+ih-h).toFixed(1)+'" width="'+(bw*0.64).toFixed(1)+'" height="'+Math.max(h,v>0?2:0).toFixed(1)+'" rx="2"/>';if((vals.length-1-i)%2===0)s+='<text class="tx" x="'+(L+i*bw+bw/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+labels[i]+'</text>';});
  return s+'</svg>';
}
function chartLines(labels,series,aria){
  var W=420,H=200,L=34,R=14,T=12,B=26,n=labels.length;var iw=W-L-R,ih=H-T-B;
  var X=function(i){return n>1?L+iw*i/(n-1):L+iw/2;},Y=function(v){return T+ih*(1-v/100);};
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(aria)+'">';
  [0,50,100].forEach(function(v){s+='<line class="gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text class="tx" x="'+(L-6)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+v+'</text>';});
  labels.forEach(function(lb,i){if(n<=7||(n-1-i)%2===0)s+='<text class="tx" x="'+X(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+lb+'</text>';});
  series.forEach(function(se){
    var seg=[];var cur=[];se.vals.forEach(function(v,i){if(v==null){if(cur.length)seg.push(cur);cur=[];}else cur.push([X(i),Y(v),i]);});if(cur.length)seg.push(cur);
    seg.forEach(function(sg){if(sg.length>1)s+='<polyline class="sl '+se.cls+'" points="'+sg.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' ')+'"/>';});
    var lastI=-1;se.vals.forEach(function(v,i){if(v!=null)lastI=i;});
    se.vals.forEach(function(v,i){if(v==null)return;s+='<circle class="p'+se.cls.replace('s','t')+'" cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="'+(i===lastI?5:2.8)+'"/>';});
  });
  return s+'</svg>';
}

/* ---------- thành phố đẳng cự ---------- */
var OX=300,OY=170,GN=7,gseq=0;
var SLOTS=[];(function(){for(var r=0;r<GN;r++)for(var c=0;c<GN;c++){if(r!==3&&c!==3&&!(r===1&&c===1))SLOTS.push([r,c]);}})();
var POP={nhanho:4,vuon:6,chungcu:40};
var CARS=[[3.18,1.1,'c','rr'],[2.82,4.9,'c','rb'],[1.2,2.82,'r','gold'],[5.3,3.18,'r','wd'],[3.18,6.0,'c','rg'],[0.4,3.18,'r','awn']];
function popOf(plot){return (plot||[]).reduce(function(s,p){return s+(POP[p.i]||0);},0);}
function tc(r,c){return [OX+(c-r)*32,OY+(c+r)*16+16];}
function pts(a){return a.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' ');}
function poly(a,cls){return '<polygon class="'+cls+'" points="'+pts(a)+'"/>';}
function at(x,y,s){return '<g transform="translate('+x.toFixed(1)+','+y.toFixed(1)+')">'+s+'</g>';}
var SPRT={"dc0":[120,102],"dc1":[117,99],"dc2":[123,102],"dc3":[116,134],"dc4":[112,136],"tm1":[125,116],"tm2":[135,126],"cv0":[80,100],"cv1":[67,104],"cv2":[74,101],"cv3":[89,99],"cv5":[131,102],"cv6":[119,98],"ct0":[143,190],"ct1":[98,176],"ct2":[155,185],"ht4":[87,81],"rock":[300,193],"bridge":[480,278],"pond":[340,220]};
function spr(id,x,y,sc){var q=SPRT[id];return '<use href="#sp-'+id+'" transform="translate('+(x-q[0]*sc/2).toFixed(1)+','+(y-q[1]*sc).toFixed(1)+') scale('+sc+')"/>';}
function sprc(id,x,y,sc,fl){var q=SPRT[id],w=q[0]*sc,h=q[1]*sc;return '<use href="#sp-'+id+'" transform="translate('+(fl?x+w/2:x-w/2).toFixed(1)+','+(y-h/2).toFixed(1)+') scale('+(fl?-sc:sc)+','+sc+')"/>';}
function foot(w,d,z){var a=w/2,b=d/2;return {N:[-32*a+32*b,-16*a-16*b-z],R:[32*a+32*b,16*a-16*b-z],F:[32*a-32*b,16*a+16*b-z],L:[-32*a-32*b,-16*a+16*b-z]};}
function fpt(w,d,z,face,u,v){var B=foot(w,d,z);var A=face==='L'?B.L:B.F,E=face==='L'?B.F:B.R;return [A[0]+u*(E[0]-A[0]),A[1]+u*(E[1]-A[1])-v];}
function win(w,d,z,face,u1,u2,v1,v2,m){return poly([fpt(w,d,z,face,u1,v1),fpt(w,d,z,face,u2,v1),fpt(w,d,z,face,u2,v2),fpt(w,d,z,face,u1,v2)],'m-'+m+(face==='R'?'-r':''));}
function archP(w,d,z,face,u1,u2,v1,v2){var rv=Math.min((u2-u1)*22,(v2-v1)*0.5),uc=(u1+u2)/2,hu=(u2-u1)/2,p=[fpt(w,d,z,face,u1,v1),fpt(w,d,z,face,u2,v1),fpt(w,d,z,face,u2,v2-rv)],k;for(k=1;k<=6;k++){var an=Math.PI*k/7;p.push(fpt(w,d,z,face,uc+hu*Math.cos(an),v2-rv+rv*Math.sin(an)));}p.push(fpt(w,d,z,face,u1,v2-rv));return p;}
function winF(w,d,z,face,u1,u2,v1,v2){var e=0.022,g=archP(w,d,z,face,u1,u2,v1,v2);return poly(archP(w,d,z,face,u1-e,u2+e,v1-1.5,v2+1.5),'m-wd'+(face==='R'?'-r':''))+poly(g,'m-win'+(face==='R'?'-r':''))+win(w,d,z,face,(u1+u2)/2-0.007,(u1+u2)/2+0.007,v1,v2-3,'wd'+(face==='R'?'-r':''));}
function sill(w,d,z,face,u1,u2,v){return win(w,d,z,face,u1-0.04,u2+0.04,v-3,v-1,'stone'+(face==='R'?'-r':''));}
function dome(r,h,z){var p=[],k;for(k=0;k<=10;k++){var an=Math.PI*k/10;p.push([-r*Math.cos(an),-z-h*Math.sin(an)]);}
  var right=p.slice(5).concat([[0,-z]]);
  return '<ellipse class="m-stone-r" cx="0" cy="'+(-z)+'" rx="'+(r+2)+'" ry="'+((r+2)/2).toFixed(1)+'"/>'+poly(p,'m-gold')+poly(right,'m-gold-r')+'<path class="ridge" d="M'+(-r*0.55).toFixed(1)+' '+(-z-h*0.5).toFixed(1)+' L'+(-r*0.2).toFixed(1)+' '+(-z-h*0.85).toFixed(1)+'"/><path class="pole" d="M0 '+(-z-h)+' V'+(-z-h-9)+'"/><circle class="m-gold" cx="0" cy="'+(-z-h-10)+'" r="2.2"/>';}
function donut(){return '<ellipse class="m-brick-r" cx="0" cy="3" rx="17" ry="9"/><ellipse class="m-wb" cx="0" cy="0" rx="17" ry="9"/><ellipse class="m-f1" cx="0" cy="-1" rx="14" ry="7"/><ellipse class="m-rg" cx="0" cy="-1" rx="5" ry="2.6"/>'+[[-9,-3,'m-wd'],[2,-6,'m-f2'],[8,0,'m-wd'],[-3,2,'m-f2'],[-12,2,'m-f2']].map(function(s){return '<rect class="'+s[2]+'" x="'+s[0]+'" y="'+s[1]+'" width="3" height="1.4" rx=".5"/>';}).join('');}

function awn(w,d,z,face,u1,u2,v,m){var a=fpt(w,d,z,face,u1,v),b=fpt(w,d,z,face,u2,v),o=face==='L'?[-7,4.5]:[7,4.5];return poly([a,b,[b[0]+o[0],b[1]+o[1]+3],[a[0]+o[0],a[1]+o[1]+3]],'m-'+m);}
function awnS(w,d,z,face,u1,u2,v,m1,m2,n){var s='',i,du=(u2-u1)/n;for(i=0;i<n;i++)s+=awn(w,d,z,face,u1+i*du,u1+(i+1)*du,v,i%2?m2:m1);return s;}
function box(w,d,h,z,m){var B=foot(w,d,z),T=foot(w,d,z+h);return poly([B.L,B.F,T.F,T.L],'m-'+m+'-l')+poly([B.F,B.R,T.R,T.F],'m-'+m+'-r')+poly([T.N,T.R,T.F,T.L],'m-'+m);}
function shadow(w,d){var F=foot(w,d,0);return '<polygon class="shd" opacity=".17" points="'+pts([F.N,F.R,F.F,F.L].map(function(p){return [p[0]+8,p[1]+3.5];}))+'"/>';}
function roof(w,d,rh,z,m,gm){
  var B=foot(w+0.14,d+0.2,z-1.5);
  var a=[(B.N[0]+B.L[0])/2,(B.N[1]+B.L[1])/2-rh],b=[(B.R[0]+B.F[0])/2,(B.R[1]+B.F[1])/2-rh];
  var o=poly([B.N,B.R,b,a],'m-'+m+'-r')+poly([B.R,B.F,b],'m-'+gm+'-r')+poly([B.L,B.F,b,a],'m-'+m),t,p1,p2;
  for(t=0.25;t<0.9;t+=0.25){p1=[B.L[0]+(a[0]-B.L[0])*t,B.L[1]+(a[1]-B.L[1])*t];p2=[B.F[0]+(b[0]-B.F[0])*t,B.F[1]+(b[1]-B.F[1])*t];o+='<path class="tl" d="M'+p1[0].toFixed(1)+' '+p1[1].toFixed(1)+' L'+p2[0].toFixed(1)+' '+p2[1].toFixed(1)+'"/>';}
  o+='<path class="eave" d="M'+B.L[0].toFixed(1)+' '+B.L[1].toFixed(1)+' L'+B.F[0].toFixed(1)+' '+B.F[1].toFixed(1)+'"/><path class="ridge" d="M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+' L'+b[0].toFixed(1)+' '+b[1].toFixed(1)+'"/>';
  return o;
}
function pyramid(w,d,rh,z,m){var B=foot(w,d,z);var ap=[0,-z-rh];return poly([B.L,B.F,ap],'m-'+m)+poly([B.F,B.R,ap],'m-'+m+'-r');}
function chimney(x,y){return at(x,y,box(0.12,0.12,13,0,'brick')+box(0.17,0.17,2,13,'stone'));}
function tree(x,y,s){return spr('cv0',x,y+3,0.42*(s||1));}
function pine(x,y,s){return spr('cv1',x,y+3,0.42*(s||1));}
function bush(x,y,s){return '<g transform="translate('+x+','+y+') scale('+(s||1)+')"><ellipse class="m-leaf-r" cx="0" cy="-4" rx="8" ry="5"/><ellipse class="m-leaf" cx="-2" cy="-6" rx="6" ry="4"/></g>';}
function carSVG(dir,m){var w=dir==='c'?0.36:0.16,d=dir==='c'?0.16:0.36;return box(w,d,5,0,m)+box(w*0.5,d*0.7,4,5,'glass');}

function home(o){
  var w=o.w,d=o.d,h=o.h,z=o.z||0,s='',ry;
  s+=box(w,d,h,z,o.wall)+box(w+0.03,d+0.03,2.5,z,'stone');
  if(o.detail){
    s+=winF(w,d,z,'L',0.09,0.27,h*0.4,h*0.78)+winF(w,d,z,'L',0.73,0.91,h*0.4,h*0.78);
    s+=win(w,d,z,'L',0.41,0.59,0,h*0.64,'door')+awn(w,d,z,'L',0.36,0.64,h*0.72,o.awn||'awn');
    s+=winF(w,d,z,'R',0.2,0.42,h*0.4,h*0.78)+winF(w,d,z,'R',0.58,0.8,h*0.4,h*0.78);
  }
  s+=roof(w,d,o.rh,z+h,o.roof,o.wall);
  ry=-(z+h-1.5)-o.rh;
  if(o.chim)s+=chimney(w*14,ry+w*7);
  return s;
}
var ISPR={nhanho:['dc0',.62],vuon:['dc1',.62],quan:['tm1',.56],san:['cv5',.54],thuvien:['ct0',.52],chungcu:['dc3',.62],congvien:['cv6',.6],thap:['ct1',.66],kinh:['dc4',.64],truong:['ct2',.5]};
function itemSVG(id,g,v){
  var o='',q=ISPR[id];
  if(q)o=spr(q[0],0,17,q[1]);
  else if(id==='cay')o=spr('cv1',-15,15,.42)+spr('cv0',10,19,.5)+spr('cv2',-2,25,.42);
  else if(id==='hoa')o=spr('cv3',-12,17,.5)+spr('cv3',17,22,.36);
  if(g)o+='<path class="m-gold" transform="translate(30,-'+(q?Math.round(q[1]*0+70):50)+')" d="M0 -9l2.4 6.6 6.6 2.4-6.6 2.4L0 9l-2.4-6.6L-9 0l6.6-2.4z"/>';
  return o;
}
var HSPR={ngoi:'dc0',da:'dc1',san:'dc2',trinh:'tm2'};
function houseSVG(key,lv){
  var s=HST[key]||HST.ngoi,w=s.w,d=s.d,h=s.h,Z=2.5,o='',P,Q,T;
  if(lv<3){
    o+=shadow(w+0.24,d+0.24)+box(w+0.1,d+0.1,2.5,0,'stone');
    if(lv<2){P=foot(w,d,2.5);o+='<polygon class="outline" points="'+pts([P.N,P.R,P.F,P.L])+'"/>'+at(-16,-3,box(0.22,0.14,6,2.5,'wood'))+at(10,5,box(0.18,0.18,9,2.5,'brick'))+at(20,-6,box(0.16,0.12,5,2.5,'stone'))+at(-2,6,box(0.2,0.12,4,2.5,'wood'));return o;}
    Q=foot(w,d,Z);T=foot(w,d,Z+h);
    o+='<g opacity=".4">'+box(w,d,h,Z,s.wall)+'</g>';
    [Q.N,Q.L,Q.R,Q.F].forEach(function(p){o+=at(p[0],p[1],box(0.07,0.07,h,0,'wood'));});
    o+='<polygon class="outline" points="'+pts([T.N,T.R,T.F,T.L])+'"/>';
    return o;
  }
  if(lv>=4)o+=spr('cv0',-40,16,.36);
  o+=spr(HSPR[key]||'dc0',0,19,0.74);
  if(lv>=4)o+=spr('cv3',40,18,.34);
  if(lv>=5)o+='<path class="pole" d="M-6 -74V-100"/><polygon class="m-gold" points="-6,-100 14,-93 -6,-86"/><circle class="m-f1" cx="-30" cy="14" r="3"/><circle class="m-f2" cx="-22" cy="18" r="3"/><circle class="m-f1" cx="34" cy="16" r="3"/>';
  return o;
}
function walkStrip(r,c){
  var ct=tc(r,c),N=[ct[0],ct[1]-16],R=[ct[0]+32,ct[1]],F=[ct[0],ct[1]+16],L=[ct[0]-32,ct[1]],k=0.17,out='';
  var st=function(A,B,off){return poly([A,B,[B[0]+off[0],B[1]+off[1]],[A[0]+off[0],A[1]+off[1]]],'m-walk');};
  if(r===2)out+=st(L,F,[32*k,-16*k]);
  if(r===4)out+=st(N,R,[-32*k,16*k]);
  if(c===2)out+=st(F,R,[-32*k,-16*k]);
  if(c===4)out+=st(N,L,[32*k,16*k]);
  return out;
}
function gp(r,c){var p=tc(r,c);return [p[0],p[1]-16];}
function gpoly(a,cls){return poly(a.map(function(q){return gp(q[0],q[1]);}),cls);}
function rocks(x,y,s){return '<g transform="translate('+x+','+y+') scale('+s+')"><polygon class="m-rock-r" points="-40,0 -34,-30 -14,-52 8,-46 30,-60 52,-34 56,0"/><polygon class="m-rock" points="-34,-30 -14,-52 8,-46 0,-20 -18,-8"/><polygon class="m-rock-l" points="8,-46 30,-60 52,-34 34,-18 14,-30"/><polygon class="m-rock" points="-40,0 -34,-30 -18,-8 -22,4"/><path class="tl" d="M-14 -52 L-6 -20 M30 -60 L24 -24"/></g>';}
function fieldSVG(kind){
  var s='',i,col=kind?['m-f2','m-wb']:['m-rg','m-leaf'];
  for(i=0;i<6;i++){var a=0.08+i*0.14,b=a+0.09;var A=[-32*0.85*0+0,0];
    s+=poly([tcOff(a,0.1),tcOff(a,0.9),tcOff(b,0.9),tcOff(b,0.1)],col[i%2]);}
  return s;
}
function tcOff(u,v){/* u theo r, v theo c, trong một lô: gốc ở tâm lô */return [(v-0.5)*64-(u-0.5)*64+0,((v-0.5)+(u-0.5))*32];}
function riverB(off){var p=[],t,k=0,w=function(x){var tp=Math.min(1,Math.max(0,(7.45-x)/1.6));return tp*(0.11*Math.sin(x*1.9+off*3)+0.06*Math.sin(x*4.3+1));};
  for(t=-1.6;t<7.45;t+=0.25)p.push([t,7.45+off+w(t)]);p.push([7.45+off,7.45+off]);
  for(t=7.2;t>=-1.7;t-=0.25)p.push([7.45+off+w(t+0.7),t]);return p;}
function riverP(off,cls){return gpoly(riverB(off).concat([[9,-1.6],[9,9],[-1.6,9]]).slice(0),cls);}
function riverLine(off){return '<path class="foam2" d="M'+riverB(off).map(function(q){var g=gp(q[0],q[1]);return g[0].toFixed(1)+' '+g[1].toFixed(1);}).join(' L')+'"/>';}
function plotSVG(me,pick){
  var plot=me.plot||[],L=levelOf(me.totalFocusMin||0),gid='sg'+(gseq++),s,r,c,i;
  s='<svg viewBox="0 40 600 430" role="img" aria-label="Thành phố của '+esc(me.name)+', '+esc((HST[me.style]||HST.ngoi).n)+', giai đoạn '+esc(L.n)+', '+plot.length+' công trình">';
  s+='<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sea1)"/><stop offset="1" style="stop-color:var(--sea2)"/></linearGradient></defs><rect y="0" width="600" height="470" fill="url(#'+gid+')"/>';
  s+='<use class="gbg" href="#bg-grass"/>'+sprc('rock',300,70,0.5)+sprc('rock',525,128,0.62)+sprc('pond',110,118,0.6);
  /* núi đá + thác ở góc sau */
  /* mặt đất + sông bao quanh phía trước */
  for(r=0;r<GN;r++)for(c=0;c<GN;c++){var ct=tc(r,c),road=(r===3||c===3);
    if(road)s+=poly([[ct[0],ct[1]-16],[ct[0]+32,ct[1]],[ct[0],ct[1]+16],[ct[0]-32,ct[1]]],'m-asph');}
  s+=riverP(-0.34,'m-sand');s+=riverP(0,'wat').replace('<polygon ','<polygon fill="url(#pw)" ');s+=riverLine(0.12).replace('foam2','shal');s+=riverLine(0.3).replace('foam2','shal2');s+=riverLine(0);
  for(r=0;r<GN;r++)for(c=0;c<GN;c++){if(r!==3&&c!==3)s+=walkStrip(r,c);}
  var ln=function(r1,c1,r2,c2){var a=tc(r1,c1),b=tc(r2,c2);return '<path class="lane" d="M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+' L'+b[0].toFixed(1)+' '+b[1].toFixed(1)+'"/>';};
  s+=ln(3,-0.4,3,2.45)+ln(3,3.55,3,GN-0.4)+ln(-0.4,3,2.45,3)+ln(3.55,3,GN-0.4,3);
  var dr=[],hc=tc(1,1);
  dr.push({d:2,r:1,s:at(hc[0],hc[1],houseSVG(me.style,L.lv))});
  /* rừng thông quanh rìa phía sau và bên trái */
  var k;for(k=-2;k<=8;k++){[[-0.9,k+0.2,0],[-1.9,k+0.7,1]].forEach(function(q){if(q[1]<-2.4)return;var p=tc(q[0],q[1]);dr.push({d:q[0]+q[1],r:q[0],s:pine(p[0],p[1]+(q[2]?4:0),0.95+((k&1)*0.15))});});}
  for(k=0;k<=6;k++){[[k+0.3,-0.9],[k+0.9,-1.9]].forEach(function(q,j){var p=tc(q[0],q[1]);dr.push({d:q[0]+q[1],r:q[0],s:(k%3===0&&!j)?tree(p[0],p[1],1):pine(p[0],p[1],0.95)});});}
  for(k=0;k<=6;k++){var pq=tc(-0.9-(k%2)*0.5,7.9+k*0.55-0.2);if(k<4)dr.push({d:-0.9+7.9+k*.5,r:-0.9,s:pine(pq[0],pq[1],0.95)});}
  SLOTS.forEach(function(rc,i){if(plot.some(function(p){return p.s===i;}))return;var ct=tc(rc[0],rc[1]);var m=i%6;
    if(m===0||m===3)dr.push({d:rc[0]+rc[1]-0.2,r:rc[0],s:at(ct[0],ct[1],fieldSVG(m===0))});
    else{var bx=((i*13+5)%19)-9,by=((i*7+2)%9)-3;dr.push({d:rc[0]+rc[1]-0.3,r:rc[0],s:at(ct[0]+bx,ct[1]+by,(m===1?tree(0,0,0.7):bush(0,0,0.8)))+at(ct[0]-bx*0.6-6,ct[1]-by*0.5+6,bush(0,0,0.55))});}});
  plot.forEach(function(p){var rc=SLOTS[p.s];if(!rc)return;var ct=tc(rc[0],rc[1]);dr.push({d:rc[0]+rc[1],r:rc[0],s:at(ct[0],ct[1],itemSVG(p.i,p.g,p.s))});});
  CARS.slice(0,Math.min(CARS.length,Math.floor(plot.length/2))).forEach(function(q){var ct=tc(q[0],q[1]);dr.push({d:q[0]+q[1],r:q[0],s:at(ct[0],ct[1],carSVG(q[2],q[3]))});});
  /* hai cây cầu bắc qua sông */
  var b1=tc(3,7.6),b2=tc(7.6,3);
  dr.push({d:14,r:3,s:sprc('bridge',b1[0],b1[1]-4,0.25,false)});dr.push({d:14,r:8,s:sprc('bridge',b2[0],b2[1]-4,0.25,true)});
  dr.sort(function(a,b){return a.d-b.d||a.r-b.r;});dr.forEach(function(x){s+=x.s;});
  if(pick){SLOTS.forEach(function(rc,i){var ct=tc(rc[0],rc[1]);var occ=plot.some(function(p){return p.s===i;});
    s+='<g class="slot'+(occ?' full':'')+'" data-act="pickslot" data-slot="'+i+'" tabindex="0" role="button" aria-label="Lô đất '+(i+1)+(occ?', đang có công trình, sẽ bị thay':'')+'"><polygon points="'+pts([[ct[0],ct[1]-16],[ct[0]+32,ct[1]],[ct[0],ct[1]+16],[ct[0]-32,ct[1]]])+'"/></g>';});}
  return s+'</svg>';
}

/* ---------- câu hỏi ---------- */
function bank(act){return DEF_Q.concat(S.custom||[]).filter(function(q){return q.act==='all'||q.act===act;});}
function pickQ(f){
  var pool=bank(f.act).filter(function(q){return f.used.indexOf(q.id)<0;});
  if(!pool.length){f.used=[];pool=bank(f.act);}
  var q=pool[Math.floor(Math.random()*pool.length)];f.used.push(q.id);
  var idx=q.o.map(function(_,i){return i;});shuffle(idx);
  return {id:q.id,q:q.q,o:idx.map(function(i){return q.o[i];}),a:idx.indexOf(q.a)};
}

/* ---------- phiên tập trung ---------- */
function mkRun(a){
  var checks=[];
  if(a.mode==='screen'){
    var n=Math.min(6,Math.max(1,Math.floor(a.plannedSec/60/10)));
    for(var i=0;i<n;i++){var s0=0.15+0.75*i/n,s1=0.15+0.75*(i+1)/n;checks.push((s0+Math.random()*(s1-s0))*a.plannedSec);}
  }
  return {step:'run',sid:a.sid,act:a.act,mode:a.mode,plannedSec:a.plannedSec,startedAt:a.startedAt,goal:a.goal||'',day:a.day||dkey(a.startedAt),
    awaySec:0,awayAt:null,dist:0,missed:0,qa:0,qc:0,used:[],checks:checks,nextIdx:0,modal:null,quitAsk:false,lastAway:0};
}
async function beginSession(){
  var f=S.flow;
  var dur=Math.round(Number(f.dur));if(!(dur>=5&&dur<=180)){toast('Thời gian cam kết cần từ 5 đến 180 phút.');return;}
  var a=ACTS[f.act];
  var rec={sid:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),act:f.act,mode:a.mode,plannedSec:dur*60,startedAt:Date.now(),goal:(f.goal||'').trim().slice(0,120)};
  rec.day=dkey(rec.startedAt);
  var me=S.me;var d=Object.assign(Z(),(me.days||{})[rec.day]||{});d.s+=1;d.pl+=rec.plannedSec;
  S.flow=mkRun(rec);
  var p={};p.active=rec;p.days={};p.days[rec.day]=d;
  save(p);
  requestWake();
  go();runLoop();
}
function requestWake(){try{if(navigator.wakeLock&&navigator.wakeLock.request){navigator.wakeLock.request('screen').then(function(w){wake=w;}).catch(function(){});}}catch(e){}}
function releaseWake(){try{if(wake){wake.release();wake=null;}}catch(e){}}
function runLoop(){clearInterval(timer);timer=setInterval(tick,500);tick();}
function onAway(){var f=S.flow;if(!f||f.step!=='run'||f.mode!=='screen'||f.awayAt)return;f.awayAt=Date.now();}
function onBack(){
  var f=S.flow;if(!f||f.step!=='run'||f.mode!=='screen'||!f.awayAt)return;
  var dt=(Date.now()-f.awayAt)/1000;f.awayAt=null;
  if(dt>=3){f.awaySec+=dt;f.dist+=1;f.lastAway=dt;var b=$('awayBanner');if(b){b.textContent='Bạn vừa rời trang '+Math.round(dt)+' giây. Đã ghi nhận 1 lần xao nhãng.';b.hidden=false;clearTimeout(onBack.t);onBack.t=setTimeout(function(){b.hidden=true;},7000);}}
  updateRun();
}
document.addEventListener('visibilitychange',function(){if(document.hidden)onAway();else onBack();});
window.addEventListener('blur',onAway);
window.addEventListener('focus',onBack);
function tick(){
  var f=S.flow;if(!f||f.step!=='run'){clearInterval(timer);return;}
  var now=Date.now(),endAt=f.startedAt+f.plannedSec*1000;
  if(now>=endAt){finishRun(endAt);return;}
  if(f.mode==='screen'){
    if(f.modal&&now>f.modal.deadline)answerCheck(-1);
    else if(!f.modal&&!document.hidden&&!f.awayAt&&f.nextIdx<f.checks.length&&(now-f.startedAt)/1000>=f.checks[f.nextIdx])openCheck();
  }
  updateRun();
}
function updateRun(){
  var f=S.flow;if(!f||f.step!=='run')return;
  var now=Date.now(),left=Math.max(0,Math.ceil((f.startedAt+f.plannedSec*1000-now)/1000));
  var t=$('tLeft');if(!t)return;t.textContent=mmss(left);
  var circ=2*Math.PI*90;var r=$('rprog');if(r)r.setAttribute('stroke-dashoffset',(circ*(1-(1-left/f.plannedSec))).toFixed(1));
  if(f.mode==='screen'){
    var awayNow=f.awayAt?(now-f.awayAt)/1000:0;
    $('sDist').textContent=f.dist;$('sChk').textContent=f.qc+'/'+f.qa;$('sAway').textContent=Math.round(f.awaySec+awayNow)+' giây';
    if(f.modal){var c=$('chkLeft');if(c)c.textContent=Math.max(0,Math.ceil((f.modal.deadline-now)/1000));}
  }
}
function openCheck(){
  var f=S.flow;var q=pickQ(f);f.modal={q:q,deadline:Date.now()+45000};
  var m=$('modal');
  m.innerHTML='<div class="card stack" role="dialog" aria-modal="true" aria-label="Kiểm tra hiện diện"><div><p class="eyebrow">Kiểm tra hiện diện · còn <span id="chkLeft">45</span> giây</p><h3 style="margin-top:6px">'+esc(q.q)+'</h3></div>'+q.o.map(function(o,i){return '<button class="opt" data-act="chk" data-i="'+i+'"><b>'+esc(o)+'</b></button>';}).join('')+'<p class="small muted">Không trả lời kịp sẽ được ghi nhận là không phản hồi.</p></div>';
  m.hidden=false;
}
function answerCheck(i){
  var f=S.flow;if(!f||!f.modal)return;var q=f.modal.q;
  f.qa+=1;if(i===q.a)f.qc+=1;if(i===-1)f.missed+=1;
  f.modal=null;f.nextIdx+=1;$('modal').hidden=true;$('modal').innerHTML='';
  toast(i===-1?'Chưa kịp trả lời. Đã ghi nhận không phản hồi.':(i===q.a?'Chính xác.':'Chưa đúng, bạn vẫn tiếp tục phiên.'));
  updateRun();
}
function finishRun(endAt){
  var f=S.flow;
  if(f.awayAt){var dt=(endAt-f.awayAt)/1000;f.awayAt=null;if(dt>=3){f.awaySec+=dt;f.dist+=1;}}
  if(f.modal){f.modal=null;$('modal').hidden=true;$('modal').innerHTML='';}
  clearInterval(timer);releaseWake();
  var n=f.mode==='screen'?1:2;
  f.step='verify';f.vq=[];for(var i=0;i<n;i++)f.vq.push(pickQ(f));
  f.vans=new Array(n).fill(null);f.self=0;f.conf=false;f.note='';
  go();
}
function askQuit(){var f=S.flow;if(!f||f.step!=='run')return;f.quitAsk=true;showQuit();}
function showQuit(){
  var m=$('modal');
  m.innerHTML='<div class="card stack" role="dialog" aria-modal="true" aria-label="Dừng phiên"><h3>Dừng phiên sớm?</h3><p class="small muted">Phiên sẽ được ghi nhận là bỏ cuộc và không nhận công trình. Chọn lý do để giúp CLB hiểu vì sao các phiên bị dừng.</p><div class="row" id="rsn">'+Object.keys(REASONS).filter(function(k){return k!=='closed';}).map(function(k){return '<button class="chip" data-act="rsn" data-v="'+k+'" aria-pressed="false">'+REASONS[k]+'</button>';}).join('')+'</div><div class="row"><button class="btn" data-act="quitno">Tiếp tục phiên</button><button class="btn danger" data-act="quityes" id="quitYes" disabled>Xác nhận bỏ cuộc</button></div></div>';
  m.hidden=false;
}
async function doQuit(reason){
  var f=S.flow;clearInterval(timer);releaseWake();
  var el=Math.min(f.plannedSec,Math.round((Date.now()-f.startedAt)/1000));
  if(f.awayAt){f.awaySec+=(Date.now()-f.awayAt)/1000;f.awayAt=null;}
  $('modal').hidden=true;$('modal').innerHTML='';
  S.flow=null;S.tab='town';
  await recordQuit(f,reason,el);
  toast('Đã ghi nhận bỏ cuộc. Lần sau cố gắng lại nhé.');go();
}
async function recordQuit(f,reason,activeSec){
  var me=S.me||{};var day=f.day||dkey(f.startedAt);
  var d=Object.assign(Z(),(me.days||{})[day]||{});
  d.q+=1;d.ac+=activeSec;d.aw+=Math.round(f.awaySec||0);d.dn+=f.dist||0;d.ms+=f.missed||0;d.qa+=f.qa||0;d.qc+=f.qc||0;
  var qr=Object.assign({},me.quitReasons||{});qr[reason]=(qr[reason]||0)+1;
  var p={active:null,quitReasons:qr,lastAt:Date.now()};p.days={};p.days[day]=d;
  save(p);
  await saveLog(f,{status:'quit',reason:reason,active:activeSec,focus:null,note:'',self:0});
}
function toVerifyReady(){var f=S.flow;if(!f||f.step!=='verify')return false;var a=ACTS[f.act];var words=(f.note||'').trim().split(/\s+/).filter(Boolean).length;
  if(f.vans.some(function(x){return x==null;}))return false;if(!f.self)return false;if(f.mode==='offline'&&!f.conf)return false;if(a.needNote&&words<6)return false;return true;}
async function completeSession(){
  var f=S.flow;if(!toVerifyReady())return;
  f.vq.forEach(function(q,i){f.qa+=1;if(f.vans[i]===q.a)f.qc+=1;});
  var activeSec=f.plannedSec;
  var focus=scoreSession({mode:f.mode,plannedSec:f.plannedSec,activeSec:activeSec,awaySec:f.awaySec,distractions:f.dist,missed:f.missed,qa:f.qa,qc:f.qc,self:f.self});
  var me=S.me;var day=f.day;var d=Object.assign(Z(),(me.days||{})[day]||{});
  d.c+=1;d.ac+=activeSec;d.cs+=activeSec;d.aw+=Math.round(f.awaySec);d.dn+=f.dist;d.ms+=f.missed;d.qa+=f.qa;d.qc+=f.qc;d.fs+=focus;d.fn+=1;
  var minutes=Math.round(f.plannedSec/60);var tier=tierFor(minutes);
  var pending=(me.pending||[]).concat([{sid:f.sid,t:tier,g:focus>=85?1:0,m:minutes,a:f.act}]);
  var p={active:null,totalFocusMin:(me.totalFocusMin||0)+minutes,pending:pending,lastAt:Date.now()};p.days={};p.days[day]=d;
  S.lastResult={focus:focus,minutes:minutes,tier:tier,shiny:focus>=85,qc:f.qc,qa:f.qa,dist:f.dist,away:Math.round(f.awaySec),missed:f.missed,mode:f.mode,prevLv:levelOf(me.totalFocusMin||0).lv,newLv:levelOf((me.totalFocusMin||0)+minutes).lv};
  var snap=f;
  S.flow={step:'reward',item:null};
  save(p);
  saveLog(snap,{status:'done',reason:'',active:activeSec,focus:focus,note:(f.note||'').trim().slice(0,400),self:f.self});
  go();
}
async function finalizeResume(a,reason){
  var f=mkRun(a);
  await recordQuit(f,reason,0);
  toast('Phiên trước chưa kết thúc nên được tính là bỏ cuộc.');
}
function checkResume(){
  if(S.resumed||!S.loaded)return;S.resumed=true;
  var a=S.me&&S.me.active;if(!a||S.flow)return;
  if(a.mode==='screen'){finalizeResume(a,'closed');return;}
  S.flow=mkRun(a);S.tab='focus';
  if(Date.now()>=a.startedAt+a.plannedSec*1000){finishRun(a.startedAt+a.plannedSec*1000);}
  else{requestWake();go();runLoop();}
}

/* ---------- phần thưởng ---------- */
async function placeItem(slot){
  var f=S.flow;var me=S.me;var pend=(me.pending||[])[0];if(!pend||!f.item)return;
  var plot=(me.plot||[]).filter(function(p){return p.s!==slot;});
  plot.push({s:slot,i:f.item,t:pend.t,g:pend.g});
  var rest=(me.pending||[]).slice(1);
  save({plot:plot,pending:rest});
  var it=ITEMS.filter(function(x){return x.id===f.item;})[0];
  toast('Đã xây '+it.n+' trong thành phố.');
  f.item=null;
  if(!rest.length){S.flow=null;S.tab='town';S.lastResult=null;}
  go();
}

/* ---------- tải nhật ký ---------- */
function loadLogs(id){
  if(S.logs[id]!==undefined)return;S.logs[id]=null;
  S.db.collection('logs/'+id+'/sessions').orderBy('at','desc').limit(20).get().then(function(snap){S.logs[id]=snap.docs.map(function(d){return Object.assign({id:d.id},d.data());});refresh();}).catch(function(){S.logs[id]=[];refresh();});
}

/* ---------- khung hiển thị ---------- */
function go(){render();}
function refresh(){
  var f=S.flow;if(f&&(f.step==='run'||f.step==='verify'))return;
  var ae=document.activeElement;if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)&&$('view').contains(ae))return;
  render();
}
function render(){
  var tabs=$('tabs'),v=$('view');
  renderWho();
  if(!S.ready){tabs.innerHTML='';v.innerHTML='<div class="card muted">Đang mở thành phố…</div>';return;}
  if(S.bootErr){tabs.innerHTML='';v.innerHTML='<div class="card stack"><h2>Không khởi động được</h2><p>'+esc(S.bootErr.message||S.bootErr)+'</p><p class="small muted">Kiểm tra kết nối mạng và cấu hình trong js/firebase-config.js rồi tải lại trang.</p></div>';return;}
  if(!S.auth){tabs.innerHTML='';v.innerHTML=viewLogin();return;}
  if(S.err){tabs.innerHTML='';v.innerHTML='<div class="card stack"><h2>Chưa đọc được dữ liệu</h2><p>'+esc(errMsg(S.err))+'</p><div class="row"><button class="btn" data-act="reload">Tải lại</button>'+(S.gid?'<button class="btn" data-act="switchgrp">Chọn nhóm khác</button>':'')+'</div></div>';return;}
  if(S.profile===undefined){tabs.innerHTML='';v.innerHTML='<div class="card muted">Đang tải hồ sơ…</div>';return;}
  if(!S.gid){tabs.innerHTML='';v.innerHTML=viewGroups();return;}
  if(S.group===null){tabs.innerHTML='';v.innerHTML='<div class="card stack"><h2>Nhóm không còn tồn tại</h2><p class="muted">Nhóm bạn tham gia trước đó đã bị xóa. Hãy chọn hoặc lập nhóm khác.</p><div><button class="btn primary" data-act="switchgrp">Chọn nhóm</button></div></div>';return;}
  if(!S.loaded||!S.group){tabs.innerHTML='';v.innerHTML='<div class="card muted">Đang tải dữ liệu nhóm…</div>';return;}
  var f=S.flow;var inFlow=f&&(f.step==='run'||f.step==='verify');
  var T=[['town','Thành phố'],['focus','Tập trung'],['mine','Của tôi'],['group','Nhóm']];if(S.isAdmin)T.push(['admin','Quản trị']);
  var cur=f&&f.step!=='setup'&&f.step!=='reward'?'focus':S.tab;
  if(f&&f.step==='reward')cur='town';
  tabs.innerHTML=T.map(function(t){return '<button class="tab" data-act="tab" data-v="'+t[0]+'"'+(cur===t[0]?' aria-current="page"':'')+'>'+t[1]+'</button>';}).join('');
  var html='';
  if(!S.me&&(S.tab==='town'||S.tab==='focus'||S.tab==='mine')&&!inFlow)html+=viewOnboard();
  else if(f&&f.step==='run')html+=viewRun();
  else if(f&&f.step==='verify')html+=viewVerify();
  else if(f&&f.step==='reward')html+=viewReward();
  else if(S.tab==='town')html+=viewTown();
  else if(S.tab==='focus')html+=viewSetup();
  else if(S.tab==='mine')html+=viewMine();
  else if(S.tab==='group')html+=viewGroup();
  else if(S.tab==='admin'&&S.isAdmin)html+=viewAdmin();
  v.innerHTML=html;
  if(f&&f.step==='run')updateRun();
}
var PROV={google:'Google',facebook:'Facebook',guest:'Khách'};
function myName(){return (S.me&&S.me.name)||(S.profile&&S.profile.name)||(S.auth&&S.auth.name)||'bạn';}
function renderWho(){
  var who=$('who');
  if(!S.auth){who.innerHTML='';return;}
  var inFlow=S.flow&&(S.flow.step==='run'||S.flow.step==='verify');
  who.innerHTML='<div><b>'+esc(myName())+'</b> <span class="pill">'+esc(PROV[S.auth.provider]||S.auth.provider)+'</span></div>'
   +(S.group?'<div>Nhóm '+esc(S.group.name)+(S.isAdmin?' · trưởng nhóm':'')+'</div>':'')
   +(inFlow?'':'<div class="row whoact">'+(S.gid?'<button class="lnk" data-act="switchgrp">Đổi nhóm</button>':'')+'<button class="lnk" data-act="logout">Đăng xuất</button></div>');
}

/* ---------- các màn hình ---------- */
function viewOnboard(){
  var o=S.onb;
  return '<section class="card stack"><div><p class="eyebrow">Chào mừng</p><h2>Chọn khu đất đầu tiên</h2><p class="muted" style="margin-top:6px">Mỗi phiên tập trung hoàn thành cho bạn một công trình để xây nhà và phát triển thành phố của riêng bạn trong khu phố của CLB.</p></div>'
  +'<label class="fld" for="onbName">Tên hiển thị trong CLB<input type="text" id="onbName" maxlength="24" value="'+esc(o.name)+'" placeholder="Tên hoặc biệt danh"></label>'
  +'<div><p class="eyebrow" style="margin-bottom:8px">Kiểu nhà</p><div class="grid g2">'+HKEYS.map(function(k){return '<button class="opt" data-act="onbstyle" data-v="'+k+'" aria-pressed="'+(o.style===k)+'"><svg viewBox="-48 -88 96 112" style="width:100%;max-height:150px;border-radius:8px;background:var(--sea1)"><polygon class="m-grass" points="0,-16 32,0 0,16 -32,0"/>'+houseSVG(k,4)+'</svg><b>'+HST[k].n+'</b></button>';}).join('')+'</div></div>'
  +'<div><p class="eyebrow" style="margin-bottom:8px">Mục tiêu tập trung mỗi ngày</p><div class="row">'+[15,30,45,60,90].map(function(m){return '<button class="chip" data-act="onbgoal" data-v="'+m+'" aria-pressed="'+(o.goal===m)+'">'+m+' phút</button>';}).join('')+'</div><p class="small muted" style="margin-top:6px">Chỉ dùng để theo dõi tiến độ trong ngày. Bạn vẫn đăng ký thời gian cho từng phiên riêng.</p></div>'
  +'<div><button class="btn primary big" data-act="create">Bắt đầu xây thành phố</button></div></section>';
}
function viewLogin(){
  var P=Backend.providers,b=S.busy;
  var h='<section class="card stack auth"><div><p class="eyebrow">Đăng nhập</p><h2>Vào thành phố của bạn</h2><p class="muted" style="margin-top:6px">Đăng nhập để lưu tiến độ, xây thành phố và cùng nhóm rèn kỷ luật mỗi ngày.</p></div>';
  if(Backend.mode==='local')h+='<div class="banner">Đang chạy chế độ thử: dữ liệu chỉ lưu trong trình duyệt này. Điền <code>js/firebase-config.js</code> để bật đăng nhập Google, Facebook và đồng bộ giữa các máy.</div>';
  h+='<div class="stack"><button class="btn sso" data-act="login" data-v="google"'+(P.google&&!b?'':' disabled')+'>'+ssoIco('google')+(b==='google'?'Đang mở Google…':'Tiếp tục với Google')+'</button>'
   +'<button class="btn sso" data-act="login" data-v="facebook"'+(P.facebook&&!b?'':' disabled')+'>'+ssoIco('facebook')+(b==='facebook'?'Đang mở Facebook…':'Tiếp tục với Facebook')+'</button></div>';
  h+='<div class="or"><span>hoặc vào với tư cách khách</span></div>';
  h+='<label class="fld" for="guestName">Tên của bạn<input type="text" id="guestName" maxlength="24" value="'+esc(S.guestName)+'" placeholder="Tên hoặc biệt danh" autocomplete="nickname"></label>'
   +'<div><button class="btn primary" data-act="login" data-v="guest"'+(b?' disabled':'')+'>'+(b==='guest'?'Đang vào…':'Vào với tên này')+'</button></div>'
   +'<p class="small muted">Tài khoản khách gắn với trình duyệt này. Đăng xuất hoặc xóa dữ liệu trình duyệt sẽ mất tiến độ.</p></section>';
  return h;
}
function ssoIco(k){
  if(k==='google')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="#fff" d="M16.7 15.5l.5-3.5h-3.3V9.8c0-1 .5-1.9 2-1.9h1.5v-3s-1.4-.2-2.7-.2c-2.8 0-4.6 1.7-4.6 4.7V12H7v3.5h3.1V24h3.8v-8.5z"/></svg>';
}
function viewGroups(){
  var gs=S.groups,gp=S.gp,b=S.busy;
  var h='<section class="stack"><div><p class="eyebrow">Xin chào, '+esc(myName())+'</p><h2>Chọn nhóm</h2><p class="muted" style="margin-top:6px">Mỗi nhóm có khu phố, bảng nhóm và ngân hàng câu hỏi riêng. Bạn có thể đổi nhóm sau; tiến độ ở mỗi nhóm được giữ lại.</p></div><div class="grid g2">';
  h+='<div class="card stack"><div><h3>Lập nhóm mới</h3><p class="small muted" style="margin-top:4px">Bạn sẽ là trưởng nhóm, có thêm tab Quản trị để xem từng thành viên, xuất CSV và thêm câu hỏi.</p></div>'
   +'<label class="fld" for="grpName">Tên nhóm<input type="text" id="grpName" maxlength="40" value="'+esc(gp.name)+'" placeholder="Ví dụ: Lớp 10A1 đọc sách"></label>'
   +'<div><button class="btn primary" data-act="mkgroup"'+(b?' disabled':'')+'>'+(b==='mk'?'Đang lập nhóm…':'Lập nhóm')+'</button></div></div>';
  h+='<div class="card stack"><div><h3>Tham gia nhóm có sẵn</h3><p class="small muted" style="margin-top:4px">'+(gs===null?'Đang tải danh sách nhóm…':gs.length?'Chọn một trong '+gs.length+' nhóm đang hoạt động.':'Chưa có nhóm nào. Hãy lập nhóm đầu tiên.')+'</p></div>';
  if(gs&&gs.length)h+='<div class="stack grplist" role="list">'+gs.map(function(g){return '<button class="opt" role="listitem" data-act="pickgrp" data-v="'+esc(g.id)+'" aria-pressed="'+(gp.pick===g.id)+'"><b>'+esc(g.name)+'</b><span class="small muted">Trưởng nhóm: '+esc(g.ownerName||'–')+(g.createdAt?' · lập ngày '+dmy(dkey(g.createdAt))+'/'+new Date(g.createdAt).getFullYear():'')+'</span></button>';}).join('')+'</div>';
  h+='<div><button class="btn primary" data-act="joingrp"'+(gs&&gs.length&&gp.pick&&!b?'':' disabled')+'>'+(b==='join'?'Đang tham gia…':'Tham gia nhóm')+'</button></div></div></div></section>';
  return h;
}
function ico(n){
  var m={
   pop:'<circle cx="9" cy="8" r="4" fill="#ff9a3c"/><path d="M2 21c0-5 3-8 7-8s7 3 7 8z" fill="#ff9a3c"/><circle cx="17" cy="9" r="3.4" fill="#2f8cf0"/><path d="M12 21c0-4 2-6.500 5-6.500s6 2.500 6 6.500z" fill="#2f8cf0"/>',
   min:'<circle cx="12" cy="12" r="10" fill="#f6b21b" stroke="#c98a0a" stroke-width="1.5"/><path d="M12 6v6l4 2.500" stroke="#7a4f00" stroke-width="2" fill="none" stroke-linecap="round"/>',
   disc:'<polygon points="13,1 4,14 11,14 9,23 20,9 13,9" fill="#f7b92a" stroke="#c98a0a" stroke-width="1"/>',
   focus:'<circle cx="12" cy="12" r="10" fill="#e8f4ff" stroke="#2f8cf0" stroke-width="2"/><circle cx="12" cy="12" r="5.500" fill="#2f8cf0"/><circle cx="12" cy="12" r="2" fill="#fff"/>',
   ok:'<circle cx="12" cy="12" r="10" fill="#ffd54a" stroke="#c98a0a" stroke-width="1.5"/><path d="M7 12.500l3.500 3.500L17 9" stroke="#5a3b00" stroke-width="2.600" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
   build:'<path d="M3 11L12 3l9 8v10H3z" fill="#2f8cf0"/><rect x="10" y="14" width="4" height="7" fill="#fff"/>',
   timer:'<circle cx="12" cy="13" r="9" fill="#2fb89e"/><path d="M12 8v5l3 2M9 2h6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>',
   chart:'<rect x="3" y="12" width="5" height="9" rx="1" fill="#2f8cf0"/><rect x="10" y="6" width="5" height="15" rx="1" fill="#f6b21b"/><rect x="17" y="9" width="4" height="12" rx="1" fill="#2fb89e"/>',
   group:'<path d="M6 4h12v6a6 6 0 0 1-12 0z" fill="#f6b21b"/><path d="M9 20h6M12 16v4" stroke="#c98a0a" stroke-width="2.500" stroke-linecap="round"/>',
   star:'<polygon points="12,2 15,9 22,9.500 16.500,14 18.500,21.500 12,17.500 5.500,21.500 7.500,14 2,9.500 9,9" />'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">'+m[n]+'</svg>';
}
function viewTown(){
  var me=S.me;var L=levelOf(me.totalFocusMin||0);var today=me.days&&me.days[dkey(Date.now())]||Z();
  var m=metrics(sumDays(me.days,keysBack(30,0)),30,me.createdAt);
  var hs=HST[me.style]||HST.ngoi;var np=(me.pending||[]).length;
  var goal=me.dailyGoal||30,doneMin=Math.round((today.cs||0)/60);
  var h='<section class="stack">';
  h+='<div class="pk hudtop"><div class="lvbadge" title="Giai đoạn nhà">'+L.lv+'</div><div><h2 class="ptitle">Thành phố của '+esc(me.name)+'</h2><p class="psub">'+esc(hs.n)+' · '+esc(L.n)+'</p></div></div>';
  h+='<div class="pk statbar">'
   +[['pop','Dân số',popOf(me.plot)],['min','Phút tập trung',Math.round(me.totalFocusMin||0)],['disc','Kỷ luật',num(m.disc)],['focus','Tập trung sâu',num(m.focus)],['ok','Cam kết',pct(m.comp)]].map(function(x){return '<div class="stat">'+ico(x[0])+'<div><span>'+x[1]+'</span><b>'+x[2]+'</b></div></div>';}).join('')+'</div>';
  if(np)h+='<div class="banner row" style="justify-content:space-between"><span>Bạn có '+np+' phần thưởng chưa đặt lên bản đồ.</span><button class="btn lamp" data-act="openreward">Chọn công trình</button></div>';
  h+='<div class="game"><nav class="pk tool" aria-label="Công cụ">'
   +'<button class="tbtn on" data-act="openreward"'+(np?'':' disabled style="opacity:.55;cursor:default"')+'>'+ico('build')+'Xây dựng'+(np?'<i>'+np+'</i>':'')+'</button>'
   +'<button class="tbtn" data-act="tab" data-v="focus">'+ico('timer')+'Tập trung</button>'
   +'<button class="tbtn" data-act="tab" data-v="mine">'+ico('chart')+'Tiến bộ</button>'
   +'<button class="tbtn" data-act="tab" data-v="group">'+ico('group')+'Cả nhóm</button></nav>';
  h+='<div class="scene">'+plotSVG(me,false)+'</div>';
  h+='<aside class="pk info"><div class="ipill">'+esc(hs.n)+'</div><div class="ihouse"><svg viewBox="-60 -118 120 150" aria-hidden="true"><polygon class="m-grass" points="0,-16 32,0 0,16 -32,0"/>'+houseSVG(me.style,L.lv)+'</svg></div>';
  h+='<div class="stars"><span>Giai đoạn '+L.lv+'/5</span>'+[1,2,3,4,5].map(function(k){return '<svg viewBox="0 0 24 24" style="fill:'+(k<=L.lv?'#f6b21b':'var(--pkline)')+'"><polygon points="12,2 15,9 22,9.500 16.500,14 18.500,21.500 12,17.500 5.500,21.500 7.500,14 2,9.500 9,9"/></svg>';}).join('')+'</div>';
  if(L.next){var span=L.next.at-L.at,got=(me.totalFocusMin||0)-L.at;h+='<div><div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="'+span+'" aria-valuenow="'+got+'"><i style="width:'+Math.round(100*got/span)+'%"></i></div><p class="small muted" style="margin-top:6px">Còn '+fmtMin(L.next.at-(me.totalFocusMin||0))+' để lên “'+esc(L.next.n)+'”.</p></div>';}
  else h+='<p class="small muted">Nhà của bạn đã hoàn thiện.</p>';
  h+='<div class="irow"><span>Hôm nay</span><b>'+doneMin+' / '+goal+' phút</b></div><div class="irow"><span>Chuỗi ngày liên tiếp</span><b>'+streakOf(me.days)+' ngày</b></div><div class="irow"><span>Công trình đã xây</span><b>'+(me.plot||[]).length+' / '+SLOTS.length+'</b></div><div class="irow"><span>Tổng tích lũy</span><b>'+fmtMin(me.totalFocusMin||0)+'</b></div>'
   +'<button class="gbtn y" data-act="tab" data-v="focus">▶ Bắt đầu tập trung</button><button class="gbtn t" data-act="openreward"'+(np?'':' disabled')+'>Chọn công trình'+(np?' ('+np+')':'')+'</button></aside></div>';
  h+='<div class="pk dock"><h3>Kho công trình</h3><div class="dockrow">'+ITEMS.map(function(i){var tr=TIERS[i.t-1];return '<div class="dk"><svg viewBox="-48 -118 96 140" aria-hidden="true"><polygon class="m-grass" points="0,-16 32,0 0,16 -32,0" opacity=".0"/>'+itemSVG(i.id,0,0)+'</svg><b>'+esc(i.n)+'</b><small>hạng '+esc(tr.n)+' · '+tr.min+' phút</small></div>';}).join('')+'</div></div>';
  var ps=Object.keys(S.players).map(function(id){return Object.assign({id:id},S.players[id]);}).sort(function(a,b){return (b.totalFocusMin||0)-(a.totalFocusMin||0);});
  h+='<div class="pk" style="padding:14px"><div style="margin-bottom:10px"><h3 style="font:700 22px var(--font-hud);color:var(--ptitle);text-transform:uppercase">Khu phố '+esc(S.group.name)+'</h3><p class="small muted">Thành phố của '+ps.length+' thành viên, xếp theo tiến độ xây dựng.</p></div><div class="townhouses">'+ps.map(function(p){var l=levelOf(p.totalFocusMin||0);return '<div class="thouse">'+plotSVG(p,false)+'<div><b>'+esc(p.name)+(p.id===S.uid?' (bạn)':'')+'</b><span class="muted">'+esc(l.n)+' · '+(p.plot||[]).length+' công trình</span></div></div>';}).join('')+'</div></div></section>';
  return h;
}
function viewSetup(){
  var f=S.flow&&S.flow.step==='setup'?S.flow:(S.flow={step:'setup',act:'read',dur:25,goal:'',checks:[false,false,false]});
  var a=ACTS[f.act];
  var checks=a.mode==='screen'?['Điện thoại đã cất xa tầm tay và tắt âm','Đã đóng các tab và ứng dụng không cần cho phiên này','Tôi hiểu rằng rời trang hoặc dừng giữa chừng sẽ được ghi nhận']:['Tôi sẽ chuyển điện thoại sang Không làm phiền và cất đi ngay sau khi bấm bắt đầu','Đã chuẩn bị đủ vật dụng cho hoạt động','Tôi hiểu rằng quay lại sớm hoặc dừng giữa chừng sẽ được ghi nhận là bỏ cuộc'];
  var ok=f.checks.every(Boolean)&&Number(f.dur)>=5&&Number(f.dur)<=180;
  var min=Number(f.dur)||0,tier=tierFor(min);
  var h='<section class="stack"><div><p class="eyebrow">Đăng ký phiên</p><h2>Cam kết trước, tập trung sau</h2></div>';
  h+='<div class="card stack"><h3>1. Chọn hoạt động</h3><div class="grid g3">'+ACT_KEYS.map(function(k){return '<button class="opt" data-act="setact" data-v="'+k+'" aria-pressed="'+(f.act===k)+'"><b>'+ACTS[k].n+'</b><span>'+(ACTS[k].mode==='screen'?'Trên máy · theo dõi rời trang':'Ngoài màn hình · cất điện thoại')+'</span></button>';}).join('')+'</div><p class="small muted">'+esc(a.d)+'</p></div>';
  h+='<div class="card stack"><h3>2. Đăng ký thời gian tối thiểu</h3><div class="row">'+DURS.map(function(m){return '<button class="chip" data-act="setdur" data-v="'+m+'" aria-pressed="'+(Number(f.dur)===m)+'">'+m+' phút</button>';}).join('')+'</div><label class="fld" for="durIn" style="max-width:220px">Hoặc nhập số phút (5–180)<input type="number" id="durIn" min="5" max="180" value="'+esc(f.dur)+'"></label>'
    +'<p class="small muted">'+(tier?'Với '+min+' phút, bạn nhận công trình hạng “'+TIERS[tier-1].n+'”. Hạng cao hơn mở ở '+(tier<4?TIERS[tier].min+' phút.':'mức này là cao nhất.'):'Cần tối thiểu 5 phút để nhận công trình.')+' Đã bấm bắt đầu thì không đổi được thời gian; dừng sớm tính là bỏ cuộc.</p></div>';
  h+='<div class="card stack"><h3>3. Mục tiêu của phiên</h3><label class="fld" for="goalIn">'+esc(a.gl)+' (không bắt buộc)<input type="text" id="goalIn" maxlength="120" value="'+esc(f.goal)+'" placeholder="'+esc(a.ph)+'"></label></div>';
  h+='<div class="card stack"><h3>4. Chuẩn bị</h3>'+checks.map(function(c,i){return '<label class="check"><input type="checkbox" data-act="chkbox" data-i="'+i+'"'+(f.checks[i]?' checked':'')+'><span>'+esc(c)+'</span></label>';}).join('')
    +'<button class="btn primary big" data-act="begin"'+(ok?'':' disabled')+'>Cam kết '+(min||'…')+' phút và bắt đầu</button></div></section>';
  return h;
}
function viewRun(){
  var f=S.flow;var a=ACTS[f.act];var circ=2*Math.PI*90;
  var h='<section class="card center stack"><div><p class="eyebrow">'+esc(a.n)+' · cam kết '+Math.round(f.plannedSec/60)+' phút</p>'+(f.goal?'<p style="margin-top:6px">'+esc(f.goal)+'</p>':'')+'</div>'
  +'<div class="ringbox"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="rtrack" cx="110" cy="110" r="90"/><circle id="rprog" class="rbar" cx="110" cy="110" r="90" stroke-dasharray="'+circ.toFixed(1)+'" stroke-dashoffset="'+circ.toFixed(1)+'" transform="rotate(-90 110 110)"/></svg><div class="rtime"><b id="tLeft">--:--</b><span>còn lại</span></div></div>';
  if(f.mode==='screen'){
    h+='<p class="muted">Giữ trang này ở phía trước. Điện thoại cần ở xa tầm tay.</p><div class="stats3"><div><b id="sDist">0</b><span>lần rời trang</span></div><div><b id="sChk">0/0</b><span>câu kiểm tra đúng</span></div><div><b id="sAway">0 giây</b><span>tổng thời gian rời</span></div></div><div id="awayBanner" class="banner bad" hidden></div>';
  }else{
    h+='<div class="banner" style="text-align:left"><b>Hãy cất điện thoại.</b> Bạn có thể thoát khỏi ứng dụng. Quay lại sau <b>'+hm(f.startedAt+f.plannedSec*1000)+'</b> để trả lời câu hỏi xác nhận và nhận công trình.</div>';
  }
  h+='<div><button class="btn ghost" data-act="quitask">Dừng phiên (tính là bỏ cuộc)</button></div></section>';
  return h;
}
function viewVerify(){
  var f=S.flow;var a=ACTS[f.act];var words=(f.note||'').trim().split(/\s+/).filter(Boolean).length;
  var h='<section class="stack"><div><p class="eyebrow">Hết giờ</p><h2>Xác nhận để nhận công trình</h2><p class="muted" style="margin-top:6px">Bạn đã hoàn thành '+Math.round(f.plannedSec/60)+' phút cam kết. Trả lời các câu hỏi sau để xác nhận phiên.</p></div>';
  f.vq.forEach(function(q,qi){h+='<div class="card stack"><h3>'+esc(q.q)+'</h3>'+q.o.map(function(o,i){return '<button class="opt" data-act="vans" data-q="'+qi+'" data-i="'+i+'" aria-pressed="'+(f.vans[qi]===i)+'"><b>'+esc(o)+'</b></button>';}).join('')+'</div>';});
  h+='<div class="card stack"><h3>Bạn tập trung được mức nào?</h3><div class="row">'+[1,2,3,4,5].map(function(n){return '<button class="chip" data-act="self" data-v="'+n+'" aria-pressed="'+(f.self===n)+'">'+n+'</button>';}).join('')+'</div><p class="small muted">1 là rất xao nhãng, 5 là hoàn toàn tập trung.'+(f.mode==='offline'?' Với hoạt động ngoài màn hình, điểm tập trung dựa trên câu trả lời và tự đánh giá này.':'')+'</p>';
  h+='<label class="fld" for="noteIn">'+(a.needNote?'Ghi 1–2 câu về điều bạn rút ra (ít nhất 6 từ)':'Ghi chú ngắn về phiên (không bắt buộc)')+'<textarea id="noteIn" maxlength="400">'+esc(f.note)+'</textarea></label>'+(a.needNote?'<p class="small muted">Đã viết '+words+' từ.</p>':'');
  if(f.mode==='offline')h+='<label class="check"><input type="checkbox" data-act="conf"'+(f.conf?' checked':'')+'><span>Tôi xác nhận đã thực hiện đủ thời gian và không dùng điện thoại trong phiên.</span></label>';
  h+='<button class="btn primary big" data-act="finish"'+(toVerifyReady()?'':' disabled')+'>Hoàn thành phiên</button></div></section>';
  return h;
}
function viewReward(){
  var me=S.me;var f=S.flow;var pend=(me.pending||[])[0];var r=S.lastResult;
  if(!pend){S.flow=null;S.tab='town';return viewTown();}
  var h='<section class="stack">';
  if(r){h+='<div class="card stack"><p class="eyebrow">Kết quả phiên</p><h2>Hoàn thành '+r.minutes+' phút</h2><div class="stats3"><div><b>'+r.focus+'</b><span>điểm tập trung</span></div><div><b>'+r.qc+'/'+r.qa+'</b><span>câu đúng</span></div><div><b>'+(r.mode==='screen'?r.dist+r.missed:'–')+'</b><span>xao nhãng</span></div></div>'+(r.newLv>r.prevLv?'<p><b>Nhà của bạn lên giai đoạn mới: '+esc(LV[r.newLv-1].n)+'.</b></p>':'')+(r.shiny?'<p>Điểm tập trung từ 85 trở lên nên công trình được mạ vàng.</p>':'')+'</div>';}
  var avail=ITEMS.filter(function(i){return i.t<=pend.t;});
  h+='<div class="card stack"><div><p class="eyebrow">Phần thưởng hạng “'+TIERS[pend.t-1].n+'” · '+pend.m+' phút</p><h2>Chọn một công trình</h2></div><div class="itemgrid">'+avail.map(function(i){return '<button class="itm" data-act="pickitem" data-id="'+i.id+'" aria-pressed="'+(f.item===i.id)+'"><svg viewBox="-48 -132 96 152"><polygon class="m-grass" points="0,-16 32,0 0,16 -32,0"/>'+itemSVG(i.id,pend.g,0)+'</svg>'+esc(i.n)+'<small>hạng '+TIERS[i.t-1].n+'</small></button>';}).join('')+'</div><p class="small muted">'+(f.item?'Bấm vào một lô đất nét đứt trên bản đồ để xây. Lô viền đỏ đang có công trình và sẽ bị thay.':'Hạng cao hơn mở thêm công trình. Càng cam kết lâu, công trình càng hiếm.')+'</p></div>';
  h+='<div class="scene">'+plotSVG(me,!!f.item,true)+'</div></section>';
  return h;
}

/* ---------- bảng cá nhân ---------- */
function viewMine(){
  var me=S.me;var n=S.period;var keys=keysBack(n,0),pk=keysBack(n,n);
  var cur=metrics(sumDays(me.days,keys),n,me.createdAt),prv=metrics(sumDays(me.days,pk),n,me.createdAt);
  var k14=keysBack(14,0);var mins=k14.map(function(k){var d=me.days&&me.days[k];return d?Math.round((d.cs||0)/60):0;});
  var foc=k14.map(function(k){var d=me.days&&me.days[k];return d&&d.fn?Math.round(d.fs/d.fn):null;});
  var h='<section class="stack"><div class="row" style="justify-content:space-between"><div><p class="eyebrow">Bảng của '+esc(me.name)+'</p><h2>Tiến bộ của tôi</h2></div><div class="row">'+[7,30,90].map(function(p){return '<button class="chip" data-act="period" data-v="'+p+'" aria-pressed="'+(n===p)+'">'+p+' ngày</button>';}).join('')+'</div></div>';
  if(!cur.s&&!prv.s&&!Object.keys(me.days||{}).length){h+='<div class="card stack"><h3>Chưa có phiên nào</h3><p class="muted">Hoàn thành phiên đầu tiên để thấy điểm kỷ luật, điểm tập trung và xu hướng tiến bộ ở đây.</p><div><button class="btn primary" data-act="tab" data-v="focus">Đăng ký phiên đầu tiên</button></div></div></section>';return h;}
  h+='<div class="grid g2"><div class="card stack"><p class="eyebrow">Kỷ luật tự thân</p><div class="big-n">'+num(cur.disc)+'</div><div class="meter"><i style="width:'+(cur.disc||0)+'%"></i></div>'+trendHTML(delta(cur.disc,prv.disc))+'</div>'
  +'<div class="card stack"><p class="eyebrow">Tập trung sâu</p><div class="big-n">'+num(cur.focus)+'</div><div class="meter"><i style="width:'+(cur.focus||0)+'%"></i></div>'+trendHTML(delta(cur.focus,prv.focus))+'</div></div>';
  h+='<div class="grid g2"><div class="card stack"><h3>Tính cam kết ('+n+' ngày)</h3><dl class="kv"><dt>Phiên đã đăng ký</dt><dd>'+cur.s+'</dd><dt>Hoàn thành đủ thời gian</dt><dd>'+cur.c+' ('+pct(cur.comp)+')</dd><dt>Bỏ cuộc</dt><dd>'+cur.q+' ('+pct(cur.quitRate)+')</dd><dt>Thời gian thực hiện / đã đăng ký</dt><dd>'+pct(cur.kept)+'</dd><dt>Lần rời trang (xao nhãng)</dt><dd>'+cur.dn+'</dd><dt>Câu kiểm tra không phản hồi</dt><dd>'+cur.ms+'</dd><dt>Trả lời đúng</dt><dd>'+pct(cur.quiz)+'</dd><dt>Số ngày có hoạt động</dt><dd>'+cur.act+' / '+n+'</dd></dl></div>';
  var qr=me.quitReasons||{};var qk=Object.keys(qr).sort(function(a,b){return qr[b]-qr[a];});
  h+='<div class="card stack"><h3>Nhận xét</h3><p>'+personalNote(cur,prv,n)+'</p>'+(qk.length?'<div><p class="eyebrow" style="margin-bottom:6px">Lý do bỏ cuộc của bạn</p><dl class="kv">'+qk.map(function(k){return '<dt>'+esc(REASONS[k]||k)+'</dt><dd>'+qr[k]+' lần</dd>';}).join('')+'</dl></div>':'')+'</div></div>';
  h+='<div class="card stack"><h3>14 ngày gần nhất</h3><div class="grid g2"><div class="chart"><p class="small muted">Số phút hoàn thành mỗi ngày</p>'+chartBars(k14.map(dmy),mins,'Số phút hoàn thành mỗi ngày trong 14 ngày')+'</div><div class="chart"><p class="small muted">Điểm tập trung trung bình mỗi ngày</p>'+chartLines(k14.map(dmy),[{name:'Tập trung',vals:foc,cls:'s1'}],'Điểm tập trung theo ngày')+'</div></div></div>';
  loadLogs(S.uid);var lg=S.logs[S.uid];
  h+='<div class="card stack"><h3>Các phiên gần đây</h3>'+logTable(lg)+'</div>';
  h+='<details class="card"><summary>Cách tính điểm</summary><p>Kỷ luật tự thân = 40% tỷ lệ phiên hoàn thành + 30% tỷ lệ thời gian thực hiện so với thời gian đã đăng ký + 30% số ngày có hoạt động trên số ngày trong kỳ.</p><p>Tập trung sâu (phiên trên máy) = tỷ lệ thời gian ở lại trang, trừ 3 điểm cho mỗi lần rời trang và 5 điểm cho mỗi câu kiểm tra không phản hồi, rồi nhân với hệ số từ 0,75 đến 1 theo tỷ lệ trả lời đúng. Phiên ngoài màn hình tính 60% theo câu trả lời đúng và 40% theo tự đánh giá. Phiên bỏ cuộc không có điểm tập trung nhưng tính vào tỷ lệ bỏ cuộc.</p></details></section>';
  return h;
}
function personalNote(cur,prv,n){
  if(!cur.s)return 'Chưa có phiên nào trong '+n+' ngày qua. Hãy đăng ký một phiên ngắn để giữ nhịp.';
  var t=[];var dd=delta(cur.disc,prv.disc),df=delta(cur.focus,prv.focus);
  if(dd!=null)t.push(dd>=3?'Kỷ luật tăng '+Math.round(dd)+' điểm so với kỳ trước.':dd<=-3?'Kỷ luật giảm '+Math.round(-dd)+' điểm so với kỳ trước.':'Kỷ luật giữ ổn định so với kỳ trước.');
  if(df!=null)t.push(df>=3?'Điểm tập trung tăng '+Math.round(df)+' điểm.':df<=-3?'Điểm tập trung giảm '+Math.round(-df)+' điểm.':'Điểm tập trung giữ ổn định.');
  if(cur.comp!=null&&cur.comp<0.6)t.push('Tỷ lệ hoàn thành cam kết còn thấp. Thử đăng ký thời gian ngắn hơn để giữ trọn lời hứa.');
  else if(cur.comp!=null&&cur.comp>=0.9)t.push('Bạn giữ cam kết rất tốt. Có thể tăng dần thời gian mỗi phiên.');
  if(cur.dn+cur.ms>=3&&cur.c>0)t.push('Số lần xao nhãng đang nhiều. Kiểm tra lại việc cất điện thoại và đóng các tab không cần.');
  if(!t.length)t.push('Cần thêm dữ liệu từ kỳ trước để so sánh tiến bộ.');
  return esc(t.join(' '));
}
function logTable(lg){
  if(lg===undefined||lg===null)return '<p class="muted small">Đang tải…</p>';
  if(!lg.length)return '<p class="muted small">Chưa có phiên nào được ghi.</p>';
  return '<div class="tscroll"><table class="tbl"><thead><tr><th>Ngày</th><th>Hoạt động</th><th>Đăng ký</th><th>Thực hiện</th><th>Kết quả</th><th>Xao nhãng</th><th>Điểm</th></tr></thead><tbody>'+lg.map(function(r){
    var st=r.status==='done'?'<span class="pill good">Hoàn thành</span>':'<span class="pill bad">Bỏ cuộc</span>';
    return '<tr><td>'+dmy(r.day)+' '+hm(r.at)+'</td><td>'+esc((ACTS[r.act]||{}).n||r.act)+'</td><td>'+Math.round(r.planned/60)+' ph</td><td>'+Math.round((r.active||0)/60)+' ph</td><td>'+st+(r.reason?' <span class="small muted">'+esc(REASONS[r.reason]||r.reason)+'</span>':'')+'</td><td>'+((r.dist||0)+(r.missed||0))+'</td><td>'+(r.focus==null?'–':r.focus)+'</td></tr>'+(r.note?'<tr><td colspan="7" style="text-align:left;white-space:normal" class="small muted">“'+esc(r.note)+'”</td></tr>':'');
  }).join('')+'</tbody></table></div>';
}

/* ---------- bảng nhóm ---------- */
function groupWeek(off){
  var keys=keysBack(7,7*off);var T=Z();var act=[];var discs=[];var ids=Object.keys(S.players);
  ids.forEach(function(id){var p=S.players[id];var t=sumDays(p.days,keys);for(var f in T)T[f]+=t[f];if(t.s>0)act.push(id);var m=metrics(t,7,p.createdAt);if(m.disc!=null)discs.push(m.disc);});
  return {T:T,act:act,discs:discs,disc:discs.length?Math.round(avg(discs)):null,comp:T.s?T.c/T.s:null,quit:T.s?T.q/T.s:null,focus:T.fn?Math.round(T.fs/T.fn):null,hours:T.cs/3600,n:ids.length};
}
function viewGroup(){
  var ids=Object.keys(S.players);
  if(!ids.length)return '<section class="card stack"><h2>Chưa có thành viên</h2><p class="muted">Khi có người tạo nhà và hoàn thành phiên, số liệu cả nhóm sẽ hiện ở đây.</p></section>';
  var w=[];for(var i=0;i<6;i++)w.push(groupWeek(5-i));var cur=w[5],prv=w[4];
  var ret=prv.act.length?cur.act.filter(function(id){return prv.act.indexOf(id)>=0;}).length/prv.act.length:null;
  var qr={};ids.forEach(function(id){var q=S.players[id].quitReasons||{};for(var k in q)qr[k]=(qr[k]||0)+q[k];});var qk=Object.keys(qr).sort(function(a,b){return qr[b]-qr[a];});var qtot=qk.reduce(function(s,k){return s+qr[k];},0);
  var df=delta(cur.focus,prv.focus);
  var crit=[
    {k:'Hoàn thành đúng cam kết',v:pct(cur.comp),t:'từ 75%',ok:cur.comp!=null&&cur.comp>=0.75},
    {k:'Tỷ lệ bỏ cuộc',v:pct(cur.quit),t:'không quá 20%',ok:cur.quit!=null&&cur.quit<=0.2},
    {k:'Điểm tập trung trung bình',v:num(cur.focus),t:'từ 70',ok:cur.focus!=null&&cur.focus>=70},
    {k:'Giữ chân (hoạt động cả hai tuần)',v:pct(ret),t:'từ 60%',ok:ret!=null&&ret>=0.6},
    {k:'Xu hướng tập trung so với tuần trước',v:df==null?'–':(df>=0?'+':'')+Math.round(df),t:'không giảm',ok:df!=null&&df>=0}
  ];
  var okN=crit.filter(function(c){return c.ok;}).length;var enough=cur.T.s>=10;
  var verdict=!enough?{t:'Chưa đủ dữ liệu',c:'warn',d:'Cần ít nhất 10 phiên được đăng ký trong 7 ngày để đánh giá. Hiện có '+cur.T.s+' phiên.'}:okN>=4?{t:'Chương trình đang hiệu quả',c:'good',d:'Đạt '+okN+'/5 tiêu chí tham khảo.'}:okN>=3?{t:'Hiệu quả một phần',c:'warn',d:'Đạt '+okN+'/5 tiêu chí. Xem các tiêu chí chưa đạt để điều chỉnh.'}:{t:'Cần điều chỉnh',c:'bad',d:'Chỉ đạt '+okN+'/5 tiêu chí tham khảo.'};
  var labels=['T-5','T-4','T-3','T-2','T-1','Tuần này'];
  var bands=[['Dưới 40',0,39],['40–59',40,59],['60–79',60,79],['Từ 80',80,100]].map(function(b){return [b[0],cur.discs.filter(function(x){return x>=b[1]&&x<=b[2];}).length];});
  var mx=Math.max(1,Math.max.apply(null,bands.map(function(b){return b[1];})));
  var h='<section class="stack"><div><p class="eyebrow">Cả CLB · 7 ngày gần nhất</p><h2>Bảng nhóm</h2></div>';
  h+='<div class="card stack"><div class="row" style="justify-content:space-between"><div><p class="eyebrow">Đánh giá tự động (tham khảo)</p><h2>'+verdict.t+'</h2></div><span class="pill '+verdict.c+'">'+okN+'/5 tiêu chí</span></div><p class="muted">'+verdict.d+'</p><div class="tscroll"><table class="tbl"><thead><tr><th>Tiêu chí</th><th>Hiện tại</th><th>Ngưỡng</th><th>Kết quả</th></tr></thead><tbody>'+crit.map(function(c){return '<tr><td>'+c.k+'</td><td>'+c.v+'</td><td>'+c.t+'</td><td><span class="pill '+(c.ok?'good':'warn')+'">'+(c.ok?'Đạt':'Chưa đạt')+'</span></td></tr>';}).join('')+'</tbody></table></div></div>';
  h+='<div class="grid g3"><div class="card stack"><p class="eyebrow">Kỷ luật tự thân (TB)</p><div class="big-n">'+num(cur.disc)+'</div>'+trendHTML(delta(cur.disc,prv.disc))+'</div><div class="card stack"><p class="eyebrow">Tập trung sâu (TB)</p><div class="big-n">'+num(cur.focus)+'</div>'+trendHTML(df)+'</div><div class="card stack"><p class="eyebrow">Hoạt động tuần này</p><div class="big-n">'+cur.act.length+'<span style="font-size:22px"> / '+cur.n+'</span></div><p class="small muted">'+cur.hours.toFixed(1)+' giờ tập trung hoàn thành</p></div></div>';
  h+='<div class="card stack"><h3>Cam kết và bỏ cuộc (tuần này)</h3><dl class="kv"><dt>Phiên đã đăng ký</dt><dd>'+cur.T.s+'</dd><dt>Hoàn thành đủ thời gian</dt><dd>'+cur.T.c+' ('+pct(cur.comp)+')</dd><dt>Bỏ cuộc</dt><dd>'+cur.T.q+' ('+pct(cur.quit)+')</dd><dt>Lần rời trang</dt><dd>'+cur.T.dn+'</dd><dt>Câu kiểm tra không phản hồi</dt><dd>'+cur.T.ms+'</dd><dt>Trả lời đúng</dt><dd>'+pct(cur.T.qa?cur.T.qc/cur.T.qa:null)+'</dd></dl></div>';
  h+='<div class="card stack"><h3>Xu hướng 6 tuần</h3><div class="chart">'+chartLines(labels,[{vals:w.map(function(x){return x.focus;}),cls:'s1'},{vals:w.map(function(x){return x.comp==null?null:Math.round(x.comp*100);}),cls:'s2'},{vals:w.map(function(x){return x.quit==null?null:Math.round(x.quit*100);}),cls:'s3'}],'Xu hướng điểm tập trung, tỷ lệ hoàn thành và tỷ lệ bỏ cuộc trong 6 tuần')+'</div><div class="legend"><span><i class="s1" style="color:var(--c1)"></i>Điểm tập trung TB</span><span><i class="s2" style="color:var(--c2)"></i>Hoàn thành (%)</span><span><i class="s3" style="color:var(--c3)"></i>Bỏ cuộc (%)</span></div></div>';
  h+='<div class="grid g2"><div class="card stack"><h3>Phân bố điểm kỷ luật</h3><dl class="kv" style="grid-template-columns:90px 1fr 28px;align-items:center">'+bands.map(function(b){return '<dt>'+b[0]+'</dt><dd style="text-align:left"><div class="meter"><i style="width:'+Math.round(100*b[1]/mx)+'%"></i></div></dd><dd>'+b[1]+'</dd>';}).join('')+'</dl><p class="small muted">Số thành viên có phiên trong tuần, theo mức điểm.</p></div>';
  h+='<div class="card stack"><h3>Vì sao dừng phiên (từ đầu đến nay)</h3>'+(qtot?'<dl class="kv">'+qk.map(function(k){return '<dt>'+esc(REASONS[k]||k)+'</dt><dd>'+qr[k]+' ('+Math.round(100*qr[k]/qtot)+'%)</dd>';}).join('')+'</dl>':'<p class="muted small">Chưa có phiên nào bị bỏ cuộc.</p>')+'</div></div></section>';
  return h;
}

/* ---------- quản trị ---------- */
function exportCSV(){
  var keys=keysBack(365,0),k7=keysBack(7,0);
  var rows=[['Tên','Ngày tham gia','Tổng phút tập trung','Phiên đăng ký','Hoàn thành','Bỏ cuộc','Tỷ lệ hoàn thành','Lần rời trang','Không phản hồi','Trả lời đúng','Điểm tập trung TB','Điểm kỷ luật 7 ngày','Hoạt động gần nhất']];
  Object.keys(S.players).forEach(function(id){var p=S.players[id];var a=metrics(sumDays(p.days,keys),365,p.createdAt),w=metrics(sumDays(p.days,k7),7,p.createdAt);
    rows.push([p.name,p.createdAt?dkey(p.createdAt):'',p.totalFocusMin||0,a.s,a.c,a.q,a.comp==null?'':Math.round(a.comp*100)+'%',a.dn,a.ms,a.quiz==null?'':Math.round(a.quiz*100)+'%',a.focus==null?'':a.focus,w.disc==null?'':w.disc,p.lastAt?dkey(p.lastAt):'']);});
  var csv='﻿'+rows.map(function(r){return r.map(function(c){c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',');}).join('\r\n');
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='thanh-pho-tu-lap-'+dkey(Date.now())+'.csv';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},0);
  toast('Đã tải file CSV.');
}
function viewAdmin(){
  var k7=keysBack(7,0),p7=keysBack(7,7);
  var rows=Object.keys(S.players).map(function(id){var p=S.players[id];var m=metrics(sumDays(p.days,k7),7,p.createdAt),pm=metrics(sumDays(p.days,p7),7,p.createdAt);return {id:id,p:p,m:m,pm:pm};}).sort(function(a,b){return (b.m.cs||0)-(a.m.cs||0);});
  var h='<section class="stack"><div class="row" style="justify-content:space-between"><div><p class="eyebrow">Dành cho người tổ chức</p><h2>Quản trị CLB</h2></div><button class="btn" data-act="csv">Xuất CSV</button></div>';
  h+='<div class="card stack"><h3>Từng thành viên (7 ngày)</h3><p class="small muted">Bấm vào một dòng để xem các phiên gần đây và ghi chú của thành viên.</p><div class="tscroll"><table class="tbl"><thead><tr><th>Thành viên</th><th>Phút</th><th>Phiên</th><th>Hoàn thành</th><th>Bỏ cuộc</th><th>Xao nhãng</th><th>Tập trung</th><th>Kỷ luật</th><th>Xu hướng</th><th>Lần cuối</th></tr></thead><tbody>'+rows.map(function(r){
    var tr=delta(r.m.disc,r.pm.disc);var risk=!r.m.s||(r.m.comp!=null&&r.m.comp<0.5);
    return '<tr data-act="detail" data-id="'+esc(r.id)+'"><td>'+esc(r.p.name)+(risk?' <span class="pill warn">Cần chú ý</span>':'')+'</td><td>'+Math.round((r.m.cs||0)/60)+'</td><td>'+r.m.s+'</td><td>'+pct(r.m.comp)+'</td><td>'+r.m.q+'</td><td>'+(r.m.dn+r.m.ms)+'</td><td>'+num(r.m.focus)+'</td><td>'+num(r.m.disc)+'</td><td>'+(tr==null?'–':tr>=3?'▲ +'+Math.round(tr):tr<=-3?'▼ '+Math.round(tr):'–')+'</td><td>'+(r.p.lastAt?dmy(dkey(r.p.lastAt)):'–')+'</td></tr>';}).join('')+'</tbody></table></div></div>';
  if(S.detail&&S.players[S.detail]){loadLogs(S.detail);h+='<div class="card stack"><div class="row" style="justify-content:space-between"><h3>Các phiên gần đây của '+esc(S.players[S.detail].name)+'</h3><button class="btn" data-act="detailx">Đóng</button></div>'+logTable(S.logs[S.detail])+'</div>';}
  h+='<div class="card stack"><div><h3>Ngân hàng câu hỏi</h3><p class="small muted">Câu hỏi của CLB (ví dụ nội dung cuốn sách đang đọc) được trộn cùng '+DEF_Q.length+' câu có sẵn, dùng cho kiểm tra hiện diện giữa phiên và xác nhận cuối phiên. Chọn “Tất cả hoạt động” để câu hỏi xuất hiện ở mọi phiên.</p></div>';
  h+='<div class="stack"><label class="fld" for="qAct">Áp dụng cho<select id="qAct"><option value="all">Tất cả hoạt động</option>'+ACT_KEYS.map(function(k){return '<option value="'+k+'">'+ACTS[k].n+'</option>';}).join('')+'</select></label><label class="fld" for="qText">Câu hỏi<input type="text" id="qText" maxlength="200"></label>'+[0,1,2,3].map(function(i){return '<label class="fld" for="qO'+i+'">Đáp án '+'ABCD'[i]+'<input type="text" id="qO'+i+'" maxlength="120"></label>';}).join('')+'<label class="fld" for="qOk">Đáp án đúng<select id="qOk"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label><div><button class="btn primary" data-act="addq">Thêm câu hỏi</button></div></div>';
  h+='<div><p class="eyebrow" style="margin-bottom:6px">Câu hỏi đã thêm ('+S.custom.length+')</p>'+(S.custom.length?'<div class="stack">'+S.custom.map(function(q){return '<div class="row" style="justify-content:space-between;align-items:flex-start"><div style="min-width:0"><span class="pill">'+(q.act==='all'?'Tất cả':esc((ACTS[q.act]||{}).n||q.act))+'</span> '+esc(q.q)+'<br><span class="small muted">Đúng: '+esc(q.o[q.a])+'</span></div><button class="btn danger" data-act="delq" data-id="'+esc(q.id)+'">Xóa</button></div>';}).join('')+'</div>':'<p class="small muted">Chưa có câu hỏi riêng của CLB.</p>')+'</div></div></section>';
  return h;
}

/* ---------- sự kiện ---------- */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;var act=t.getAttribute('data-act');var v=t.getAttribute('data-v');var f=S.flow;
  switch(act){
    case 'tab':
      if(f&&(f.step==='run'||f.step==='verify')){toast('Bạn đang trong phiên cam kết.');return;}
      if(f&&f.step==='reward'&&v!=='town'){toast('Hãy đặt công trình trước.');return;}
      S.tab=v;if(v==='focus'&&!f)S.flow=null;if(f&&f.step==='setup'&&v!=='focus')S.flow=null;go();break;
    case 'onbstyle':S.onb.style=v;S.onb.name=($('onbName')||{}).value||S.onb.name;go();break;
    case 'onbgoal':S.onb.goal=Number(v);S.onb.name=($('onbName')||{}).value||S.onb.name;go();break;
    case 'create':{
      var name=(($('onbName')||{}).value||'').trim();if(!name){toast('Hãy nhập tên hiển thị.');return;}
      S.onb.name=name;
      var doc={name:name.slice(0,24),style:S.onb.style,dailyGoal:S.onb.goal,createdAt:Date.now(),totalFocusMin:0,plot:[],pending:[],days:{},quitReasons:{},active:null,lastAt:0};
      applyLocal(doc);S.tab='town';go();
      enqueue(function(){return S.db.doc('players/'+S.uid).set(doc);});break;}
    case 'setact':f.act=v;go();break;
    case 'setdur':f.dur=Number(v);go();break;
    case 'begin':beginSession();break;
    case 'quitask':askQuit();break;
    case 'quitno':f.quitAsk=false;$('modal').hidden=true;$('modal').innerHTML='';break;
    case 'rsn':{Array.prototype.forEach.call(document.querySelectorAll('#rsn .chip'),function(c){c.setAttribute('aria-pressed','false');});t.setAttribute('aria-pressed','true');f.reason=v;var y=$('quitYes');if(y)y.disabled=false;break;}
    case 'quityes':if(f.reason)doQuit(f.reason);break;
    case 'chk':answerCheck(Number(t.getAttribute('data-i')));break;
    case 'vans':f.vans[Number(t.getAttribute('data-q'))]=Number(t.getAttribute('data-i'));go();break;
    case 'self':f.self=Number(v);go();break;
    case 'finish':completeSession();break;
    case 'openreward':S.flow={step:'reward',item:null};go();break;
    case 'pickitem':f.item=t.getAttribute('data-id');go();break;
    case 'pickslot':placeItem(Number(t.getAttribute('data-slot')));break;
    case 'period':S.period=Number(v);go();break;
    case 'detail':S.detail=t.getAttribute('data-id');go();break;
    case 'detailx':S.detail=null;go();break;
    case 'csv':exportCSV();break;
    case 'addq':{
      var q=($('qText').value||'').trim();var o=[0,1,2,3].map(function(i){return ($('qO'+i).value||'').trim();});
      if(!q||o.some(function(x){return !x;})){toast('Cần nhập đủ câu hỏi và 4 đáp án.');return;}
      var item={id:'c'+Date.now().toString(36),act:$('qAct').value,q:q,o:o,a:Number($('qOk').value)};
      var items=S.custom.concat([item]);
      enqueue(function(){return S.db.doc('config/questions').set({items:items});}).then(function(){toast('Đã thêm câu hỏi.');});break;}
    case 'delq':{var id=t.getAttribute('data-id');var rest=S.custom.filter(function(x){return x.id!==id;});enqueue(function(){return S.db.doc('config/questions').set({items:rest});}).then(function(){toast('Đã xóa câu hỏi.');});break;}
    case 'login':doLogin(v);break;
    case 'logout':askLogout();break;
    case 'logoutyes':closeModal();doLogout();break;
    case 'modalx':closeModal();break;
    case 'reload':location.reload();break;
    case 'switchgrp':leaveGroup();break;
    case 'pickgrp':S.gp.pick=v;go();break;
    case 'mkgroup':createGroup();break;
    case 'joingrp':joinGroup(S.gp.pick);break;
  }
});
document.addEventListener('keydown',function(e){
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.slot')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
  if(e.key==='Enter'&&e.target.id==='guestName'){e.preventDefault();doLogin('guest');}
  if(e.key==='Enter'&&e.target.id==='grpName'){e.preventDefault();createGroup();}
});
document.addEventListener('change',function(e){
  var t=e.target,f=S.flow;
  if(t.id==='durIn'&&f){f.dur=t.value;go();}
  if(t.getAttribute&&t.getAttribute('data-act')==='chkbox'&&f){f.checks[Number(t.getAttribute('data-i'))]=t.checked;go();}
  if(t.getAttribute&&t.getAttribute('data-act')==='conf'&&f){f.conf=t.checked;go();}
});
document.addEventListener('input',function(e){
  var t=e.target,f=S.flow;
  if(t.id==='goalIn'&&f)f.goal=t.value;
  if(t.id==='noteIn'&&f){f.note=t.value;var b=document.querySelector('[data-act="finish"]');if(b)b.disabled=!toVerifyReady();}
  if(t.id==='onbName')S.onb.name=t.value;
  if(t.id==='guestName')S.guestName=t.value;
  if(t.id==='grpName')S.gp.name=t.value;
});

/* ---------- đăng nhập ---------- */
function authErr(e){
  var c=e&&e.code;
  if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request'||c==='auth/user-cancelled')return '';
  if(c==='auth/account-exists-with-different-credential')return 'Email này đã đăng nhập bằng cách khác. Hãy dùng cách bạn đã đăng nhập lần đầu.';
  if(c==='auth/operation-not-allowed'||c==='auth/admin-restricted-operation')return 'Cách đăng nhập này chưa được bật trong Firebase Authentication.';
  if(c==='auth/unauthorized-domain')return 'Tên miền này chưa có trong Authorized domains của Firebase Authentication.';
  if(c==='auth/network-request-failed')return 'Không có kết nối mạng. Hãy thử lại.';
  if(c==='unsupported')return 'Chế độ thử chỉ hỗ trợ đăng nhập khách.';
  return 'Đăng nhập không thành công'+(e&&(e.message||c)?': '+(e.message||c):'.');
}
async function doLogin(kind){
  if(S.busy)return;
  var name='';
  if(kind==='guest'){
    name=(S.guestName||'').trim().replace(/\s+/g,' ').slice(0,24);
    if(!name){toast('Hãy nhập tên để vào với tư cách khách.');var gi=$('guestName');if(gi)gi.focus();return;}
  }
  S.pendingName=name;S.busy=kind;go();
  try{await Backend.signIn(kind,name);}catch(e){var m=authErr(e);if(m)toast(m);}
  S.busy=null;go();
}
function askLogout(){
  var f=S.flow;if(f&&(f.step==='run'||f.step==='verify')){toast('Bạn đang trong phiên cam kết.');return;}
  if(S.auth.provider!=='guest'){doLogout();return;}
  var m=$('modal');
  m.innerHTML='<div class="card stack" role="dialog" aria-modal="true" aria-label="Đăng xuất"><h3>Đăng xuất tài khoản khách?</h3><p class="small muted">Tài khoản khách không có mật khẩu. Sau khi đăng xuất, bạn sẽ không vào lại được thành phố và tiến độ hiện tại.</p><div class="row"><button class="btn" data-act="modalx">Ở lại</button><button class="btn danger" data-act="logoutyes">Vẫn đăng xuất</button></div></div>';
  m.hidden=false;
}
function closeModal(){var m=$('modal');m.hidden=true;m.innerHTML='';}
function doLogout(){Backend.signOut().catch(function(e){toast(errMsg(e));});}

/* ---------- hồ sơ và nhóm ---------- */
function scoped(prefix){var r=S.root;return {doc:function(p){return r.doc(prefix+p);},collection:function(p){return r.collection(prefix+p);}};}
function stopGroup(){unsubGroup.forEach(function(u){u();});unsubGroup=[];}
function stopGroups(){if(unsubGroups){unsubGroups();unsubGroups=null;}}
function resetGroupState(){
  clearInterval(timer);timer=null;releaseWake();closeModal();
  S.db=null;S.gid=null;S.group=undefined;S.isAdmin=false;S.players={};S.me=null;S.loaded=false;S.custom=[];S.logs={};
  S.detail=null;S.resumed=false;S.flow=null;S.tab='town';S.lastResult=null;
}
function onAuthUser(u){
  S.ready=true;
  if(u&&S.auth&&u.uid===S.auth.uid){S.auth=u;return;}
  stopGroup();stopGroups();if(unsubProfile){unsubProfile();unsubProfile=null;}
  resetGroupState();
  S.auth=u;S.uid=u?u.uid:null;S.profile=undefined;S.err=null;S.groups=null;S.gp={name:'',pick:null};
  if(!u){go();return;}
  var ref=S.root.doc('users/'+u.uid);
  // Chờ máy chủ xác nhận trước khi mở nhóm, vì quyền đọc dữ liệu nhóm dựa trên groupId trong hồ sơ.
  unsubProfile=ref.onSnapshot({includeMetadataChanges:true},function(s){
    if(s.metadata&&s.metadata.hasPendingWrites)return;
    if(!s.exists){
      var name=(S.pendingName||u.name||'Khách').slice(0,24);
      ref.set({name:name,provider:u.provider,createdAt:Date.now(),groupId:null}).catch(function(e){S.err=e;go();});
      return;
    }
    S.profile=s.data();
    var gid=S.profile.groupId||null;
    if(gid!==S.gid||(!gid&&!unsubGroups)){enterGroup(gid);go();}else refresh();
  },function(e){S.err=e;go();});
  go();
}
function onGroupErr(e){S.err=e;go();}
function enterGroup(gid){
  stopGroup();resetGroupState();S.err=null;
  if(!gid){watchGroups();return;}
  stopGroups();
  S.gid=gid;S.db=scoped('groups/'+gid+'/');
  S.onb={name:(S.profile&&S.profile.name)||'',style:'san',goal:30};
  unsubGroup.push(S.root.doc('groups/'+gid).onSnapshot(function(s){
    S.group=s.exists?Object.assign({id:gid},s.data()):null;S.isAdmin=!!S.group&&S.group.ownerId===S.uid;refresh();
  },onGroupErr));
  unsubGroup.push(S.db.collection('players').onSnapshot(function(snap){
    var m={};snap.docs.forEach(function(d){m[d.id]=d.data();});
    S.players=m;S.me=m[S.uid]||null;S.loaded=true;
    checkResume();refresh();
  },onGroupErr));
  unsubGroup.push(S.db.doc('config/questions').onSnapshot(function(s){var d=s.exists?s.data():null;S.custom=d&&Array.isArray(d.items)?d.items:[];refresh();},function(){}));
}
function watchGroups(){
  if(unsubGroups)return;S.groups=null;
  unsubGroups=S.root.collection('groups').orderBy('createdAt','desc').limit(50).onSnapshot(function(snap){
    S.groups=snap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
    if(S.gp.pick&&!S.groups.some(function(g){return g.id===S.gp.pick;}))S.gp.pick=null;
    refresh();
  },function(e){S.groups=[];toast(errMsg(e));refresh();});
}
async function createGroup(){
  if(S.busy)return;
  var name=(S.gp.name||'').trim().replace(/\s+/g,' ').slice(0,40);
  if(!name){toast('Hãy đặt tên cho nhóm.');var gi=$('grpName');if(gi)gi.focus();return;}
  if((S.groups||[]).some(function(g){return String(g.name||'').toLowerCase()===name.toLowerCase();})){toast('Đã có nhóm “'+name+'”. Hãy tham gia nhóm đó hoặc đặt tên khác.');return;}
  S.busy='mk';go();
  try{
    var gid=Backend.newId();
    await S.root.doc('groups/'+gid).set({name:name,ownerId:S.uid,ownerName:myName(),createdAt:Date.now()});
    await S.root.doc('users/'+S.uid).update({groupId:gid});
    toast('Đã lập nhóm “'+name+'”.');
  }catch(e){toast(errMsg(e));}
  S.busy=null;go();
}
async function joinGroup(gid){
  if(S.busy)return;
  var g=(S.groups||[]).filter(function(x){return x.id===gid;})[0];
  if(!g){toast('Hãy chọn một nhóm để tham gia.');return;}
  S.busy='join';go();
  try{await S.root.doc('users/'+S.uid).update({groupId:gid});toast('Đã tham gia nhóm “'+g.name+'”.');}catch(e){toast(errMsg(e));}
  S.busy=null;go();
}
function leaveGroup(){
  var f=S.flow;if(f&&(f.step==='run'||f.step==='verify')){toast('Bạn đang trong phiên cam kết.');return;}
  if(!S.uid)return;
  if(!S.gid){S.err=null;go();return;}
  S.root.doc('users/'+S.uid).update({groupId:null}).then(function(){toast('Đã rời nhóm. Tiến độ trong nhóm cũ vẫn được giữ.');}).catch(function(e){toast(errMsg(e));});
}

/* ---------- khởi động ---------- */
async function init(){
  render();
  try{await Backend.start();}catch(e){S.bootErr=e;S.ready=true;render();return;}
  S.root=Backend.db;
  if(Backend.redirectError){var m=authErr(Backend.redirectError);if(m)toast(m);}
  Backend.onAuth(onAuthUser);
}
init();
})();
