const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const pageerror = async(req,res)=>{
    res.render("admin-error");
}


const loadLogin = (req,res)=>{

    if(req.session.admin){
        return res.redirect('/admin/dashboard');
    }
    res.render("admin-login",{message:null});
}

const login = async(req,res) =>{
    try{
        const {email,password} = req.body;
        const admin = await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch = bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin = true;
                return res.redirect("/admin");
            }else{
                return res.redirect("/admin/login");
            }
        }else{
            return res.redirect('/admin/login');
        }
    }catch(error){
        console.log("login error",error);
        return res.redirect('/pageerror');
    }
};

const loadDashboard = async(req,res)=>{
    if(req.session.admin){
        try {
            const userscount = await User.countDocuments();
            const ordercount = await Order.countDocuments();
            const totalFinalAmount = await Order.aggregate([
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: "$finalAmount" }
                    }
                }
            ]);
            const ordersAmountSum = totalFinalAmount.length > 0 ? totalFinalAmount[0].totalAmount : 0;

            //monthly orders
            const monthlyOrders = await Order.aggregate([
                {
                    $group:{
                        _id:{$month:"$createdOn"},
                        count:{$sum:1}
                    }
                },
                {
                    $sort: { "_id": 1 }
                }
            ]);
            const monthlyCounts = Array(12).fill(0);
            monthlyOrders.forEach(item => {
                monthlyCounts[item._id - 1] = item.count;
            });
            res.render('dashboard',{
                userscount: userscount,
                ordercount: ordercount,
                ordersAmountSum: ordersAmountSum,
                monthlyCounts:monthlyCounts,
            });
        } catch (error) {
            res.redirect('/pageerror')
        }
    }
}

const logout = async(req,res)=>{
    try {
        req.session.destroy(err =>{
            if(err){
                console.log("Error destroying session",err);
                return res.redirect("/pageerror");
            }
            res.redirect('/admin/login');
        })
    } catch (error) {
        console.log("Unexpected error during logout",error);
        res.redirect("/pageerror");
    }
}
module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}