const express = require('express');
const router = express.Router()
const UserController = require('../app/controllers/UserController');
//const checkUser = require("../app/middleware/checkUser");
const checkLogin = require("../app/middleware/checkLogin");
const checkChangePassword = require("../app/middleware/checkChangePassword");

//Check Login
//router.use(checkLogin)

// //Check Change Password
// router.use(checkChangePassword)

//router.use(checkUser);
router.post('/home', UserController.renderHome)
router.post('/tuition', UserController.renderTuition)
router.post('/history', UserController.renderHistory)
router.get('/home_temp', UserController.renderHomeTemp)
router.get('/chuyentien', UserController.renderChuyenTien)
router.post('/chuyentien', UserController.ChuyenTien)
router.get('/muacard', UserController.renderMuaCard)
router.post('/muacard', UserController.MuaCard)
router.get('/lichsugiaodichnap', UserController.renderLichSuGiaoDichNap)
router.get('/lichsugiaodichrut', UserController.renderLichSuGiaoDichRut)
router.get('/lichsugiaodichchuyen', UserController.renderLichSuGiaoDichChuyen)
router.get('/lichsugiaodichmua', UserController.renderLichSuGiaoDichMua)
router.get('/naptien', UserController.renderNapTien)
router.post('/naptien', UserController.NapTien)
router.get('/ruttien', UserController.renderRutTien)
router.post('/ruttien', UserController.RutTien)
router.get('/thongtincanhan', UserController.renderThongTinCaNhan)
router.post('/change_password', UserController.change_password)
router.post('/updateCMND', UserController.updateCMND)
router.post('/otp', UserController.createOTP)
router.post('/getMoneyByMssv', UserController.getMoneyByMssv)

module.exports = router;