// const getCheckoutPage = async (req, res) => {
//     try {
//       const user = req.query.userId;
//       const findUser = await User.findOne({ _id: user });
//       if (!findUser) {
//         throw new Error("User not found.");
//         }
//       const addressData = await Address.findOne({ userId: user });
//       if (!addressData) {
//         console.warn("No address found for the user.");
//         }
//       const oid = new mongodb.ObjectId(user);
//       const data = await User.aggregate([
//         { $match: { _id: oid } },
//         { $unwind: "$cart" },
//         {
//           $project: {
//             proId: { $toObjectId: "$cart.productId" },
//             quantity: "$cart.quantity",
//           },
//         },
//         {
//           $lookup: {
//             from: "products",
//             localField: "proId",
//             foreignField: "_id",
//             as: "productDetails",
//           },
//         },
//       ]);
  
//       const grandTotal = await User.aggregate([
//         { $match: { _id: oid } },
//         { $unwind: "$cart" },
//         {
//           $project: {
//             proId: { $toObjectId: "$cart.productId" },
//             quantity: "$cart.quantity",
//           },
//         },
//         {
//           $lookup: {
//             from: "products",
//             localField: "proId",
//             foreignField: "_id",
//             as: "productDetails",
//           },
//         },
//         {
//           $unwind: "$productDetails", // Unwind the array created by the $lookup stage
//         },
  
//         {
//           $group: {
//             _id: null,
//             totalQuantity: { $sum: "$quantity" },
//             totalPrice: {
//               $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
//             },
//           },
//         },
//       ]);
//     console.log("Pipeline data result:", data);
//     console.log("Grand total result:", grandTotal);

//       const gTotal = req.session.grandTotal;
//       const today = new Date().toISOString();
//       const findCoupons = await Coupon.find({
//         isList: true,
//         createdOn: { $lt: new Date(today) },
//         expireOn: { $gt: new Date(today) },
//         minimumPrice: { $lt: grandTotal[0].totalPrice },
//       });
//       if (findUser.cart.length > 0) {
//         res.render("checkoutcart", {
//           product: data,
//           user: findUser,
//           isCart: true,
//           userAddress: addressData,
//           grandTotal: grandTotal[0].totalPrice,
//           Coupon: findCoupons,
//         });
//       } else {
//         res.redirect("/shop");
//       }
//     } catch (error) {
//       console.error("Error in getCheckoutPage:", error);
//       res.redirect("/pageNotFound");
//     }
//   };



// const orderPlaced = async (req, res) => {
//     try {
//       const { totalPrice, addressId, payment, discount } = req.body;
//       const userId = req.session.user;
//       const findUser = await User.findOne({ _id: userId }).populate('cart');
//       if (!findUser) {
//         return res.status(404).json({ error: "User not found" });
//       }
      
//       const findAddress = await Address.findOne({ userId: userId, "address._id": addressId });
//       if (!findAddress) {
//         return res.status(404).json({ error: "Address not found" });
//       }
  
//       const desiredAddress = findAddress.address.find((item) => item._id.toString() === addressId.toString());
//       if (!desiredAddress) {
//         return res.status(404).json({ error: "Specific address not found" });
//       }
//       const productIds = findUser.cart.map((item) => item.productId);
//       console.log('Cart productID:',productIds);
//       const findProducts = await Product.find({ _id: { $in: productIds } });
//       console.log('ProductSchema productID:',findProducts);
//       if (findProducts.length !== productIds.length) {
//         return res.status(404).json({ error: "Some products not found" });
//       }
      
//       const orderedProducts = findProducts.map((product) => {
//         const cartItem = findUser.cart.find((item) => item.productId.toString() === product._id.toString());
//         if (!cartItem) {
//           console.error(`Cart item not found for product ID: ${product._id}`);
//         }
//         return {
//           product: product._id,
//           price: product.salePrice,
//           name: product.productName,
//           quantity: cartItem.quantity,
//         };
//       });
      
      // const cartItemQuantities = findUser.cart.map((item) => ({
      //   productId: item.productId,
      //   quantity: item.quantity,
      // }));
  
      // const orderedProducts = findProducts.map((item) => ({
      //   _id: item._id,
      //   price: item.salePrice,
      //   name: item.productName,
      //   productStatus: "Confirmed",
      //   quantity: cartItemQuantities.find((cartItem) => cartItem.productId.toString() === item._id.toString()).quantity,
      // }));
    //   console.log("ordered Items: ",orderedProducts);
    //   if (payment === "cod" && totalPrice > 1000) {
    //     return res.status(400).json({ error: "Orders above ₹1000 are not allowed for Cash on Delivery (COD)" });
    //   }
    //   const finalAmount = totalPrice - discount;
    //   console.log(`finalAmount: ${finalAmount}`);
  
    //   let newOrder = new Order({
    //     orderedItems: orderedProducts,
    //     totalPrice: totalPrice,
    //     discount: discount,
    //     finalAmount: finalAmount,
    //     address: desiredAddress,
    //     payment: payment,
    //     userId: userId,
    //     status: payment === "razorpay" ? "Failed" : "Confirmed",
    //     createdOn: Date.now(),
    //   });
    //   let orderDone = await newOrder.save();
  
    //   await User.updateOne({ _id: userId }, { $set: { cart: [] } }); //Empty Users cart
    //   for (let orderedProduct of orderedProducts) {
    //     const product = await Product.findOne({ _id: orderedProduct._id }); //Update product quantities
    //     if (product) {
    //       product.quantity = Math.max(product.quantity - orderedProduct.quantity, 0);
    //       await product.save();
    //     }
    //   }
  
      // Handle different payment methods
    //   if (newOrder.payment === "cod") {
    //     res.json({
    //       payment: true,
    //       method: "cod",
    //       order: orderDone,
          //quantity: cartItemQuantities,
//           orderId: orderDone._id,
//         });
//       } else if (newOrder.payment === "wallet") {
//         if (newOrder.finalAmount <= findUser.wallet) {
//           findUser.wallet -= newOrder.finalAmount;
//           findUser.history.push({ amount: newOrder.finalAmount, status: "debit", date: Date.now() });
//           await findUser.save();
//           res.json({
//             payment: true,
//             method: "wallet",
//             order: orderDone,
//             orderId: orderDone._id,
//             //quantity: cartItemQuantities,
//             success: true,
//           });
//         } else {
//           await Order.updateOne({ _id: orderDone._id }, { $set: { status: "Failed" } });
//           res.json({ payment: false, method: "wallet", success: false });
//         }
//       } else if (newOrder.payment === "razorpay") {
//         const razorPayGeneratedOrder = await generateOrderRazorpay(orderDone._id, orderDone.finalAmount);
//         res.json({
//           payment: false,
//           method: "razorpay",
//           razorPayOrder: razorPayGeneratedOrder,
//           order: orderDone,
//         });
//       }
//     } catch (error) {
//       console.error("Error processing order:", error);
//       res.redirect("/pageNotFound");
//     }
//   };