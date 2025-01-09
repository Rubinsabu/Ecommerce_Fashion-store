
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand = require('../../models/brandSchema');
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");

const pageNotFound = async(req,res)=>{
    try{
        res.render("page-404")
    }catch(error){
        res.redirect("/pageNotFound");
    }
}

const loadHomepage = async(req,res)=>{

    try{
        console.log("Session User at Homepage:", req.session.user);

        const categories = await Category.find({isListed:true});
        let productData = await Product.find(
            {isBlocked:false,
             category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
            });

        productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        productData = productData.slice(0,4);

        res.render('home',{products:productData});
        // res.render('home');
        
    }catch(error){
        console.log("Home page not found");
        res.status(500).send("Server error")
    }
}

const loadSignup = async(req,res)=>{

    try{
        return res.render("signup");
    }catch(error){
        console.log("Signup page not found",error);
        res.status(500).send("Server error")
    }
}

const loadShopping = async(req,res)=>{

    try{
        return res.render("shop");
    }catch(error){
        console.log("Shopping page not found",error);
        res.status(500).send("Server error")
    }
}
function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){
    try{
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`,
        })

        return info.accepted.length > 0

    }catch(error){
        console.error("Error sending email",error);
        return false;
    }
}

const signup = async(req,res)=>{
    try{

        const {name,phone,email, password, cPassword} = req.body;
        if(password !== cPassword){
            return res.render("signup",{ message :"Passwords do not match"});
        }
        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{ message: "User with this email already exists"});
        }

        const otp = generateOtp();

        const emailSent = await sendVerificationEmail(email,otp);
        if(!emailSent){
            return res.json("email-error");
        }

        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password};

        res.render("verify-otp");
        console.log("OTP Sent", otp);

    }catch(error){
        console.error("signup error",error);
        res.redirect("/pageNotFound");
    }
}

const securePassword = async(password)=>{
    try{

        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;

    }catch(error){

    }
}

const verifyOtp = async(req,res)=>{
    try{

        const {otp} = req.body;
        console.log(otp);

        if(otp===req.session.userOtp){
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
            })

            await saveUserData.save();
            req.session.user = {_id: saveUserData._id, name: saveUserData.name};
            res.json({success:true, redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Invalid OTP, Please try again"});
        }

    }catch(error){
        console.error("Error Verifying OTP",error);
        res.status(500).json({success:false,message:"An error occurred"});

    }
}

const resendOtp = async(req,res)=>{

    try{

        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true, message:"OTP Resend Successfully"})    
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP. Please try again !"})
        }

    }catch(error){
        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal Server Error. Please try again !"});
    }
}

const loadLogin = async(req,res) => {
    try {
        if(!req.session.user){
            return res.render("login");
        }else{
            res.redirect("/");
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const login = async(req,res) =>{

    try {
        
        const {email,password} = req.body;

        const findUser = await User.findOne({isAdmin:0,email:email});

        if(!findUser){
            return res.render("login",{message:"User not found"});
        }
        if(findUser.isBlocked){
            return res.render('login',{message:'User is blocked by admin'});
        }
        const passwordMatch = await bcrypt.compare(password,findUser.password);
        
        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }

        req.session.user = {_id:findUser._id, name: findUser.name};
        res.redirect('/');

    } catch (error) {
        console.error("login error", error);
        res.render('login',{message:"login failed. Please try again later."})
    }
}

const logout = async (req,res) =>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message);
                return res.redirect('/pageNotFound');
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/pageNotFound");
    }
}

// const checkUserBlocked = async (req, res, next) => {
//     console.log("check user block started..");
//     if (req.session.user) {
//         try {
//             const user = await User.findById(req.session.user._id);
//             if (user && user.isBlocked) {
//                 req.session.destroy((err)=>{
        //              if(err){
        //                  console.log("Session destruction error",err.message);
        //                  return res.redirect('/pageNotFound');
        //              }
        //     return res.redirect("/login")
        //        })
//                 }else {
//                     next(); 
//                 };
               
//         } catch (error) {
//             console.error("Error checking blocked status:", error.message);
//             return res.status(500).redirect('/pageNotFound'); 
//         }
//     } else {
//         next(); 
//     }
//  };

const loadShoppingPage = async(req,res)=>{
    try {
        const user = req.session.user;
        const userData = await User.findOne({_id:user});
        const categories = await Category.find({isListed:true});
        const categoryIds = categories.map((category)=>category._id.toString());

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page-1)*limit;
        const products = await Product.find({
            isBlocked: false,
            category:{$in:categoryIds},
            quantity:{$gt:0},
        }).sort({createdOn:-1}).skip(skip).limit(limit);

        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category:{$in:categoryIds},
            quantity:{$gt:0},
        })
        const totalPages = Math.ceil(totalProducts/limit);

        const brands = await Brand.find({isBlocked:false});
        const categoriesWithIds = categories.map(category=>({_id:category._id,name:category.name}));

        res.render('shop',{
            user:userData,
            products:products,
            category:categoriesWithIds,
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            selectedCategory: null,
            selectedBrand: null,
            selectedPriceRange: null 
        });

    } catch (error) {
        console.log(error);
        res.redirect('/pageNotFound');
    }
}

const filterProduct = async(req,res)=>{

    try {
        const user = req.session.user;
        const category = req.query.category;
        const brand = req.query.brand;
        const findCategory = category ? await Category.findOne({_id:category}) : null;
        const findBrand = brand ? await Brand.findOne({_id:brand}) : null;
        const brands = await Brand.find({}).lean();
        const query = {
            isBlocked: false,
            quantity: {$gt:0}
        }

        if(findCategory){
            query.category = findCategory._id;
        }
        if(findBrand){
            query.brand = findBrand.brandName;
        }
        console.log('Query:', query);
        let findProducts = await Product.find(query).lean();
        findProducts.sort((a,b)=> new Date(b.createdOn)- new Date(a.createdOn));

        const categories = await Category.find({isListed:true});

        let itemsPerPage = 6;

        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage-1) * itemsPerPage;
        let endIndex = startIndex+itemsPerPage;
        let totalPages = Math.ceil(findProducts.length/itemsPerPage);
        const currentProduct = findProducts.slice(startIndex,endIndex);
        let userData = null;
        if(user){
            userData = await User.findOne({_id:user});
            if(userData){
                const searchEntry = {
                    category : findCategory ? findCategory._id:null,
                    brand : findBrand ? findBrand.brandName : null,
                    searchedOn : new Date(),
                }
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filteredProducts = currentProduct;

        res.render("shop",{
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedBrand: brand || null,
            selectedPriceRange: null,
        })

    } catch (error) {
        console.log(error);
        res.redirect('/pageNotFound');
    }

}

const filterByPrice = async(req,res) =>{
    try {
        const user = req.session.user;
        const userData = await User.findOne({_id:user});
        const brands = await Brand.find({}).lean();
        const categories = await Category.find({isListed:true}).lean();
        
        let findProducts = await Product.find({
            salePrice: {$gt:req.query.gt,$lt:req.query.lt},
            isBlocked: false,
            quantity: {$gt:0}
        }).lean();

        findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        
        let itemsPerPage=6;
        let currentPage = parseInt(req.query.page)|| 1;
        let startIndex = (currentPage-1)*itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages= Math.ceil(findProducts.length/itemsPerPage);
        const currentProduct = findProducts.slice(startIndex,endIndex);
        req.session.filteredProducts = findProducts;

        res.render('shop',{
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            selectedCategory: null,
            selectedBrand: null,
            selectedPriceRange: { gt:req.query.gt, lt:req.query.lt },
        })

    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
}

const searchProducts = async(req,res)=>{
    try {
        const user = req.session.user;
        const userData = await User.findOne({_id:user});
        let search = req.body.query;
        console.log("Search text:",search);
        const brands = await Brand.find({}).lean();
        const categories = await Category. find ({isListed: true}).lean();
        const categoryIds = categories.map(category=>category._id.toString());
        let searchResult = [];
        if(req.session.filteredProducts && req.session.filteredProducts.length>0){
            searchResult = req.session.filteredProducts.filter(product=> 
                product.productName.toLowerCase().includes(search.toLowerCase()))
        }
        else{
            searchResult = await Product.find({
                
                $or: [
                    { productName: { $regex: ".*" + search + ".*", $options: "i" } }, 
                    { color: { $regex: ".*" + search + ".*", $options: "i" } },
                    { brand: {$regex: ".*" + search + ".*", $options: "i"}},    
                ],
                isBlocked:false,
                quantity:{$gt:0},
                category:{$in:categoryIds}
            })
        }
        searchResult.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        console.log("Search Result : ",searchResult);

        let itemsPerPage=6;
        let currentPage = parseInt(req.query.page)|| 1;
        let startIndex = (currentPage-1)*itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages= Math.ceil(searchResult.length/itemsPerPage);
        const currentProduct = searchResult.slice(startIndex,endIndex);

        res.render("shop",{
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            count : searchResult.length,
            selectedCategory: search,
            selectedBrand: null,
            selectedPriceRange: null ,
        })

    } catch (error) {
        console.log("Error:",error);
        res.redirect('/pageNotFound');
    }
}
const clearFilter = async (req, res) => {
    try {
        delete req.session.filteredProducts; // Clear the session variable
        res.redirect('/shop');
    } catch (error) {
        console.error("Error:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    loadShopping,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    //checkUserBlocked,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts,
    clearFilter,
}