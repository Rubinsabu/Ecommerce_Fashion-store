const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const mongodb = require("mongodb");
const Cart = require("../../models/cartSchema");

const getCartPage = async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Fetch the user's cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.render("cart", {
        user: req.session.user,
        quantity: 0,
        data: [],
        grandTotal: 0,
      });
    }

    // Process cart items
    let quantity = 0;
    let grandTotal = 0;

    const data = cart.items.map((item) => {
      quantity += item.quantity;
      grandTotal += item.totalPrice;

      return {
        productDetails: {
          _id: item.productId._id,
          productName: item.productId.productName,
          productImage: item.productId.productImage, // Images are arrays
          salePrice: item.productId.salePrice,
          category: item.productId.category,
          brand: item.productId.brand,
          status: item.productId.status, // Check product availability
        },
        quantity: item.quantity,
        totalPrice: item.totalPrice,
      };
    });

    req.session.grandTotal = grandTotal;

    res.render("cart", {
      user: req.session.user,
      quantity,
      data,
      grandTotal,
    });
  } catch (error) {
    console.error("Error loading cart:", error);
    res.redirect("/pageNotFound");
  }
};
  
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
const addToCart = async (req, res) => {
    try {
      console.log("Starting Add to Cart");
      const productId = new mongodb.ObjectId(req.body.productId);
      const userId = req.session.user; // Assuming `req.session.user` contains the user's ID
      const product = await Product.findById({ _id: productId }).lean();
  
      if (!product) {
        return res.json({ status: "Product not found" });
      }
  
      if (product.quantity <= 0) {
        return res.json({ status: "Out of stock" });
      }
  
      // Find or create the cart for the user
      let cart = await Cart.findOne({ userId });
      if (!cart) {
        cart = new Cart({ userId, items: [] });
      }
  
      // Check if the product already exists in the cart
      const cartItemIndex = cart.items.findIndex((item) =>
        item.productId.equals(productId)
      );
  
      if (cartItemIndex === -1) {
        // Add new product to the cart
        cart.items.push({
          productId,
          quantity: 1,
          price: product.salePrice,
          totalPrice: product.salePrice,
        });
      } else {
        // Update quantity and total price if the product already exists
        const cartItem = cart.items[cartItemIndex];
        if (cartItem.quantity < product.quantity) {
          cartItem.quantity += 1;
          cartItem.totalPrice = cartItem.quantity * product.salePrice;
        } else {
          return res.json({ status: "Out of stock" });
        }
      }
  
      // Save the updated cart
      await cart.save();
  
      return res.json({
        status: true,
        cartLength: cart.items.length,
        user: userId,
      });
    } catch (error) {
      console.error(error);
      return res.redirect("/pageNotFound");
    }
  };  


const changeQuantity = async (req, res) => {
  try {
    const id = req.body.productId;
    const user = req.session.user;
    const count = req.body.count;
    // count(-1,+1)
    const findUser = await User.findOne({ _id: user });
    const findProduct = await Product.findOne({ _id: id });
    const oid = new mongodb.ObjectId(user);
    if (findUser) {
      const productExistinCart = findUser.cart.find(
        (item) => item.productId === id
      );
      let newQuantity;
      if (productExistinCart) {
        if (count == 1) {
          newQuantity = productExistinCart.quantity + 1;
        } else if (count == -1) {
          newQuantity = productExistinCart.quantity - 1;
        } else {
          return res
            .status(400)
            .json({ status: false, error: "Invalid count" });
        }
      } else {
      }
      if (newQuantity > 0 && newQuantity <= findProduct.quantity) {
        let quantityUpdated = await User.updateOne(
          { _id: user, "cart.productId": id },
          {
            $set: {
              "cart.$.quantity": newQuantity,
            },
          }
        );
        const totalAmount = findProduct.salePrice * newQuantity;
        const grandTotal = await User.aggregate([
          { $match: { _id: oid } },
          { $unwind: "$cart" },
          {
            $project: {
              proId: { $toObjectId: "$cart.productId" },
              quantity: "$cart.quantity",
            },
          },
          {
            $lookup: {
              from: "products",
              localField: "proId",
              foreignField: "_id",
              as: "productDetails",
            },
          },
          {
            $unwind: "$productDetails", // Unwind the array created by the $lookup stage
          },

          {
            $group: {
              _id: null,
              totalQuantity: { $sum: "$quantity" },
              totalPrice: {
                $sum: { $multiply: ["$quantity", "$productDetails.salePrice"] },
              }, 
            },
          },
        ]);
        if (quantityUpdated) {
          res.json({
            status: true,
            quantityInput: newQuantity,
            count: count,
            totalAmount: totalAmount,
            grandTotal: grandTotal[0].totalPrice,
          });
        } else {
          res.json({ status: false, error: "cart quantity is less" });
        }
      } else {
        res.json({ status: false, error: "out of stock" });
      }
    }
  } catch (error) {
    res.redirect("/pageNotFound");
    return res.status(500).json({ status: false, error: "Server error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const cartIndex = user.cart.findIndex((item) => item.productId == id);
    user.cart.splice(cartIndex, 1);
    await user.save();
    res.redirect("/cart");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};


module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
};

