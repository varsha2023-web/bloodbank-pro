require('dotenv').config();
const express=require('express'),helmet=require('helmet'),cookie=require('cookie-parser'),path=require('path'),{csrf}=require('./middleware/auth'),db=require('./config/db');
if(!process.env.JWT_SECRET){console.log('JWT_SECRET is missing in backend/.env');process.exit(1)}
const app=express();
app.use(helmet({contentSecurityPolicy:false})); // CSP off: pages load Bootstrap/Chart.js from a CDN
app.use(express.json({limit:'50kb'}),cookie(),csrf);
app.use('/api/auth',require('./routes/auth'));
app.use('/api/public',require('./routes/public'));
app.use('/api/me',require('./routes/user'));
app.use('/api/admin',require('./routes/admin'));
app.use(express.static(path.join(__dirname,'../frontend')));
app.use((e,q,s,n)=>{console.error('SERVER ERROR ['+(e.code||'')+'] '+e.message);s.status(500).json({error:'Something went wrong. Please try again.'})});
const P=process.env.PORT||3000;
db.query('SELECT 1').then(()=>app.listen(P,()=>console.log('Database connected. Open http://localhost:'+P+' in Chrome or Edge.')))
 .catch(e=>{console.log('Cannot reach the database ['+e.code+']: '+e.message+'\nRun "npm run setup" first and check DB_PASSWORD in backend/.env');process.exit(1)});
