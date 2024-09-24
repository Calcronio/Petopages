/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { DataFind, DataInsert } = require("../middleware/database_query");

router.get("/", async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const login_data = await DataFind(`SELECT * FROM tbl_admin`);
        const general = await DataFind(`SELECT * FROM tbl_general_settings`);
        
        if (login_data == "") {
            const hash = await bcrypt.hash('123', 10);
            if (await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'admin', 'admin@admin.com', '+91', '9999999999', '${hash}', '1'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        res.render("login", {
            nameCode, CountryCode, general:general[0]
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/login", async(req, res)=>{
    try {
        const {country_code, phone, password} = req.body;

        const login_data = await DataFind(`SELECT * FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);

        if (login_data == "") {
            req.flash('errors', 'Phone No. Not Register');
            return res.redirect("/");
        }
        
        const hash_pass = await bcrypt.compare(password, login_data[0].password);
        if (!hash_pass) {
            req.flash('errors', 'Your Password is Wrong');
            return res.redirect("/");
        }

        console.log(111111);

        const lan = req.cookies.lan;
        if (lan === undefined) {
            const lantoken = jwt.sign({lang:"en"}, process.env.jwt_key);
            res.cookie("lan", lantoken);
        }
        
        if (login_data[0].role == "1") {
            
            const token = jwt.sign({admin_id:login_data[0].id, admin_email:login_data[0].email, admin_role:login_data[0].role}, process.env.jwt_key);
            res.cookie('pet', token, {expires: new Date(Date.now() + 60000 * 60)});
            
            req.flash('success', 'login successfully');
            res.redirect("/index");
        }
        
        if (login_data[0].role == "4") {

            const role_data = await DataFind(`SELECT rstatus FROM tbl_role_permission WHERE country_code = '${login_data[0].country_code}' AND phone = '${login_data[0].phone}'`);

            if (role_data[0].rstatus == "0") {
                req.flash('success', 'Your Account Inactive');
                return res.redirect("/");
            }

            const token = jwt.sign({admin_id:login_data[0].id, admin_email:login_data[0].email, admin_role:login_data[0].role}, process.env.jwt_key);
            res.cookie('pet', token, {expires: new Date(Date.now() + 60000 * 60)});
            
            req.flash('success', 'login successfully');
            res.redirect("/index");
        }
        
        if (login_data[0].role == "3") {
            const sitter_data = await DataFind(`SELECT * FROM tbl_sitter where country_code = '${login_data[0].country_code}' AND phone = '${login_data[0].phone}'`);
            
            if (sitter_data[0].status == "0") {
                req.flash('success', 'Your Account Inactive');
                return res.redirect("/");

            } else {
                const token = jwt.sign({admin_id:login_data[0].id, admin_email:login_data[0].email, admin_role:login_data[0].role}, process.env.jwt_key);
                res.cookie('pet', token, {expires: new Date(Date.now() + 60000 * 60)});

                req.flash('success', 'login successfully');
                res.redirect("/index");
            }
        }

        // res.redirect("/");
    } catch (error) {
        console.log(error);
    }
});

router.post("/language", async(req, res)=>{
    try {
        const {lan} = req.body;
        const lantoken = jwt.sign({lang:lan}, process.env.jwt_key);
        res.cookie("lan", lantoken);

        res.status(200).json(lantoken);
    } catch (error) {
        console.log(error);
    }
});

router.get("/signup", async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const general = await DataFind(`SELECT * FROM tbl_general_settings`);
        
        res.render("signup", {
            nameCode, CountryCode, general:general[0]
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/signup", async(req, res)=>{
    try {
        const {Name, Email, country_code, phone, password} = req.body;

        const hash = await bcrypt.hash(password, 10);

        if (await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'${Name}', '${Email}', '${country_code}', '${phone}', '${hash}', '2'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataInsert(`tbl_customer`, `name, email, country_code, phone, status`, `'${Name}', '${Email}', '${country_code}', '${phone}', '0'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.redirect("/");
    } catch (error) {
        console.log(error);
    }
});

router.get("/logout", async(req, res)=>{
    try {
        res.clearCookie("pet");

        res.redirect("/");
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;