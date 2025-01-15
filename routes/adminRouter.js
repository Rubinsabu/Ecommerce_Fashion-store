const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const {userAuth,adminAuth}= require("../middlewares/auth");
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const brandController = require('../controllers/admin/brandController');
const orderController = require('../controllers/admin/orderController');
const couponController = require('../controllers/admin/couponController');

const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({storage: storage});

router.get('/pageerror',adminController.pageerror);
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/',adminAuth,adminController.loadDashboard);
router.get('/logout',adminController.logout);

router.get('/users',adminAuth,customerController.customerInfo);
router.get('/blockCustomer',adminAuth,customerController.customerBlocked);
router.get('/unblockCustomer',adminAuth,customerController.customerunBlocked);
router.get('/category',adminAuth,categoryController.categoryInfo);
//category
router.post('/addCategory',adminAuth,categoryController.addCategory);
router.get('/listCategory',adminAuth,categoryController.getListCategory);
router.get('/unlistCategory',adminAuth,categoryController.getUnlistCategory);
router.get('/editCategory',adminAuth,categoryController.getEditCategory);
router.post('/editCategory/:id',adminAuth,categoryController.editCategory);
//Brand Management
router.get('/brands',adminAuth,brandController.getBrandPage);
router.post('/addBrand',adminAuth,uploads.single("image"),brandController.addBrand);
router.get('/blockBrand',adminAuth,brandController.blockBrand);
router.get('/unBlockBrand',adminAuth,brandController.unBlockBrand);
router.get('/deleteBrand',adminAuth,brandController.deleteBrand);
//Product
router.get('/addProducts',adminAuth,productController.getProductAddPage);
router.post('/addProducts',adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);

//order
router.get("/orderList", adminAuth, orderController.getOrderListPageAdmin);
router.get("/orderDetailsAdmin", adminAuth, orderController.getOrderDetailsPageAdmin);
router.post("/deliverOrder",adminAuth,orderController.deliverOrder);


//Coupon management
router.get("/coupon",adminAuth,couponController.loadCoupon);
router.post("/createCoupon",adminAuth,couponController.createCoupon);
router.get("/editCoupon",adminAuth,couponController.editCoupon);
router.put("/updatecoupon",adminAuth,couponController.updateCoupon);
router.get("/deletecoupon",adminAuth,couponController.deleteCoupon);

module.exports = router;