
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const Cart = require('../../models/cartSchema');
const Address = require("../../models/addressSchema");
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
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

  const orderPlaced = async (req, res) => {
    try {
      const { totalPrice, addressId, payment, discount } = req.body;
      const userId = req.session.user;
      const findUser = await User.findOne({ _id: userId }).populate('cart');
      if (!findUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const findAddress = await Address.findOne({ userId: userId, "address._id": addressId });
      if (!findAddress) {
        return res.status(404).json({ error: "Address not found" });
      }
  
      const desiredAddress = findAddress.address.find((item) => item._id.toString() === addressId.toString());
      if (!desiredAddress) {
        return res.status(404).json({ error: "Specific address not found" });
      }
      const productIds = findUser.cart.map((item) => item.productId);
      console.log('Cart productID:',productIds);
      const findProducts = await Product.find({ _id: { $in: productIds } });
      console.log('ProductSchema productID:',findProducts);
      if (findProducts.length !== productIds.length) {
        return res.status(404).json({ error: "Some products not found" });
      }
      
      const orderedProducts = findProducts.map((product) => {
        const cartItem = findUser.cart.find((item) => item.productId.toString() === product._id.toString());
        if (!cartItem) {
          console.error(`Cart item not found for product ID: ${product._id}`);
        }
        return {
          product: product._id,
          price: product.salePrice,
          name: product.productName,
          quantity: cartItem.quantity,
        };
      });
  
      console.log("ordered Items: ",orderedProducts);
      if (payment === "cod" && totalPrice > 1000) {
        return res.status(400).json({ error: "Orders above ₹1000 are not allowed for Cash on Delivery (COD)" });
      }
      const finalAmount = totalPrice - discount;
      console.log(`finalAmount: ${finalAmount}`);
      console.log('payment:',payment);

      let newOrder = new Order({
        orderedItems: orderedProducts,
        totalPrice: totalPrice,
        discount: discount,
        finalAmount: finalAmount,
        address: desiredAddress,
        payment: payment,
        userId: userId,
        status: payment === "razorpay" ? "Failed" : "Confirmed",
        createdOn: Date.now(),
      });
      let orderDone = await newOrder.save();

      // Add the orderId to the user's orderHistory
      await User.updateOne(
        { _id: userId },
        { $push: { orderHistory: orderDone._id } }
      );
  
      await User.updateOne({ _id: userId }, { $set: { cart: [] } }); //Empty UserSchema cart
      await Cart.updateOne({ userId }, { $set: { items: [] } }); //Empty CartSchema

      for (let orderedProduct of orderedProducts) {
        console.log(`Processing ordered product: ${JSON.stringify(orderedProduct)}`);
        
        const product = await Product.findOne({ _id: orderedProduct.product }); //Update product quantities
        if (product) {
          console.log(`Product found: ${product._id}`);
          console.log(`Current quantity: ${product.quantity}, Ordered quantity: ${orderedProduct.quantity}`);
          product.quantity = Math.max(product.quantity - orderedProduct.quantity, 0);
          console.log(`Updated quantity: ${product.quantity}`)
          await product.save();
          console.log(`Product ${product._id} updated successfully.`);
        }else{
          console.error('Product not found');
        }
      }
  
      // Handle different payment methods
      if (newOrder.payment === "cod") {
        console.log('payment:',newOrder.payment);
        res.json({
          payment: true,
          method: "cod",
          order: orderDone,
          //quantity: cartItemQuantities,
          orderId: orderDone._id,
        });
      } else if (newOrder.payment === "wallet") {
        if (newOrder.finalAmount <= findUser.wallet) {
          findUser.wallet -= newOrder.finalAmount;
          findUser.history.push({ amount: newOrder.finalAmount, status: "debit", date: Date.now() });
          await findUser.save();
          res.json({
            payment: true,
            method: "wallet",
            order: orderDone,
            orderId: orderDone._id,
            //quantity: cartItemQuantities,
            success: true,
          });
        } else {
          await Order.updateOne({ _id: orderDone._id }, { $set: { status: "Failed" } });
          res.json({ payment: false, method: "wallet", success: false });
        }
      } else if (newOrder.payment === "razorpay") {
        const razorPayGeneratedOrder = await generateOrderRazorpay(orderDone._id, orderDone.finalAmount);
        res.json({
          payment: false,
          method: "razorpay",
          razorPayOrder: razorPayGeneratedOrder,
          order: orderDone,
          //quantity: cartItemQuantities,
        });
      }
    } catch (error) {
      console.error("Error processing order:", error);
      res.redirect("/pageNotFound");
    }
  };
  
  const getOrderDetailsPage = async (req, res) => {
    try {
      const userId = req.session.user;
      const orderId = req.query.id;
      const findOrder = await Order.findOne({ _id: orderId })
      .populate({
        path: "orderedItems.product",
        select: "productName productImage"
      });
      const addressId = findOrder?.address;

    const findAddress = await Address.findOne(
      { userId: userId, "address._id": addressId },
      { "address.$": 1 }
    );

    const userAddress = findAddress?.address[0] || null;
      console.log("Order with populated address:", findOrder);
      console.log("Address Data:", findAddress);
      const findUser = await User.findOne({ _id: userId });
      let totalGrant = 0;
      findOrder.orderedItems.forEach((val) => {
        totalGrant += val.price * val.quantity;
      });
  
      const totalPrice = findOrder.totalPrice;
      const discount = totalGrant - totalPrice;
      const finalAmount = totalPrice; 
      //console.log("Total price:",totalPrice);

      res.render("orderDetails", {
        orders: findOrder,
        user: findUser,
        totalGrant: totalGrant,
        totalPrice: totalPrice,
        discount: discount,
        finalAmount: finalAmount,
        address: userAddress,
      });
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  };
  

  module.exports={
    getCheckoutPage,
    orderPlaced,
    getOrderDetailsPage,
  }
  