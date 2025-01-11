const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");

const getOrderListPageAdmin = async (req, res) => {
    try {
      const orders = await Order.find({}).sort({ createdOn: -1 });
      let itemsPerPage = 6;
      let currentPage = parseInt(req.query.page) || 1;
      let startIndex = (currentPage - 1) * itemsPerPage;
      let endIndex = startIndex + itemsPerPage;
      let totalPages = Math.ceil(orders.length / 6);
      const currentOrder = orders.slice(startIndex, endIndex);
    //   currentOrder.forEach(order => {
    //     order.orderId = uuidv4();
    //   });
  
      res.render("order-list", { orders: currentOrder, totalPages, currentPage });
    } catch (error) {
      res.redirect("/pageerror");
    }
  };

  const getOrderDetailsPageAdmin = async (req, res) => {
    try {
      const orderId = req.query.id;
      const findOrder = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
  
      if (!findOrder) {
        throw new Error('Order not found');
      }
  
      // Calculate total grant if needed
    //   let totalGrant = 0;
    //   findOrder.product.forEach((val) => {
    //     totalGrant += val.price * val.quantity;
    //   });
  
      const finalPrice = findOrder.finalAmount;

      const user = await User.findOne({ orderHistory: orderId })
            .select('name email phone') // Fetch only the required fields
            .exec();

        if (!user) {
            return res.status(404).json({ error: "User not found with the provided order ID" });
        }

      const addressId = findOrder?.address;
      const findAddress = await Address.findOne(
        { userId: user._id, "address._id": addressId },
        { "address.$": 1 }
      );
      console.log("Address details:",findAddress);
      const extractedAddress = findAddress?.address?.[0] || null;

      res.render("order-details-admin", {
        orders: findOrder,
        orderId: orderId,
        user: user,
        finalPrice: finalPrice,
        address:extractedAddress,
      });
    } catch (error) {
      console.error(error);
      res.redirect("/pageerror");
    }
  };
  
  const deliverOrder = async (req, res) => {
    try {
      console.log("deliver Order entered");
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
      if (findOrder.status === "Confirmed") {
        await Order.updateOne({ _id: orderId }, { status: "Delivered" });
        return res.status(200).json({ message: "Order marked as delivered successfully!" });
      }
      
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  module.exports={
    getOrderListPageAdmin,
    getOrderDetailsPageAdmin,
    deliverOrder,
  }
  