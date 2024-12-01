
const User = require("../../models/userSchema");
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
        return res.render("home");
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
            return res.render("signup",{ message :"Passwords donot match"});
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
            req.session.user = saveUserData._id;
            res.json({success:true, redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Inavalid OTP, Please try again"});
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

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    loadShopping,
    signup,
    verifyOtp,
    resendOtp
}