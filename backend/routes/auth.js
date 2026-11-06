const r=require('express').Router(),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),rl=require('express-rate-limit');
const db=require('../config/db'),{auth,w}=require('../middleware/auth'),{re,bad}=require('../middleware/validate');
const lim=rl({windowMs:15*60*1000,max:10,message:{error:'Too many attempts. Try again in 15 minutes.'}});
r.post('/register',w(async(q,s)=>{const {full_name,email,mobile,password,confirm}=q.body;
 if(!full_name||full_name.trim().length<2)return bad(s,'Enter your full name.');
 if(!re.email.test(email||''))return bad(s,'Enter a valid email address.');
 if(!re.mobile.test(mobile||''))return bad(s,'Enter a valid 10-digit mobile number.');
 if(!re.pw.test(password||''))return bad(s,'Password needs 8+ characters with a letter and a number.');
 if(password!==confirm)return bad(s,'Passwords do not match.');
 try{await db.query('INSERT INTO users(full_name,email,mobile,password_hash)VALUES(?,?,?,?)',[full_name.trim(),email.toLowerCase(),mobile,await bcrypt.hash(password,10)]);s.json({ok:true})}
 catch(e){if(e.code==='ER_DUP_ENTRY')return s.status(409).json({error:'That email is already registered.'});throw e}}));
const login=role=>w(async(q,s)=>{
 const [[u]]=await db.query('SELECT * FROM users WHERE email=? AND role=?',[String(q.body.email||'').toLowerCase(),role]);
 if(!u||!u.is_active||!await bcrypt.compare(String(q.body.password||''),u.password_hash))return s.status(401).json({error:'Wrong email or password.'});
 const t=jwt.sign({id:u.id,role:u.role,name:u.full_name},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'2h'});
 s.cookie('token',t,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:2*3600*1000});s.json({role:u.role})});
r.post('/login',lim,login('user'));r.post('/admin-login',lim,login('admin'));
r.post('/logout',(q,s)=>{s.clearCookie('token');s.json({ok:true})});
r.get('/me',auth,(q,s)=>s.json(q.user));
module.exports=r;
