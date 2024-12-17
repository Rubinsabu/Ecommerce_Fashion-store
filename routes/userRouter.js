const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require('../controllers/user/profileController');
const passport = require("passport");
const { userAuth } = require("../middlewares/auth");


router.get('/pageNotFound',userController.pageNotFound);

//router.use(['/', '/login'],userController.checkUserBlocked);
router.get('/',userController.loadHomepage);
router.get('/shop',userAuth,userController.loadShoppingPage);
router.get('/filter',userAuth,userController.filterProduct)
router.get('/filterPrice',userAuth,userController.filterByPrice);

router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);



router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = { id: req.user._id, name: req.user.name };
    res.redirect('/');
});
router.get('/login',userController.loadLogin);
router.post('/login',userController.login);
router.get('/logout',userController.logout);

router.get("/userProfile",userAuth,profileController.userProfile);



module.exports = router;