
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const Cart = require('../../models/cartSchema');
const Address = require("../../models/addressSchema");
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const mongodb = require("mongodb");
const razorpay = require("razorpay");
const crypto = require("crypto");
const env = require("dotenv").config();
const easyinvoice = require("easyinvoice");
const fs = require("fs");
const path = require("path");
const { format } = require('date-fns');


let instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


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
      console.log("Today:", new Date(today));
      const sampleCoupon = await Coupon.findOne();
      console.log("Sample coupon :",sampleCoupon);
      const findCoupons = await Coupon.find({
        isList: true,
        createdOn: { $lt: new Date(today) },
        expireOn: { $gt: new Date(today) },
        minimumPrice: { $lt: grandTotal[0].totalPrice },
      });
      console.log("Coupons here:",findCoupons);

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
        console.log("Razorpay payment started.");
        res.json({
          payment: false,
          method: "razorpay",
          razorPayOrder: razorPayGeneratedOrder,
          order: orderDone,
          key_id: process.env.RAZORPAY_KEY_ID,
          user: {name: findUser.name,
                email: findUser.email,
                phone: findUser.phone,},
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
  
  const cancelOrder = async (req, res) => {
    try {
      const userId = req.session.user;
      const findUser = await User.findOne({ _id: userId });
      if (!findUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const { orderId } = req.body;
      const findOrder = await Order.findOne({ _id: orderId });
      if (!findOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (findOrder.status === "Cancelled") {
        return res.status(400).json({ message: "Order is already cancelled" });
      }
      if (["Delivered", "Returned"].includes(findOrder.status)) {
        return res.status(400).json({ message: `Order cannot be cancelled. Current status: ${findOrder.status}` });
      }
      
      // Handle refund if payment was made via Razorpay or wallet
      if ((findOrder.payment === "razorpay" || findOrder.payment === "wallet") && findOrder.status === "Confirmed") {
        findUser.wallet += findOrder.finalAmount;
        // Update user wallet history
        await User.updateOne(
          { _id: userId },
          {
            $push: {
              history: {
                amount: findOrder.finalAmount,
                status: "credit",
                date: Date.now(),
                description: `Order ${orderId} cancelled`,
              },
            },
          }
        );
        await findUser.save();
      }
  
      // Update order status to cancelled
      await Order.updateOne({ _id: orderId }, { status: "Cancelled" });
  
      // Update product quantities
      for (const item of findOrder.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        } else {
          console.error(`Product with ID ${item.product} not found`);
        }
      }
  
      res.status(200).json({ message: "Order cancelled successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  
  const generateOrderRazorpay = (orderId, total) => {
    return new Promise((resolve, reject) => {
      const options = {
        amount: total * 100,
        currency: "INR",
        receipt: String(orderId),
      };
      instance.orders.create(options, (err, order) => {
        if (err) {
          reject(err);
        } else {
          resolve(order);
        }
      });
    });
  };

  //verify payment
  const verify = (req, res) => {
    let hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(
      `${req.body.payment.razorpay_order_id}|${req.body.payment.razorpay_payment_id}`
    );
    hmac = hmac.digest("hex");
    console.log(hmac,"HMAC");
    console.log(req.body.payment.razorpay_signature,"signature");
    if (hmac === req.body.payment.razorpay_signature) {
      console.log("true");
      res.json({ status: true });
    } else {
      console.log("false");
      res.json({ status: false });
    }
  };
  
  //confirm payment
  const paymentConfirm = async (req, res) => {
    try {
      await Order.updateOne(
        { _id: req.body.orderId },
        { $set: { status: "Confirmed" } }
      ).then((data) => {
        res.json({ status: true });
      });
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  };
  

  const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
        .populate(
           {path: "orderedItems.product" }
          );
        if (!order) {
            return res.status(404).send('Order not found');
        }

        const addressDoc = await Address.findOne({
          "address._id": order.address // Match the subdocument `_id` field
      });

      if (!addressDoc) {
        return res.status(404).send("Address not found");
      } 

      const address = addressDoc.address.find(
        (addr) => addr._id.toString() === order.address.toString()
    );

    if (!address) {
        return res.status(404).send("Address not found in address collection");
    }
        const data = {
            "documentTitle": "INVOICE",
            "currency": "INR",
            "taxNotation": "gst",
            "marginTop": 25,
            "marginRight": 25,
            "marginLeft": 25,
            "marginBottom": 25,
            apiKey: process.env.EASYINVOICE_API,
            mode: "development",
            images: {
                logo: "https://mms.img.susercontent.com/id-11134216-7r98r-lykz64w40cfc14",
            },
            "sender": {
                "company": "Men Side",
                "address": "Mamala",
                "zip": "682305",
                "city": "Kochi",
                "country": "India",
            },
            "client": {
                "company": address.name,
                "address": address.landMark + ", " + address.city,
                "zip": address.pincode,
                "city": address.state,
                "country": "India"
            },
            "information": {
                "number": order.orderId,
                "date": format(new Date(order.createdOn), 'yyyy-MM-dd HH:mm:ss')
            },
            "products": order.orderedItems.map(prod => ({
                "quantity": prod.quantity,
                "description": prod.name || prod.title,
                "tax": 0,
                "price": prod.price,
  
            })),
            "bottomNotice": "Thank you for your business",
        };
        console.log("Invoice creation started..");
        console.log("EasyInvoice API Key:", process.env.EASYINVOICE_API);
        console.log("Invoice Data:", JSON.stringify(data, null, 2));
        const result = await easyinvoice.createInvoice(data);
        console.log("result created");
        const invoicePath = path.join(__dirname, "../../public/invoice/", `invoice_${orderId}.pdf`);
        console.log("Invoice path made..")
        console.log("Invoice path:", invoicePath);
        fs.writeFileSync(invoicePath, result.pdf, 'base64');
        console.log("Invoice saved to path..")
        res.download(invoicePath, `invoice_${orderId}.pdf`, (err) => {
            if (err) {
                console.error("Error downloading the file", err);
            }
            fs.unlinkSync(invoicePath);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while generating the invoice');
    }
  };
  
  
  

  module.exports={
    getCheckoutPage,
    orderPlaced,
    getOrderDetailsPage,
    cancelOrder,
    paymentConfirm,
    verify,
    downloadInvoice,
  }
  