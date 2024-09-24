/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/sitter");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

// ============= Become a Sitter ================ //

router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        const services_data = await DataFind(`SELECT * FROM tbl_services`);
        const zone_data = await DataFind(`SELECT * FROM tbl_zone where status = '1'`);
        
        res.render("add_sitter", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, services_data, zone_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/services_check", auth, async(req, res)=>{
    try {
        const {service_id} = req.body;
        const services_data = await DataFind(`SELECT * FROM tbl_services`);
        const services = await DataFind(`SELECT * FROM tbl_services where id = '${service_id}'`);
        
        res.send({services_data, services});
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_sitter", auth, upload.fields([{name: 'logo', maxCount: 1}, {name: 'cover_logo', maxCount: 1}]), async(req, res)=>{
    try {
        const {name, status, country_code, phone, title, subtitle, tag, description, cancel_policy, email, password, address, pincode, landmark, zone, latitude, longitude, commisiion,
                service_id, service_type, price, price_type, v_status} = req.body;

        let ste_id, strtype, str_price, str_ptype, str_tag;
        if (typeof tag == "string") { 
            str_tag = [tag];
        } else {
            str_tag = [...tag];
        }
        
        if (typeof service_id == "string") {
            ste_id = [service_id];
            strtype = [service_type];
            str_price = [price];
            str_ptype = [price_type];
        } else {
            ste_id = [...service_id];
            strtype = [...service_type];
            str_price = [...price];
            str_ptype = [...price_type];
        }

        let id_tag = [];
        for (let a = 0; a < str_tag.length;){
            let id = a + parseFloat(1);
            id_tag.push(id +'&!'+str_tag[a]);
            a++;
        }

        const logo = req.files.logo ? "uploads/sitter/" + req.files.logo[0].filename : null;
        const cover_logo = req.files.cover_logo ? "uploads/sitter/" + req.files.cover_logo[0].filename : null;

        const hash = await bcrypt.hash(password, 10);

        if (await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'${name}', '${email}', '${country_code}', '${phone}', '${hash}', '3'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const sit_title = mysql.escape(title);
        const sit_subtitle = mysql.escape(subtitle);
        const sit_destitle = mysql.escape(description);
        const sit_cantitle = mysql.escape(cancel_policy);
        const sit_addtitle = mysql.escape(address);

        const sitterid = await DataInsert(`tbl_sitter`,
        `name, email, logo, cover_logo, status, country_code, phone, title, subtitle, tag, description, cancel_policy, address, pincode, landmark, zone, latitude, longitude, 
            commisiion, tot_favorite, wallet, verified_status`,
        
        `'${name}', '${email}', '${logo}', '${cover_logo}', '${status}', '${country_code}', '${phone}', ${sit_title}, ${sit_subtitle}, '${id_tag}', ${sit_destitle}, 
            ${sit_cantitle}, ${sit_addtitle}, '${pincode}', '${landmark}', '${zone}', '${latitude}', '${longitude}', '${commisiion}', '0', '0', '${v_status}'`, req.hostname, req.protocol);

        if (sitterid == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }


        if (await DataInsert(`tbl_sitter_setting`, `sitter_id, extra_pet_charge, sitter_time, defaultm`, `'${sitterid.insertId}', '0', '', ''`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        for (let i = 0; i < ste_id.length;){
            if (await DataInsert(`tbl_sitter_services`, `sitter_id, service_id, service_type, price, price_type`,
                `'${sitterid.insertId}', '${ste_id[i]}', '${strtype[i]}', '${str_price[i]}', '${str_ptype[i]}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            i++;
        }

        req.flash('success', 'Sitter Add successfully');
        res.redirect("/sitter_data/view");
    } catch (error) {
        console.log(error);
    }
});

router.get("/view", auth, async(req, res)=>{
    try {
        const sitter_data = await DataFind(`SELECT id, name, email, country_code, phone, status, verified_status FROM tbl_sitter ORDER BY id DESC`);
        
        res.render("become_a_sitter", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        const services_data = await DataFind(`SELECT * FROM tbl_services`);
        const zone_data = await DataFind(`SELECT * FROM tbl_zone`);
        const sitter_data = await DataFind(`SELECT * FROM tbl_sitter where id = '${req.params.id}'`);
        const admin_data = await DataFind(`SELECT id FROM tbl_admin where country_code = '${sitter_data[0].country_code}' AND phone = '${sitter_data[0].phone}'`);
        const sitter_service_id = await DataFind(`SELECT tbl_sitter_services.service_id FROM tbl_sitter_services where sitter_id = '${admin_data[0].id}' GROUP BY service_id`);

        let servicesdata = [];
        for (let i = 0; i < sitter_service_id.length;){
            const sitter_service_data = await DataFind(`SELECT tbl_sitter_services.*,
                                                        tbl_services.name as service_name
                                                        FROM tbl_sitter_services 
                                                        join tbl_services on tbl_sitter_services.service_id =  tbl_services.id
                                                        where sitter_id = '${admin_data[0].id}' AND service_id = '${sitter_service_id[i].service_id}'`);
            servicesdata.push(sitter_service_data);
            i++;
        }
        const services = [].concat(...servicesdata);

        const tag = sitter_data[0].tag;
        let spl_tag = tag.split(",");
        let data_tag = [];
        for (let a = 0; a < spl_tag.length; ){
            const tag_data = spl_tag[a].split("&!");
            data_tag.push({id:tag_data[0], name:tag_data[1]});
            a++;
        }
        let serices_id = "";
        for (let b = 0; b < services.length;) {
            if (b == 0) {
                serices_id += services[b].id;
            } else {
                serices_id += "&!" + services[b].id;
            }b++;
        }

        res.render("edit_sitter", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, services_data, zone_data, sitter_data, sitter_service_id, data_tag, services, serices_id
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit/:id", auth, upload.fields([{name: 'logo', maxCount: 1}, {name: 'cover_logo', maxCount: 1}]), async(req, res)=>{
    try {
        const {name, status, country_code, phone, title, subtitle, tag, description, cancel_policy, email, password, address, pincode, landmark, zone, latitude, longitude, commisiion,
            service_id, service_type, price, price_type, old_logo, old_clogo, services_data_id, services_id, old_ccode, old_phone, v_status} = req.body;

        let ste_data_id, ste_id, strtype, str_price, str_ptype, str_tag;
        if (typeof tag == "string") { 
            str_tag = [tag];
        } else {
            str_tag = [...tag];
        }

        if (typeof services_data_id == "string") {
            ste_data_id = [services_data_id];
            ste_id = [service_id];
            strtype = [service_type];
            str_price = [price];
            str_ptype = [price_type];
        } else {
            ste_data_id = [...services_data_id];
            ste_id = [...service_id];
            strtype = [...service_type];
            str_price = [...price];
            str_ptype = [...price_type];
        }

        let id_tag = [];
        for (let a = 0; a < str_tag.length;){
            let id = a + parseFloat(1);
            let match = str_tag[a].match("&!");
            if (match != null) {
                id_tag.push(str_tag[a]);
            } else {
                id_tag.push(id +'&!'+str_tag[a]);
            }
            a++;
        }

        const logo = req.files.logo ? "uploads/sitter/" + req.files.logo[0].filename : old_logo;
        const cover_logo = req.files.cover_logo ? "uploads/sitter/" + req.files.cover_logo[0].filename : old_clogo;
        
        if (password == "") {
            if (await DataUpdate(`tbl_admin`, `name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}'`,
                `country_code = '${old_ccode}' AND phone = '${old_phone}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        } else {
            const hash = await bcrypt.hash(password, 10);

            if (await DataUpdate(`tbl_admin`, `name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}', password = '${hash}'`,
                `country_code = '${old_ccode}' AND phone = '${old_phone}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        const sit_title = mysql.escape(title);
        const sit_subtitle = mysql.escape(subtitle);
        const sit_destitle = mysql.escape(description);
        const sit_cantitle = mysql.escape(cancel_policy);
        const sit_addtitle = mysql.escape(address);


        if (await DataUpdate(`tbl_sitter`,
            
            `name = '${name}', email = '${email}', logo = '${logo}', cover_logo = '${cover_logo}', status = '${status}', country_code = '${country_code}',
            phone = '${phone}', title = ${sit_title}, subtitle = ${sit_subtitle}, tag = '${id_tag}', description = ${sit_destitle}, cancel_policy = ${sit_cantitle}, address = ${sit_addtitle}, 
            pincode = '${pincode}', landmark = '${landmark}', zone = '${zone}', latitude = '${latitude}', longitude = '${longitude}', commisiion = '${commisiion}', verified_status = '${v_status}'`,
            
            `country_code = '${old_ccode}' AND phone = '${old_phone}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let ser_id = services_id.split("&!");
        let remove_id = [];
        remove_id = ser_id.map(i => {
           return { 'id': i, 'status': ste_data_id.includes(i) };
        });

        for (let a = 0; a < remove_id.length;){
            if (remove_id[a].status === false) {
                if (await DataDelete(`tbl_breed`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                } else {
                    await DataDelete(`tbl_sitter_services`, `id = '${remove_id[a].id}'`, req.hostname, req.protocol);
                }
            }a++;
        }

        const admin_data = await DataFind(`SELECT id FROM tbl_admin where country_code = '${country_code}' AND phone = '${phone}'`);

        for (let i = 0; i < ste_data_id.length;){
            if (ste_data_id[i] == "0") {
                if (await DataInsert(`tbl_sitter_services`, `sitter_id, service_id, service_type, price, price_type`,
                    `'${admin_data[0].id}', '${ste_id[i]}', '${strtype[i]}', '${str_price[i]}', '${str_ptype[i]}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }

            } else {
                if (await DataUpdate(`tbl_sitter_services`, `sitter_id = '${admin_data[0].id}', service_id = '${ste_id[i]}', service_type = '${strtype[i]}', price = '${str_price[i]}', price_type = '${str_ptype[i]}'`, `id = '${ste_data_id[i]}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
                
            }i++;
        }

        req.flash('success', 'Sitter Updated successfully');
        res.redirect("/sitter_data/view");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const sitter_data = await DataFind(`SELECT * FROM tbl_sitter where id = '${req.params.id}'`);
        const admin_data = await DataFind(`SELECT * FROM tbl_admin where country_code = '${sitter_data[0].country_code}' AND phone = '${sitter_data[0].phone}'`);

        if (await DataDelete(`tbl_sitter`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        await DataDelete(`tbl_sitter_gallery`, `sitter_id = '${admin_data[0].id}'`);
        await DataDelete(`tbl_pet_detail`, `customer = '${admin_data[0].id}'`);
        await DataDelete(`tbl_sitter_services`, `sitter_id = '${admin_data[0].id}'`);
        await DataDelete(`tbl_about`, `sitter_id = '${admin_data[0].id}'`);
        await DataDelete(`tbl_sitter_reviews`, `sitter_id = '${admin_data[0].id}'`);

        await DataDelete(`tbl_admin`, `id = '${admin_data[0].id}'`);
        
        req.flash('success', 'Sitter Deleted successfully');
        res.redirect("/sitter_data/view");
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;