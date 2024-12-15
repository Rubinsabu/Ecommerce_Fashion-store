
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
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

// const signup = async(req,res)=>{

//     const {name,email,phone,password} = req.body;

//     try{
      
//         const newUser = new User({name,email,phone,password});
//         console.log(newUser);
        
//         await newUser.save();
//         return res.redirect("/signup");

//     }catch(error){
//         console.error("Error for save user",error);
//         res.status(500).send("Internal server error");
//     }
// }
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
}