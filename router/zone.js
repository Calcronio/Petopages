/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

router.get("/view", auth, async(req, res)=>{
    try {
        const zone_data = await DataFind(`SELECT * FROM tbl_zone`);
        
        res.render("zone", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, zone_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_zone", auth, async(req, res)=>{
    try {
        const {name, status, zone_lat_lon} = req.body;

        console.log(req.body);
        const all_lat_lon = zone_lat_lon.split(',');
        let zone_leg = all_lat_lon.length;

        let latitude = [];
        let longitiude = [];

        let lat_log = [];

        for (let i = 0; i < zone_leg;) {

            if ((i%2) == 0) {
                latitude.push(all_lat_lon[i]);
            } else {
                longitiude.push(all_lat_lon[i]);
            }
            i++;
        }

        for (let a = 0; a < latitude.length;) {
            lat_log.push(latitude[a] +':'+longitiude[a]);
            a++;
        }

        let zone = lat_log.toString();

        if (await DataInsert(`tbl_zone`, `name, status, lat_lon`, `'${name}', '${status}', '${zone}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        res.redirect("/zone/view");
    } catch (error) {
        console.log(error);
    }
});

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const zone_data = await DataFind(`SELECT * FROM tbl_zone where id = '${req.params.id}'`);

        res.render("edit_zone", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, zone_data
        });
    } catch (error) {
        console.log(error);
    }
});


router.post("/edit_zone", auth, async(req, res)=>{
    try {
        const {zone_id, name, status, zone_lat_lon} = req.body;

        if (zone_lat_lon == "") {
            if (await DataUpdate(`tbl_zone`, `name = '${name}', status = '${status}'`, `id = '${zone_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
        } else {

            const all_lat_lon = zone_lat_lon.split(',');
            let zone_leg = all_lat_lon.length;

            let latitude = [];
            let longitiude = [];

            let lat_log = [];

            for (let i = 0; i < zone_leg;) {

                if ((i%2) == 0) {
                    latitude.push(all_lat_lon[i]);
                } else {
                    longitiude.push(all_lat_lon[i]);
                }
                i++;
            }

            for (let a = 0; a < latitude.length;) {
                lat_log.push(latitude[a] +':'+longitiude[a]);
                a++;
            }

            let zone = lat_log.toString();

            if (await DataUpdate(`tbl_zone`, `name = '${name}', status = '${status}', lat_lon = '${zone}'`, `id = '${zone_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
        
        res.redirect("/zone/view");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_zone`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        res.redirect("/zone/view");
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;