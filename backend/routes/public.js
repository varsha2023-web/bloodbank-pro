const r=require('express').Router(),db=require('../config/db'),{w}=require('../middleware/auth'),{re,GROUPS,COMPONENTS,bad}=require('../middleware/validate');
// Only screened, unexpired stock is ever shown. No donor data is exposed here.
r.get('/availability',w(async(q,s)=>{const p=[];let f='';
 if(GROUPS.includes(q.query.group)){f+=' AND blood_group=?';p.push(q.query.group)}
 if(COMPONENTS.includes(q.query.component)){f+=' AND component=?';p.push(q.query.component)}
 s.json((await db.query(`SELECT blood_group,component,SUM(units_available) units FROM blood_inventory WHERE screening_status='Passed' AND expiry_date>=CURDATE() AND units_available>0${f} GROUP BY blood_group,component ORDER BY blood_group,component`,p))[0])}));
r.post('/contact',w(async(q,s)=>{const {name,email,subject,message}=q.body;
 if(!name||!subject||!message||message.length>2000)return bad(s,'Fill in name, subject and message (max 2000 characters).');
 if(!re.email.test(email||''))return bad(s,'Enter a valid email address.');
 await db.query('INSERT INTO contact_messages(name,email,subject,message)VALUES(?,?,?,?)',[name.slice(0,100),email,subject.slice(0,150),message]);s.json({ok:true})}));
module.exports=r;
