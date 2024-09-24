/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const bcrypt = require('bcrypt');
const auth = require("../middleware/auth");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        
        res.render("add_role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_role", auth, async(req, res)=>{
    try {
        const { name, email, country_code, phone, status, password, bookadd, bookedit, cusview, cusadd, cusedit, catview, catadd, catedit, serviview, serviadd, serviedit, faqview, 
                faqadd, faqedit, sitview, sitadd, sitedit, breeview, breeadd, breeedit, sizeview, sizeadd, sizeedit, yearview, yearadd, yearedit, repoview, repoedit, payoutview, 
                payoutedit, pageview, pageedit, paymview, paymedit, statview, statedit, bannview, bannadd, bannedit, zoneview, zoneadd, zoneedit, managview, managedit, snotiview, 
                snotiadd, snotiedit, foldview, foldedit, settview, settedit } = req.body;

        let book1 = bookadd == "on" ? "1" : "0";
        let book2 = bookedit == "on" ? "1" : "0";
        const book = book1 + ',' + book2;
        
        let cus1 = cusview == "on" ? "1" : "0";
        let cus2 = cusadd == "on" ? "1" : "0";
        let cus3 = cusedit == "on" ? "1" : "0";
        const customer = cus1 + ',' + cus2 + ',' + cus3;
        
        let cate1 = catview == "on" ? "1" : "0";
        let cate2 = catadd == "on" ? "1" : "0";
        let cate3 = catedit == "on" ? "1" : "0";
        const category = cate1 + ',' + cate2 + ',' + cate3;
        
        let ser1 = serviview == "on" ? "1" : "0";
        let ser2 = serviadd == "on" ? "1" : "0";
        let ser3 = serviedit == "on" ? "1" : "0";
        const services = ser1 + ',' + ser2 + ',' + ser3;
        
        let faq1 = faqview == "on" ? "1" : "0";
        let faq2 = faqadd == "on" ? "1" : "0";
        let faq3 = faqedit == "on" ? "1" : "0";
        const faq = faq1 + ',' + faq2 + ',' + faq3;
        
        let sit1 = sitview == "on" ? "1" : "0";
        let sit2 = sitadd == "on" ? "1" : "0";
        let sit3 = sitedit == "on" ? "1" : "0";
        const sitter = sit1 + ',' + sit2 + ',' + sit3;
        
        let bre1 = breeview == "on" ? "1" : "0";
        let bre2 = breeadd == "on" ? "1" : "0";
        let bre3 = breeedit == "on" ? "1" : "0";
        const breed = bre1 + ',' + bre2 + ',' + bre3;
        
        let siz1 = sizeview == "on" ? "1" : "0";
        let siz2 = sizeadd == "on" ? "1" : "0";
        let siz3 = sizeedit == "on" ? "1" : "0";
        const size = siz1 + ',' + siz2 + ',' + siz3;
        
        let yea1 = yearview == "on" ? "1" : "0";
        let yea2 = yearadd == "on" ? "1" : "0";
        let yea3 = yearedit == "on" ? "1" : "0";
        const year = yea1 + ',' + yea2 + ',' + yea3;
        
        let re1 = repoview == "on" ? "1" : "0";
        let re2 = repoedit == "on" ? "1" : "0";
        const report = re1 + ',' + re2;
        
        let pay1 = payoutview == "on" ? "1" : "0";
        let pay2 = payoutedit == "on" ? "1" : "0";
        const payout = pay1 + ',' + pay2;
        
        let pag1 = pageview == "on" ? "1" : "0";
        let pag2 = pageedit == "on" ? "1" : "0";
        const pages = pag1 + ',' + pag2;
        
        let paym1 = paymview == "on" ? "1" : "0";
        let paym2 = paymedit == "on" ? "1" : "0";
        const payment = paym1 + ',' + paym2;
        
        let stat1 = statview == "on" ? "1" : "0";
        let stat2 = statedit == "on" ? "1" : "0";
        const statusl = stat1 + ',' + stat2;
        
        let bann1 = bannview == "on" ? "1" : "0";
        let bann2 = bannadd == "on" ? "1" : "0";
        let bann3 = bannedit == "on" ? "1" : "0";
        const banner = bann1 + ',' + bann2 + ',' + bann3;
        
        let zone1 = zoneview == "on" ? "1" : "0";
        let zone2 = zoneadd == "on" ? "1" : "0";
        let zone3 = zoneedit == "on" ? "1" : "0";
        const zone = zone1 + ',' + zone2 + ',' + zone3;
        
        let man1 = managview == "on" ? "1" : "0";
        let man2 = managedit == "on" ? "1" : "0";
        const timem = man1 + ',' + man2;

        let snoti1 = snotiview == "on" ? "1" : "0";
        let snoti2 = snotiadd == "on" ? "1" : "0";
        let snoti3 = snotiedit == "on" ? "1" : "0";
        const snoti = snoti1 + ',' + snoti2 + ',' + snoti3;
        
        let fol1 = foldview == "on" ? "1" : "0";
        let fol2 = foldedit == "on" ? "1" : "0";
        const folder = fol1 + ',' + fol2;
        
        let sett1 = settview == "on" ? "1" : "0";
        let sett2 = settedit == "on" ? "1" : "0";
        const setting = sett1 + ',' + sett2;

        const phash = await bcrypt.hash(password, 10);

        if (await DataInsert(`tbl_admin`, `name, email, country_code, phone, password, role`, `'${name}', '${email}', '${country_code}', '${phone}', '${phash}', '4'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataInsert(`tbl_role_permission`,
            `name, email, country_code, phone, rstatus, book_service, customer, category, services, faq, sitter, breed, size, year, report, payout, pages, payment_list
            , status, banner_list, zone, time_management, snotification, folder, setting`,
            `'${name}', '${email}', '${country_code}', '${phone}', '${status}', '${book}', '${customer}', '${category}', '${services}', '${faq}', '${sitter}', '${breed}', 
            '${size}', '${year}', '${report}', '${payout}', '${pages}', '${payment}', '${statusl}', '${banner}', '${zone}', '${timem}', '${snoti}', '${folder}', '${setting}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Role Add successfully');
        res.redirect("/role/list");
    } catch (error) {
        console.log(error);
    }
});



router.get("/list", auth, async(req, res)=>{
    try {
        const role_data = await DataFind(`SELECT id, name, email, country_code, phone, rstatus FROM tbl_role_permission ORDER BY id DESC`);
        // console.log(role_data);

        res.render("role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, role_data
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

        const role_data = await DataFind(`SELECT * FROM tbl_role_permission WHERE id = '${req.params.id}'`);
        
        let index = 0;
        let role = Object.keys(role_data[0]).reduce((key, i) => {
            let rval = role_data[0][i];
            if (index > 5) rval = rval.split(",");
            key[i] = rval;
            index++;
            return key;
        }, {});


        res.render("edit_role_permission", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, role
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_role/:id", auth, async(req, res)=>{
    try {
        const { name, email, country_code, phone, status, password, bookadd, bookedit, cusview, cusadd, cusedit, catview, catadd, catedit, serviview, serviadd, serviedit, faqview, 
            faqadd, faqedit, sitview, sitadd, sitedit, breeview, breeadd, breeedit, sizeview, sizeadd, sizeedit, yearview, yearadd, yearedit, repoview, repoedit, payoutview, 
            payoutedit, pageview, pageedit, paymview, paymedit, statview, statedit, bannview, bannadd, bannedit, zoneview, zoneadd, zoneedit, managview, managedit, snotiview, 
            snotiadd, snotiedit, foldview, foldedit, settview, settedit } = req.body;

        let book1 = bookadd == "on" ? "1" : "0";
        let book2 = bookedit == "on" ? "1" : "0";
        const book = book1 + ',' + book2;
            
        let cus1 = cusview == "on" ? "1" : "0";
        let cus2 = cusadd == "on" ? "1" : "0";
        let cus3 = cusedit == "on" ? "1" : "0";
        const customer = cus1 + ',' + cus2 + ',' + cus3;
            
        let cate1 = catview == "on" ? "1" : "0";
        let cate2 = catadd == "on" ? "1" : "0";
        let cate3 = catedit == "on" ? "1" : "0";
        const category = cate1 + ',' + cate2 + ',' + cate3;

        let ser1 = serviview == "on" ? "1" : "0";
        let ser2 = serviadd == "on" ? "1" : "0";
        let ser3 = serviedit == "on" ? "1" : "0";
        const services = ser1 + ',' + ser2 + ',' + ser3;
            
        let faq1 = faqview == "on" ? "1" : "0";
        let faq2 = faqadd == "on" ? "1" : "0";
        let faq3 = faqedit == "on" ? "1" : "0";
        const faq = faq1 + ',' + faq2 + ',' + faq3;
            
        let sit1 = sitview == "on" ? "1" : "0";
        let sit2 = sitadd == "on" ? "1" : "0";
        let sit3 = sitedit == "on" ? "1" : "0";
        const sitter = sit1 + ',' + sit2 + ',' + sit3;
            
        let bre1 = breeview == "on" ? "1" : "0";
        let bre2 = breeadd == "on" ? "1" : "0";
        let bre3 = breeedit == "on" ? "1" : "0";
        const breed = bre1 + ',' + bre2 + ',' + bre3;
            
        let siz1 = sizeview == "on" ? "1" : "0";
        let siz2 = sizeadd == "on" ? "1" : "0";
        let siz3 = sizeedit == "on" ? "1" : "0";
        const size = siz1 + ',' + siz2 + ',' + siz3;
            
        let yea1 = yearview == "on" ? "1" : "0";
        let yea2 = yearadd == "on" ? "1" : "0";
        let yea3 = yearedit == "on" ? "1" : "0";
        const year = yea1 + ',' + yea2 + ',' + yea3;
            
        let re1 = repoview == "on" ? "1" : "0";
        let re2 = repoedit == "on" ? "1" : "0";
        const report = re1 + ',' + re2;
            
        let pay1 = payoutview == "on" ? "1" : "0";
        let pay2 = payoutedit == "on" ? "1" : "0";
        const payout = pay1 + ',' + pay2;
            
        let pag1 = pageview == "on" ? "1" : "0";
        let pag2 = pageedit == "on" ? "1" : "0";
        const pages = pag1 + ',' + pag2;
            
        let paym1 = paymview == "on" ? "1" : "0";
        let paym2 = paymedit == "on" ? "1" : "0";
        const payment = paym1 + ',' + paym2;
            
        let stat1 = statview == "on" ? "1" : "0";
        let stat2 = statedit == "on" ? "1" : "0";
        const statusl = stat1 + ',' + stat2;
            
        let bann1 = bannview == "on" ? "1" : "0";
        let bann2 = bannadd == "on" ? "1" : "0";
        let bann3 = bannedit == "on" ? "1" : "0";
        const banner = bann1 + ',' + bann2 + ',' + bann3;
            
        let zone1 = zoneview == "on" ? "1" : "0";
        let zone2 = zoneadd == "on" ? "1" : "0";
        let zone3 = zoneedit == "on" ? "1" : "0";
        const zone = zone1 + ',' + zone2 + ',' + zone3;
            
        let man1 = managview == "on" ? "1" : "0";
        let man2 = managedit == "on" ? "1" : "0";
        const timem = man1 + ',' + man2;

        let snoti1 = snotiview == "on" ? "1" : "0";
        let snoti2 = snotiadd == "on" ? "1" : "0";
        let snoti3 = snotiedit == "on" ? "1" : "0";
        const snoti = snoti1 + ',' + snoti2 + ',' + snoti3;

        let fol1 = foldview == "on" ? "1" : "0";
        let fol2 = foldedit == "on" ? "1" : "0";
        const folder = fol1 + ',' + fol2;
            
        let sett1 = settview == "on" ? "1" : "0";
        let sett2 = settedit == "on" ? "1" : "0";
        const setting = sett1 + ',' + sett2;

        const role_data = await DataFind(`SELECT country_code, phone FROM tbl_role_permission WHERE id = "${req.params.id}"`);

        if (role_data != "") {
            if (password != "") {
                const phash = await bcrypt.hash(password, 10);

                if (await DataUpdate(`tbl_admin`,
                    `name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}', password = '${phash}'`,
                    `country_code = '${role_data[0].country_code}' AND phone = '${role_data[0].phone}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
                
            } else {

                if (await DataUpdate(`tbl_admin`,
                    `SET name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}'`,
                    `country_code = '${role_data[0].country_code}' AND phone = '${role_data[0].phone}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }

            if (await DataUpdate(`tbl_role_permission`,

                `name = '${name}', email = '${email}', country_code = '${country_code}', phone = '${phone}', rstatus = '${status}',
                book_service = '${book}', customer = '${customer}', category = '${category}', services = '${services}', faq = '${faq}', sitter = '${sitter}', breed = '${breed}', size = '${size}'
                , year = '${year}', report = '${report}', payout = '${payout}', pages = '${pages}', payment_list = '${payment}', status = '${statusl}', banner_list = '${banner}'
                , zone = '${zone}', time_management = '${timem}', snotification = '${snoti}', folder = '${folder}', setting = '${setting}'`,
    
                `country_code = '${role_data[0].country_code}' AND phone = '${role_data[0].phone}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            req.flash('success', 'Role Updated successfully');
        }

        res.redirect("/role/list");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const role_data = await DataFind(`SELECT country_code, phone FROM tbl_role_permission WHERE id = "${req.params.id}"`);

        if (await DataDelete(`tbl_admin`, `country_code = '${role_data[0].country_code}' AND phone = '${role_data[0].phone}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        } else {
            await DataDelete(`tbl_role_permission`, `country_code = '${role_data[0].country_code}' AND phone = '${role_data[0].phone}'`, req.hostname, req.protocol);
        }
        
        req.flash('success', 'Services Deleted successfully');
        res.redirect("/role/list");
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;