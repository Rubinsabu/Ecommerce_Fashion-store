const User = require("../../models/userSchema");
const Address = require('../../models/addressSchema');

const userProfile = async (req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({userId : userId});
        res.render('profile',{
            user:userData,
            userAddress: addressData,
        });

    } catch (error) {
        
        console.error("Error for retrieve profile data",error);
        res.redirect('/pageNotFound');
    }
}

const addAddress = async(req,res)=>{
    try {
        
        const user = req.session.user;
        res.render('add-address',{user: user});

    } catch (error) {
        
        res.redirect('/pageNotFound');
    }
}

const postAddAddress = async(req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findOne({_id:userId});
        const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body;
        const userAddress = await Address.findOne({userId: userData._id});

        if(!userAddress){
            const newAddress = new Address({
                userId : userData._id,
                address : [{addressType,name,city,landMark,state,pincode,phone,altPhone}]
            });
            await newAddress.save();
        }else{
            userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone});
            await userAddress.save();
        }

        res.redirect('/userProfile');

    } catch (error) {
        console.error('Error adding address:',error);
        res.redirect('/pageNotFound');
    }
}

const editAddress = async(req,res) =>{
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            'address._id' :addressId,
        });
        if(!currAddress){
            return res.redirect('/pageNotFound');
        }

        const addressData = currAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString();
        })

        if(!addressData){
            return res.redirect('/pageNotFound');
        }

        res.render('edit-address',{
            address : addressData,
            user: user,
        })
    } catch (error) {
        console.error("Error in edit address", error);
        res.redirect('/pageNotFound');
    }
}

const postEditAddress = async(req,res)=>{
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            res.redirect('/pageNotFound')
        }
        await Address.updateOne(
            {"address._id":addressId},
            {$set : {
                'address.$' : {
                    _id : addressId,
                    addressType: data.addressType,
                    name: data.name,
                    city: data.city,
                    landMark: data.landMark,
                    state: data.state,
                    pincode : data.pincode,
                    phone: data.phone,
                    altphone : data.altPhone,
                }
            }}
        )
        res.redirect("/userProfile");

    } catch (error) {
        console.error("Error in edit address", error);
        res.redirect('/pageNotFound');
    }
}
module.exports = {
    userProfile,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
}