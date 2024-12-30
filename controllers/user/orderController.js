
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const Cart = require('../../models/cartSchema');
const Address = require("../../models/addressSchema");
const mongodb = require("mongodb");



const getCheckoutPage = async (req, res) => {
    try {
          const userId = req.query.userId;
      
          // Find the user
          const findUser = await User.findOne({ _id: userId });
          if (!findUser) {
            throw new Error("User not found.");
          }
      
          // Find user's address (optional)
          const addressData = await Address.findOne({ userId });
      
          // Retrieve cart details
          const cartDetails = await Cart.aggregate([
            { $match: { userId: new mongodb.ObjectId(userId) } }, // Match cart by user ID
            { $unwind: "$items" }, // Unwind items array
            {
              $lookup: {
                from: "products",
                localField: "items.productId",
                foreignField: "_id",
                as: "productDetails",
              },
            },
            { $unwind: "$productDetails" }, // Unwind product details
            {
              $addFields: {
                "items.totalPrice": {
                  $multiply: ["$items.quantity", "$productDetails.salePrice"],
                },
              },
            },
          ]);
      
          console.log("Cart Details:", cartDetails);
      
          // Redirect to shop if cart is empty
          if (!cartDetails.length) {
            return res.redirect("/shop");
          }
      
          // Calculate grand total
          const grandTotal = await Cart.aggregate([
            { $match: { userId: new mongodb.ObjectId(userId) } }, // Match cart by user ID
            { $unwind: "$items" }, // Unwind items array
            {
              $lookup: {
                from: "products",
                localField: "items.productId",
                foreignField: "_id",
                as: "productDetails",
              },
            },
            { $unwind: "$productDetails" }, // Unwind product details
            {
              $group: {
                _id: null,
                totalQuantity: { $sum: "$items.quantity" },
                totalPrice: {
                  $sum: { $multiply: ["$items.quantity", "$productDetails.salePrice"] },
                },
              },
            },
          ]);
      
          if (!grandTotal.length) {
            throw new Error("Failed to calculate grand total.");
          }
      
          console.log("Grand Total:", grandTotal);

      const gTotal = req.session.grandTotal;
      const today = new Date().toISOString();
      const findCoupons = await Coupon.find({
        isList: true,
        createdOn: { $lt: new Date(today) },
        expireOn: { $gt: new Date(today) },
        minimumPrice: { $lt: grandTotal[0].totalPrice },
      });
      
      res.render("checkoutcart", {
          product: cartDetails,
          user: findUser,
          isCart: true,
          userAddress: addressData,
          grandTotal: grandTotal[0].totalPrice,
          Coupon: findCoupons,
      });
      
    } catch (error) {
      console.error("Error in getCheckoutPage:", error);
      res.redirect("/pageNotFound");
    }
  };


  module.exports={
    getCheckoutPage,
  }
  