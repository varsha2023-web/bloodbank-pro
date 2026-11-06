const r=require('express').Router(),bcrypt=require('bcryptjs'),crypto=require('crypto');
const db=require('../config/db'),{auth,w}=require('../middleware/auth'),{re,GROUPS,COMPONENTS,bad}=require('../middleware/validate');
r.use(auth); // every route below only ever touches the logged-in user's own rows
r.get('/profile',w(async(q,s)=>{const [[u]]=await db.query('SELECT id,full_name,email,mobile FROM users WHERE id=?',[q.user.id]);
 const [[d]]=await db.query('SELECT * FROM donors WHERE user_id=?',[q.user.id]);s.json({user:u,donor:d||null})}));
r.put('/profile',w(async(q,s)=>{const {full_name,mobile}=q.body;
 if(!full_name||full_name.trim().length<2)return bad(s,'Enter your full name.');
 if(!re.mobile.test(mobile||''))return bad(s,'Enter a valid 10-digit mobile number.');
 await db.query('UPDATE users SET full_name=?,mobile=? WHERE id=?',[full_name.trim(),mobile,q.user.id]);s.json({ok:true,msg:'Profile saved.'})}));
r.put('/password',w(async(q,s)=>{const [[u]]=await db.query('SELECT password_hash FROM users WHERE id=?',[q.user.id]);
 if(!await bcrypt.compare(String(q.body.current||''),u.password_hash))return bad(s,'Current password is wrong.');
 if(!re.pw.test(q.body.next||''))return bad(s,'New password needs 8+ characters with a letter and a number.');
 await db.query('UPDATE users SET password_hash=? WHERE id=?',[await bcrypt.hash(q.body.next,10),q.user.id]);s.json({ok:true,msg:'Password changed.'})}));
r.post('/donor',w(async(q,s)=>{const b=q.body,age=(Date.now()-new Date(b.date_of_birth))/31557600000;
 if(isNaN(age)||age<18||age>65)return bad(s,'Donor registration is for ages 18 to 65.');
 if(!GROUPS.includes(b.blood_group))return bad(s,'Choose a blood group.');
 if(!b.city||!b.city.trim())return bad(s,'Enter your city.');
 if(!b.consent)return bad(s,'Consent is required to register.');
 if(b.last_donation_date&&new Date(b.last_donation_date)>new Date())return bad(s,'Last donation date cannot be in the future.');
 await db.query(`INSERT INTO donors(user_id,date_of_birth,gender,blood_group,city,location,last_donation_date,is_available,consent_given,consent_at)VALUES(?,?,?,?,?,?,?,?,TRUE,NOW())
  ON DUPLICATE KEY UPDATE date_of_birth=VALUES(date_of_birth),gender=VALUES(gender),blood_group=VALUES(blood_group),city=VALUES(city),location=VALUES(location),last_donation_date=VALUES(last_donation_date),is_available=VALUES(is_available)`,
  [q.user.id,b.date_of_birth,b.gender||null,b.blood_group,b.city.trim(),b.location||null,b.last_donation_date||null,b.is_available?1:0]);
 s.json({ok:true,msg:'Donor details saved. Staff will assess eligibility at your visit.'})}));
r.post('/donations',w(async(q,s)=>{const [[d]]=await db.query('SELECT id FROM donors WHERE user_id=?',[q.user.id]);
 if(!d)return bad(s,'Register as a donor first.');const p=q.body.preferred_date;
 if(!p||p<new Date().toISOString().slice(0,10))return bad(s,'Choose a date from today onwards.');
 const [[x]]=await db.query("SELECT id FROM donations WHERE donor_id=? AND status IN('Requested','Scheduled')",[d.id]);
 if(x)return bad(s,'You already have an open donation request.');
 await db.query('INSERT INTO donations(donor_id,preferred_date)VALUES(?,?)',[d.id,p]);s.json({ok:true,msg:'Donation request sent.'})}));
r.get('/donations',w(async(q,s)=>s.json((await db.query('SELECT x.* FROM donations x JOIN donors d ON d.id=x.donor_id WHERE d.user_id=? ORDER BY x.id DESC',[q.user.id]))[0])));
r.put('/donations/:id/cancel',w(async(q,s)=>{const [x]=await db.query("UPDATE donations x JOIN donors d ON d.id=x.donor_id SET x.status='Cancelled' WHERE x.id=? AND d.user_id=? AND x.status='Requested'",[q.params.id,q.user.id]);
 x.affectedRows?s.json({ok:true,msg:'Cancelled.'}):bad(s,'Only pending requests can be cancelled.')}));
r.post('/requests',w(async(q,s)=>{const b=q.body,n=+b.units_required;
 if(!b.patient_name||!b.hospital_name||!b.city)return bad(s,'Fill in patient, hospital and city.');
 if(!GROUPS.includes(b.blood_group)||!COMPONENTS.includes(b.component))return bad(s,'Choose a valid blood group and component.');
 if(!Number.isInteger(n)||n<1||n>10)return bad(s,'Units must be between 1 and 10.');
 if(!re.mobile.test(b.contact_mobile||''))return bad(s,'Enter a valid 10-digit contact number.');
 if(!['Routine','Urgent','Emergency'].includes(b.urgency))return bad(s,'Choose urgency.');
 const code='BR-'+new Date().getFullYear()+'-'+crypto.randomInt(100000,999999);
 await db.query('INSERT INTO blood_requests(request_code,user_id,patient_name,blood_group,component,units_required,hospital_name,city,urgency,contact_mobile,notes)VALUES(?,?,?,?,?,?,?,?,?,?,?)',
  [code,q.user.id,b.patient_name.trim(),b.blood_group,b.component,n,b.hospital_name.trim(),b.city.trim(),b.urgency,b.contact_mobile,(b.notes||'').slice(0,500)]);
 s.json({ok:true,msg:'Request submitted. Your request ID is '+code+'. Submitting does not guarantee availability.'})}));
r.get('/requests',w(async(q,s)=>s.json((await db.query('SELECT * FROM blood_requests WHERE user_id=? ORDER BY id DESC',[q.user.id]))[0])));
r.put('/requests/:id/cancel',w(async(q,s)=>{const [x]=await db.query("UPDATE blood_requests SET status='Cancelled' WHERE id=? AND user_id=? AND status IN('Pending','Under Review')",[q.params.id,q.user.id]);
 x.affectedRows?s.json({ok:true,msg:'Request cancelled.'}):bad(s,'Only pending requests can be cancelled.')}));
r.get('/notifications',w(async(q,s)=>s.json((await db.query('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 20',[q.user.id]))[0])));
r.put('/notifications/read',w(async(q,s)=>{await db.query('UPDATE notifications SET is_read=1 WHERE user_id=?',[q.user.id]);s.json({ok:true})}));
module.exports=r;
