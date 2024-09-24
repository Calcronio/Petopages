/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { DataFind, DataUpdate } = require("../middleware/database_query");

router.get("/management", auth, async(req, res)=>{
    try {
        const date_time = await DataFind(`SELECT * FROM tbl_date_time`);
        let slect_time = req.general.sitter_time.split(",");
        
        let day_list = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        res.render("time_management", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, day_list, date_time, slect_time
        });
    } catch (error) {
        console.log(error); 
    }
});

router.post("/add_time", auth, async(req, res)=>{
    try {
        const {time} = req.body;

        let filter = time.filter(item => item.trim() !== '');

        const general = await DataFind(`SELECT * FROM tbl_general_settings`);

        if (await DataUpdate(`tbl_general_settings`, `sitter_time = '${filter}'`, `id = '${general[0].id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        res.redirect("/time/management");
    } catch (error) {
        console.log(error);
    }
});


module.exports = router;