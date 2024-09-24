/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');
const multer  = require('multer');
let mysql = require('mysql');
const fs = require('fs-extra');
const path = require("path");
const sendOneNotification = require("../middleware/send");
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

const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/service proof");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const proof = multer({storage : storage3});

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/story");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const story_img = multer({storage : storage2});

// ============= Home ================ //

router.post("/home", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const sitter = await DataFind(`SELECT sitt.logo, sitt.title, sitt.wallet, sitt.verified_status
                                        FROM tbl_admin AS ad
                                        JOIN tbl_sitter AS sitt ON ad.country_code = sitt.country_code AND ad.phone = sitt.phone
                                        where ad.id = '${sid}'`);

        const order = await DataFind(`SELECT COUNT(*) AS tot_order FROM tbl_order where sitter_id = '${sid}'`);

        const gallery_data = await DataFind(`SELECT COUNT(*) AS tot_image FROM tbl_sitter_gallery where sitter_id = '${sid}'`);

        const service = await DataFind(`SELECT COUNT(*) AS tot_service FROM tbl_sitter_services where sitter_id = '${sid}'`);

        const pet_detail = await DataFind(`SELECT COUNT(*) AS tot_pet FROM tbl_pet_detail where customer = '${sid}'`);

        const coupon_list = await DataFind(`SELECT COUNT(*) AS tot_coupon FROM tbl_coupon WHERE sitter_id = '${sid}'`);
        
        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${sid}'`);
        let tot_about = 0;
        if (about_data != "") {
            const aboutheading = about_data[0].heading.split("&!");
            tot_about = aboutheading.length;
        }

        const review_list = await DataFind(`SELECT COUNT(*) AS tot_review FROM tbl_sitter_reviews WHERE sitter_id = '${sid}'`);

        const faq_data = await DataFind(`SELECT COUNT(*) AS tot_faq FROM tbl_sitter_faq WHERE sitter_id = '${sid}'`);

        const setting = await DataFind(`SELECT sitter_time FROM tbl_sitter_setting where sitter_id = '${sid}'`);
        let select_time = [];
        if (setting != "") {
            select_time = setting[0].sitter_time == null ? '0' : setting[0].sitter_time.split(",");
        }

        const tot_balance = await DataFind(`SELECT COALESCE(SUM(amount), '0') as tot_amount FROM tbl_wallet_withdraw WHERE sitter_id = '${sid}'`);

        const general_setting = await DataFind(`SELECT site_currency, one_app_id, one_api_id FROM tbl_general_settings`);

        let data = [
            { field_name: "Book Services", tot_no: order[0].tot_order },
            { field_name: "Gallery", tot_no: gallery_data[0].tot_image},
            { field_name: "Services", tot_no: service[0].tot_service },
            { field_name: "Pet", tot_no: pet_detail[0].tot_pet },
            { field_name: "Coupon", tot_no: coupon_list[0].tot_coupon },
            { field_name: "About", tot_no: tot_about },
            { field_name: "Review", tot_no: review_list[0].tot_review },
            { field_name: "Timeslot", tot_no: select_time.length },
            { field_name: "FAQ", tot_no: faq_data[0].tot_faq },
            { field_name: "My Earning", tot_no: sitter[0].wallet },
            { field_name: "Payout", tot_no: tot_balance[0].tot_amount },
        ];

        delete sitter[0].wallet;

        res.status(200).json({ message: 'Data load successful', status:true, general_currency:general_setting[0], sitter:sitter[0], data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Login ================ //

router.post("/login", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        if (ccode == "" || phone == "" || password == "") {
            return res.status(200).json({ message: 'Enter All Details', status:false});
        }

        const login_data = await DataFind(`SELECT * FROM tbl_admin WHERE role = '3' AND country_code = '${ccode}' AND phone = '${phone}'`);
        
        if (login_data == "") {
            res.status(200).json({ message: "PhoneNo Not Exist", result:false });  
            
        } else {
            
            const hash_pass = await bcrypt.compare(password, login_data[0].password);
            if (!hash_pass) {
                
                res.status(200).json({ message: "Password Not match", result:false });
            } else {
                console.log(111111);
                const sitter_data = await DataFind(`SELECT name, email, country_code, phone, status, verified_status FROM tbl_sitter WHERE country_code = '${login_data[0].country_code}' AND phone = '${login_data[0].phone}'`);

                if (sitter_data[0].status == "1") {
                    
                    let user_data = {...login_data[0], ...sitter_data[0]};

                    return res.status(200).json({ message: "Login Sccessful", result:true, user_data });
                } else {   
                    return res.status(200).json({ message: "Account Deactivated", result:false });
                }
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




// ============= Gallery ================ //

router.post("/gallery", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const gallery_data = await DataFind(`SELECT id, image FROM tbl_sitter_gallery where sitter_id = '${sid}' ORDER BY id DESC`);
        
        res.status(200).json({ message: 'Data load successful', status:true, gallery_data});    
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_gallery", upload.array('image'), async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        if (req.files) {
            for (let i = 0; i < req.files.length;){
                let file = "uploads/gallery/" + req.files[i].filename;

                if (await DataInsert(`tbl_sitter_gallery`, `sitter_id, image`, `'${sid}', '${file}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
                i++;
            }
            return res.status(200).json({ message: 'Gallery Add successful', status:true });
        } else {
            return res.status(200).json({ message: 'Image Not Found!', status:false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/delete_gallery", async(req, res)=>{
    try {
        const {sid, image_id} = req.body;
        if (sid == "" || image_id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const gallery_data = await DataFind(`SELECT * FROM tbl_sitter_gallery where id = '${image_id}' AND sitter_id = '${sid}'`);

        const folder_path = "public/" + gallery_data[0].image;

        fs.unlink(folder_path, (err) => {
                if (err) {
                console.error('Error deleting file:');
                return;
            }
            console.log('Image deleted successfully.');
        });

        if (await DataDelete(`tbl_sitter_gallery`, `id = '${image_id}' AND sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        res.status(200).json({ message: 'Image Delete successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Services ================ //

router.post("/services", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const services_list = await DataFind(`SELECT id, name FROM tbl_services WHERE status = '1'`);

        let all_servicesdata = [];
        let services_name = services_list;
        
        for (let a = 0; a < services_list.length;){
            let id_services = [];
            const sitter_service_data = await DataFind(`SELECT tbl_sitter_services.*,
                                                            COALESCE(tbl_services.name, '') as service_name
                                                            FROM tbl_sitter_services
                                                            LEFT join tbl_services on tbl_sitter_services.service_id =  tbl_services.id AND 1 = tbl_services.status
                                                            where sitter_id = '${sid}' AND service_id = '${services_list[a].id}'`);

            if (sitter_service_data != "") {
                for (let b = 0; b < sitter_service_data.length;){
                    let services_all = {
                        id: sitter_service_data[b].id,
                        service_id: sitter_service_data[b].service_id,
                        service_type: sitter_service_data[b].service_type,
                        price: sitter_service_data[b].price,
                        price_type: sitter_service_data[b].price_type
                    };
                    id_services.push(services_all);
                    b++;
                }
    
                all_servicesdata.push({service_data:id_services});
            } else {
                all_servicesdata.push({service_data:id_services});
            }
            a++;
        }
        
        res.status(200).json({ message: 'Data load successful', status:true, services_name, all_servicesdata});    
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_services", async(req, res)=>{
    try {
        const {sid, service_id, service_type, price, price_type} = req.body;

        const missingField = ["sid", "service_id", "service_type", "price", "price_type"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});

        if (await DataInsert(`tbl_sitter_services`, `sitter_id, service_id, service_type, price, price_type`,
            `'${sid}', '${service_id}', '${service_type}', '${price}', '${price_type}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        res.status(200).json({ message: 'Services Add successful', status:true});    
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.post("/edit_services", async(req, res)=>{
    try {
        const {sid, sdata_id, service_id, service_type, price, price_type} = req.body;

        const missingField = ["sid", "sdata_id", "service_id", "service_type", "price", "price_type"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});

        if (await DataUpdate(`tbl_sitter_services`, `service_id = '${service_id}', service_type = '${service_type}', price = '${price}', price_type = '${price_type}'`,
            `id = '${sdata_id}' AND  sitter_id = '${sid}' `, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        res.status(200).json({ message: 'Services Update successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/delete_services", async(req, res)=>{
    try {
        const {sid, id} = req.body;
        if (sid == "" || id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        if (await DataDelete(`tbl_sitter_services`, `id = '${id}' AND sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        res.status(200).json({ message: 'Services Delete successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Sitter Pet ================ //

router.post("/pet_list", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const pet_detail = await DataFind(`SELECT id, image, name, gender, date FROM tbl_pet_detail where customer = '${sid}'`);

        res.status(200).json({ message: 'Data load successful', status:true, pet_detail });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/pet_detail", async(req, res)=>{
    try {
        const category_data = await DataFind(`SELECT * FROM tbl_category`);
        const breed_data = await DataFind(`SELECT * FROM tbl_breed`);
        const pet_size = await DataFind(`SELECT * FROM tbl_pet_size`);
        const pet_year = await DataFind(`SELECT * FROM tbl_pet_year`);
        
        res.status(200).json({ message: 'Data load successful', status:true, category_data, breed_data, pet_size, pet_year });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_pet", pet_image.single('image'), async(req, res)=>{
    try {
        const {sid, name, categoryid, breed, gender, pet_size, pet_year, natured, date} = req.body;

        const missingField = ["sid", "name", "categoryid", "breed", "gender", "pet_size", "pet_year", "natured", "date"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});
        
        const imageUrl = req.file ? "uploads/pet image/" + req.file.filename : null;

        let pet_id = await DataInsert(`tbl_pet_detail`, `customer, image, name, category, breed, gender, pet_size, pet_year, pet_nature, date`,
            `'${sid}', '${imageUrl}', '${name}', '${categoryid}', '${breed}', '${gender}', '${pet_size}', '${pet_year}', '${natured}', '${date}'`, req.hostname, req.protocol);

        if (pet_id == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
        
        return res.status(200).json({ message: 'Pet Add successful', status:true, insertedId:pet_id.insertId});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/edit_detail", async(req, res)=>{
    try {
        const {pet_id} = req.body;
        if (pet_id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const pet_data = await DataFind(`SELECT pet.*,
                                        COALESCE(ca.image, '') as category_image, COALESCE(ca.name, '') as category_name,
                                        COALESCE(br.name, '') as breed_name,
                                        COALESCE(si.name, '') as size_name, COALESCE(si.min_size, '') as min_size, COALESCE(si.max_size, '') as max_size, COALESCE(si.units, '') as size_units,
                                        COALESCE(ye.name, '') as year_name, COALESCE(ye.min_year, '') as min_year, COALESCE(ye.max_year, '') as max_year, COALESCE(ye.units, '') as year_units
                                        FROM tbl_pet_detail pet
                                        LEFT JOIN tbl_category ca ON pet.category = ca.id
                                        LEFT JOIN tbl_breed br ON pet.breed = br.id
                                        LEFT JOIN tbl_pet_size si ON pet.pet_size = si.id
                                        LEFT JOIN tbl_pet_year ye ON pet.pet_year = ye.id
                                        WHERE pet.id = '${pet_id}'`);

        return res.status(200).json({ status:true, pet_data:pet_data[0]});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/edit_pet", pet_image.single('image'), async(req, res)=>{
    try {
        const {pet_id, name, categoryid, breed, gender, pet_size, pet_year, natured} = req.body;

        const missingField = ["pet_id", "name", "categoryid", "breed", "gender", "pet_size", "pet_year", "natured"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});
        
        if (!req.file) {
            if (await DataUpdate(`tbl_pet_detail`,
                `name = '${name}', category = '${categoryid}', breed = '${breed}', gender = '${gender}', pet_size = '${pet_size}', pet_year = '${pet_year}', pet_nature = '${natured}'`,
                `id = '${pet_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        } else {

            const imageUrl = req.file ? "uploads/pet image/" + req.file.filename : null;

            if (await DataUpdate(`tbl_pet_detail`,
                `image = '${imageUrl}', name = '${name}', category = '${categoryid}', breed = '${breed}', gender = '${gender}', pet_size = '${pet_size}', pet_year = '${pet_year}', 
                pet_nature = '${natured}'`, `id = '${pet_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        return res.status(200).json({ message: 'Pet Update successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/delete_pet", async(req, res)=>{
    try {
        const {pet_id} = req.body;
        if (pet_id == "") return res.status(200).json({ message: 'Pet Id Not Found!', status:false});

        if (await DataDelete(`tbl_pet_detail`, `id = '${pet_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
        
        return res.status(200).json({ message: 'Pet Delete successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





function getfulldate(ndate) {
    let date = new Date(ndate);
    let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
    let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
    let year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

// ============= Sitter Coupon ================ //

router.post("/coupon", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const coupon_data = await DataFind(`SELECT * FROM tbl_coupon WHERE sitter_id = '${sid}' ORDER BY id DESC`);
        let coupon_list = coupon_data.map(val => {
            val.start_date = getfulldate(val.start_date);
            val.end_date = getfulldate(val.end_date);
            return val;
        });
        
        res.status(200).json({ message: 'Data load successful', status:true, coupon_list});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function isValidDateFormat(dateString) {
    let dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateFormatRegex.test(dateString)) {
        if (new Date(dateString) != "Invalid Date") {
            return true;
        }
    }
    return false;
}

router.post("/add_coupon", async(req, res)=>{ 
    try {
        const {sid, title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;

        const missingField = ["sid", "title", "sub_title", "code", "start_date", "end_date", "min_amount", "discount_amount"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});
        
        if (isValidDateFormat(start_date) === false || isValidDateFormat(end_date) === false) {
            return res.status(200).json({ message: 'Invalid Date Format', status:false});
        }

        if (getfulldate(new Date()) <= start_date && start_date < end_date) {
            
            if (await DataInsert(`tbl_coupon`, `sitter_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount`,
                `'${sid}', '${title}', '${sub_title}', '${code}', '${start_date}', '${end_date}', '${min_amount}', '${discount_amount}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            return res.status(200).json({ message: 'Coupon Add successful', status:true});
        } else {
            return res.status(200).json({ message: 'The provided date is past.', status:true});
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/edit_coupon", async(req, res)=>{
    try {
        const {coupon_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;

        const missingField = ["coupon_id", "title", "sub_title", "code", "start_date", "end_date", "min_amount", "discount_amount"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});

        if (isValidDateFormat(start_date) === false || isValidDateFormat(end_date) === false) {
            return res.status(200).json({ message: 'Invalid Date Format', status:false});
        }

        if (getfulldate(new Date()) <= start_date && start_date < end_date) {

            if (await DataUpdate(`tbl_coupon`,
                `title = '${title}', sub_title = '${sub_title}', code = '${code}', start_date = '${start_date}', end_date = '${end_date}', min_amount = '${min_amount}', 
                discount_amount = '${discount_amount}'`, `id = '${coupon_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
            return res.status(200).json({ message: 'Coupon Update successful', status:true});
        } else {
            return res.status(200).json({ message: 'The provided date is past.', status:true});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/delete_coupon", async(req, res)=>{
    try {
        const {coupon_id} = req.body;
        if (coupon_id == "") return res.status(200).json({ message: 'Pet Id Not Found!', status:false});

        if (await DataDelete(`tbl_coupon`, `id = '${coupon_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
        res.status(200).json({ message: 'Coupon Delete successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Sitter About ================ //

router.post("/about", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${sid}'`);
        
        let head_des = [], imglist = [];
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");
            
            aboutheading.forEach((heading, index) => {
                let dataicon = abouticon[index].split("&!");
                let datasub = aboutsubtitle[index].split("&!");
                
                const about = [];
                for (let i = 0; i < dataicon.length;){
                    about.push({ icon: dataicon[i], subtitle: datasub[i] });
                    i++;
                }

                head_des.push({ id: aboutid[index], head: heading, description: aboutdes[index], title: abouttitle[index], about: about });
            });

            const folderPath = path.resolve(__dirname, '../public/uploads/about');
            fs.readdirSync(folderPath).forEach(file => {
                imglist.push({imgpath : "uploads/about/" + file, imgname : file});
            });

            res.status(200).json({ message: 'Data load successful', status:true, head_des, imglist});
        } else {
            res.status(200).json({ message: 'Data load successful', status:true, head_des, imglist});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function aboutimg() {
    const folderPath = path.resolve(__dirname, '../public/uploads/about');
    let imagel = fs.readdirSync(folderPath)[0];
    return imagel;
}

router.post("/add_about", async(req, res)=>{
    try {
        const {sid, head, description, title, list} = req.body;

        const missingField = ["sid", "head", "description", "title", "list"].find(field => !req.body[field]);
        if (missingField) return res.status(200).json({ message: 'Enter All Details', status:false});

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${sid}'`);
        
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            let idlen = parseFloat(aboutid.length) + 1;
            let aid = about_data[0].about_id + '&!' + idlen;

            const aboutheading = about_data[0].heading + '&!' + head;
            const aboutdes = about_data[0].description + '&!' + description;
            const abouttitle = about_data[0].title + '&!' + title;


            let abouticon = about_data[0].icon + '&&!';
            let aboutsubtitle = about_data[0].sub_title + '&&!';

            for (let i = 0; i < list.length;){
                
                if (list[i].icon != "" && list[i].subtitle != "") {

                    let iconp = "", ilist = list[i].icon;
                    if (ilist.includes("uploads/about/") === true) iconp = ilist;
                    else iconp = "uploads/about/" + ilist;

                    let defualticon = iconp == "" ? "uploads/about/" + aboutimg() : iconp;
                    abouticon += i == 0 ? defualticon : '&!' + defualticon;
                    aboutsubtitle += i == 0 ? list[i].subtitle : '&!' + list[i].subtitle;
                }
                i++;
            }
            let esheading = mysql.escape(aboutheading), esdes = mysql.escape(aboutdes), estitle = mysql.escape(abouttitle), essubtitle = mysql.escape(aboutsubtitle);

            if ( await DataUpdate(`tbl_about`,
                `about_id = '${aid}', title = ${estitle}, icon = '${abouticon}', sub_title = ${essubtitle}, heading = ${esheading}, description = ${esdes}`, 
                `sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
            
        } else {
            let aicon = "", asubtitle = "";
            for (let a = 0; a < list.length;){

                if (list[a].icon != "" && list[a].subtitle != "") {

                    let iconp = "", ilist = list[a].icon;
                    if (ilist.includes("uploads/about/") === true) iconp = ilist;  
                    else iconp = "uploads/about/" + ilist;
    
                    let ic = list[a].icon == "" ? "uploads/about/" + aboutimg() : list[a].icon;
                    aicon += a == 0 ? ic : '&!' + ic;
                    asubtitle += a == 0 ? list[a].subtitle : '&!' + list[a].subtitle;
                    
                }
                a++;
            }
                
            let esheading = mysql.escape(head), esdes = mysql.escape(description), estitle = mysql.escape(title), essubtitle = mysql.escape(asubtitle);
                
            if (await DataInsert(`tbl_about`, `sitter_id, about_id, title, icon, sub_title, heading, description`,
                `'${sid}', '1', ${estitle}, '${aicon}', ${essubtitle}, ${esheading}, ${esdes}`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        res.status(200).json({ message: 'About Add successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/edit_about", async(req, res)=>{
    try {
        const {sid, about_id, head, description, title, list} = req.body;
        const missingField = ["sid", "about_id", "head", "description", "title", "list"].find(field => !req.body[field]);
        if (missingField) {
            return res.status(200).json({ message: 'Enter All Details', status:false});
        }
        
        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${sid}'`);
        
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");
            
            if (about_id != "") {
                
                for (let i = 0; i < aboutid.length;){
                    let icon = "", subtitle = "";
                    if (aboutid[i] == about_id) {
                        aboutheading[i] = head;
                        aboutdes[i] = description;
                        abouttitle[i] = title;
                        
                        for (let a = 0; a < list.length;){
                            if (list[a].icon != "" && list[a].subtitle != "") {

                                let iconp = "", ilist = list[a].icon;
                                if (ilist.includes("uploads/about/") === true) iconp = ilist;
                                else iconp = "uploads/about/" + ilist;

                                let ic = iconp == "" ? "uploads/about/" + aboutimg() : iconp;
                                icon += icon == "" ? ic : '&!' + ic;
                                subtitle += subtitle == "" ? list[a].subtitle : '&!' + list[a].subtitle;
                            }
                            a++;
                        }
                        abouticon[i] = icon;
                        aboutsubtitle[i] = subtitle;
                    }
                    i++;
                }
            }
            
            let nid = aboutid.join("&!"), nheading = aboutheading.join("&!"), ndesc = aboutdes.join("&!"), ntitle = abouttitle.join("&!"), nicon = abouticon.join("&&!"), nsubtitle = aboutsubtitle.join("&&!");

            let esheading = mysql.escape(nheading), esdes = mysql.escape(ndesc), estitle = mysql.escape(ntitle), essubtitle = mysql.escape(nsubtitle);
            
            if ( await DataUpdate(`tbl_about`, `about_id = '${nid}', title = ${estitle}, icon = '${nicon}', sub_title = ${essubtitle}, heading = ${esheading}, description = ${esdes}`,
                `sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            return res.status(200).json({ message: 'About Update successful', status:true});
        } else {
            return res.status(200).json({ message: 'Data Not Found!', status:true});   
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/delete_about", async(req, res)=>{
    try {
        const {sid, delete_id} = req.body;
        const missingField = ["sid", "delete_id"].find(field => !req.body[field]);
        if (missingField) {
            return res.status(200).json({ message: 'Enter All Details', status:false});
        }
        
        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE sitter_id = '${sid}'`);
        
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");
            
            for (let a = 0; a < aboutid.length;){
                if (aboutid[a] == delete_id) {
                    aboutid.splice(a, 1);
                    aboutheading.splice(a, 1);
                    aboutdes.splice(a, 1);
                    abouttitle.splice(a, 1);
                    abouticon.splice(a, 1);
                    aboutsubtitle.splice(a, 1);
                }
                a++;
            }
            
            let nid = aboutid.join("&!"), nheading = aboutheading.join("&!"), ndesc = aboutdes.join("&!"), ntitle = abouttitle.join("&!"), nicon = abouticon.join("&&!"), nsubtitle = aboutsubtitle.join("&&!");

            let esheading = mysql.escape(nheading), esdes = mysql.escape(ndesc), estitle = mysql.escape(ntitle), essubtitle = mysql.escape(nsubtitle);
            
            if (await DataUpdate(`tbl_about`, `about_id = '${nid}', title = ${estitle}, icon = '${nicon}', sub_title = ${essubtitle}, heading = ${esheading}, description = ${esdes}`,
                `sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            return res.status(200).json({ message: 'About Delete successful', status:true});
        } else {
            return res.status(200).json({ message: 'Data Not Found!', status:true});   
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Sitter FAQ ================ //

router.post("/faq", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const faq_data = await DataFind(`SELECT * FROM tbl_sitter_faq WHERE sitter_id = '${sid}'`);
        
        res.status(200).json({ message: 'Data load successful', status:true, faq_data});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_faq", async(req, res)=>{
    try {
        const {sid, title, description} = req.body;
        if (sid == "" || title == "" || description == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);

        if (await DataInsert(`tbl_sitter_faq`, `sitter_id, title, description`, `'${sid}', ${faq_faq_title}, ${faq_faq_des}`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        res.status(200).json({ message: 'FAQ Add successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/edit_faq", async(req, res)=>{
    try {
        const {sid, faq_id, title, description} = req.body;
        if (sid == "" || faq_id == "" || title == "" || description == "") return res.status(200).json({ message: 'Data Not Found!', status:false});
            
        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);
    
        if (await DataUpdate(`tbl_sitter_faq`, `title = ${faq_faq_title}, description = ${faq_faq_des}`, `id = '${faq_id}' AND sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
        
        res.status(200).json({ message: 'FAQ Update successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/delete_faq", async(req, res)=>{
    try {
        const {sid, faq_id} = req.body;
        if (sid == "" || faq_id == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        if (await DataDelete(`tbl_sitter_faq`, `id = '${faq_id}' AND sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
        
        res.status(200).json({ message: 'FAQ Delete successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Sitter Time Management ================ //

router.post("/time", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        let day_list = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        
        const general_setting = await DataFind(`SELECT sitter_time FROM tbl_general_settings`);
        let general_time = general_setting[0].sitter_time.split(",");
        
        const setting = await DataFind(`SELECT sitter_time FROM tbl_sitter_setting where sitter_id = '${sid}'`);

        let select_time = [];
        if (setting != "") {
            select_time = setting[0].sitter_time == null ? '0' : setting[0].sitter_time.split(",");
        }

        let all_date = [];
        for (let i = 0; i < day_list.length;) {
            
            let date_time = await DataFind(`SELECT * FROM tbl_date_time where day = '${day_list[i]}'`);

            let adate = [];
            for (let a = 0; a < date_time.length;) {
                let oned = date_time[a];

                let did = (oned.id).toString();

                if (general_time.includes(did) === true) {

                    if (select_time.includes(did) === true) {
                        adate.push({ id:oned.id, day:oned.day, time:oned.time, gcheck:1, selected: 1 });
                    } else {
                        adate.push({ id:oned.id, day:oned.day, time:oned.time, gcheck:1, selected: 0 });
                    }
                } else {
                    adate.push({ id:oned.id, day:oned.day, time:oned.time, gcheck:0, selected: 0 });
                }
                a++;
            }
            all_date.push({ day: day_list[i], adate });
            i++;
        }
        
        res.status(200).json({ message: 'Data load successful', status:true, all_date});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_time", async(req, res)=>{
    try {
        const {sid, added_id, removed_id} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        const setting = await DataFind(`SELECT sitter_time FROM tbl_sitter_setting where sitter_id = '${sid}'`);

        let select_time = [];
        if (setting != "") {
            select_time = setting[0].sitter_time == null ? '0' : setting[0].sitter_time.split(",");
        }

        let add = [];
        added_id.map(rval => {
            let rid = (rval).toString();
            if (select_time.includes(rid) === false) {
                add.push(rid);
            }
        });

        let remove = [];
        removed_id.map(rval => {
            let rid = (rval).toString();
            if (select_time.includes(rid) === true) {
                remove.push(rid);
            }
        });

        let filter = select_time.filter(id => !remove.includes(id));
        let data_add = filter.concat(add);

        let sortdate = data_add.sort((a, b) => a - b);
         
        let join_data = sortdate.join(",");

        if (setting == "") {
            if (await DataInsert(`tbl_sitter_setting`, `sitter_id, extra_pet_charge, sitter_time`, `'${sid}', '0', '${join_data}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        } else {

            if (await DataUpdate(`tbl_sitter_setting`, `itter_time = '${join_data}'`, `sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        res.status(200).json({ message: 'Time Update successful', status:true});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Sitter Setting ================ //

router.post("/setting", async(req, res)=>{
    try {
        const {sid, extra_pet_charge} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});
        
        let setting;
        if (extra_pet_charge == "") {
            setting = await DataFind(`SELECT extra_pet_charge FROM tbl_sitter_setting where sitter_id = '${sid}'`);
            
        } else {
            let check = await DataFind(`SELECT extra_pet_charge FROM tbl_sitter_setting where sitter_id = '${sid}'`);

            if (check == "") {

                if (await DataInsert(`tbl_sitter_setting`, `sitter_id, extra_pet_charge`, `'${sid}', '${extra_pet_charge}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            } else {

                if (await DataUpdate(`tbl_sitter_setting`, `extra_pet_charge = '${extra_pet_charge}'`, `sitter_id = '${sid}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            }
            setting = await DataFind(`SELECT extra_pet_charge FROM tbl_sitter_setting where sitter_id = '${sid}'`);
        }
        res.status(200).json({ message: 'Data load successful', status:true, charge:setting[0]});
    } catch (error) {
        console.log(error);
    }
});





// ============= Sitter Wallet ================ //

router.post("/wallet", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});
        
        const admin_data = await DataFind(`SELECT id, country_code, phone FROM tbl_admin WHERE id = '${sid}'`);
        
        const sitter_wallet = await DataFind(`SELECT wallet FROM tbl_sitter WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}' `);
        const general_setting = await DataFind(`SELECT s_min_withdraw FROM tbl_general_settings`);
        
        const swallet_data = await DataFind(`SELECT * FROM tbl_wallet_withdraw WHERE sitter_id = '${sid}' ORDER BY id DESC`);
        
        res.status(200).json({ message: 'Data load successful', status:true, totwallet:sitter_wallet[0].wallet, min_withdraw:Number(general_setting[0].s_min_withdraw), swallet_data});
    } catch (error) {
        console.log(error);
    }
});

router.post("/add_withdraw", async(req, res)=>{
    try {
        const { sid, Withdraw_amount, payment_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type } = req.body;
        if (sid == "" || Withdraw_amount == "" || payment_type == "") return res.status(200).json({ message: 'Data Not Found!', status:false});
        
        const admin_data = await DataFind(`SELECT id, country_code, phone FROM tbl_admin WHERE id = '${sid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'User Not Found!', status:false});

        const sitter_wallet = await DataFind(`SELECT id, wallet FROM tbl_sitter WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}' `);
        const general_setting = await DataFind(`SELECT s_min_withdraw FROM tbl_general_settings`);

        if ( parseFloat(sitter_wallet[0].wallet) >= parseFloat(general_setting[0].s_min_withdraw)) {

            if (parseFloat(Withdraw_amount) >= parseFloat(general_setting[0].s_min_withdraw) && parseFloat(Withdraw_amount) <= parseFloat(sitter_wallet[0].wallet)) {
                let check = 0;
                if (payment_type == "UPI") {
                    if (upi_id == "") return res.status(200).json({ message: 'Data Not Found!', status:false});
                    check = 1;

                    if (await DataInsert(`tbl_wallet_withdraw`, `image, sitter_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${sid}', '${getfulldate(new Date())}', '${Withdraw_amount}', '1', '0', '${upi_id}', '', '', '', ''`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ message: process.env.dataerror, status:false });
                    }
                    
                } else if (payment_type == "Paypal") {
                    if (paypal_id == "") return res.status(200).json({ message: 'Data Not Found!', status:false});
                    check = 1;

                    if (await DataInsert(`tbl_wallet_withdraw`, `image, sitter_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${sid}', '${getfulldate(new Date())}', '${Withdraw_amount}', '2', '0', '', '${paypal_id}', '', '', ''`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ message: process.env.dataerror, status:false });
                    }
                                    
                } else if (payment_type == "BANK Transfer") {
                    if (bank_no == "" || bank_ifsc == "" || bank_type == "") return res.status(200).json({ message: 'Data Not Found!', status:false});
                    check = 1;

                    if (await DataInsert(`tbl_wallet_withdraw`, `image, sitter_id, date, amount, p_type, status, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${sid}', '${getfulldate(new Date())}', '${Withdraw_amount}', '3', '0', '', '', '${bank_no}', '${bank_ifsc}', '${bank_type}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ message: process.env.dataerror, status:false });
                    }
                }

                if (check == "1") {
                    let total = parseFloat(sitter_wallet[0].wallet) - parseFloat(Withdraw_amount);
                    if (await DataUpdate(`tbl_sitter`, `wallet = '${total}'`, `id = '${sitter_wallet[0].id}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ message: process.env.dataerror, status:false });
                    }
                }

                return res.status(200).json({ message: 'Wallet Withdraw Request Add Successfully', status:true});
            }
            return res.status(200).json({ message: 'Amount Not Withdrawn Form Wallet', status:false});
        } else {
            return res.status(200).json({ message: 'Amount Not Withdrawn Form Wallet', status:false});
        }
    } catch (error) {
        console.log(error);
    }
});





// ============= Sitter Book Services ================ //

router.post("/book_service", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        let pending_order = await DataFind(`SELECT ord.id, ord.order_id, ord.date, ord.tot_price, ord.status, ord.site_commisiion, ord.reject_reason, ord.date_status,
                                                COALESCE(tsa.name, '') as sname,  COALESCE(sitt.name, '') AS customer_name,   COALESCE(ser.service_type, '') AS sub_sname, 
                                                COALESCE(servi.name, '') as service_name,  COALESCE(cad.address, '') as caddress
                                                FROM tbl_order AS ord
                                                LEFT JOIN tbl_status_list AS tsa ON ord.status = tsa.id
                                                LEFT JOIN tbl_admin AS sadmin ON ord.customer_id = sadmin.id
                                                LEFT JOIN tbl_customer AS sitt ON sadmin.country_code = sitt.country_code AND sadmin.phone = sitt.phone
                                                LEFT JOIN tbl_sitter_services AS ser ON ord.subservice_id = ser.id
                                                LEFT JOIN tbl_services AS servi ON ord.service_id = servi.id
                                                LEFT JOIN tbl_customer_address AS cad ON ord.address = cad.id
                                                WHERE ord.sitter_id = '${sid}' AND ord.status IN ('${Status[0].id}', '${Status[1].id}', '${Status[3].id}', '${Status[4].id}') 
                                                ORDER BY ord.id DESC`);

        pending_order.map(oval => {
            oval.tot_price = (parseFloat(oval.tot_price) - parseFloat(oval.site_commisiion)).toFixed(2);
            return oval;
        });

        let past_order = await DataFind(`SELECT ord.id, ord.order_id, ord.date, ord.tot_price, ord.status, ord.site_commisiion, ord.reject_reason, ord.date_status,
                                                COALESCE(tsa.name, '') as sname,  COALESCE(sitt.name, '') AS customer_name,   COALESCE(ser.service_type, '') AS sub_sname, 
                                                COALESCE(servi.name, '') as service_name,  COALESCE(cad.address, '') as caddress
                                                FROM tbl_order AS ord
                                                LEFT JOIN tbl_status_list AS tsa ON ord.status = tsa.id
                                                LEFT JOIN tbl_admin AS sadmin ON ord.customer_id = sadmin.id
                                                LEFT JOIN tbl_customer AS sitt ON sadmin.country_code = sitt.country_code AND sadmin.phone = sitt.phone
                                                LEFT JOIN tbl_sitter_services AS ser ON ord.subservice_id = ser.id
                                                LEFT JOIN tbl_services AS servi ON ord.service_id = servi.id
                                                LEFT JOIN tbl_customer_address AS cad ON ord.address = cad.id
                                                WHERE ord.sitter_id = '${sid}' AND ord.status NOT IN ('${Status[0].id}', '${Status[1].id}', '${Status[3].id}', '${Status[4].id}') 
                                                ORDER BY ord.id DESC`);

        past_order.map(oval => {
            oval.tot_price = (parseFloat(oval.tot_price) - parseFloat(oval.site_commisiion)).toFixed(2);
            return oval;
        });

        res.status(200).json({ message: 'Data load successful', status:true, pending_order, past_order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function getfulltime() {
    let date = new Date();
    let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
    let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
    let year = date.getFullYear();
    let hours = (date.getHours() % 12 || 12);
    let minutes = (date.getMinutes() < 10 ? '0'+date.getMinutes() : date.getMinutes());
    let ampm = (date.getHours() >= 12) ? 'PM' : 'AM';
    return `${year}-${month}-${day} | ${hours}:${minutes} ${ampm}`;
}

async function sendnotification(oid, cid, sid, status, hostname, protocol) {
    return await DataInsert(`tbl_notification`, `order_id, c_id, s_id, date, status`, `'${oid}', '${cid}', '${sid}', '${getfulltime()}', '${status}'`, hostname, protocol);
}

router.post("/approved", async(req, res)=>{
    try {
        const {order_id} = req.body;
        if (order_id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);
        await DataUpdate(`tbl_order`, `status = '${Status[1].id}', date_status = '1'`, `id = '${order_id}'`);

        const order_data = await DataFind(`SELECT id, customer_id, sitter_id FROM tbl_order WHERE id = '${order_id}'`);
        
        // Notification
        if (sendnotification(order_data[0].id, order_data[0].customer_id, order_data[0].sitter_id, Status[1].id, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        // OneSignal
        sendOneNotification(Status[1].notifi_text, 'customer', order_data[0].customer_id);

        res.status(200).json({ message: 'Service Approved successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/unapproved", async(req, res)=>{
    try {
        const {order_id, cancel_reason} = req.body;
        if (order_id == "" || cancel_reason == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.sitter_id, ord.date_time, ord.status, ord.reject_reason, ord.complete_date, ord.uncomplete_date, ord.un_check, 
                                        COALESCE(ser.price, '0') as sprice, 
                                        COALESCE(cus.id, '') as cid, COALESCE(cus.tot_balance, '') as cbalance
                                        FROM tbl_order as ord
                                        LEFT JOIN tbl_sitter_services as ser ON ord.subservice_id = ser.id
                                        LEFT JOIN tbl_admin as adm ON ord.customer_id = adm.id
                                        LEFT JOIN tbl_customer as cus ON adm.country_code = cus.country_code AND adm.phone = cus.phone
                                        WHERE ord.id = '${order_id}'`);

        if (unorder == "") return res.status(200).json({ message: 'Service Not Found!', status:false});

        if (unorder[0].status == "1" && unorder[0].reject_reason == "") {

            let untotal = "", twallet = 0;
            let tdate = unorder[0].date_time.split("&!");
            for (let i = 0; i < tdate.length;){
                let check = tdate[i].split("&")[1].split(",");

                for (let a = 0; a < check.length;) {
                    if (typeof untotal == "string") {
                        untotal = parseFloat(unorder[0].sprice);
                    } else {
                        untotal += parseFloat(unorder[0].sprice);
                    }
                    a++;
                }
                i++;
            }
            
            if (untotal != "") {
                twallet += parseFloat(unorder[0].cbalance) + parseFloat(untotal);

                if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }

                if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                    `'${unorder[0].customer_id}', '${untotal}', '${getfulldate(new Date())}', '0', '1', '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            }
    
            const oreason = mysql.escape(cancel_reason);
            if (await DataUpdate(`tbl_order`, `status = '${Status[2].id}', reject_reason = ${oreason}`, `id = '${order_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
    
            // Notification
            if (sendnotification(unorder[0].id, unorder[0].customer_id, unorder[0].sitter_id, Status[2].id, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
    
            // OneSignal
            sendOneNotification(Status[2].notifi_text, 'customer', unorder[0].customer_id);
        }

        res.status(200).json({ message: 'Service UnApproved successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/send_otp", async(req, res)=>{
    try {
        const {id} = req.body;
        if (id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const service_otp = await DataFind(`SELECT date_time, otp_data, start_time, end_time, checked_date, current_check, complete_date, uncomplete_date FROM tbl_order WHERE id = '${id}'`);

        let date_data = service_otp[0].date_time.split('&!');

        let date = new Date();
        let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
        let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
        let year = date.getFullYear();
        let fulldate = `${year}-${month}-${day}`;

        let checked_date = [], current_check = "", current_id = [], undate = [];
        
        if (!service_otp[0].checked_date || service_otp[0].checked_date != "") {

            let check_first = 0, uncheckid = [];

            let che_date = service_otp[0].checked_date.split('&&!');

            let udata = service_otp[0].uncomplete_date;

            if (service_otp[0].current_check == "") {
                
                for (let a = 0; a < che_date.length;){
                    let cdate = che_date[a].split("&!");
    
                    if (fulldate <= cdate[0]) {
                        if (check_first == 0) {
                            current_check = che_date[a];
                            current_id = cdate[1].split("&");
                            check_first = 1;
                        } else {
    
                            checked_date.push(che_date[a]);
                        }
                    } else {
                            
                        if (udata == "" || udata === null) {
                            let uspl = cdate[1].split("&");
                            uncheckid = uncheckid == "" ? uspl : uncheckid.concat(uspl);
                            
                        } else {
                            let oldundate = udata.split(",");
                            let newundata = oldundate.concat(cdate[1].split("&"));
                            
                            uncheckid = uncheckid == "" ? newundata : uncheckid.concat(newundata);
                        }
                    }
                    a++;
                }
                
                if (udata == "" || udata === null) {
                    undate = uncheckid;
                } else {
                    let oid = udata.split(",");
                    undate = uncheckid == "" ? oid : oid.concat(uncheckid);
                }
                
                if (await DataUpdate(`tbl_order`, `checked_date = '${checked_date.join('&&!')}', current_check = '${current_check}', uncomplete_date = '${undate.join(",")}'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
                
            } else {
                let current = service_otp[0].current_check.split("&!");
                let old_un = service_otp[0].uncomplete_date;
                
                if (fulldate <= current[0]) {
                    
                    current_id = current[1].split("&");
                    undate = old_un.split(",");
                    
                } else {
                    
                    if (old_un != "") {
                        let old = old_un.split(",");
                        undate = old.concat(current[1].split("&"));
                    } else {
                        undate = current[1].split("&");
                    }
                    
                    if (che_date != "") {
                        for (let c = 0; c < che_date.length;){
                            let cdate = che_date[c].split("&!");
            
                            if (fulldate <= cdate[0]) {
                                if (check_first == 0) {
                                    current_check = che_date[c];
                                    current_id = cdate[1].split("&");
                                    check_first = 1;
                                } else {
            
                                    checked_date.push(che_date[c]);
                                }
                            } else {
            
                                let udata = service_otp[0].uncomplete_date;
                                if (udata == "" || udata === null) {
                                    
                                    let uspl = cdate[1].split("&");
                                    undate = undate.concat(uspl);
                                    
                                } else {   
                                    let newundata = cdate[1].split("&");
                                    undate = undate.concat(newundata);
                                }
                            }
                            c++;
                        }
                    }

                    if (await DataUpdate(`tbl_order`, `checked_date = '${checked_date.join('&&!')}', current_check = '${current_check}', uncomplete_date = '${undate.join(",")}'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ message: process.env.dataerror, status:false });
                    }
                }
            }
        }
        
        let complete_time = service_otp[0].complete_date;
        let cutime = [];
        if (complete_time != "" || complete_time != undefined) {
            cutime = complete_time.split(",");
        }

        let all_date = [];
        for (let i = 0; i < date_data.length;){
            let dtime = date_data[i].split("&");
            const date_time = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${dtime[1]})`);

            let check_date = [];
            for (let b = 0; b < date_time.length;) {
                let chid = (date_time[b].id).toString();

                if (undate.includes(chid) === true) {
                    check_date.push({ ...date_time[b], status: '3' });
                } else if (current_id.includes(chid) === true) {
                    check_date.push({ ...date_time[b], status: '2' });
                } else if (cutime.includes(chid) === true) {
                    check_date.push({ ...date_time[b], status: '1' });
                } else {
                    check_date.push({ ...date_time[b], status: '0' });
                }
                b++;
            }

            let onefulldate = {
                date : dtime[0],
                times : check_date
            };
            all_date.push(onefulldate);
            i++;
        }

        if (current_id == "") {

            const Status = await DataFind(`SELECT * FROM tbl_status_list`);

            const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.complete_date, ord.uncomplete_date, ord.un_check, ser.price as sprice, 
                                            cus.id as cid, cus.tot_balance as cbalance
                                            FROM tbl_order as ord
                                            JOIN tbl_sitter_services as ser ON ord.subservice_id = ser.id
                                            JOIN tbl_admin as adm ON ord.customer_id = adm.id
                                            JOIN tbl_customer as cus ON adm.country_code = cus.country_code AND adm.phone = cus.phone
                                            WHERE ord.id = '${id}'`);
            
            let untotal = "";
            if (unorder[0].uncomplete_date != "") {
                
                let unid = unorder[0].uncomplete_date.split(',');
                let undate = unorder[0].un_check != "" ? unorder[0].un_check.split(',') : '';
    
                unid.map(udata => {
                    if (undate != "") {
                        if (undate.includes(udata) === false) {
                            if (untotal == "") {
                                untotal = parseFloat(unorder[0].sprice);
                            } else {
                                untotal += parseFloat(unorder[0].sprice);
                            }
                        }
                    } 
                    if (undate == "") {
                        if (untotal == "") {
                            untotal = parseFloat(unorder[0].sprice);
                        } else {
                            untotal += parseFloat(unorder[0].sprice);
                        }
                    }
                });

                let twallet = parseFloat(unorder[0].cbalance) + parseFloat(untotal);

                if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }

                if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                    `'${unorder[0].customer_id}', '${untotal}', '${getfulldate(new Date())}', '0', '1', '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            }

            if (unorder[0].complete_date != "") {
                if (await DataUpdate(`tbl_order`, `status = '${Status[5].id}', diff_amount = '${untotal}', otp_data = '', date_status = '0'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
                
            } else {
                if (await DataUpdate(`tbl_order`, `status = '${Status[2].id}', diff_amount = '${untotal}', reject_reason = 'Service Not Attending', otp_data = '', date_status = '0'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                }
            }

            return res.status(200).json({ message: 'Service End', status:false });
        }

        if (service_otp[0].otp_data == "" && current_id != "") {
            
            let otp_result = '';
            let characters = '0123456789';
            let charactersLength = characters.length;
            for (let i = 0; i < 6; i++) {
                otp_result += characters.charAt(Math.floor(Math.random() * charactersLength));
            }

            if (await DataUpdate(`tbl_order`, `otp_data = '${otp_result}'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
            return res.status(200).json({ message: 'Service Otp Send successful', status:true, otp:otp_result, all_date });
            
        } else {
            return res.status(200).json({ message: 'Service Otp Send successful', status:true, otp:service_otp[0].otp_data, all_date });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Service start and end 
async function sendChat({cus, sitter, onetime, sname, onedate, message, hostname}) {

    const dt = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${onetime})`);

    let mess = `⏰ The ${sname} ${message} at `;
    dt.map((d, i) => {
        if (i == "0") mess += `${d.time}`;
        else mess += ` & ${d.time}`;
    });
    mess += `, ${onedate}`;

    const chat_check = await DataFind(`SELECT * FROM tbl_chat 
                                        WHERE (sender_id = '${sitter}' AND resiver_id = '${cus}') OR (sender_id = '${cus}' AND resiver_id = '${sitter}') 
                                        ORDER BY id DESC LIMIT 1 `);

    let fdate = new Date().toISOString(), messa = "";
    if (chat_check == "") {

        const sitterg = await DataFind(`SELECT defaultm FROM tbl_sitter_setting WHERE sitter_id = '${sitter}'`);
        if (sitterg != "") {
            if(sitterg[0].defaultm != null || sitterg[0].defaultm != undefined || sitterg[0].defaultm != "") {
                messa = sitterg[0].defaultm;

                if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sitter}', '${cus}', '${fdate}', '${sitterg[0].defaultm}'`, hostname, protocol) == -1) return -1;
            }
        } else {
            messa = "Hello 👋";

            if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sitter}', '${cus}', '${fdate}', '${messa}'`, hostname, protocol) == -1) return -1;
        }
        if(messa != "") sendOneNotification(messa, 'customer', cus);

        let sdate = new Date().toISOString();

        if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sitter}', '${cus}', '${sdate}', '${mess}'`, hostname, protocol) == -1) return -1;
    } else {

        if (await DataInsert(`tbl_chat`, `sender_id, resiver_id, date, message`, `'${sitter}', '${cus}', '${fdate}', '${mess}'`, hostname, protocol) == -1) return -1;
    }
    sendOneNotification(mess, 'customer', cus);
    return;
}

router.post("/service_start", async(req, res)=>{
    try {
        const {id, entered_otp} = req.body;
        if (id == "" || entered_otp == "") return res.status(200).json({ message: 'Data Not Found!', status:false});

        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        const order_data = await DataFind(`SELECT ord.id, ord.customer_id, ord.sitter_id, ord.otp_data, ord.start_time, ord.current_check,
                                            COALESCE(servi.name, "") as sname
                                            FROM tbl_order as ord
                                            LEFT JOIN tbl_services AS servi ON ord.service_id = servi.id
                                            WHERE ord.id = '${id}'`);

        if (order_data == "") return res.status(200).json({ message: 'Service Not Found!', status:false }); 

        if (order_data[0].otp_data != entered_otp) return res.status(200).json({ message: 'Please Enter Correct OTP!', status:false }); 

        let curr_data = order_data[0].current_check;
        if (curr_data == "") {
            return res.status(200).json({ message: 'Please Send Otp!', status:false }); 
        }

        let onedate = curr_data.split("&!");
        let onetime = onedate[1].split('&');

        let fulldate;
        if (order_data[0].start_time == "" || order_data[0].start_time == null) {
            fulldate = `${onetime[0]}&` + getfulltime();
        } else {
            fulldate = order_data[0].start_time + `&!${onetime[0]}&` + getfulltime();
        }

        if (await DataUpdate(`tbl_order`, `status = '${Status[3].id}', otp_data = '', start_time = '${fulldate}', date_status = '2'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        // Send Chat Start Service
        if (await sendChat({cus:order_data[0].customer_id, sitter:order_data[0].sitter_id, onetime, sname:order_data[0].sname, onedate:onedate[0], message:"started", hostname:req.hostname, protocol:req.protocol}) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }
        
        // Notification
        if (sendnotification(order_data[0].id, order_data[0].customer_id, order_data[0].sitter_id, Status[3].id, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status:false });
        }

        // OneSignal
        sendOneNotification(Status[3].notifi_text, 'customer', order_data[0].customer_id);

        return res.status(200).json({ message: 'Service Start successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/service_end", async(req, res)=>{
    try {
        const {id, entered_otp} = req.body;
        if (id == "" || entered_otp == "") return res.status(200).json({ message: 'Data Not Found!', status:false});
        
        const Status = await DataFind(`SELECT * FROM tbl_status_list`);

        const order_data = await DataFind(`SELECT ord.id, ord.customer_id, ord.sitter_id, ord.sitter_commission, ord.otp_data, ord.end_time, ord.checked_date, ord.start_time, 
                                            ord.current_check, ord.complete_date,
                                            COALESCE(servi.name, "") as sname
                                            FROM tbl_order as ord
                                            LEFT JOIN tbl_services AS servi ON ord.service_id = servi.id
                                            WHERE ord.id = '${id}'`);
        
        if (order_data == "") return res.status(200).json({ message: 'Service Not Found!', status:false });

        if (order_data[0].otp_data != entered_otp) return res.status(200).json({ message: 'Please Enter Correct OTP!', status: false });

        let curr_data = order_data[0].current_check;
        if (curr_data == "") {
            return res.status(200).json({ message: 'Please Send Otp!', status:false }); 
        }

        let onedate = curr_data.split("&!");
        let onetime = onedate[1].split('&');
        let time = onetime[onetime.length - 1];

        let fulldate;
        if (order_data[0].end_time == "" || order_data[0].end_time == null) {
            fulldate = `${time}&` + getfulltime();
        } else {
            fulldate = order_data[0].end_time + `&!${time}&` + getfulltime();
        }
        
        let complete = order_data[0].complete_date != "" ? order_data[0].complete_date.split(",") : "";
        let com_id = complete == "" || complete == null ? onetime : complete + ',' + onetime;
        
        if (order_data[0].checked_date == "") {

            const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.complete_date, ord.uncomplete_date, ord.un_check, ser.price as sprice, cus.id as cid, cus.tot_balance as cbalance
                                            FROM tbl_order as ord
                                            JOIN tbl_sitter_services as ser ON ord.subservice_id = ser.id
                                            JOIN tbl_admin as adm ON ord.customer_id = adm.id
                                            JOIN tbl_customer as cus ON adm.country_code = cus.country_code AND adm.phone = cus.phone
                                            WHERE ord.id = '${id}'`);
            
            let untotal = "", undate = "", twallet = 0;
            if (unorder[0].uncomplete_date != "") {
                undate = unorder[0].un_check != "" || unorder[0].un_check != null ? unorder[0].un_check.split(',') : '';

                let unid = unorder[0].uncomplete_date.split(',');
                unid.map(udata => {
                    if (undate != "") {
                        if (undate.includes(udata) === false) {
                            if (untotal == "") {
                                untotal = parseFloat(unorder[0].sprice);
                            } else {
                                untotal += parseFloat(unorder[0].sprice);
                            }
                        }
                    } 
                    if (undate == "") {
                        if (untotal == "") {
                            untotal = parseFloat(unorder[0].sprice);
                        } else {
                            untotal += parseFloat(unorder[0].sprice);
                        }
                    }
                });

                twallet += parseFloat(unorder[0].cbalance) + parseFloat(untotal);
            }
            
            const c_tot_order = await DataFind(`SELECT COUNT(*) as tot_order FROM tbl_order WHERE customer_id = '${order_data[0].customer_id}'`);
            
            if (twallet != "0") {
                if (c_tot_order[0].tot_order == "1") {
                    twallet += parseFloat(req.general.signup_credit);
                }

                if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status:false });
                } else {
                    await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                        `'${unorder[0].customer_id}', '${untotal}', '${getfulldate(new Date())}', '0', '1', '${unorder[0].id}'`, req.hostname, req.protocol);
                }
            }
            
            const admin_data = await DataFind(`SELECT id, country_code, phone FROM tbl_admin WHERE id = '${order_data[0].sitter_id}'`);
            const sitter_wallet = await DataFind(`SELECT id, wallet FROM tbl_sitter WHERE country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}' `);
            
            let tot_wallet = parseFloat(sitter_wallet[0].wallet) + parseFloat(order_data[0].sitter_commission);

            if (await DataUpdate(`tbl_sitter`, `wallet = '${tot_wallet.toFixed(2)}'`, `id = '${sitter_wallet[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            if (await DataUpdate(`tbl_order`,
                `status = '${Status[5].id}', diff_amount = '${untotal}', otp_data = '', end_time = '${fulldate}', current_check = '', complete_date = '${com_id}', un_check = '${unorder[0].uncomplete_date}', date_status = '0'`,
                `id = '${id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            // Send Chat Ended Service
            if (await sendChat({cus:order_data[0].customer_id, sitter:order_data[0].sitter_id, onetime, sname:order_data[0].sname, onedate:onedate[0], message:"ended", hostname:req.hostname, protocol:req.protocol}) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            // Notification
            if (sendnotification(order_data[0].id, order_data[0].customer_id, order_data[0].sitter_id, Status[5].id, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            // OneSignal
            sendOneNotification(Status[5].notifi_text, 'customer', order_data[0].customer_id);

        } else {

            if (await DataUpdate(`tbl_order`,
                `status = '${Status[4].id}', otp_data = '', end_time = '${fulldate}', current_check = '', date_status = '1', complete_date = '${com_id}'`,
                `id = '${id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            // Send Chat Ended Service
            if (await sendChat({cus:order_data[0].customer_id, sitter:order_data[0].sitter_id, onetime, sname:order_data[0].sname, onedate:onedate[0], message:"ended", hostname:req.hostname, protocol:req.protocol}) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            // Notification
            if (sendnotification(order_data[0].id, order_data[0].customer_id, order_data[0].sitter_id, Status[4].id, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

            // OneSignal
            sendOneNotification(Status[4].notifi_text, 'customer', order_data[0].customer_id);
        }

        return res.status(200).json({ message: 'Service End successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/proof_list", async(req, res)=>{
    try {
        const {id} = req.body;
        if (id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const proof_data = await DataFind(`SELECT * FROM tbl_service_proof WHERE order_id = '${id}' ORDER BY id DESC`);

        let all_proof = [];
        if (proof_data != "") {
            let aproof = proof_data[0].proof_data.split("&!/");
    
            for (let i = 0; i < aproof.length;){
                let pro_date = aproof[i].split('&/');
                let pro_title = pro_date[1].split('!/');
                let pro_image = pro_title[1].split('::/');
    
                all_proof.push({ date: pro_date[0], title: pro_title[0], image: pro_image });
                i++;
            }
        }

        return res.status(200).json({ message: 'Service End successful', status:true, all_proof });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_proof", proof.array('image'), async(req, res)=>{
    try {
        const {id, title} = req.body;
        if (id == "" || title == "") return res.status(200).json({ message: 'Detail Not Found!', status:false});

        const proof_data = await DataFind(`SELECT * FROM tbl_service_proof WHERE order_id = '${id}'`);

        let images;
        if (req.files) {
            images = req.files.map(img => {
                return 'uploads/service proof/' + img.filename;
            });
        } else {
            return res.status(200).json({ message: 'Image Not Found!', status:false});
        }

        let allimage = images.join("::/");

        let full_data;
        if (proof_data == "") {
            full_data = `${getfulltime()}&/${title}!/${allimage}`;
            const edata = mysql.escape(full_data);

            if (await DataInsert(`tbl_service_proof`, `order_id, proof_data`, `'${id}', ${edata}`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }

        } else {
            full_data = proof_data[0].proof_data + `&!/${getfulltime()}&/${title}!/${allimage}`;
            const edatas = mysql.escape(full_data);
            
            if (await DataUpdate(`tbl_service_proof`, `proof_data = ${edatas}`, `id = '${proof_data[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
        }

        const order_data = await DataFind(`SELECT ord.customer_id, COALESCE(pd.name, "") as pname, COALESCE(adm.name, "") as sname
                                            FROM tbl_order AS ord
                                            LEFT JOIN tbl_pet_detail AS pd ON ord.pet = pd.id
                                            LEFT JOIN tbl_admin AS adm ON ord.sitter_id = adm.id
                                            where ord.id = '${id}'`);

        // OneSignal
        let ndata = `Good news! ${order_data[0].sname} has just uploaded a new report card for ${order_data[0].pname}. You can now review the latest update on how ${order_data[0].pname} is doing, including their activities, behavior, and any other important notes. To view the report card, simply log into your account and check the "Booking Details" section. Thank you for choosing our service!`;

        sendOneNotification(ndata, 'customer', order_data[0].customer_id);
        
        return res.status(200).json({ message: 'Service Proof Add successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



function splitDate(dateString) {
		return dateString ? dateString.split(',') : '';
}

router.post("/service_details", async(req, res)=>{
    try {
        const {id} = req.body;
        if (id == "") return res.status(200).json({ message: 'Id Not Found!', status:false});
        
        const order_detail = await DataFind(`SELECT ord.*,
                                                sta.name as order_status,
                                                sitt.name AS sitter_name, sitt.logo as sitter_logo,
                                                ser.service_type AS sub_sname, ser.price as service_price, ser.price_type AS price_type,
                                                servi.name as service_name,
                                                ssetting.extra_pet_charge as ex_pet_charge
                                                FROM tbl_order AS ord
                                                JOIN tbl_status_list AS sta ON ord.status = sta.id
                                                JOIN tbl_admin AS sadmin ON ord.sitter_id = sadmin.id
                                                JOIN tbl_sitter AS sitt ON sadmin.country_code = sitt.country_code AND sadmin.phone = sitt.phone
                                                JOIN tbl_sitter_services AS ser ON ord.subservice_id = ser.id
                                                JOIN tbl_services AS servi ON ord.service_id = servi.id
                                                JOIN tbl_sitter_setting ssetting ON ord.sitter_id = ssetting.sitter_id
                                                WHERE ord.id = '${id}'`);


        if (order_detail == "") return res.status(200).json({ message: 'Service Not Found!', status:false});

        let online_payment = "" , online_amount = "", wallet_payment = "", wallet_amount = "", payment_detail;

        let aorderd = order_detail[0];

        aorderd.tot_price = (parseFloat(aorderd.tot_price) - parseFloat(aorderd.site_commisiion)).toFixed(2);
        
        if (aorderd.payment_type != "0" && aorderd.wallet_type != "0") {

            payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '${aorderd.payment_type}'`);

            let wamount = parseFloat(aorderd.tot_price) - parseFloat(aorderd.wallet_amount);
            online_payment = payment_detail[0].name;
            online_amount = wamount.toFixed(2);

            wallet_payment = "1";
            wallet_amount = aorderd.wallet_amount;
            
        } else if (aorderd.wallet_type == "0") {
            
            payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '${aorderd.payment_type}'`);

            online_payment = payment_detail[0].name;
            online_amount = aorderd.tot_price;

            wallet_payment = "0";
            wallet_amount = aorderd.wallet_amount;

        } else if (aorderd.payment_type == "0") {

            online_payment = "0";
            online_amount = "0";

            wallet_payment = "1";
            wallet_amount = aorderd.wallet_amount;
        }
        
        const Address_data = await DataFind(`SELECT house_no, address, landmark, address_as, country_code, phone, google_address, instruction FROM tbl_customer_address WHERE id = '${aorderd.address}'`);
        
        const pet_data = await DataFind(`SELECT id, image, name FROM tbl_pet_detail WHERE id IN (${aorderd.pet})`);
        
        let full_date = aorderd.date_time.split("&!");

        let cstart = aorderd.start_time;
        let start = cstart == '' ? '' : cstart.split('&!');

        let cend = aorderd.end_time;
        let end = cend == '' ? '' : cend.split('&!');

        let current = [];
        if (aorderd.current_check != "") {
            current = aorderd.current_check.split("&!")[1].split("&");
        }
        
        let complete = splitDate(aorderd.complete_date);
        let uncomplete = splitDate(aorderd.uncomplete_date);
        
        let date_data = [];
        let date_price = 0, tot_hour = 0;
        for (let i = 0; i < full_date.length;){

            let dtime = full_date[i].split("&");
            let fulltime = [];
            
            const date_time = await DataFind(`SELECT * FROM tbl_date_time WHERE id IN (${dtime[1]})`);

            for (let b = 0; b < date_time.length;){
                date_price += parseFloat(aorderd.service_price);
                tot_hour += parseFloat(1);
                let tid = (date_time[b].id).toString();

                if (current.includes(tid)) {
                    let currtime = "";
                    for (let c = 0; c < start.length;){
                        let startid = start[c].split('&');

                        if ([startid[0]].includes(tid) === true) {
                            currtime = [startid[0]].includes(tid) === true ? startid[1] : "";
                        }
                        c++;
                    }
                    fulltime.push({ check:'5', time: date_time[b].time, start: currtime, end: "" });
                    
                } else if (complete.includes(tid)) {
                    let stimes = "", etime = "";

                    for (let d = 0; d < start.length;){
                        let startid = start[d].split('&'), endid;

                        if (end[d] != undefined) {
                            endid = end[d].split('&');
                        } else {
                            endid = [ '0' ];
                        }
                        if ([startid[0]].includes(tid) === true) {
                            stimes = [startid[0]].includes(tid) === true ? startid[1] : "";
                        }
                        if ([endid[0]].includes(tid)) {
                            etime = endid[1];
                        }
                        d++;
                    }

                    if (stimes != "" && etime != "") {
                        fulltime.push({ check:'2', time: date_time[b].time, start: stimes, end: etime });
                    } else if (stimes != "" && etime == "") {
                        fulltime.push({ check:'3', time: date_time[b].time, start: stimes, end: "" });
                    } else if (stimes == "" && etime != "") {
                        fulltime.push({ check:'4', time: date_time[b].time, start: "", end: etime });
                    } else {
                        fulltime.push({ check:'4', time: date_time[b].time, start: "", end: "" });
                    }
                } else if (uncomplete.includes(tid)) {
                    fulltime.push({ check:'1', time: date_time[b].time, start: "", end: "", img: "" });
                } else {
                    fulltime.push({ check:'0', time: date_time[b].time, start: "", end: "", img: "" });
                }
                b++;
            }
            let fulldate = {
                date : dtime[0], 
                times : fulltime
            };
            date_data.push(fulldate);

            i++;
        }

        delete aorderd.date_time;
        delete aorderd.pet;
        delete aorderd.address;
        delete aorderd.payment_type;
        delete aorderd.wallet_amount;
        delete aorderd.wallet_type;

        aorderd.online_payment = online_payment;
        aorderd.online_amount = online_amount;
        aorderd.wallet_payment = wallet_payment;
        aorderd.wallet_amount = wallet_amount;
        aorderd.date_price = date_price;
        aorderd.tot_hour = tot_hour;

        const proof_data = await DataFind(`SELECT * FROM tbl_service_proof WHERE order_id = '${aorderd.id}' ORDER BY id DESC`);
        let all_proof = [];
        if (proof_data != "") {
            let aproof = proof_data[0].proof_data.split("&!/");
            for (let b = 0; b < aproof.length;){
                let pro_date = aproof[b].split('&/');
                let pro_title = pro_date[1].split('!/');
                let pro_image = pro_title[1].split('::/');
    
                all_proof.push({ date: pro_date[0], title: pro_title[0], image: pro_image });
                b++;
            }
        }
        all_proof.reverse();

        return res.status(200).json({ message: 'Service Detail', status:true, order_detail:aorderd, Address_data:Address_data[0], pet_data, date_data, all_proof });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Notification list ================ //

router.post("/notification", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const notification = await DataFind(`SELECT noti.order_id, noti.date,
                                            sta.name as sname, sta.notifi_text as notification
                                            FROM tbl_notification as noti
                                            JOIN tbl_status_list as sta ON noti.status = sta.id
                                            WHERE s_id = '${sid}' ORDER BY noti.id DESC LIMIT 5`);

        return res.status(200).json({ message: 'Service Detail', status:true, notification });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Add Reviews ================ //

router.get("/pages", async(req, res)=>{
    try {
        const pages_data = await DataFind(`SELECT * FROM tbl_pages where status = '1'`);
        
        res.status(200).json({ message: 'Data load successful', status:true, pages_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Add Reviews ================ //

router.post("/delete_sitter", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_admin WHERE id = '${sid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Sitter Not Found!', status:false});

        const sitter = await DataFind(`SELECT id, status FROM tbl_sitter WHERE  country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}'`);
        if (sitter == "") return res.status(200).json({ message: 'Sitter Not Found!', status:false});

        if (sitter[0].status == "1") {
            
            if (await DataUpdate(`tbl_sitter`, `status = '0'`, `country_code = '${admin_data[0].country_code}' AND phone = '${admin_data[0].phone}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status:false });
            }
            return res.status(200).json({ message: 'Account Deactivate Successful', status:true });
        } else {
            return res.status(200).json({ message: 'Account Already Deactivate', status:true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Add Reviews ================ //

router.post("/reviews", async(req, res)=>{
    try {
        const {sid} = req.body;
        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const review_data = await DataFind(`SELECT sitter_id, date, review, star_no, 
                                            COALESCE(tbl_services.name, '') as service_name, 
                                            COALESCE(tbl_admin.name, '') as customer_name   
                                            FROM tbl_sitter_reviews
                                            LEFT join tbl_services on tbl_sitter_reviews.service_id = tbl_services.id
                                            LEFT join tbl_admin on tbl_sitter_reviews.customer_id = tbl_admin.id
                                            WHERE sitter_id = '${sid}'`);
        
        res.status(200).json({ message: 'Data load successful', status:true, review_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Add Story ================ //

const { addStory, storyData } = require("./story");

router.post("/add_story", story_img.single('image'), async(req, res)=>{
    try {
        const {uid, sitter_id} = req.body;

        const imageUrl = req.file ? "uploads/story/" + req.file.filename : null;
        
        await addStory(uid, sitter_id, imageUrl, req.hostname, req.protocol);

        res.status(200).json({ message: 'Story Upload successful', status:true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/story_data", async(req, res)=>{
    try {
        const {uid, lat, lon} = req.body;

        if (uid == "") return res.status(200).json({ message: 'Location Not Found!', status:false});

        let allc_story = await storyData(uid, lat, lon);

        if (allc_story != "") {
            res.status(200).json({ message: 'Story load successful', status: true, all_story: allc_story });
        } else {
            res.status(200).json({ message: 'Story Not Found!', status: false, all_story: allc_story });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/myearning", async(req, res)=>{
    try {
        const {sid} = req.body;

        if (sid == "") return res.status(200).json({ message: 'Id Not Found!', status:false});

        const order_data = await DataFind(`SELECT ord.id, ord.order_id, ord.site_commisiion as csite, ord.sitter_commission as csitter, ord.tot_price, ord.date,
                                        COALESCE(cusa.name, '') as cus_name,
                                        COALESCE(siad.name, '') as sitt_name
                                        FROM tbl_order ord
                                        LEFT join tbl_admin cusa on ord.customer_id = cusa.id
                                        LEFT join tbl_admin siad on ord.sitter_id = siad.id
                                        WHERE ord.sitter_id = "${sid}" ORDER BY ord.id DESC`);

        let csitter = 0, commission = [];
        if (order_data == "") return res.status(200).json({ message: 'Commission Not Found!', status:true, totcommission:csitter, commission});
        
        commission = order_data.map(sd => {
            csitter += parseFloat(sd.csitter);
            return sd;
        });

        let totamount =  parseFloat(csitter).toFixed(2);

        if (commission != "") {
            return res.status(200).json({ message: 'Commission load successful', status: true, totcommission:Number(totamount), commission });
        } else {
            return res.status(200).json({ message: 'Commission Not Found!', status: true, totcommission:Number(totamount), commission });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





module.exports = router;