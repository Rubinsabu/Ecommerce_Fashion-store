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
    const { productId, count:rawCount } = req.body;
    const userId = req.session.user._id;
    const count = parseInt(rawCount, 10);

    console.log("Received request:", { productId, count, userId });

    const product = await Product.findById(productId);
    if (!product) {
      console.log("Product not found:", productId);
      return res.status(404).json({ status: false, error: "Product not found" });
    }

    const cart = await Cart.findOne({ userId, "items.productId": productId });
    if (!cart) {
      console.log("Cart not found for userId:", userId);
      return res.status(404).json({ status: false, error: "Product not in cart" });
    }

    const cartItem = cart.items.find((item) => item.productId.equals(productId));
    if (!cartItem) {
      console.log("Cart item not found for productId:", productId);
      return res.status(404).json({ status: false, error: "Cart item not found" });
    }

    const newQuantity = cartItem.quantity + count;

    console.log("New Quantity:", newQuantity);
    console.log("Available Stock:", product.quantity);
    console.log("Cart Item:", cartItem);

    // Check constraints
    if (newQuantity < 1) {
      console.log("Quantity is less than 1, rejecting update.");
      return res.status(400).json({
        status: false,
        error: "Quantity cannot be less than 1. Consider removing the item instead.",
      });
    }

    if (newQuantity > 3) {
      console.log("Quantity exceeds the maximum allowed (3).");
      return res.status(400).json({
        status: false,
        error: "You can only add up to 3 items of this product.",
      });
    }

    if (newQuantity > product.quantity) {
      console.log("Out of stock error triggered.");
      return res.status(400).json({ status: false, error: "Out of stock" });
    }

    // Update the cart
    cartItem.quantity = newQuantity;
    cartItem.totalPrice = newQuantity * product.salePrice;

    await cart.save();

    // Calculate the new grand total
    const grandTotal = cart.items.reduce(
      (acc, item) => acc + item.totalPrice,
      0
    );

    return res.json({
      status: true,
      quantityInput: newQuantity,
      totalAmount: cartItem.totalPrice,
      grandTotal,
    });
  } catch (error) {
    console.error("Error in changeQuantity:", error);
    return res.status(500).json({ status: false, error: "Internal server error" });
  }
};



const deleteProduct = async (req, res) => {
  try {
    const  productId  = req.query.id;
    if (!productId) {
      return res.json({ status: false, message: "Product ID is required" });
    }
    const userId = req.session.user; 
    
    // Remove the product directly using MongoDB's `$pull` operator
    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId: new mongodb.ObjectId(productId) } } },
      { new: true } // Return the updated document
    );

    if (!cart) {
      return res.json({ status: false, message: "Cart not found" });
    }

    return res.redirect('/cart');

  } catch (error) {
    console.error("Error deleting product from cart:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};


module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct,
};

