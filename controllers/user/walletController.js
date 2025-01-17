const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const razorpay = require("razorpay");

let instance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

const addMoneyToWallet = async (req, res) => {
    try {
        console.log("adding money to wallet");
      var options = {
        amount: req.body.total*100,
        currency: "INR",
        receipt: "" + Date.now(),
      };
      instance.orders.create(options, async function (err, order) {
        if (err) {
          console.log("Error while creating order : ", err);
        } else {
          var amount = order.amount / 100;
          console.log("amount here:",amount);
          await User.updateOne(
            {
              _id: req.session.user
            },
            {
              $push: {
                history: {
                  amount: amount,
                  status: "credit",
                  date: Date.now()
                }
              }
            }
          );
        }
        console.log("orders:",order);
        res.json({ order: order, razorpay: true });
      });
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  };

  const verify_payment = async (req, res)=>{
    try {
        console.log("reached verify payment");
        let details = req.body;
        console.log("details :",details);
        let amount = parseInt(details.order.amount) / 100;
        console.log("amount before update:",amount);
        await User.updateOne(
            {_id : req.session.user},
            {$inc : {wallet : amount}}
        )
        console.log("wallet updated");
        res.json({success : true})
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}



  module.exports = {
    addMoneyToWallet,
    verify_payment,
  }

