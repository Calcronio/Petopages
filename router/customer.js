/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */

const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const auth = require("../middleware/auth");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

// ============= Add Customer ================ //

router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        
        res.render('add_customer', {
            auth:req.user, nameCode, CountryCode, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/signup_ajex", auth, async(req, res)=>{
    try {
        const {country, phone} = req.body;

        const login_phone = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${country}' AND phone = '${phone}'`);

        if (login_phone != "") {
            return res.json({error : "phone_error"});
        }

        res.json({error : ""});
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_customer", auth, async(req, res)=>{
    try {
        const {Name, Email, country_code, phone, Password} = req.body;

        const hash = await bcrypt.hash(Password, 10);

        let referral = '';
        let characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let charactersLength = characters.length;
        for (let i = 0; i < 6; i++) {
            referral += characters.charAt(Math.floor(Math.random() * charactersLength));
        }

        if (await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'${Name}', '${Email}', '${country_code}', '${phone}', '${hash}', '2'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            res.redirect("/valid_license");
        } else {
            await DataInsert(`tbl_customer`, `name, email, country_code, phone, status, referral_code`, `'${Name}', '${Email}', '${country_code}', '${phone}', '0', '${referral}'`, req.hostname, req.protocol);
            req.flash('success', 'Customer Add successfully');
            res.redirect("/customer/view");
        }
        
    } catch (error) {
        console.log(error);
    }
});

// ============= Customer ================ //

router.get('/view', auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT * FROM tbl_customer`);
        
        res.render("customer", {
            auth:req.user, customer, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

// ============= Edit Customer ================ //

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
        
        res.render('edit_customer', {
            auth:req.user, customer, nameCode, CountryCode, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_customer_ajax", auth, async(req, res)=>{
    try {
        const {country, phone} = req.body;

        const login_phone = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${country}' AND phone = '${phone}'`);
    
        if (login_phone != "") {
            return res.json({error : "phone_error"});
        }

        res.json({error : ""});
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_customer/:id", auth, async(req, res)=>{
    try {
        const {Name, Email, country_code, phone, Password, status} = req.body;

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
        const status_no = status == "on" ? 1 : 0;

        if (Password == "") {

            if (await DataUpdate(`tbl_admin`,
                `name = '${Name}', email = '${Email}', country_code = '${country_code}', phone = '${phone}'`,
                `country_code = '${customer[0].country_code}' AND phone = '${customer[0].phone}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

        } else {
            const hash = await bcrypt.hash(Password, 10);

            if (await DataUpdate(`tbl_admin`,
                `name = '${Name}', email = '${Email}', country_code = '${country_code}', phone = '${phone}', password = '${hash}'`,
                `country_code = '${customer[0].country_code}' AND phone = '${customer[0].phone}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        if (await DataUpdate(`tbl_customer`, `name = '${Name}', email = '${Email}', country_code = '${country_code}', phone = '${phone}', status = '${status_no}'`,
            `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Customer Updated successfully');
        res.redirect("/customer/view");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);

        if (await DataDelete(`tbl_customer`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            res.redirect("/valid_license");
        } else {
            await DataDelete(`tbl_admin`, `country_code = '${customer[0].country_code}' AND phone = '${customer[0].phone}'`, req.hostname, req.protocol);
            req.flash('success', 'Customer Deleted successfully');
            res.redirect("/customer/view");
        }
    } catch (error) {
        console.log(error);
    }
});

// ============= Customer pet Detail ================ //

router.get("/pet_detail/:id", auth, async(req, res)=>{
    try {
        const customer_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${customer_data[0].country_code}' AND phone = '${customer_data[0].phone}'`);

        const pet_data = await DataFind(`SELECT pet.*,
                                            ca.image as category_image, ca.name as category_name,
                                            br.name as breed_name,
                                            si.name as size_name, si.min_size as min_size, si.max_size as max_size, si.units as size_units,
                                            ye.name as year_name, ye.min_year as min_year, ye.max_year as max_year, ye.units as year_units
                                            FROM tbl_pet_detail pet
                                            join tbl_category ca on pet.category = ca.id
                                            join tbl_breed br on pet.breed = br.id
                                            join tbl_pet_size si on pet.pet_size = si.id
                                            join tbl_pet_year ye on pet.pet_year = ye.id
                                            WHERE pet.customer = '${admin_data[0].id}'`);

        if (pet_data == "") {
            req.flash('errors', `Pet not Added`);
            return res.redirect("back");
        }

        res.render("customer_pet_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pet_data
        });
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;