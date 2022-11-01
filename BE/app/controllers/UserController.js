const Account = require('../models/Account');
const bcrypt = require("bcrypt");
const upload = require('../../upload');
const multiparty = require('multiparty');
const Transaction = require('../models/Transaction')
const card_network = require("../../util/card");
const OTP = require('../models/OTP');
const otp = require('../../util/OTP');
const nodemailer =  require('nodemailer');
const { mailHost, mailUser, mailPass, mailPort, appPassword } = process.env;

const cards = [
    {
        number_card: "111111",
        date_end: "2022-10-10",
        cvv: "411",
        STT: 1,
    },
    {
        number_card: "222222",
        date_end: "2022-11-11",
        cvv: "443",
        STT: 2,
    },
    {
        number_card: "333333",
        date_end: "2022-12-12",
        cvv: "577",
        STT: 3,
    },
];

class UserController {
  
    // [POST] /user/home
    async renderHome(req, res) {
        const account = req.body
        if(account.account == 'null'){
            return res.json({code: 1, message: 'Chưa đăng nhập'});
        }
        let accountList = await Account.findOne({_id: JSON.parse(account.account)._id}).lean();
        //console.log(accountList)
        return res.json({code: 0, message: 'Đã đăng nhập', data: accountList});
    }

    // [POST] /user/tuition
    async renderTuition(req, res) {
        const account = req.body
        if(account.account == 'null'){
            return res.json({code: 1, message: 'Chưa đăng nhập'});
        }
        let accountList = await Account.findOne({_id: JSON.parse(account.account)._id}).lean();
        //console.log(accountList)
        return res.json({code: 0, message: 'Đã đăng nhập', data: accountList});
    }

    // [POST] /user/history
    async renderHistory(req, res, next) {
        const account = req.body
        // console.log(account)
        let historyList = await Transaction.find({mssv: JSON.parse(account.account).mssv}).lean();
        if(account.account == 'null'){
            return res.json({code: 1, message: 'Chưa đăng nhập'});
        }
        console.log("Account là", account)
        return res.json({code: 0, message: 'Đã đăng nhập', account, historyList});
    }

    renderHomeTemp(req, res, next) {
        //const account = req.account;
        res.render('./user/home_temp');
    }

    async renderChuyenTien(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh' || account[0].status === 'chờ cập nhật'){
            account_cxm.push(account[0])
        }
        else if(account[0].status === 'đã xác minh'){
            account_dxm.push(account[0])
        }
        res.render('./user/chuyentien', {account_cxm, account_dxm});
    }

    async createOTP(req, res, next) {
        const { type, mssv, account } = req.body;
        const acc = await Account.findOne({ mssv }).lean();
        if (!acc) {
            return res.json({ code: 1, message: "Tài khoản không tồn tại!" });
        }

        const otpfind = await OTP.findOne({ mssv, type });
        if (otpfind) {
            await OTP.findOneAndDelete({ mssv, type });
        }
        const otpCode = otp.createOTP();
        const data = { mssv, code: otpCode, type };
        const o = new OTP(data);
        await o.save();
        otp.deleteOTP(o._id);
        console.log("OTP CODE: ", otpCode);
        sendMailOTP(JSON.parse(account).email, otpCode, type);
        return res.json({ code: 0, message: "Create OTP Sucessfully" });
    }

    async getMoneyByMssv(req, res){
        let { mssv } = req.body
        if(!mssv){
            return res.json({code: 1, message: 'Thiếu mssv'})
        }
        let account = await Account.findOne({ mssv }).lean();
        //console.log("Account theo mssv la", account)
        if(!account){
            return res.json({code: 2, message: 'MSSV không tồn tại'})
        }
        return res.json({code: 0, message: 'Tìm thấy account', data: account})
    }

    async ChuyenTien(req, res){
        let {receiver, mssv, otp_code, money, accountLocalStorage} = req.body
        console.log("Account Local", accountLocalStorage)
        let accountStorage = await Account.findOne({_id: JSON.parse(accountLocalStorage)._id}).lean();
        let account = await Account.findOne({mssv}).lean();
        console.log(account);
        money = parseInt(money)
        const otp_find = await OTP.findOne({
            mssv: account.mssv,
            otp_code,
            type: "transfer_money",
        });
        if(!otp_find){
            return res.json({code: 3, message: 'Mã OTP không hợp lệ hoặc đã hết hạn'})
        }
        
        if (accountStorage.balance < parseInt(money)) {
            return res.json({code: 4, message: 'Số tiền không đủ'})
        }

        let data = {
            mssv,
            receiver,
            money,
            type: "transfer_money",
            status: "thanhcong",
        };
        console.log(accountStorage.balance, money)
        let balance = accountStorage.balance - money;
        console.log(balance)
        let tuition = account.tuition - money;
        console.log("Số dư là: ", balance)
        await Account.findOneAndUpdate(
            { mssv: accountStorage.mssv },
            { balance }
        );
        await Account.findOneAndUpdate(
            { mssv },
            { tuition }
        );
        const trans = new Transaction(data);
        await trans.save();
        sendMailTransfer(accountStorage.email, money, account.mssv);
        return res.json({code: 0, message: 'Chuyển tiền thành công'})
    }

    async renderThongTinCaNhan(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh'){
            account_cxm.push(account[0])
        }
        else if(account[0].status === 'đã xác minh' || account[0].status === 'chờ cập nhật'){
            account_dxm.push(account[0])
        }
        console.log(account_dxm)
        res.render('./user/thongtincanhan',{account_dxm, account_cxm, account});
    }

    async renderMuaCard(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh'){
            account_cxm.push(account[0])
        }
        else if(account[0].status === 'đã xác minh' || account[0].status === 'chờ cập nhật'){
            account_dxm.push(account[0])
        }
        res.render('./user/muacard', {account_cxm, account_dxm});
    }

    async MuaCard(req, res){
        let account = req.account
        let {name, price, quantity} = req.body
        let total = parseInt(price) * parseInt(quantity)
        if(total > account.balance){
            return res.json({code: 1, message: 'Số dư tài khoản không đủ'})
        }
        let cardContent = ``
        for (let i = 0; i < quantity; i++) {
            cardContent += card_network.card(name);
        }
        const data = {
            phone: account.phone,
            amount: total,
            operator: name,
            denomination: price,
            quantity,
            fee: 0,
            content: cardContent,
            type: "buycard",
        };
        const transaction = new Transaction(data);
        await transaction.save();
        const balance = account.balance - total;
        await Account.findOneAndUpdate(
            { username: account.username },
            { balance }
        );
        req.flash("card_content", cardContent)
        return res.json({code: 0, message:'Mua card thành công'})
    }

    async renderLichSuGiaoDichNap(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh'){
            account_cxm.push(account[0] || account[0].status === 'chờ cập nhật')
        }
        else if(account[0].status === 'đã xác minh'){
            account_dxm.push(account[0])
        }
        let transaction = await Transaction.find({type: 'naptien'}).sort({createdAt: -1}).lean()
        console.log(transaction)
        res.render('./user/lichsugiaodichnap', {account_cxm, account_dxm, transaction});
    }

    async renderLichSuGiaoDichRut(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh' || account[0].status === 'chờ cập nhật'){
            account_cxm.push(account[0])
        }
        else if(account[0].status === 'đã xác minh'){
            account_dxm.push(account[0])
        }
        let transaction = await Transaction.find({type: 'ruttien'}).sort({createdAt: -1}).lean()
        console.log(transaction)
        res.render('./user/lichsugiaodichrut', {account_cxm, account_dxm, transaction});
    }

    async renderLichSuGiaoDichChuyen(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh' || account[0].status === 'chờ cập nhật'){
            account_cxm.push(account[0])
        }
        else if(account[0].status === 'đã xác minh'){
            account_dxm.push(account[0])
        }
        let transaction = await Transaction.find({type: 'transfer_money'}).sort({createdAt: -1, updateAt: -1}).lean()
        console.log(transaction)
        res.render('./user/lichsugiaodichchuyen', {account_cxm, account_dxm, transaction});
    }

    async renderLichSuGiaoDichMua(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh' || account[0].status === 'chờ cập nhật'){
            account_cxm.push(account[0])
        }
        else if(account[0].status === 'đã xác minh'){
            account_dxm.push(account[0])
        }
        let transaction = await Transaction.find({type: 'buycard'}).sort({createdAt: -1}).lean()
        console.log(transaction)
        res.render('./user/lichsugiaodichmua', {account_cxm, account_dxm, transaction});
    }

    async renderNapTien(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh' || account[0].status === 'chờ cập nhật'){
            account_cxm.push(account[0])
        }
        else if(account[0].status === 'đã xác minh'){
            account_dxm.push(account[0])
        }
        res.render('./user/naptien', {account_cxm, account_dxm});
    }

    async NapTien(req, res){
        let {number_card, date_end, cvv_code, money} = req.body
        let account = req.account
        let card = new Array()
        cards.forEach(item => {
            if(item.number_card == number_card){
                card.push(item)
            }
        })
        console.log(card[0])
        console.log(date_end)
        console.log(cvv_code)
        if(card.length == 0){
            return res.json({code: 1, message: 'Mã thẻ không được hỗ trợ'})
        }
        if(card[0].date_end != date_end){
            return res.json({code: 2, message: 'Ngày hết hạn không hợp lệ'})
        }
        if(card[0].cvv != cvv_code){
            return res.json({code: 3, message: 'Mã CVV không hợp lệ'})
        }
        if(card[0].STT == 2 && money > 1000000){
            return res.json({code: 4, message: 'Thẻ này chỉ hỗ trợ nạp tối đa 1 triệu/lần'})
        }
        if(card[0].STT == 3){
            return res.json({code: 5, message: 'Thẻ này không hỗ trợ nạp tiền, khi nạp luôn thông báo thẻ hết tiền'})
        }
        const data = {
            phone: account.phone,
            number_card: card[0].number_card,
            money,
            total: money,
            type: "naptien",
        };
        const transaction = new Transaction(data);
        await transaction.save();
        const balance = parseInt(account.balance) + parseInt(money);
        await Account.findOneAndUpdate(
            { phone: account.phone },
            {
                balance,
            }
        );
        return res.json({code: 0, message: 'Nạp tiền thành công'})
    }

    async renderRutTien(req, res){
        let account = await Account.find({_id: req.session.user_id}).lean()
        let account_cxm = new Array()
        let account_dxm = new Array()
        if(account[0].status == 'chờ xác minh' || account[0].status === 'chờ cập nhật'){
            account_cxm.push(account[0])
        }
        else if(account[0].status === 'đã xác minh'){
            account_dxm.push(account[0])
        }
        res.render('./user/ruttien', {account_cxm, account_dxm});
    }

    // [POST] /user/ruttien
    async RutTien(req, res){
        let {number_card, date_end, cvv_code, money, note} = req.body
        let account = req.account
        let card = new Array()
        cards.forEach(item => {
            if(item.number_card == number_card){
                card.push(item)
            }
        })
        //console.log(card[0])
        console.log(date_end)
        console.log(card[0].date_end)
        //console.log(cvv_code)
        if(card.length == 0){
            return res.json({code: 1, message: 'Thông tin thẻ không hợp lệ'})
        }
        if(card[0].date_end != date_end){
            return res.json({code: 2, message: 'Ngày hết hạn không hợp lệ'})
        }
        if(card[0].cvv != cvv_code){
            return res.json({code: 3, message: 'Mã CVV không hợp lệ'})
        }
        if(money % 50000 !== 0){
            return res.json({code: 4, message: 'Số tiền rút phải là bội số của 50000'})
        }
        let fee = parseInt(money) * 0.05
        let total = parseInt(money) + parseInt(fee)
        if(account.balance < total){
            return res.json({code: 5, message: 'Số tiền rút vượt quá số dư trong tài khoản'})
        }
        const transactions = await Transaction.find({
            phone: account.phone,
            type: "ruttien",
        }).sort({ createdAt: -1 }).limit(2)
        let times = 0;
        let today = getToday();
        transactions.forEach((t) => {
            let diff = checkDateWithdraw(today, t.createdAt);
            if (diff > 0) {
                times += 1;
            }
        });
        if (times >= 2) {
            return res.json({code: 6, message: 'Mỗi ngày chỉ được rút tiền tối đa 2 lần'});
        }
        if(money < 5000000){
            const data = {
                phone: account.phone,
                number_card,
                money,
                fee,
                total,
                type: "ruttien",
                note,
                status:'thanhcong'
            };
            const transaction = new Transaction(data);
            await transaction.save();
            const balance = parseInt(account.balance) - total;
            await Account.findOneAndUpdate(
                { phone: account.phone },
                {
                    balance,
                }
            );
        }
        else{
            const data = {
                phone: account.phone,
                number_card,
                money,
                fee,
                total,
                type: "ruttien",
                note,
                status:'doi_duyet_rut'
            };
            const transaction = new Transaction(data);
            await transaction.save();
        }
        return res.json({code: 0, message: 'Rút tiền thành công'})
    }

    // [POST] /user/change_password
    async change_password(req, res){
        //res.redirect('./user/change_password')
        const account = req.account;
        const ollPassword = req.body.oldPassword
        const newPassword = req.body.newPassword;
        const confirmPassword = req.body.confirmPassword;
        if(!bcrypt.compareSync(ollPassword, account.password)){
            return res.json({code: 1, message: 'Mật khẩu cũ không đúng'})
        }
        const hash = await bcrypt.hash(newPassword, 10);
        await Account.findOneAndUpdate(
            { _id: account._id },
            { password: hash }
        );
        //res.redirect("/logout");
        console.log("Change password successfully!!!")
        return res.json({code: 0, message: 'Change password successfully'})
    }

    // [POST] /user/updateCMND
    updateCMND(req, res){
        const form = new multiparty.Form()
        form.parse(req, (err, fields, files) => {
            console.log(fields)
            if (err){
                console.log(err)
            }
            upload(files.before[0].path, files.before[0].originalFilename)
            upload(files.after[0].path, files.after[0].originalFilename)
            Account.findByIdAndUpdate(fields.id_account_cmnd[0], {before: files.before[0].originalFilename, after: files.after[0].originalFilename, status: 'chờ xác minh'}, {
                new: true
            })
            .then(p => {
                if(p){
                    //return res.json({code: 0, message: "Cập nhật thành công"})
                    console.log("Thành công")
                }
                else{
                    //return res.json({code: 2, message: "Không tìm thấy sách để cập nhật"})
                    console.log("Thất bại")
                }  
            })
            .catch(e => {
                //return res.json({code: 3, message: e.message})
                console.log("Có lôi xảy ra")
            })
            res.redirect('/user/home')   
        })
    }
    
}

// send Mail OTP
function sendMailOTP(email, code, type) {
    //Tiến hành gửi mail, nếu có gì đó bạn có thể xử lý trước khi gửi mail
    var transporter =  nodemailer.createTransport({ // config mail server
        host: mailHost,
        port: mailPort,
        secure: true,
        auth: {
            user: mailUser, //Tài khoản gmail vừa tạo
            pass: appPassword //Mật khẩu tài khoản gmail vừa tạo
        },
        tls: {
            // do not fail on invalid certs
            rejectUnauthorized: false
        }
    });
    var content = '';
    content += `Send Email By Nodemailer`
    contentHTML = `<p>Mã OTP của bạn là ${code} </p>  
                    <p>Thời hạn nhập OTP là 1 phút</p>
                    `;
    var mainOptions = { // thiết lập đối tượng, nội dung gửi mail
        from: mailUser,
        to: email,
        subject: 'Gửi OTP để chuyển tiền',
        text: content,
        html: contentHTML, //Nội dung html mình đã tạo trên kia :))
    }
    transporter.sendMail(mainOptions, function(err, info){
        if (err) {
            console.log(err);
            //req.flash('mess', 'Lỗi gửi mail: '+err); //Gửi thông báo đến người dùng
            //res.redirect('/login');
        } else {
            console.log('Message sent: ' +  info.response);
            //res.redirect('/login');
        }
    });
}

function getToday() {
    let today = new Date();
    let dd = String(today.getDate()).padStart(2, "0");
    let mm = String(today.getMonth() + 1).padStart(2, "0");
    let yyyy = today.getFullYear();
    today = mm + "/" + dd + "/" + yyyy;
    return today;
}
function checkDateWithdraw(date1, date2) {
    date1 = new Date(date1);
    date2 = new Date(date2);

    let time = date2.getTime() - date1.getTime();

    let day = time / (1000 * 3600 * 24);
    return day;
}

// send Mail
function sendMailTransfer(email, money, mssv) {
    //Tiến hành gửi mail, nếu có gì đó bạn có thể xử lý trước khi gửi mail
    var transporter =  nodemailer.createTransport({ // config mail server
        host: mailHost,
        port: mailPort,
        //secure: true,
        auth: {
            user: mailUser, //Tài khoản gmail vừa tạo
            pass: appPassword //Mật khẩu tài khoản gmail vừa tạo
        },
        tls: {
            // do not fail on invalid certs
            rejectUnauthorized: false
        }
    });
    var content = '';
    content += `Send Email By Nodemailer`
    contentHTML = `<p>Sinh viên ${mssv} đã đóng học phí thành công</p> 
                    <p>Sinh viên vui lòng kiểm tra tài khoản của mình để xem biến động số dư</p>`;
    var mainOptions = { // thiết lập đối tượng, nội dung gửi mail
        from: mailUser,
        to: email,
        subject: 'Đóng học phí thành công',
        text: content,
        html: contentHTML, //Nội dung html mình đã tạo trên kia :))
    }
    transporter.sendMail(mainOptions, function(err, info){
        if (err) {
            console.log(err);
            //req.flash('mess', 'Lỗi gửi mail: '+err); //Gửi thông báo đến người dùng
            //res.redirect('/login');
        } else {
            console.log('Message sent: ' +  info.response);
            //res.redirect('/login');
        }
    });
}

module.exports = new UserController;