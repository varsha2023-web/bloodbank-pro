// FICTIONAL sample data. Demo users share the password Demo@1234
require('dotenv').config();const db=require('../config/db'),bcrypt=require('bcryptjs');
(async()=>{const h=await bcrypt.hash('Demo@1234',10);
 for(const [n,e,m,g] of [['Asha Demo','asha@example.com','9000000001','O+'],['Ravi Demo','ravi@example.com','9000000002','A+']]){
  const [u]=await db.query('INSERT IGNORE INTO users(full_name,email,mobile,password_hash)VALUES(?,?,?,?)',[n,e,m,h]);
  if(u.insertId)await db.query("INSERT INTO donors(user_id,date_of_birth,blood_group,city,consent_given,consent_at)VALUES(?,'1999-05-10',?,'Bengaluru',TRUE,NOW())",[u.insertId,g])}
 const G=['A+','A-','B+','B-','AB+','AB-','O+','O-'];
 for(const [i,g] of G.entries()){const n=i%3===0?3:12;
  await db.query("INSERT IGNORE INTO blood_inventory(batch_code,blood_group,component,units_total,units_available,collection_date,expiry_date,screening_status)VALUES(?,?,'Red Cells',?,?,CURDATE()-INTERVAL 5 DAY,CURDATE()+INTERVAL 30 DAY,'Passed')",['DEMO-'+(i+1),g,n,n])}
 await db.query("INSERT IGNORE INTO blood_inventory(batch_code,blood_group,component,units_total,units_available,collection_date,expiry_date,screening_status)VALUES('DEMO-PENDING','O-','Plasma',5,5,CURDATE(),CURDATE()+INTERVAL 60 DAY,'Pending'),('DEMO-EXPIRED','B+','Red Cells',5,5,CURDATE()-INTERVAL 40 DAY,CURDATE()-INTERVAL 1 DAY,'Passed')");
 console.log('Sample data added (includes one unscreened and one expired batch that must NOT show as available).');process.exit(0)})().catch(x=>{console.error(x.message);process.exit(1)});
