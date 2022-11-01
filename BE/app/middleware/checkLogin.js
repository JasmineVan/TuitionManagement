const Account = require("../models/Account");
module.exports = async function checkLogin(req, res, next){
    console.log(req.session.user_id)
    const account = await Account.findOne({ _id: req.session.user_id }).lean();
    console.log(account)
    if (account) {
        req.account = account;
        next(); 
    } 
    else {
        console.log('Chưa đăng nhập');
        return res.json({code : 10, message: 'Chưa Đăng Nhập'})
    }
}