// const getCartPage = async (req, res) => {
//   try {
//     console.log("User ID from session (getCartPage):", req.session.user);
//     const id = req.session.user._id;
//     const user = await User.findOne({ _id: id });
//     const productIds = user.cart.map((item) => item.productId);
//     const products = await Product.find({ _id: { $in: productIds } });
//     const oid = new mongodb.ObjectId(id);
//     let data = await User.aggregate([
//       { $match: { _id: oid } },
//       { $unwind: "$cart" },
//       {
//         $project: {
//           proId: { $toObjectId: "$cart.productId" },
//           quantity: "$cart.quantity",
//         },
//       },
//       {
//         $lookup: {
//           from: "products",
//           localField: "proId",
//           foreignField: "_id",
//           as: "productDetails",
//         },
//       },
//     ]);
//     let quantity = 0;
//     for (const i of user.cart) {
//       quantity += i.quantity;
//     }
//     let grandTotal = 0;
//     for (let i = 0; i < data.length; i++) {
//       if (products[i]) {
//         grandTotal += data[i].productDetails[0].salePrice * data[i].quantity;
//       }
//       req.session.grandTotal = grandTotal;
//     }
//     res.render("cart", {
//       user,
//       quantity,
//       data,
//       grandTotal,
//     });
//   } catch (error) {
//     console.error("Cart not loaded",error);
//     res.redirect("/pageNotFound");
//   }
// };


// const addToCart = async (req, res) => {
//   try {
//     console.log("Starting Add to Cart");
//     const id = new mongodb.ObjectId(req.body.productId);
//     const userId = req.session.user;
//     const findUser = await User.findById(userId);
//     const product = await Product.findById({ _id: id }).lean();
    
//     if (!product) {
//       return res.json({ status: "Product not found" });
//     }
    
//     if (product.quantity <= 0) {
//       return res.json({ status: "Out of stock" });
//     }

//     const cartIndex = findUser.cart.findIndex((item) => item.productId.equals(id));

//     if (cartIndex === -1) {
//       const quantity = 1;
//       await User.findByIdAndUpdate(userId, {
//         $addToSet: {
//           cart: {
//             productId: id,
//             quantity: quantity,
//           },
//         },
//       });
//       return res.json({ status: true, cartLength: findUser.cart.length + 1, user: userId });
//     } else {
//       const productInCart = findUser.cart[cartIndex];
//       if (productInCart.quantity < product.quantity) {
//         const newQuantity = productInCart.quantity + 1;
//         await User.updateOne(
//           { _id: userId, "cart.productId": id },
//           { $set: { "cart.$.quantity": newQuantity } }
//         );
//         return res.json({ status: true, cartLength: findUser.cart.length, user: userId });
//       } else {
//         return res.json({ status: "Out of stock" });
//       }
//     }
//   } catch (error) {
//     console.error(error);
//     return res.redirect("/pageNotFound");
//   }
// };

// const changeQuantity = async (req, res) => {
//   try {
//     const id = req.body.productId;
//     const user = req.session.user;
//     const count = req.body.count;
//     // count(-1,+1)
//     const findUser = await User.findOne({ _id: user });
//     const findProduct = await Product.findOne({ _id: id });
//     const oid = new mongodb.ObjectId(user);
//     if (findUser) {
//       const productExistinCart = findUser.cart.find(
//         (item) => item.productId === id
//       );
//       let newQuantity;
//       if (productExistinCart) {
//         if (count == 1) {
//           newQuantity = productExistinCart.quantity + 1;
//         } else if (count == -1) {
//           newQuantity = productExistinCart.quantity - 1;
//         } else {
//           return res
//             .status(400)
//             .json({ status: false, error: "Invalid count" });
//         }
//       } else {
//       }
//       if (newQuantity > 0 && newQuantity <= findProduct.quantity) {
//         let quantityUpdated = await User.updateOne(
//           { _id: user, "cart.productId": id },
//           {
//             $set: {
//               "cart.$.quantity": newQuantity,
//             },
//           }
//         );
//         const totalAmount = findProduct.salePrice * newQuantity;
//         const grandTotal = await User.aggregate([
//           { $match: { _id: oid } },
//           { $unwind: "$cart" },
//           {
//             $project: {
//               proId: { $toObjectId: "$cart.productId" },
//               quantity: "$cart.quantity",
//             },
//           },
//           {
//             $lookup: {
//               from: "products",
//               localField: "proId",
//               foreignField: "_id",
//               as: "productDetails",
//             },
//           },
//           {
//             $unwind: "$productDetails", // Unwind the array created by the $lookup stage
//           },

//           {
//             $group: {
//               _id: null,
//               totalQuantity: { $sum: "$quantity" },
//               totalPrice: {
//                 $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
//               }, 
//             },
//           },
//         ]);
//         if (quantityUpdated) {
//           res.json({
//             status: true,
//             quantityInput: newQuantity,
//             count: count,
//             totalAmount: totalAmount,
//             grandTotal: grandTotal[0].totalPrice,
//           });
//         } else {
//           res.json({ status: false, error: "cart quantity is less" });
//         }
//       } else {
//         res.json({ status: false, error: "out of stock" });
//       }
//     }
//   } catch (error) {
//     res.redirect("/pageNotFound");
//     return res.status(500).json({ status: false, error: "Server error" });
//   }
// };

// const deleteProduct = async (req, res) => {
//   try {
//     const id = req.query.id;
//     const userId = req.session.user;
//     const user = await User.findById(userId);
//     const cartIndex = user.cart.findIndex((item) => item.productId == id);
//     user.cart.splice(cartIndex, 1);
//     await user.save();
//     res.redirect("/cart");
//   } catch (error) {
//     res.redirect("/pageNotFound");
//   }
// };