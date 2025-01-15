const Coupon = require('../../models/couponSchema');
const mongoose = require("mongoose");

const loadCoupon = async(req,res) =>{
    try {

        const findCoupons = await Coupon.find({});
        
        return res.render("coupon",
            {coupons:findCoupons
            });
    } catch (error) {
        return res.redirect('/pageerror');
    }
}

const createCoupon = async(req,res)=>{
    try {
        const data = {
            couponName : req.body.couponName,
            startDate : new Date(req.body.startDate + "T00:00:00"),
            endDate : new Date(req.body.endDate + "T00:00:00"),
            offerPrice : parseInt(req.body.offerPrice),
            minimumPrice : parseInt(req.body.minimumPrice),
        }
        
        const newCoupon = new Coupon({
            name: data.couponName,
            createdOn: data.startDate,
            expireOn: data.endDate,
            offerPrice: data.offerPrice,
            minimumPrice: data.minimumPrice,
        })

        await newCoupon.save();

        return res.redirect("/admin/coupon");

    } catch (error) {
        res.redirect("/pageerror");
    }
}

const editCoupon = async(req,res) =>{
    try {
        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id});
        
        res.render('edit-coupon',{
            findCoupon:findCoupon,
        })
    } catch (error) {
        res.redirect('/pageerror');
    }
}

const updateCoupon = async(req,res)=>{
    try {
       
        couponId = req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId);
        const selectedCoupon = await Coupon.findOne({_id:oid});
        if(selectedCoupon){
            const startDate = new Date(req.body.startDate);
            const endDate = new Date(req.body.endDate);
            
            const updateCoupon = await Coupon.updateOne(
                {_id: oid},
                {
                    $set:{
                        name: req.body.couponName,
                        createdOn: startDate,
                        expireOn:endDate,
                        offerPrice: parseInt(req.body.offerPrice),
                        minimumPrice: parseInt(req.body.minimumPrice),
                    }
                },{new: true}
            );

            if(updateCoupon!=null){
                res.send("Coupon updated successfully")
            }else{
                res.status(500).send("Coupon update failed")
            }
        }

    } catch (error) {
        res.redirect("/pageerror");
    }
}

const deleteCoupon = async(req,res)=>{

    try {
        const id = req.query.id;
        await Coupon.deleteOne({_id:id});
        res.status(200).send({success:true, message:"Coupon deleted successfully"});
    
    } catch (error) {
        console.error("Error deleting Coupon");
        res.status(500).send({success:false, message:"Failed to delete coupon"});   
    }
}

const applyCoupon = async(req,res)=>{
    try {
        console.log("apply coupon started..");
        const name = req.body.coupon;
        const total = req.body.total;
        console.log("name:",name,"+ totalamount:",total);
        const findCoupon = await Coupon.findOne({name: name});
        if(findCoupon){
            console.log("Coupon fetched",findCoupon);
            const offerPrice = parseInt(findCoupon.offerPrice);
            const grantTotal = parseInt(total - offerPrice);
            console.log("offerPrice:",offerPrice);
            console.log("grantTotal:",grantTotal);
            res.status(200).json({
                success: true,
                offerPrice,
                grantTotal,    
            });    
        }else{
            res.status(404).json({
                success: false,
                message: 'Coupon not found or invalid.',
            });
        }
        
    } catch (error) {
        console.error("Error applying Coupon",error);

        res.status(500).json({
            success: false,
            message: 'Internal server error.',
        });
    }
}

module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon,
    applyCoupon,
}