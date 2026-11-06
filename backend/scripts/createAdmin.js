require('dotenv').config();const db=require('../config/db'),bcrypt=require('bcryptjs');
(async()=>{const e=process.env.ADMIN_EMAIL,p=process.env.ADMIN_PASSWORD;
 if(!e||!p||p.length<8||p==='choose_a_strong_password'){console.log('Set ADMIN_EMAIL and a strong ADMIN_PASSWORD in .env first.');process.exit(1)}
 await db.query("INSERT INTO users(full_name,email,mobile,password_hash,role)VALUES('Administrator',?,'9000000000',?,'admin') ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),role='admin'",[e.toLowerCase(),await bcrypt.hash(p,10)]);
 console.log('Admin ready. Log in at /admin-login.html with',e);process.exit(0)})().catch(x=>{console.error(x.message);process.exit(1)});
