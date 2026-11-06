const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const D=d=>d?String(d).slice(0,10):'';
async function api(u,m='GET',b){const r=await fetch('/api'+u,{method:m,headers:{'Content-Type':'application/json','X-Requested-With':'fetch'},body:b?JSON.stringify(b):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d}
function msg(el,t,ok){el.innerHTML=`<div class="alert alert-${ok?'success':'danger'} py-2" role="alert">${esc(t)}</div>`}
function table(el,rows,cols,act){el.innerHTML=rows.length?`<div class="table-responsive"><table class="table table-sm table-striped align-middle"><thead><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}${act?'<th></th>':''}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(c[1](r))}</td>`).join('')}${act?`<td class="text-nowrap">${act(r)}</td>`:''}</tr>`).join('')}</tbody></table></div>`:'<p class="text-muted">Nothing here yet.</p>'}
const G=['A+','A-','B+','B-','AB+','AB-','O+','O-'],C=['Whole Blood','Red Cells','Plasma','Platelets'];
const opts=a=>a.map(x=>`<option>${x}</option>`).join('');
function fillSelects(){document.querySelectorAll('select.g').forEach(e=>e.innerHTML='<option value="">Select</option>'+opts(G));document.querySelectorAll('select.c').forEach(e=>e.innerHTML=opts(C))}
async function logout(){await api('/auth/logout','POST');location.href='/'}
async function nav(){let me=null;try{me=await api('/auth/me')}catch{}
 const L=[['/','Home'],['/#about','About Us'],['/#availability','Blood Availability'],['/user.html#donor','Donate Blood'],['/user.html#request','Request Blood'],['/#contact','Contact Us']];
 $('#nav').innerHTML=`<nav class="navbar navbar-expand-lg navbar-dark" style="background:#b02a37"><div class="container"><a class="navbar-brand" href="/">🩸 LifeLine Blood Bank</a><button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#navmenu" aria-label="Menu"><span class="navbar-toggler-icon"></span></button><div id="navmenu" class="collapse navbar-collapse"><ul class="navbar-nav ms-auto">${L.map(([h,t])=>`<li class="nav-item"><a class="nav-link" href="${h}">${t}</a></li>`).join('')}${me?`<li class="nav-item"><a class="nav-link" href="${me.role==='admin'?'/admin.html':'/user.html'}">${esc(me.name)}</a></li><li class="nav-item"><a class="nav-link" href="#" onclick="logout()">Log out</a></li>`:'<li class="nav-item"><a class="nav-link" href="/login.html">Login</a></li><li class="nav-item"><a class="nav-link" href="/register.html">Register</a></li>'}</ul></div></div></nav>`;
 if($('#foot'))$('#foot').innerHTML='<footer><div class="container">LifeLine Blood Bank · Academic demonstration project · all records are fictional · Email: help@example.com · Phone: 080-0000-0000</div></footer>';return me}
