// One-step setup: creates the database + tables (only if missing), the admin account and sample data.
require('dotenv').config();
const mysql=require('mysql2/promise'),fs=require('fs'),path=require('path'),{execSync}=require('child_process');
(async()=>{
 const need=['DB_HOST','DB_USER','JWT_SECRET','ADMIN_EMAIL','ADMIN_PASSWORD'];
 const miss=need.filter(k=>!process.env[k]);
 if(miss.length){console.log('\nMissing in backend/.env: '+miss.join(', '));process.exit(1)}
 let c;
 try{c=await mysql.createConnection({host:process.env.DB_HOST,port:process.env.DB_PORT||3306,user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',multipleStatements:true})}
 catch(e){
  const why={ER_ACCESS_DENIED_ERROR:'Wrong MySQL user or password. Open backend/.env and set DB_PASSWORD to your MySQL root password.',ECONNREFUSED:'MySQL is not running. Open Windows Services, find MySQL80 and click Start.'}[e.code]||e.message;
  console.log('\nCannot connect to MySQL: '+why);process.exit(1)}
 const db=process.env.DB_NAME||'bloodbank_db';
 const [[t]]=await c.query("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name='users'",[db]);
 if(t.n===0){console.log('Creating database and tables...');await c.query(fs.readFileSync(path.join(__dirname,'../../database/schema.sql'),'utf8'))}
 else console.log('Database already exists - keeping your data.');
 await c.end();
 const run=f=>execSync('node '+path.join(__dirname,f),{stdio:'inherit'});
 run('createAdmin.js');
 if(t.n===0)run('seed.js');
 console.log('\nSetup finished.');process.exit(0)})().catch(e=>{console.log('\nSetup failed: '+e.message);process.exit(1)});
