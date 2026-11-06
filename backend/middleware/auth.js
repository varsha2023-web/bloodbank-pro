const jwt=require('jsonwebtoken');
exports.auth=(q,s,n)=>{try{q.user=jwt.verify(q.cookies.token,process.env.JWT_SECRET);n()}catch{s.status(401).json({error:'Please log in.'})}};
exports.admin=(q,s,n)=>q.user.role==='admin'?n():s.status(403).json({error:'Admins only.'});
exports.csrf=(q,s,n)=>(q.method!=='GET'&&q.get('X-Requested-With')!=='fetch')?s.status(403).json({error:'Bad request.'}):n();
exports.w=f=>(q,s,n)=>f(q,s,n).catch(n); // forwards async errors to the error handler
