const User = require('../../models/userSchema');

const customerInfo = async (req,res)=>{
    try {
        let search="";
        if(req.query.search){
            search=req.query.search;
        }
        let page=1;
        if(req.query.page){
            page= req.query.page
        }
        const limit = 3;
        const userData = await User.find({
            isAdmin: false,
            $or: [
                {name: {$regex: ".*" + search + ".*"}},
                {email: {$regex: ".*" + search + ".*"}},
            ],
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            isAdmin: false,
            $or: [
                {name: {$regex: ".*" + search + ".*"}},
                {email: {$regex: ".*" + search + ".*"}},
            ],
        }).countDocuments();

        const totalPages= Math.ceil(count/limit);

        console.log("customers loading");
        res.render('customers',{
            data: userData,
            totalPages: totalPages,
            currentPage: page,
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}

const customerBlocked = async(req,res)=>{
    try {
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        console.log("user blocked");
        delete req.session.user;
        res.redirect("/admin/users");
        console.log("admin user page loaded");
    } catch (error) {
        res.redirect("/pageerror");
    }
}

const customerunBlocked = async(req,res)=>{
    try {
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/users");
    } catch (error) {
        res.redirect("/pageerror");
    }
}

module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked,

}