const r=require('express').Router(),db=require('../config/db'),{auth,admin,w}=require('../middleware/auth'),{GROUPS,COMPONENTS,bad}=require('../middleware/validate');
r.use(auth,admin); // role check on every admin route
const log=(q,a,t,id,d)=>db.query('INSERT INTO admin_logs(admin_id,action,entity_type,entity_id,details,ip_address)VALUES(?,?,?,?,?,?)',[q.user.id,a,t,id,JSON.stringify(d||{}),q.ip]);
const OK="screening_status='Passed' AND expiry_date>=CURDATE()"; // the "eligible stock" rule
const rows=async(sql,p)=>(await db.query(sql,p))[0];
r.get('/stats',w(async(q,s)=>{const [[t]]=await db.query(`SELECT (SELECT COUNT(*) FROM users WHERE role='user') users,(SELECT COUNT(*) FROM donors) donors,(SELECT COUNT(DISTINCT user_id) FROM blood_requests) recipients,(SELECT COUNT(*) FROM blood_requests WHERE status='Pending') pending,(SELECT COUNT(*) FROM blood_requests WHERE status IN('Approved','Ready for Issue')) approved,(SELECT COUNT(*) FROM blood_requests WHERE status='Issued') fulfilled,(SELECT COALESCE(SUM(units_available),0) FROM blood_inventory WHERE ${OK}) units`);
 s.json({totals:t,
  byGroup:await rows(`SELECT blood_group,SUM(units_available) units FROM blood_inventory WHERE ${OK} GROUP BY blood_group`),
  byStatus:await rows('SELECT status,COUNT(*) n FROM blood_requests GROUP BY status'),
  monthly:await rows("SELECT DATE_FORMAT(collected_on,'%Y-%m') m,SUM(units) units FROM donations WHERE status='Completed' GROUP BY m ORDER BY m"),
  trend:await rows("SELECT DATE_FORMAT(issued_at,'%Y-%m') m,SUM(units_issued) units FROM blood_issues GROUP BY m ORDER BY m"),
  expiring:await rows('SELECT batch_code,blood_group,component,expiry_date,units_available FROM blood_inventory WHERE units_available>0 AND expiry_date<DATE_ADD(CURDATE(),INTERVAL 7 DAY) ORDER BY expiry_date')})}));
r.get('/users',w(async(q,s)=>s.json(await rows("SELECT id,full_name,email,mobile,is_active,created_at FROM users WHERE role='user' ORDER BY id DESC"))));
r.put('/users/:id/active',w(async(q,s)=>{await db.query("UPDATE users SET is_active=? WHERE id=? AND role='user'",[q.body.active?1:0,q.params.id]);await log(q,'user.active','user',+q.params.id,q.body);s.json({ok:true})}));
r.get('/donations',w(async(q,s)=>s.json(await rows('SELECT x.*,u.full_name,d.blood_group,d.city FROM donations x JOIN donors d ON d.id=x.donor_id JOIN users u ON u.id=d.user_id ORDER BY x.id DESC'))));
r.put('/donations/:id',w(async(q,s)=>{const {status,units,notes}=q.body;
 if(!['Scheduled','Completed','Deferred','Cancelled'].includes(status))return bad(s,'Invalid status.');
 if(status==='Completed'&&!(+units>=1&&+units<=2))return bad(s,'Enter units collected (1 or 2).');
 const [x]=await db.query("UPDATE donations SET status=?,units=?,staff_notes=?,recorded_by=?,collected_on=IF(?='Completed',CURDATE(),collected_on) WHERE id=? AND status IN('Requested','Scheduled')",[status,status==='Completed'?+units:null,(notes||'').slice(0,500),q.user.id,status,q.params.id]);
 if(!x.affectedRows)return bad(s,'This donation is already closed.');
 if(status==='Completed')await db.query('UPDATE donors d JOIN donations x ON x.donor_id=d.id SET d.last_donation_date=CURDATE() WHERE x.id=?',[q.params.id]);
 await log(q,'donation.'+status,'donation',+q.params.id,q.body);s.json({ok:true})}));
r.get('/inventory',w(async(q,s)=>s.json(await rows(`SELECT *,(${OK} AND units_available>0) AS eligible FROM blood_inventory ORDER BY expiry_date`))));
r.post('/inventory',w(async(q,s)=>{const b=q.body,n=+b.units;
 if(!GROUPS.includes(b.blood_group)||!COMPONENTS.includes(b.component))return bad(s,'Invalid blood group or component.');
 if(!Number.isInteger(n)||n<1||n>100)return bad(s,'Units must be 1 to 100.');
 if(!b.batch_code||!b.collection_date||!b.expiry_date||b.expiry_date<=b.collection_date)return bad(s,'Enter a batch code and valid dates (expiry after collection).');
 try{const [x]=await db.query('INSERT INTO blood_inventory(batch_code,donation_id,blood_group,component,units_total,units_available,collection_date,expiry_date,created_by)VALUES(?,?,?,?,?,?,?,?,?)',[b.batch_code.trim(),b.donation_id||null,b.blood_group,b.component,n,n,b.collection_date,b.expiry_date,q.user.id]);
  await db.query("INSERT INTO inventory_transactions(inventory_id,change_type,units_change,performed_by)VALUES(?,'Added',?,?)",[x.insertId,n,q.user.id]);
  await log(q,'inventory.add','inventory',x.insertId,b);s.json({ok:true})}
 catch(e){if(e.code==='ER_DUP_ENTRY')return bad(s,'That batch code already exists.');throw e}}));
r.put('/inventory/:id/screening',w(async(q,s)=>{if(!['Passed','Failed'].includes(q.body.status))return bad(s,'Invalid status.');
 const [x]=await db.query("UPDATE blood_inventory SET screening_status=? WHERE id=? AND screening_status='Pending'",[q.body.status,q.params.id]);
 if(!x.affectedRows)return bad(s,'Screening was already recorded.');
 await db.query("INSERT INTO inventory_transactions(inventory_id,change_type,units_change,note,performed_by)VALUES(?,'Screening Update',0,?,?)",[q.params.id,q.body.status,q.user.id]);
 await log(q,'inventory.screening','inventory',+q.params.id,q.body);s.json({ok:true})}));
const NEXT={'Pending':['Under Review','Cancelled'],'Under Review':['Approved','Rejected','Cancelled'],'Approved':['Ready for Issue','Cancelled'],'Ready for Issue':['Cancelled']}; // 'Issued' only via /issue
r.get('/requests',w(async(q,s)=>{const f=[],p=[];for(const k of ['status','urgency','blood_group']){if(q.query[k]){f.push(k+'=?');p.push(q.query[k])}}
 if(q.query.from){f.push('DATE(created_at)>=?');p.push(q.query.from)}if(q.query.to){f.push('DATE(created_at)<=?');p.push(q.query.to)}
 s.json(await rows(`SELECT * FROM blood_requests ${f.length?'WHERE '+f.join(' AND '):''} ORDER BY id DESC`,p))}));
r.put('/requests/:id/status',w(async(q,s)=>{const {status,reason,response}=q.body;const [[x]]=await db.query('SELECT * FROM blood_requests WHERE id=?',[q.params.id]);
 if(!x)return bad(s,'Request not found.');
 if(!(NEXT[x.status]||[]).includes(status))return bad(s,`Cannot change ${x.status} to ${status}.`);
 if(status==='Rejected'&&!reason)return bad(s,'Enter a rejection reason.');
 if(status==='Approved'){const [[a]]=await db.query(`SELECT COALESCE(SUM(units_available),0) n FROM blood_inventory WHERE blood_group=? AND component=? AND ${OK}`,[x.blood_group,x.component]);
  if(+a.n<x.units_required)return bad(s,`Only ${a.n} eligible unit(s) in stock. Cannot approve.`)}
 await db.query('UPDATE blood_requests SET status=?,rejection_reason=?,admin_response=? WHERE id=?',[status,reason||null,response||null,x.id]);
 await db.query('INSERT INTO notifications(user_id,message)VALUES(?,?)',[x.user_id,`Request ${x.request_code} is now: ${status}.`]);
 await log(q,'request.status','request',x.id,{status,reason});s.json({ok:true})}));
r.post('/requests/:id/issue',w(async(q,s)=>{const c=await db.getConnection();
 try{await c.beginTransaction();
  const [[x]]=await c.query('SELECT * FROM blood_requests WHERE id=? FOR UPDATE',[q.params.id]);
  if(!x||x.status!=='Ready for Issue'){await c.rollback();return bad(s,'Request must be Ready for Issue.')}
  const [[b]]=await c.query(`SELECT * FROM blood_inventory WHERE id=? AND blood_group=? AND component=? AND units_available>=? AND ${OK} FOR UPDATE`,[+q.body.inventory_id,x.blood_group,x.component,x.units_required]);
  if(!b){await c.rollback();return bad(s,'That batch cannot supply this request (group, component, screening, expiry or quantity).')}
  await c.query('UPDATE blood_inventory SET units_available=units_available-? WHERE id=?',[x.units_required,b.id]);
  await c.query('INSERT INTO blood_issues(request_id,inventory_id,units_issued,issued_by)VALUES(?,?,?,?)',[x.id,b.id,x.units_required,q.user.id]);
  await c.query("INSERT INTO inventory_transactions(inventory_id,change_type,units_change,note,performed_by)VALUES(?,'Issued',?,?,?)",[b.id,-x.units_required,x.request_code,q.user.id]);
  await c.query("UPDATE blood_requests SET status='Issued' WHERE id=?",[x.id]);
  await c.query('INSERT INTO notifications(user_id,message)VALUES(?,?)',[x.user_id,`Request ${x.request_code} has been issued.`]);
  await c.commit();await log(q,'request.issue','request',x.id,{batch:b.batch_code});s.json({ok:true})}
 catch(e){await c.rollback();throw e}finally{c.release()}}));
r.get('/messages',w(async(q,s)=>s.json(await rows('SELECT * FROM contact_messages ORDER BY id DESC'))));
r.put('/messages/:id',w(async(q,s)=>{if(!['New','In Progress','Resolved'].includes(q.body.status))return bad(s,'Invalid status.');
 await db.query('UPDATE contact_messages SET status=?,admin_notes=? WHERE id=?',[q.body.status,(q.body.notes||'').slice(0,1000),q.params.id]);s.json({ok:true})}));
const REP={
 donations:"SELECT x.id,u.full_name donor,d.blood_group bg,x.status,x.units,DATE(x.created_at) dt FROM donations x JOIN donors d ON d.id=x.donor_id JOIN users u ON u.id=d.user_id",
 inventory:"SELECT batch_code,blood_group bg,component,units_total,units_available,screening_status,expiry_date,collection_date dt FROM blood_inventory",
 requests:"SELECT request_code,blood_group bg,component,units_required,urgency,status,hospital_name,DATE(created_at) dt FROM blood_requests",
 issues:"SELECT i.id,r.request_code,b.batch_code,b.blood_group bg,i.units_issued,DATE(i.issued_at) dt FROM blood_issues i JOIN blood_requests r ON r.id=i.request_id JOIN blood_inventory b ON b.id=i.inventory_id"};
r.get('/reports/:type',w(async(q,s)=>{const sql=REP[q.params.type];if(!sql)return bad(s,'Unknown report.');const {group='',from='',to=''}=q.query;
 const d=await rows(`SELECT * FROM (${sql}) t WHERE (?='' OR bg=?) AND (?='' OR dt>=?) AND (?='' OR dt<=?) ORDER BY dt DESC`,[group,group,from,from,to,to]);
 if(q.query.format!=='csv')return s.json(d);
 const e=v=>{v=String(v??'');if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'}; // blocks spreadsheet formula injection
 const cols=d[0]?Object.keys(d[0]):[];s.type('text/csv').attachment(q.params.type+'-report.csv').send([cols.join(','),...d.map(x=>cols.map(k=>e(x[k])).join(','))].join('\n'))}));
module.exports=r;
