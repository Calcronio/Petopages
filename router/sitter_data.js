/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql');
const fs = require('fs-extra');
const path = require("path");
const fontawesome_list = require("../public/fontawesome_list/list");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/gallery");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/pet image");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const pet_image = multer({storage : storage1});

function fulldate() {
    let date = new Date();
    let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
    let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
    let year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

// ============= Gallery ================ //

router.get("/gallery", auth, async(req, res)=>{
    try {
        const gallery_data = await DataFind(`SELECT * FROM tbl_sitter_gallery where sitter_id = '${req.user.admin_id}' ORDER BY id DESC`);
        
        res.render("sitter_gallery", {
            auth:req.user, gallery_data, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, general:req.general
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_gallery", auth, upload.single('file'), async(req, res)=>{
    try {
        let file = "uploads/gallery/" + req.file.filename;

        if (await DataInsert(`tbl_sitter_gallery`, `sitter_id, image`, `'${req.user.admin_id}', '${file}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.redirect("/sitter/gallery");
    } catch (error) {
        console.log(error);
    }
});

router.post("/delete_gallery", auth, async(req, res)=>{
    try {
        const {id} = req.body;

        const gallery_data = await DataFind(`SELECT * FROM tbl_sitter_gallery where id = '${id}' AND sitter_id = '${req.user.admin_id}'`);

        const folder_path = "public/" + gallery_data[0].image;

        fs.unlink(folder_path, (err) => {
                if (err) {
                console.error('Error deleting file:');
                return;
            }
            console.log('Image deleted successfully.');
        });
        
        if (await DataDelete(`tbl_sitter_gallery`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({status:true});
    } catch (error) {
        console.log(error);
    }
});



// ============= Sitter Pet ================ //

router.get("/siter_pet", auth, async(req, res)=>{
    try {
        const pet_detail = await DataFind(`SELECT * FROM tbl_pet_detail where customer = '${req.user.admin_id}'`);

        console.log(req.user.admin_id);

        res.render("sitter_pet", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, pet_detail
        });
    } catch (error) {
        console.log(error);
    }
});

router.get("/add_pet", auth, async(req, res)=>{
    try {
        const category_data = await DataFind(`SELECT * FROM tbl_category`);
        const breed_data = await DataFind(`SELECT * FROM tbl_breed`);
        const pet_size = await DataFind(`SELECT * FROM tbl_pet_size`);
        const pet_year = await DataFind(`SELECT * FROM tbl_pet_year`);
        
        res.render("add_sitter_pet",{
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, category_data, breed_data, pet_size, pet_year
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/sitter_ad_pet", auth, pet_image.single('image'), async(req, res)=>{
    try {
        const {name, category, breed, pet_gender, pet_size, pet_year, natured} = req.body;

        const imageUrl = req.file ? "uploads/pet image/" + req.file.filename : null;

        if (await DataInsert(`tbl_pet_detail`,
            `customer, image, name, category, breed, gender, pet_size, pet_year, pet_nature, date`,
            `'${req.user.admin_id}', '${imageUrl}', '${name}', '${category}', '${breed}', '${pet_gender}', '${pet_size}', '${pet_year}', '${natured}', '${fulldate()}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Pet Add successfully');
        res.redirect("/sitter/siter_pet");
    } catch (error) {
        console.log(error);
    }
});

router.get("/edit_pet/:id", auth, async(req, res)=>{
    try {
        const pet_detail = await DataFind(`SELECT * FROM tbl_pet_detail where id = '${req.params.id}'`);
        const category_data = await DataFind(`SELECT * FROM tbl_category`);
        const breed_data = await DataFind(`SELECT * FROM tbl_breed`);
        const pet_size = await DataFind(`SELECT * FROM tbl_pet_size`);
        const pet_year = await DataFind(`SELECT * FROM tbl_pet_year`);
        
        res.render("edit_sitter_pet", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, category_data, breed_data, pet_size, pet_year, pet_detail
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/sitter_ad_pet/:id", auth, pet_image.single('image'), async(req, res)=>{
    try {
        const {old_file, name, category, breed, pet_gender, pet_size, pet_year, natured} = req.body;

        const imageUrl = req.file ? "uploads/pet image/" + req.file.filename : old_file;

        if (await DataUpdate(`tbl_pet_detail`,
            `image = '${imageUrl}', name = '${name}', category = '${category}', breed = '${breed}', gender = '${pet_gender}', pet_size = '${pet_size}', pet_year = '${pet_year}',
            pet_nature = '${natured}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Pet Updated successfully');
        res.redirect("/sitter/siter_pet");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_pet/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_pet_detail`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Pet Deleted successfully');
        res.redirect("/sitter/siter_pet");
    } catch (error) {
        console.log(error);
    }
});



// ============= Services ================ //

router.get("/services", auth, async(req, res)=>{
    try {
        const services_data = await DataFind(`SELECT * FROM tbl_services`);

        const sitter_data = await DataFind(`SELECT * FROM tbl_admin where id = '${req.user.admin_id}'`);

        const sitter_service_id = await DataFind(`SELECT tbl_sitter_services.service_id FROM tbl_sitter_services where sitter_id = '${req.user.admin_id}' GROUP BY service_id`);

        let servicesdata = [];
        for (let i = 0; i < sitter_service_id.length;){
            const sitter_service_data = await DataFind(`SELECT tbl_sitter_services.*,
                                                    tbl_services.name as service_name
                                                    FROM tbl_sitter_services 
                                                    join tbl_services on tbl_sitter_services.service_id =  tbl_services.id
                                                    where sitter_id = '${req.user.admin_id}' AND service_id = '${sitter_service_id[i].service_id}'`);
            servicesdata.push(sitter_service_data);
            i++;
        }
        const services = [].concat(...servicesdata);

        let serices_id = "";
        for (let a = 0; a < services.length;) {
            if (a == 0) {
                serices_id += services[a].id;
            } else {
                serices_id += "&!" + services[a].id;
            }a++;
        }
        res.render("sitter_services", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter_data, services_data, services, sitter_service_id, serices_id
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_services/:id", auth, async(req, res)=>{
    try {
        const {service_id, service_type, price, price_type, services_data_id, services_id} = req.body;

        let ste_data_id, ste_id, strtype, str_price, str_ptype;
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

        let ser_id = services_id.split("&!");
        let remove_id = [];
        remove_id = ser_id.map(i => {
           return { 'id': i, 'status': ste_data_id.includes(i) };
        });

        for (let a = 0; a < remove_id.length;){
            if (remove_id[a].status === false) {

                if (await DataDelete(`tbl_sitter_services`, `id = '${remove_id[a].id}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }a++;
        }

        for (let i = 0; i < ste_data_id.length;){
            if (ste_data_id[i] == "0") {

                if (await DataInsert(`tbl_sitter_services`, `sitter_id, service_id, service_type, price, price_type`,
                    `'${req.user.admin_id}', '${ste_id[i]}', '${strtype[i]}', '${str_price[i]}', '${str_ptype[i]}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            } else {

                if (await DataUpdate(`tbl_sitter_services`,
                    `sitter_id = '${req.user.admin_id}', service_id = '${ste_id[i]}', service_type = '${strtype[i]}', price = '${str_price[i]}', price_type = '${str_ptype[i]}'`,
                    `sitter_id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }
            i++;
        }

        req.flash('success', 'Services Updated successfully');
        res.redirect("/sitter/services");
    } catch (error) {
        console.log(error);
    }
});



// ============= Sitter About ================ //

router.get("/about", auth, async(req, res)=>{
    try {
        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${req.user.admin_id}'`);

        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");

            let head_des = [];
            aboutheading.forEach((heading, index) => {

                let dataicon = abouticon[index].split("&!");
                let datasub = aboutsubtitle[index].split("&!");

                const about = [];
                for (let i = 0; i < dataicon.length;){
                    about.push({ id: aboutid[index], icon: dataicon[i], subtitle: datasub[i] });
                    i++;
                }   

                head_des.push({ head: heading, description: aboutdes[index], title: abouttitle[index], about: about });
            });

            res.render("sitter_about", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, head_des
            });
        } else {
            
            res.render("sitter_about", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, head_des : ""
            });
        }
    } catch (error) {
        console.log(error);
    }
});



router.get("/add_about", auth, async(req, res)=>{
    try {
        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${req.user.admin_id}'`);
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");

            let head_des = [];
            aboutheading.forEach((heading, index) => {
                let dataicon = abouticon[index].split("&!");
                let datasub = aboutsubtitle[index].split("&!");

                const about = [];
                for (let i = 0; i < dataicon.length;){
                    about.push({ id: aboutid[index], icon: dataicon[i], subtitle: datasub[i] });
                    i++;
                } 

                head_des.push({ head: heading, description: aboutdes[index], title: abouttitle[index], about: about });
            });

            const folderPath = path.resolve(__dirname, '../public/uploads/about');
            let imagel = [];
            fs.readdirSync(folderPath).forEach(file => {
                imagel.push({imgpath : "../../uploads/about/" + file, imgname : file});
            });

            res.render("add_sitter_about", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, fontawesome_list, head_des, imagel
            });
        } else {
            res.render("add_sitter_about", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, fontawesome_list, head_des : "", imagel : []
            });
        }
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_about_data", auth, async(req, res)=>{
    try {
        const {about_heading, about_description, title, about_id, icon, about_subtitle} = req.body;

        let about_head, about_des;
        if (typeof about_heading == "string") {
            about_head = [about_heading];
            about_des = [about_description];
        } else {
            about_head = [...about_heading];
            about_des = [...about_description];
        }

        let about_title, aboutid, about_icon, about_subtit;
        if (typeof title == "string") {
            about_title = [title];
            aboutid = [about_id];
            about_icon = [icon];
            about_subtit = [about_subtitle];
        } else {
            about_title = [...title];
            aboutid = [...about_id];
            about_icon = [...icon];
            about_subtit = [...about_subtitle];
        }

        let abouttitle = "" ,abouid = "" ,abouticon = "" ,aboutsubtitle = "";
        
        let abouthead = "", aboutdes = "";
        for (let a = 0; a < about_head.length;){
            if (a == 0) {
                abouthead += about_head[a];
                aboutdes += about_des[a];
            } else {
                abouthead += '&!' + about_head[a];
                aboutdes += '&!' + about_des[a];
            }
            
            let titl = "" ,uid = "" ,aicon = "" ,subtit = "";
            for (let i = 0; i < about_title.length;){

                let iconp = "";
                if (about_icon[i].includes("uploads/about/") === true) iconp = about_icon[i]    ;
                else iconp = "uploads/about/" + about_icon[i];

                if (a+1 == aboutid[i]) {
                    if (titl == "") {
                        titl += about_title[i];
                        uid += aboutid[i];
                        aicon += iconp;
                        subtit += about_subtit[i];
                    } else {
                        aicon += '&!' + iconp;
                        subtit += '&!' + about_subtit[i];
                    }
                }
                i++;
            }

            abouttitle += abouttitle == "" ? titl : '&!' + titl;
            abouticon += abouticon == "" ? aicon : '&&!' + aicon;
            aboutsubtitle += aboutsubtitle == "" ? subtit : '&&!' + subtit;
            abouid += abouid == "" ? uid : '&!' + uid;
            a++;
        }

        let estitle = mysql.escape(abouttitle), essubtitle = mysql.escape(aboutsubtitle), esheading = mysql.escape(abouthead), esdes = mysql.escape(aboutdes);

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${req.user.admin_id}'`);

        if (about_data == "") {

            if ( await DataInsert(`tbl_about`, `sitter_id, about_id, title, icon, sub_title, heading, description`,
                `'${req.user.admin_id}', '${abouid}', ${estitle}, '${abouticon}', ${essubtitle}, ${esheading}, ${esdes}`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        } else {

            if (await DataUpdate(`tbl_about`, `about_id = '${abouid}', title = ${estitle}, icon = '${abouticon}', sub_title = ${essubtitle}, heading = ${esheading}, description = ${esdes}`,
                `sitter_id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        req.flash('success', 'About Updated successfully');
        res.redirect("/sitter/about");
    } catch (error) {
        console.log(error);
    }
});



// ============= Sitter FAQ ================ //

router.get("/faq", auth, async(req, res)=>{
    try {
        const sitter_faq_data = await DataFind(`SELECT * FROM tbl_sitter_faq WHERE sitter_id = '${req.user.admin_id}' ORDER BY id DESC`);
        
        res.render("sitter_faq", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter_faq_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_faq", auth, async(req, res)=>{
    try {
        const {title, description} = req.body;

        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);

        if (await DataInsert(`tbl_sitter_faq`, `sitter_id, title, description`, `'${req.user.admin_id}', ${faq_faq_title}, ${faq_faq_des}`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.redirect("/sitter/faq");
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_faq/:id", auth, async(req, res)=>{
    try {
        const {title, description} = req.body;
            
        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);
    
        if (await DataUpdate(`tbl_sitter_faq`, `title = ${faq_faq_title}, description = ${faq_faq_des}`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        res.redirect("/sitter/faq");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_faq/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_sitter_faq`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        res.redirect("/sitter/faq");
    } catch (error) {
        console.log(error);
    }
});



// ============= Sitter Review ================ //

router.get("/reviews", auth, async(req, res)=>{
    try {
        const review_data = await DataFind(`SELECT sitter_id, date, review, 
                                            COALESCE(tbl_services.name, '') as service_name, 
                                            COALESCE(tbl_admin.name, '') as customer_name   
                                            FROM tbl_sitter_reviews
                                            LEFT join tbl_services on tbl_sitter_reviews.service_id = tbl_services.id
                                            LEFT join tbl_admin on tbl_sitter_reviews.customer_id = tbl_admin.id
                                            WHERE sitter_id = '${req.user.admin_id}'`);
        
        res.render("sitter_reviews", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, review_data
        });
    } catch (error) {
        console.log(error);
    }
});



// ============= Sitter Coupon ================ //

router.get("/coupon", auth, async(req, res)=>{
    try {
        const coupon_list = await DataFind(`SELECT * FROM tbl_coupon WHERE sitter_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render("sitter_coupon", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, coupon_list
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_coupon", auth, async(req, res)=>{
    try {
        const {title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;
        
        if (await DataInsert(`tbl_coupon`, `sitter_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount`,
            `'${req.user.admin_id}', '${title}', '${sub_title}', '${code}', '${start_date}', '${end_date}', '${min_amount}', '${discount_amount}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Coupon Add successfully');
        res.redirect("/sitter/coupon");
    } catch (error) {
        console.log(error);
    }
});

router.post("/edit_coupon/:id", auth, async(req, res)=>{
    try {
        const {title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;

        if (await DataUpdate(`tbl_coupon`,
            `title = '${title}', sub_title = '${sub_title}', code = '${code}', start_date = '${start_date}', end_date = '${end_date}', min_amount = '${min_amount}', 
            discount_amount = '${discount_amount}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Coupon Updated successfully');
        res.redirect("/sitter/coupon");
    } catch (error) {
        console.log(error);
    }
});

router.get("/delete_coupon/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_coupon`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Coupon Deleted successfully');
        res.redirect("/sitter/coupon");
    } catch (error) {
        console.log(error);
    }
});

// ============= Sitter Setting ================ //

router.get("/setting", auth, async(req, res)=>{
    try {
        let setting = await DataFind(`SELECT * FROM tbl_sitter_setting where sitter_id = '${req.user.admin_id}'`);

        if (setting == "") {
            await DataInsert(`tbl_sitter_setting`, `sitter_id, extra_pet_charge, sitter_time, defaultm`, `'${req.user.admin_id}', '0', '', ''`);
            setting = await DataFind(`SELECT * FROM tbl_sitter_setting where sitter_id = '${req.user.admin_id}'`);
        }

        res.render("sitter_setting", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, setting
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/sitter_setting", auth, async(req, res)=>{
    try {
        const {extra_pet_charge, defaultm} = req.body;

        const setting = await DataFind(`SELECT * FROM tbl_sitter_setting where sitter_id = '${req.user.admin_id}'`);

        if (setting == "") {
            
            if (await DataInsert(`tbl_sitter_setting`, `sitter_id, extra_pet_charge, defaultm`, `'${req.user.admin_id}', '${extra_pet_charge}', '${defaultm}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        } else {
            
            if (await DataUpdate(`tbl_sitter_setting`, `extra_pet_charge = '${extra_pet_charge}', defaultm = '${defaultm}'`, `sitter_id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
        req.flash('success', 'Setting Updated successfully');
        res.redirect("/sitter/setting");
    } catch (error) {
        console.log(error);
    }
});

// ============= Sitter Time Management ================ //

router.get("/time", auth, async(req, res)=>{
    try {
        const date_time = await DataFind(`SELECT * FROM tbl_date_time`);
        let slect_time = req.general.sitter_time.split(",");
        
        let day_list = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        const setting = await DataFind(`SELECT sitter_time FROM tbl_sitter_setting where sitter_id = '${req.user.admin_id}'`);

        let s_time = [];
        if (setting != "") {
            s_time = setting[0].sitter_time == null ? '0' : setting[0].sitter_time.split(",");
        }
        
        res.render("sitter_time_management", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, day_list, date_time, slect_time, s_time
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_time_data", auth, async(req, res)=>{
    try {
        const {time} = req.body;

        let filter = time.filter(item => item.trim() !== '');

        const setting = await DataFind(`SELECT sitter_time FROM tbl_sitter_setting where sitter_id = '${req.user.admin_id}'`);

        if (setting == "") {

            if (await DataInsert(`tbl_sitter_setting`, `sitter_id, extra_pet_charge, sitter_time`, `'${req.user.admin_id}', '0', '${filter}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        } else {
            if (await DataUpdate(`tbl_sitter_setting`, `sitter_time = '${filter}'`, `sitter_id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }   
        }

        req.flash('success', 'Time Updated successfully');
        res.redirect("/sitter/time");
    } catch (error) {
        console.log(error);
    }
});

// ============= Sitter Wallet ================ //

router.get("/wallet", auth, async(req, res)=>{
    try {
        const admin_data = await DataFind(`SELECT id, country_code, phone FROM tbl_admin WHERE id = '${req.user.admin_id}'`);

        const sitter_wallet = await DataFind(`SELECT id, wallet FROM tbl_sitter WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}' `);

        const swallet_data = await DataFind(`SELECT * FROM tbl_wallet_withdraw WHERE sitter_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render('sitter_wallet', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter_wallet, swallet_data
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/wallet_withdraw", auth, async(req, res)=>{
    try {
        const { Withdraw_amount, spayment_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type, stotal_id } = req.body;

        const sitter_wallet = await DataFind(`SELECT id, wallet FROM tbl_sitter WHERE id = '${stotal_id}' `);

        if ( parseFloat(sitter_wallet[0].wallet) >= parseFloat(req.general.s_min_withdraw)) {

            if (parseFloat(Withdraw_amount) >= parseFloat(req.general.s_min_withdraw) && parseFloat(Withdraw_amount) <= parseFloat(sitter_wallet[0].wallet)) {
                
                let total = parseFloat(sitter_wallet[0].wallet) - parseFloat(Withdraw_amount);
                await DataUpdate(`tbl_sitter`, `wallet = '${total}'`, `id = '${sitter_wallet[0].id}'`);
        
                if (spayment_type == "1") {

                    if (await DataInsert(`tbl_wallet_withdraw`,
                        `image, sitter_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${fulldate()}', '${Withdraw_amount}', '${spayment_type}', '0', '${upi_id}', '', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
        
                } else if (spayment_type == "2") {

                    if (await DataInsert(`tbl_wallet_withdraw`,
                        `image, sitter_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${fulldate()}', '${Withdraw_amount}', '${spayment_type}', '0', '', '${paypal_id}', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                                    
                } else if (spayment_type == "3") {

                    if (await DataInsert(`tbl_wallet_withdraw`,
                        `image, sitter_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${fulldate()}', '${Withdraw_amount}', '${spayment_type}', '0', '', '', '${bank_no}', '${bank_ifsc}', '${bank_type}'`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
        
                }
                req.flash('success', 'Wallet Withdraw Request add successfully');
            }   
        }
        res.redirect("/sitter/wallet");
    } catch (error) {
        console.log(error);
    }
});

// ============= Sitter Wallet ================ //

router.get("/book_time", auth, async(req, res)=>{
    try {
        const sitter_service_id = await DataFind(`SELECT ser.id, ser.name as sname
                                                    FROM tbl_sitter_services as si
                                                    join tbl_services as ser ON si.service_id = ser.id
                                                    where si.sitter_id = '91' GROUP BY service_id`);

        res.render('sitter_book_time', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter_service_id
        });
    } catch (error) {
        console.log(error);
    }
});

function convertfulltime(time) {

    if (time.length <= 5) {
        let times = time.split(":");
        let padtime = String(times[0]).padStart(2, '0');
        return `${padtime}:00:00`;
    
    } else {
        
        let ftime = time.split(" ");
        if (ftime[1] == "PM") {
            let time = ftime[0].split(":");
            let conver = parseFloat(time[0]) + parseFloat(12);
            let padtime = String(conver).padStart(2, '0');
            return `${padtime}:00:00`;
        } else {
            let time = ftime[0].split(":");
            let padtime = String(time[0]).padStart(2, '0');
            return `${padtime}:00:00`;
        }
    }

}

router.post("/calendar", auth, async(req, res)=>{
    try {
        const {sidValue} = req.body;

        if (await DataDelete(`tbl_sitter_book_date`, `date < '${fulldate()}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        let date_data;
        if (sidValue == "0") {
            const service = await DataFind(`SELECT service_id FROM tbl_sitter_services WHERE sitter_id = '${req.user.admin_id}' LIMIT 1`);
            date_data = await DataFind(`SELECT date, times FROM tbl_sitter_book_date WHERE sitter_id = '${req.user.admin_id}' AND service_id = '${service[0].service_id}' AND date >= '${fulldate()}'`);
            
        } else {
            date_data = await DataFind(`SELECT date, times FROM tbl_sitter_book_date WHERE sitter_id = '${req.user.admin_id}' AND service_id = '${sidValue}' AND date >= '${fulldate()}'`);
        }

        let date_time = [];

        if (date_data != "") {
            
            let fulltitme = "";
            for (let i = 0; i < date_data.length;){
    
                let st = date_data[i].times.split(",");
    
                let atime = "";
                let check = 0;
                for (let a = 0; a < st.length;){
                    if (check == "0") {
                        check = parseFloat(st[a]);
                        atime += date_data[i].date + '&!' + st[a];
                    } else {
                        if (check == st[a]) {
                            
                            atime += '&' + st[a];
                        } else {
                            check = parseFloat(st[a]);
                            atime += '&!!' + date_data[i].date + '&!' + st[a];
                        }
                    }
                    check++;
                    a++;
                }
                fulltitme += fulltitme == "" ? atime : '&!!' + atime;
                i++;
            }
    
            let stime = fulltitme.split("&!!");
    
            for (let b = 0; b < stime.length;){
                let onetime = stime[b].split("&!");
                let sche = onetime[1].split("&");
    
                if (sche.length > 1) {
    
                    let twoid = `${sche[0]},${sche[sche.length - 1]}`;
                    const time_list = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${twoid})`);

                    let spltimes = time_list[0].time.split(" to ");
                    let spltimee = time_list[1].time.split(" to ");
    
                    let fullstr = `${onetime[0]}T${convertfulltime(spltimes[0])}`;
                    let fullend = `${onetime[0]}T${convertfulltime(spltimee[1])}`;
                    date_time.push({ title: `${spltimes[0]} to ${spltimee[1]}`, start: fullstr, end: fullend });
                } else {
    
                    const time_list = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${sche[0]})`);
    
                    let spltimes = time_list[0].time.split(" to ");
    
                    let fullstr = `${onetime[0]}T${convertfulltime(spltimes[0])}`;
                    let fullend = `${onetime[0]}T${convertfulltime(spltimes[1])}`;
                    date_time.push({ title: time_list[0].time, start: fullstr, end: fullend });
    
                }
    
                b++;
            }
        }

        res.send({date_time});
    } catch (error) {
        console.log(error);
    }
});



module.exports = router;