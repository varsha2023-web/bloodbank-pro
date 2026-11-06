exports.re={email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/,mobile:/^[6-9]\d{9}$/,pw:/^(?=.*[A-Za-z])(?=.*\d).{8,}$/};
exports.GROUPS=['A+','A-','B+','B-','AB+','AB-','O+','O-'];
exports.COMPONENTS=['Whole Blood','Red Cells','Plasma','Platelets'];
exports.bad=(s,m)=>s.status(400).json({error:m});
