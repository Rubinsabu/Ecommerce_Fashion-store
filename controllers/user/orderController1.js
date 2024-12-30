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
