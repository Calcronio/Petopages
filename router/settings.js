/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const countryCodes = require('country-codes-list');
const multer  = require('multer');
const auth = require("../middleware/auth");
let mysql = require('mysql');
const fs = require('fs-extra');
const path = require("path");
const bcrypt = require('bcrypt');
const schedule = require('node-schedule');
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/settings");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/banner");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const banner = multer({storage : storage1});

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/payment image");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const payment = multer({storage : storage2});

const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/payout list");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const payout = multer({storage : storage3});

const storage4 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/send notification");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const notification = multer({storage : storage4});

// ============= Folder Management ================ //

router.get("/folder", auth, async(req, res)=>{
    try {
        const folderPath = path.resolve(__dirname, '../public/uploads');

        let all_file = [];
        let count_file = [];
        fs.readdirSync(folderPath).forEach(file => {

            const file_path = path.resolve(__dirname, '../public/uploads/' + file);
            fs.readdirSync(file_path).forEach(filename => {

                count_file.push({filename:filename});
            });

            all_file.push({file:file, total_file:count_file.length, path:"../public/uploads/"});

            count_file = [];

        });
        
        res.render("folder", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, all_file
        });
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_folder_file/:id", auth, async(req, res)=>{
    try {
        const folder_path = path.resolve(__dirname, "../public/uploads/" + req.params.id);

        if (fs.existsSync(folder_path)) {
            fs.readdirSync(folder_path).forEach(file => {
                const curPath = path.join(folder_path, file);
                if (!fs.lstatSync(curPath).isDirectory()) {
                    fs.unlinkSync(curPath);
                }
            });
            // fs.rmdirSync(folder_path);
            req.flash('success', 'Folder Deleted successfully');
            console.log(`Deleted folder Data: ${folder_path}`);
        } else{
            console.log("Folder not Detected");
        }
        
        res.redirect("/settings/folder");
    } catch (error) {
        console.log(error);
    }
});

router.post("/open_folder_data", auth, async(req, res)=>{
    try {
        const {filename} = req.body;
        
        const folderPath = path.resolve(__dirname, '../public/uploads/' + filename);
        let filepath = '../../uploads/' + filename + '/';
        let all_file = [];
        fs.readdirSync(folderPath).forEach(file => {
            all_file.push({file: filepath + file});
        });

        res.json({all_file});
    } catch (error) {
        console.log(error);
    }
});

// ============= General Setting ================ //

router.get("/general", auth, async(req, res)=>{
    try {
        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);
        
        res.render("general_setting", {
            auth:req.user, general:general_setting[0], noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_setting", auth, upload.fields([{name: 'dark_image', maxCount: 1}, {name: 'light_image', maxCount: 1}]), async(req, res)=>{
    try {
        const {title, site_currency, currency_status, thousands_separator, google_map_key, commission_rate, commisiion_type, signup_credit, refer_credit, s_min_withdraw, one_app_id, 
                one_api_id, tstatus, smstype, msgkey, msgid, twisid, twitoken, twipnumber} = req.body;
        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        const dark_img = req.files.dark_image ? "uploads/settings/" + req.files.dark_image[0].filename : general_setting[0].dark_image;
        const light_img = req.files.light_image ? "uploads/settings/" + req.files.light_image[0].filename : general_setting[0].light_image;
        let currency_placement = currency_status == "on" ? 1 : 0;
        let ctype = commisiion_type == "on" ? '%' : 'fix';

        if (general_setting == "") {
            if (await DataInsert(`tbl_general_settings`,
                
                `dark_image, light_image, title, site_currency, currency_placement, thousands_separator, google_map_key, commission_rate, commisiion_type, signup_credit, refer_credit, 
                    s_min_withdraw, one_app_id, one_api_id, dformat, sms_type, msg_key, msg_token, twilio_sid, twilio_token, twilio_phoneno`,
                                
                `'null', 'null', 'Pet', '$', '0', '1', '0', '0', 'fix', '0', '0', '0', '', '', '0', '1', '', '', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

        } else {
            
            if (await DataUpdate(`tbl_general_settings`,
                `dark_image = '${dark_img}', light_image = '${light_img}', title = '${title}', site_currency = '${site_currency}', currency_placement = '${currency_placement}', 
                thousands_separator = '${thousands_separator}', google_map_key = '${google_map_key}', commission_rate = '${commission_rate}', commisiion_type = '${ctype}', 
                signup_credit = '${signup_credit}', refer_credit = '${refer_credit}', s_min_withdraw = '${s_min_withdraw}', one_app_id = '${one_app_id}', one_api_id = '${one_api_id}', 
                dformat = '${tstatus}', sms_type = '${smstype}', msg_key = '${msgkey}', msg_token = '${msgid}', twilio_sid = '${twisid}', twilio_token = '${twitoken}', 
                twilio_phoneno = '${twipnumber}'`,      
                `id = '${general_setting[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        updateTime(tstatus, req.hostname, req.protocol);

        req.flash('success', 'Setting Updated successfully');
        res.redirect("/settings/general");
    } catch (error) {
        console.log(error);
    }
});

async function updateTime(tstatus, hostname, protocol) {
    schedule.scheduleJob(new Date(Date.now() + 1000), async function() {
        const date_time = await DataFind(`SELECT * FROM tbl_date_time WHERE id = '24'`);

        if (tstatus == "1") {
            if (date_time[0].time == "24:00 to 1:00") await timeUpdate12(hostname, protocol);
        } else {
            if (date_time[0].time == "12:00 PM to 1:00 AM") await timeUpdate24(hostname, protocol);
        }
    });
}

async function timeUpdate12(hostname, protocol) {
    let updateId = 1;
    for (let b = 0; b < 7;) {
        for (let i = 1; i <= 12;) {
            if (i == 12) {
                let date = i + ':00 AM' + ' to ' + '1:00 PM';
                if (await DataUpdate(`tbl_date_time`, `time = '${date}'`, `id = '${updateId}'`, hostname, protocol) == -1) {
                    return;
                }
            } else {
                let date = i + ':00 AM' + ' to ' + (i+1) + ':00 AM';

                if (await DataUpdate(`tbl_date_time`, `time = '${date}'`, `id = '${updateId}'`, hostname, protocol) == -1) {
                    return;
                }
            }
            updateId++;
            i++;
        }

        for (let a = 1; a <= 12;) {
            if (a == 12) {
                let dateP = a + ':00 PM' + ' to ' + '1:00 AM';
                if (await DataUpdate(`tbl_date_time`, `time = '${dateP}'`, `id = '${updateId}'`, hostname, protocol) == -1) {
                    return;
                }
            } else {
                let dateP = a + ':00 PM' + ' to ' + (a+1) + ':00 PM';
                if (await DataUpdate(`tbl_date_time`, `time = '${dateP}'`, `id = '${updateId}'`, hostname, protocol) == -1) {
                    return;
                }
            }
            updateId++;
            a++;
        }
        b++;
    }
}

async function timeUpdate24(hostname, protocol) {
    let updateIds = 1;
    for (let b = 0; b < 7;) {
        for (let i = 1; i <= 12;) {
            if (i == 12) {
                let date = i + ':00' + ' to ' + '1:00';
                if (await DataUpdate(`tbl_date_time`, `time = '${date}'`, `id = 'id = '${updateIds}'`, hostname, protocol) == -1) {
                    return;
                }
            } else {
                let date = i + ':00' + ' to ' + (i+1) + ':00';
                if (await DataUpdate(`tbl_date_time`, `time = '${date}'`, `id = 'id = '${updateIds}'`, hostname, protocol) == -1) {
                    return;
                }
            }
            updateIds++;
            i++;
        }

        for (let a = 13; a <= 24;) {
            if (a == 24) {
                let dateP = a + ':00' + ' to ' + '1:00';

                if (await DataUpdate(`tbl_date_time`, `time = '${dateP}'`, `id = '${updateIds}'`, hostname, protocol) == -1) {
                    return;
                }
            } else {
                let dateP = a + ':00' + ' to ' + (a+1) + ':00';
                if (await DataUpdate(`tbl_date_time`, `time = '${dateP}'`, `id = '${updateIds}'`, hostname, protocol) == -1) {
                    return;
                }
            }
            updateIds++;
            a++;
        }
        b++;
    }
}



// ============= Edit Profile ================ //

router.get("/profile", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${req.user.admin_id}'`);
        
        res.render("edit_profile", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, admin_data:admin_data[0]
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_profile/:id", auth, async(req, res)=>{
    try {
        const {Name, Email, country_code, phone, old_ccode, old_phone, Password} = req.body;

        if (Password == "") {

            if (await DataUpdate(`tbl_admin`, `name = '${Name}', email = '${Email}', country_code = '${country_code}', phone = '${phone}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        } else {
            const hash = await bcrypt.hash(Password, 10);

            if (await DataUpdate(`tbl_admin`, `name = '${Name}', email = '${Email}', country_code = '${country_code}', phone = '${phone}', password = '${hash}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        if (await DataUpdate(`tbl_customer`, `name = '${Name}', email = '${Email}', country_code = '${country_code}', phone = '${phone}'`,
            `country_code = '${old_ccode}' AND phone = '${old_phone}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Profile Edit successfully');
        res.redirect("/settings/profile");
    } catch (error) {
        console.log(error);
    }
});



// ============= FAQ ================ //

router.get("/faq",auth, async(req, res)=>{
    try {
        const faq_list = await DataFind(`SELECT * FROM tbl_faq`);
        
        res.render("faq", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, faq_list
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_faq", async(req, res)=>{
    try {
        const {title, description} = req.body;

        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);

        if ( await DataInsert(`tbl_faq`, `title, description`, `${faq_faq_title}, ${faq_faq_des}`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'FAQ Add successfully');
        res.redirect("/settings/faq");
    } catch (error) {
        console.error(error);
    }
});

router.post('/edit_faq/:id', async (req, res) => {
    try {
        const {title, description} = req.body;
            
        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);
    
        if (await DataUpdate(`tbl_faq`, `title = ${faq_faq_title}, description = ${faq_faq_des}`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'FAQ Updated successfully');
        res.redirect("/settings/faq");
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/delete_faq/:id', async (req, res) => {
    try {
        if (await DataDelete(`tbl_faq`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
  
        req.flash('success', 'FAQ Deleted successfully');
        res.redirect("/settings/faq");
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Banner ================ //

router.get("/banner", auth, async(req, res)=>{
    try {
        const services_data = await DataFind(`SELECT * FROM tbl_services`);
        const banner_data = await DataFind(`SELECT tbl_banner.*,
                                            tbl_services.name as services_name
                                             FROM tbl_banner
                                             join tbl_services on tbl_banner.services = tbl_services.id`);

        res.render("banner", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, services_data, banner_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_banner", auth, banner.single('image'), async(req, res)=>{
    try {
        const {title, sub_title, service} = req.body;

        const imageUrl = req.file ? "uploads/banner/" + req.file.filename : null;

        if (await DataInsert(`tbl_banner`, `image, services, title, sub_title`, `'${imageUrl}', '${service}', '${title}', '${sub_title}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Banner Add successfully');
        res.redirect("/settings/banner");
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_banner/:id", auth, banner.single('image'), async(req, res)=>{
    try {
        const {title, sub_title, service, old_img} = req.body;

        const imageUrl = req.file ? "uploads/banner/" + req.file.filename : old_img;

        if (await DataUpdate(`tbl_banner`, `image = '${imageUrl}', services = '${service}', title = '${title}', sub_title = '${sub_title}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Banner Updated successfully');
        res.redirect("/settings/banner");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_banner/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_banner`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Banner Deleted successfully');
        res.redirect("/settings/banner");
    } catch (error) {
        console.log(error);
    }
});



// ============= Payment Data ================ //

router.get("/payment", auth, async(req, res)=>{
    try {
        const payment_data = await DataFind(`SELECT * FROM tbl_payment_detail`);
        
        res.render("payment_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, payment_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.get("/add_payment/:id", auth, async(req, res)=>{
    try {
        const payment_data = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '${req.params.id}'`);
        let attribute = payment_data[0].attribute.split(",");
        
        res.render("payment_detail_data", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, payment_data, attribute
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_payment_data", payment.single('image'), async(req, res)=>{
    try {
        const {name, sub_title, attribute, status, wallet_status} = req.body;

        const imageUrl = req.file ? "uploads/payment image/" + req.file.filename : null;
        const wstatus_no = wallet_status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_payment_detail`,
            `image, name, sub_title, attribute, status, wallet_status`,
            `'${imageUrl}', '${name}', '${sub_title}', '${attribute}', '${status}', '${wstatus_no}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.status(200).json({ message: 'Payment Data Add successful', status:true });
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_payment_data/:id", auth, payment.single('image'), async(req, res)=>{
    try {
        const {name, sub_title, attribute, status, wallet_status, old_image} = req.body;

        const imageUrl = req.file ? "uploads/payment image/" + req.file.filename : old_image;
        const wstatus_no = wallet_status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_payment_detail`,
            `image = '${imageUrl}', name = '${name}', sub_title = '${sub_title}', attribute = '${attribute}', status = '${status}', wallet_status = '${wstatus_no}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Payment Data Updated successfully');
        res.redirect("/settings/payment");
    } catch (error) {
        console.log(error);
    }
});

// ============= Status ================ //

router.get("/status", auth, async(req, res)=>{
    try {
        const status_data = await DataFind(`SELECT * FROM tbl_status_list`);
        
        res.render("status", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, status_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_status", auth, async(req, res)=>{
    try {
        const {name, n_text, status} = req.body;

        if (await DataInsert(`tbl_status_list`, `name, notifi_text, status`, `'${name}', '${n_text}', '${status}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Status Add successfully');
        res.redirect("/settings/status");
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_status/:id", auth, async(req, res)=>{
    try {
        const {name, n_text, status} = req.body;

        if (await DataUpdate(`tbl_status_list`, `name = '${name}', notifi_text = '${n_text}', status = '${status}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Status Updated successfully');
        res.redirect("/settings/status");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_status/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_status_list`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Status Deleted successfully');
        res.redirect("/settings/status");
    } catch (error) {
        console.log(error);
    }
});

// ============= Add Card ================ //

router.get("/pages", auth, async(req, res)=>{
    try {
        const pages_data = await DataFind(`SELECT * FROM tbl_pages`);
        
        res.render("pages", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pages_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.get("/add_pages/:id", auth, async(req, res)=>{
    try {
        const pages_data = await DataFind(`SELECT * FROM tbl_pages where id = '${req.params.id}'`);
        
        res.render("add_pages", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pages_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/pages_data/:id", auth, async(req, res)=>{
    try {
        const { title, status, paged } = req.body;

        const etitle = mysql.escape(title);
        const edes = mysql.escape(paged);

        if (await DataUpdate(`tbl_pages`, `title = ${etitle}, status = '${status}', description = ${edes}`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Pages Updated successfully');
        res.redirect("/settings/pages");
    } catch (error) {
        console.log(error);
    }
});




// ============= Sitter Withdraw ================ //

router.get("/payoutlist", auth, async(req, res)=>{
    try {
        const swallet_data = await DataFind(`SELECT wd.*, 
                                            ad.email as aemail
                                            FROM tbl_wallet_withdraw as wd
                                            JOIN tbl_admin as ad ON wd.sitter_id = ad.id ORDER BY wd.id DESC`);
        
        res.render("payout_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, swallet_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_wpayment", auth, payout.single('image'), async(req, res)=>{
    try {
        const {payment_sid} = req.body;

        const imageUrl = req.file ? "uploads/payout list/" + req.file.filename : null;

        if (await DataUpdate(`tbl_wallet_withdraw`, `image = '${imageUrl}', status = '1'`, `id = '${payment_sid}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Payout Add successfully');
        res.redirect("/settings/payoutlist");
    } catch (error) {
        console.log(error);
    }
});



// ============= Notification ================ //

router.get("/notification", auth, async(req, res)=>{
    try {
        let notification = "";
        if (req.user.admin_role == "1") {
            notification = await DataFind(`SELECT COALESCE(ord.order_id, "") as order_id, COALESCE(noti.date, "") AS date, COALESCE(noti.status, "") AS status,
                                            COALESCE(ad.name, "") AS name, COALESCE(sta.name, "") as sname, COALESCE(sta.notifi_text, "") as stext
                                            FROM tbl_notification as noti
                                            LEFT JOIN tbl_admin as ad ON noti.c_id = ad.id
                                            LEFT JOIN tbl_status_list as sta ON noti.status = sta.id
                                            LEFT JOIN tbl_order as ord ON noti.order_id = ord.id
                                            ORDER BY noti.id DESC`);
        } else {
            notification = await DataFind(`SELECT COALESCE(ord.order_id, "") as order_id, COALESCE(noti.date, "") AS date, COALESCE(noti.status, "") AS status,
                                            COALESCE(ad.name, "") AS name, COALESCE(sta.name, "") as sname, COALESCE(sta.notifi_text, "") as stext
                                            FROM tbl_notification as noti
                                            LEFT JOIN tbl_admin as ad ON noti.c_id = ad.id
                                            LEFT JOIN tbl_status_list as sta ON noti.status = sta.id
                                            LEFT JOIN tbl_order as ord ON noti.order_id = ord.id
                                            WHERE noti.s_id = '${req.user.admin_id}' ORDER BY noti.id DESC`);
        }
        
        res.render("notification", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, notification
        });
    } catch (error) {
        console.log(error);
    }
});



// ============= Notification ================ //

router.get("/sendn", auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT * FROM tbl_admin WHERE role = '2'`);
        const sitter = await DataFind(`SELECT * FROM tbl_admin WHERE role = '3'`);

        const ndata = await DataFind(`SELECT * FROM tbl_send_notification ORDER BY id DESC`);

        let data = ndata.map(async(nval) => {
            if (nval.customer != "All" && nval.customer != "") {
                const customer = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${nval.customer}'`);
                nval.customer = customer[0].name;
            }
            if (nval.sitter != "All" && nval.sitter != "") {
                const sitter = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${nval.sitter}'`);
                nval.sitter = sitter[0].name;
            }

            if (nval.title.length > 10) {
                nval.title = nval.title.slice(0, 10) + "...";
            }

            if (nval.description.length > 10) {
                nval.description = nval.description.slice(0, 16) + "...";
            }
            return nval;
        });

        let pdata = await Promise.all(data);

        res.render("send_notification", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, customer, sitter, pdata
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/snotification", auth, notification.single('image'), async(req, res)=>{
    try {
        const {title, description, selecttype, customer, allcustomer, sitter, allsitter} = req.body;

        const imageUrl = req.file ? "uploads/send notification/" + req.file.filename : null;

        let cid = "", sid = "", cdata = 0, sdata = 0;
        if (selecttype == "2") {
            if(allcustomer == "on") {
                cid = "All";
                cdata = await DataFind(`SELECT id FROM tbl_admin WHERE role = '2'`);
            } else if (customer != undefined) {
                cid = customer;
                cdata = [{ id: customer}];
            }

            if(allsitter == "on") {
                sid = "All";
                sdata = await DataFind(`SELECT id FROM tbl_admin WHERE role = '3'`);
            } else if(sitter != undefined) {
                sid = sitter;
                sdata = [{ id: sitter }];
            }
        } else {
            cid = "All";
            sid = "All";
            cdata = await DataFind(`SELECT id FROM tbl_admin WHERE role = '2'`);
            sdata = await DataFind(`SELECT id FROM tbl_admin WHERE role = '3'`);
        }

        let data = {title:title, description:description, imageUrl:imageUrl};

        sendNotification(cdata, sdata, data);

        if (await DataInsert(`tbl_send_notification`, `image, title, description, customer, sitter, count, status`,
            `'${imageUrl}', '${title}', '${description}', '${cid}', '${sid}', '1', '1'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Notification Send successfully');
        res.redirect("/settings/sendn");
    } catch (error) {
        console.log(error);
    }
});

router.get("/neresend/:id", auth, async(req, res)=>{
    try {
        const ndata = await DataFind(`SELECT * FROM tbl_send_notification WHERE id = '${req.params.id}'`);

        if (ndata[0].status == "1") {
            
            let cdata = 0, sdata = 0;
            if (ndata[0].customer == "All") {
                cdata = await DataFind(`SELECT id FROM tbl_admin WHERE role = '2'`);
            } else if(ndata[0].customer != "") {
                cdata = [{ id: ndata[0].customer}];
            }
    
            if (ndata[0].sitter == "All") {
                sdata = await DataFind(`SELECT id FROM tbl_admin WHERE role = '3'`);
            } else if(ndata[0].sitter != "") {
                sdata = [{ id: ndata[0].sitter}];
            }

            let count = parseFloat(ndata[0].count) + parseFloat(1);

            if (await DataUpdate(`tbl_send_notification`, `count = '${count}'`, `id = '${ndata[0].id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
    
            let data = {title:ndata[0].title, description:ndata[0].description, imageUrl:ndata[0].image};
            sendNotification(cdata, sdata, data);
    
            req.flash('success', 'Notification Send successfully');
        } else {
            req.flash('errors', 'Notification Deactivated');
        }
        res.redirect("/settings/sendn");
    } catch (error) {
        console.log(error);
    }
});

function sendNotification(cdata, sdata, data) {

    if (cdata != "0" && cdata[0].id != undefined) {
        cdata.forEach(cval => {
            sendOneNotification("", 'customer', cval.id, data);
        });
    }

    if (sdata != "0" && sdata[0].id != undefined) {
        sdata.forEach(sval => {
            sendOneNotification("", 'sitter', sval.id, data);
        });
    }

}

router.get("/sendit/:id", auth, async(req, res)=>{
    try {
        const customer = await DataFind(`SELECT * FROM tbl_admin WHERE role = '2'`);
        const sitter = await DataFind(`SELECT * FROM tbl_admin WHERE role = '3'`);

        const ndata = await DataFind(`SELECT * FROM tbl_send_notification WHERE id = '${req.params.id}'`);
        // console.log(ndata);
        res.render("send_notification_edit", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, customer, sitter, ndata:ndata[0]
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/editsend/:id", auth, notification.single('image'), async(req, res)=>{
    try {
        const {title, description, selecttype, customer, allcustomer, sitter, allsitter, status} = req.body;

        let cid = "", sid = "";
        if (selecttype == "2") {
            if(allcustomer == "on") {
                cid = "All";
            } else if (customer != undefined) {
                cid = customer;
            }

            if(allsitter == "on") {
                sid = "All";
            } else if(sitter != undefined) {
                sid = sitter;
            }
        } else {
            cid = "All";
            sid = "All";
        }

        const ndata = await DataFind(`SELECT * FROM tbl_send_notification WHERE id = '${req.params.id}'`);
        const imageUrl = req.file ? "uploads/send notification/" + req.file.filename : ndata[0].image;

        let nstatus = status == "on" ? "1" : "0";

        if (await DataUpdate(`tbl_send_notification`,
            `image = '${imageUrl}', title = '${title}', description = '${description}', customer = '${cid}', sitter = '${sid}', count = '${ndata[0].count}', status = '${nstatus}'`,
            `id = '${ndata[0].id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Notification Updated successfully');
        res.redirect("/settings/sendn");
    } catch (error) {
        console.log(error);
    }
});

router.get("/ndelete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_send_notification`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Notification Deleted successfully');
        res.redirect("/settings/sendn");
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;